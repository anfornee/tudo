import { randomUUID } from "node:crypto";
import {
	FieldPath,
	Timestamp,
	getFirestore,
	type DocumentData,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { adminAuth } from "@/lib/firebase-admin";
import { isFirebaseEmulatorEnvironment, localFirebaseProjectId } from "@/lib/firebase-environment";
import {
	ANALYTICS_LEASE_DURATION_MS,
	analyticsIsCurrent,
	analyticsLeaseIsActive,
	analyticsWorkerMayCommit,
	rideNeedsAnalytics,
} from "@/lib/rides/analytics-lifecycle";
import {
	RIDE_ANALYTICS_ALGORITHM_VERSION,
	type PersistedRideAnalytics,
	type RideAnalyticsProcessing,
	type RidePowerProvenance,
} from "@/lib/rides/analytics-model";
import { calculateRideAnalytics } from "@/lib/rides/ride-analytics";
import { parseStoredRideSamples } from "@/lib/rides/sample-payload";
import {
	markProfileAnalyticsDirty,
	runProfileAnalyticsRebuild,
} from "@/lib/rides/profile-analytics-server";

const database = getFirestore(adminAuth.app);

function rideReference(userId: string, rideId: string) {
	return database.collection("users").doc(userId).collection("rides").doc(rideId);
}

function sourceRevision(data: DocumentData) {
	if (typeof data.sourceRevision === "string" && data.sourceRevision) return data.sourceRevision;
	if (typeof data.sampleFilePath === "string" && data.sampleFilePath) return data.sampleFilePath;
	return null;
}

function lifecycleSnapshot(data: DocumentData) {
	const processing = data.analyticsProcessing as Partial<RideAnalyticsProcessing> | undefined;
	return {
		analytics: data.analytics as { algorithmVersion?: number; sourceRevision?: string } | undefined,
		processing: processing ? {
			state: processing.state,
			algorithmVersion: processing.algorithmVersion,
			sourceRevision: processing.sourceRevision,
			leaseExpiresAtMs: processing.leaseExpiresAt?.toMillis() ?? null,
		} : null,
	};
}

function processingRecord(
	state: RideAnalyticsProcessing["state"],
	revision: string | null,
	previous: Partial<RideAnalyticsProcessing> | undefined,
	overrides: Partial<RideAnalyticsProcessing> = {},
): RideAnalyticsProcessing {
	return {
		state,
		algorithmVersion: RIDE_ANALYTICS_ALGORITHM_VERSION,
		sourceRevision: revision,
		lastAttemptedAt: previous?.lastAttemptedAt ?? null,
		lastSuccessfulAt: previous?.lastSuccessfulAt ?? null,
		leaseToken: null,
		leaseExpiresAt: null,
		error: null,
		...overrides,
	};
}

function safeNumber(value: unknown, fallback = 0) {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safePowerProvenance(value: unknown, hasPower: boolean): RidePowerProvenance {
	if (value === "measured" || value === "estimated" || value === "unavailable") return value;
	// Existing parsers only retain power reported by FIT/GPX records, so legacy
	// sample sidecars with power are measured rather than estimated.
	return hasPower ? "measured" : "unavailable";
}

async function readSamples(userId: string, rideId: string, path: string) {
	const expectedPrefix = `users/${userId}/rides/${rideId}/`;
	if (!path.startsWith(expectedPrefix)) throw new Error("Ride sample path is invalid.");
	const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
		?? (isFirebaseEmulatorEnvironment ? `${localFirebaseProjectId}.firebasestorage.app` : undefined);
	const [bytes] = await getStorage(adminAuth.app).bucket(bucketName).file(path).download();
	return parseStoredRideSamples(JSON.parse(bytes.toString("utf8"))).samples;
}

export type ProcessRideAnalyticsOutcome = "completed" | "skipped" | "busy" | "stale";

export async function processRideAnalytics(
	userId: string,
	rideId: string,
	options: { force?: boolean; now?: Date; refreshProfile?: boolean } = {},
): Promise<ProcessRideAnalyticsOutcome> {
	const reference = rideReference(userId, rideId);
	const now = options.now ?? new Date();
	const nowTimestamp = Timestamp.fromDate(now);
	const leaseToken = randomUUID();
	let claimedData: DocumentData | null = null;
	let revision: string | null = null;

	const claim = await database.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(reference);
		if (!snapshot.exists) throw new Error("Ride not found.");
		const data = snapshot.data()!;
		const nextRevision = sourceRevision(data);
		if (!nextRevision || typeof data.sampleFilePath !== "string") {
			const previous = data.analyticsProcessing as Partial<RideAnalyticsProcessing> | undefined;
			transaction.update(reference, {
				analyticsProcessing: processingRecord("failed", nextRevision, previous, {
					lastAttemptedAt: nowTimestamp,
					error: { code: "source_data_unavailable", message: "Normalized ride samples are unavailable." },
				}),
			});
			markProfileAnalyticsDirty(transaction, userId, "ride_analytics_unavailable");
			return "unavailable" as const;
		}

		const lifecycle = lifecycleSnapshot(data);
		if (!options.force && analyticsIsCurrent(lifecycle, nextRevision)) return "skipped" as const;
		if (analyticsLeaseIsActive(lifecycle, nextRevision, now.getTime())) return "busy" as const;

		const previous = data.analyticsProcessing as Partial<RideAnalyticsProcessing> | undefined;
		transaction.update(reference, {
			sourceRevision: nextRevision,
			analyticsProcessing: processingRecord("processing", nextRevision, previous, {
				lastAttemptedAt: nowTimestamp,
				leaseToken,
				leaseExpiresAt: Timestamp.fromMillis(now.getTime() + ANALYTICS_LEASE_DURATION_MS),
			}),
		});
		markProfileAnalyticsDirty(transaction, userId, "ride_analytics_processing");
		claimedData = data;
		revision = nextRevision;
		return "claimed" as const;
	});

	if (claim === "skipped" || claim === "busy") return claim;
	if (claim === "unavailable") {
		if (options.refreshProfile !== false) {
			try {
				await runProfileAnalyticsRebuild(userId);
			} catch (profileError) {
				console.error("Unavailable ride analytics could not refresh profile coverage", {
					userId,
					rideId,
					error: profileError,
				});
			}
		}
		throw new Error("Normalized ride samples are unavailable.");
	}

	try {
		const data = claimedData!;
		const samples = await readSamples(userId, rideId, data.sampleFilePath as string);
		const hasPower = samples.some((sample) => typeof sample.power === "number" && Number.isFinite(sample.power));
		const calculated = calculateRideAnalytics({
			rideId,
			sourceRevision: revision!,
			calculatedAt: now,
			activityDate: data.activityDate instanceof Timestamp ? data.activityDate.toDate() : null,
			distanceMiles: safeNumber(data.distanceMiles),
			elapsedDurationSeconds: safeNumber(data.durationSeconds),
			movingDurationSeconds: safeNumber(data.movingTimeSeconds),
			elevationGainFeet: safeNumber(data.elevationGainFeet),
			powerProvenance: safePowerProvenance(data.powerProvenance, hasPower),
			samples,
		});
		const analytics: PersistedRideAnalytics = {
			...calculated,
			calculatedAt: nowTimestamp,
		};

		const outcome = await database.runTransaction(async (transaction) => {
			const latest = await transaction.get(reference);
			if (!latest.exists) return "stale" as const;
			const latestData = latest.data()!;
			const processing = latestData.analyticsProcessing as Partial<RideAnalyticsProcessing> | undefined;
			if (!analyticsWorkerMayCommit(sourceRevision(latestData), processing, revision!, leaseToken)) {
				return "stale" as const;
			}
			transaction.update(reference, {
				analytics,
				analyticsProcessing: processingRecord("completed", revision, processing, {
					lastAttemptedAt: nowTimestamp,
					lastSuccessfulAt: nowTimestamp,
				}),
			});
			markProfileAnalyticsDirty(transaction, userId, "ride_analytics_completed");
			return "completed" as const;
		});
		if (outcome === "completed" && options.refreshProfile !== false) {
			try {
				await runProfileAnalyticsRebuild(userId);
			} catch (profileError) {
				console.error("Ride analytics completed but profile aggregation failed", {
					userId,
					rideId,
					error: profileError,
				});
			}
		}
		return outcome;
	} catch (error) {
		await database.runTransaction(async (transaction) => {
			const latest = await transaction.get(reference);
			if (!latest.exists) return;
			const latestData = latest.data()!;
			const processing = latestData.analyticsProcessing as Partial<RideAnalyticsProcessing> | undefined;
			if (!analyticsWorkerMayCommit(sourceRevision(latestData), processing, revision!, leaseToken)) return;
			transaction.update(reference, {
				analyticsProcessing: processingRecord("failed", revision, processing, {
					lastAttemptedAt: nowTimestamp,
					error: { code: "calculation_failed", message: "Ride analytics could not be calculated." },
				}),
			});
		});
		if (options.refreshProfile !== false) {
			try {
				await runProfileAnalyticsRebuild(userId);
			} catch (profileError) {
				console.error("Failed ride analytics could not refresh profile coverage", {
					userId,
					rideId,
					error: profileError,
				});
			}
		}
		throw error;
	}
}

export interface AnalyticsBackfillPage {
	rideIds: string[];
	nextCursor: string | null;
	scannedRides: number;
}

export async function findRidesNeedingAnalytics(
	userId: string,
	options: { cursor?: string; scanLimit?: number; force?: boolean; now?: Date } = {},
): Promise<AnalyticsBackfillPage> {
	const scanLimit = Math.min(Math.max(options.scanLimit ?? 50, 1), 200);
	let query = rideReference(userId, "placeholder").parent
		.orderBy(FieldPath.documentId())
		.limit(scanLimit);
	if (options.cursor) query = query.startAfter(options.cursor);
	const snapshot = await query.get();
	const nowMs = (options.now ?? new Date()).getTime();
	const rideIds = snapshot.docs.filter((document) => {
		const data = document.data();
		const revision = sourceRevision(data);
		if (!revision) return true;
		return options.force || rideNeedsAnalytics(lifecycleSnapshot(data), revision, nowMs);
	}).map((document) => document.id);
	return {
		rideIds,
		nextCursor: snapshot.size === scanLimit ? snapshot.docs.at(-1)!.id : null,
		scannedRides: snapshot.size,
	};
}

export async function processRideAnalyticsBatch(userId: string, rideIds: readonly string[], force = false) {
	const results = [];
	for (const rideId of rideIds) {
		try {
			results.push({
				rideId,
				outcome: await processRideAnalytics(userId, rideId, { force, refreshProfile: false }),
			});
		} catch {
			results.push({ rideId, outcome: "failed" as const });
		}
	}
	return results;
}
