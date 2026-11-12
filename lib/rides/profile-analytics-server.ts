import { randomUUID } from "node:crypto";
import {
	FieldPath,
	FieldValue,
	Timestamp,
	getFirestore,
	type DocumentData,
	type Transaction,
} from "firebase-admin/firestore";

import { adminAuth } from "@/lib/firebase-admin";
import {
	RIDE_ANALYTICS_ALGORITHM_VERSION,
	RIDE_ANALYTICS_SCHEMA_VERSION,
	type RideAnalyticsProcessingState,
	type RideAnalyticsResult,
} from "@/lib/rides/analytics-model";
import {
	HISTORICAL_ANALYTICS_POLICY_VERSION,
	HISTORICAL_ANALYTICS_SCHEMA_VERSION,
	type PersistedHistoricalAnalytics,
} from "@/lib/rides/historical-analytics-model";
import {
	accumulateProfileRide,
	createProfileAnalyticsAccumulator,
	finalizeProfileAnalytics,
	profileRebuildMayCommit,
	type ProfileAnalyticsAccumulator,
	type ProfileRideSnapshot,
} from "@/lib/rides/profile-analytics";
import {
	PROFILE_ANALYTICS_POLICY_VERSION,
	PROFILE_ANALYTICS_SCHEMA_VERSION,
	type PersistedProfileAnalytics,
} from "@/lib/rides/profile-analytics-model";

const database = getFirestore(adminAuth.app);
const PROFILE_REBUILD_LEASE_MS = 2 * 60 * 1000;
const DEFAULT_REBUILD_BATCH_SIZE = 100;

function ridesCollection(userId: string) {
	return database.collection("users").doc(userId).collection("rides");
}

function profileReference(userId: string) {
	return database.doc(`users/${userId}/profileAnalytics/ride`);
}

function rebuildReference(userId: string) {
	return database.doc(`users/${userId}/profileAnalytics/rebuild`);
}

function historyReference(userId: string) {
	return database.doc(`users/${userId}/profileAnalytics/history`);
}

function sourceRevision(data: DocumentData) {
	if (typeof data.sourceRevision === "string" && data.sourceRevision) return data.sourceRevision;
	if (typeof data.sampleFilePath === "string" && data.sampleFilePath) return data.sampleFilePath;
	return null;
}

export function markProfileAnalyticsDirty(
	transaction: Transaction,
	userId: string,
	reason: string,
) {
	transaction.set(rebuildReference(userId), {
		sourceGeneration: FieldValue.increment(1),
		state: "pending",
		lastInvalidatedReason: reason,
		updatedAt: FieldValue.serverTimestamp(),
		error: null,
	}, { merge: true });
}

export async function profileCalendarTimeZone(userId: string) {
	const snapshot = await database.doc(`users/${userId}/preferences/notifications`).get();
	const candidate = snapshot.data()?.timeZone;
	if (typeof candidate === "string") {
		try {
			new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
			return candidate;
		} catch {
			// Fall through to the deterministic default.
		}
	}
	return "UTC";
}

export function profileRideSnapshot(document: FirebaseFirestore.DocumentSnapshot): ProfileRideSnapshot {
	const data = document.data()!;
	const revision = sourceRevision(data);
	const analytics = data.analytics as Record<string, unknown> | undefined;
	const processing = data.analyticsProcessing as Record<string, unknown> | undefined;
	const processingState = typeof processing?.state === "string"
		? processing.state as RideAnalyticsProcessingState
		: null;
	const current = Boolean(
		analytics
		&& analytics.schemaVersion === RIDE_ANALYTICS_SCHEMA_VERSION
		&& analytics.algorithmVersion === RIDE_ANALYTICS_ALGORITHM_VERSION
		&& analytics.sourceRevision === revision
		&& processingState === "completed"
		&& processing?.algorithmVersion === RIDE_ANALYTICS_ALGORITHM_VERSION
		&& processing?.sourceRevision === revision
		&& analytics.sensorCoverage,
	);
	let normalizedAnalytics: RideAnalyticsResult | null = null;
	if (current && analytics) {
		const calculatedAt = analytics.calculatedAt;
		normalizedAnalytics = {
			...(analytics as unknown as RideAnalyticsResult),
			calculatedAt: calculatedAt instanceof Timestamp
				? calculatedAt.toDate().toISOString()
				: typeof calculatedAt === "string" ? calculatedAt : new Date(0).toISOString(),
		};
	}
	return {
		rideId: document.id,
		analytics: normalizedAnalytics,
		current,
		processingState,
		hasOutdatedAnalytics: Boolean(analytics && !current),
	};
}

interface RebuildClaim {
	leaseToken: string;
	targetGeneration: number;
	cursor: string | null;
	processedRides: number;
	accumulator: ProfileAnalyticsAccumulator;
	calendarTimeZone: string;
}

export type ProfileRebuildOutcome =
	| { state: "completed"; processedRides: number; sourceGeneration: number }
	| { state: "pending"; processedRides: number; sourceGeneration: number; cursor: string }
	| { state: "busy" | "stale"; processedRides: number; sourceGeneration: number };

async function claimRebuild(userId: string, calendarTimeZone: string, force: boolean): Promise<RebuildClaim | null> {
	const reference = rebuildReference(userId);
	const now = Timestamp.now();
	const leaseToken = randomUUID();
	return database.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(reference);
		const data = snapshot.data() ?? {};
		const leaseExpiresAt = data.leaseExpiresAt instanceof Timestamp ? data.leaseExpiresAt.toMillis() : 0;
		if (data.state === "processing" && leaseExpiresAt > now.toMillis()) return null;
		const sourceGeneration = typeof data.sourceGeneration === "number" ? data.sourceGeneration : 0;
		const resume = !force
			&& data.targetGeneration === sourceGeneration
			&& data.calendarTimeZone === calendarTimeZone
			&& data.profileSchemaVersion === PROFILE_ANALYTICS_SCHEMA_VERSION
			&& data.profilePolicyVersion === PROFILE_ANALYTICS_POLICY_VERSION
			&& data.rideAnalyticsAlgorithmVersion === RIDE_ANALYTICS_ALGORITHM_VERSION
			&& data.historicalSchemaVersion === HISTORICAL_ANALYTICS_SCHEMA_VERSION
			&& data.historicalPolicyVersion === HISTORICAL_ANALYTICS_POLICY_VERSION
			&& data.accumulator?.monthly;
		const claim: RebuildClaim = {
			leaseToken,
			targetGeneration: sourceGeneration,
			cursor: resume && typeof data.cursor === "string" ? data.cursor : null,
			processedRides: resume && typeof data.processedRides === "number" ? data.processedRides : 0,
			accumulator: resume ? data.accumulator as ProfileAnalyticsAccumulator : createProfileAnalyticsAccumulator(),
			calendarTimeZone,
		};
		transaction.set(reference, {
			state: "processing",
			targetGeneration: sourceGeneration,
			calendarTimeZone,
			profileSchemaVersion: PROFILE_ANALYTICS_SCHEMA_VERSION,
			profilePolicyVersion: PROFILE_ANALYTICS_POLICY_VERSION,
			historicalSchemaVersion: HISTORICAL_ANALYTICS_SCHEMA_VERSION,
			historicalPolicyVersion: HISTORICAL_ANALYTICS_POLICY_VERSION,
			rideAnalyticsAlgorithmVersion: RIDE_ANALYTICS_ALGORITHM_VERSION,
			cursor: claim.cursor,
			processedRides: claim.processedRides,
			accumulator: claim.accumulator,
			leaseToken,
			leaseExpiresAt: Timestamp.fromMillis(now.toMillis() + PROFILE_REBUILD_LEASE_MS),
			lastAttemptedAt: now,
			error: null,
		}, { merge: true });
		return claim;
	});
}

export async function runProfileAnalyticsRebuildBatch(
	userId: string,
	options: { batchSize?: number; force?: boolean } = {},
): Promise<ProfileRebuildOutcome> {
	const calendarTimeZone = await profileCalendarTimeZone(userId);
	const claim = await claimRebuild(userId, calendarTimeZone, options.force === true);
	if (!claim) {
		const state = await rebuildReference(userId).get();
		return {
			state: "busy",
			processedRides: state.data()?.processedRides ?? 0,
			sourceGeneration: state.data()?.sourceGeneration ?? 0,
		};
	}

	const batchSize = Math.min(Math.max(options.batchSize ?? DEFAULT_REBUILD_BATCH_SIZE, 1), 200);
	let query = ridesCollection(userId).orderBy(FieldPath.documentId()).limit(batchSize);
	if (claim.cursor) query = query.startAfter(claim.cursor);
	const rides = await query.get();
	for (const document of rides.docs) {
		accumulateProfileRide(claim.accumulator, profileRideSnapshot(document), claim.calendarTimeZone);
	}
	const processedRides = claim.processedRides + rides.size;
	const nextCursor = rides.size === batchSize ? rides.docs.at(-1)!.id : null;
	const now = Timestamp.now();

	return database.runTransaction(async (transaction) => {
		const rebuild = await transaction.get(rebuildReference(userId));
		const data = rebuild.data() ?? {};
		if (!profileRebuildMayCommit(
			data.sourceGeneration ?? 0,
			data.leaseToken ?? null,
			claim.targetGeneration,
			claim.leaseToken,
		)) {
			if (data.leaseToken === claim.leaseToken) {
				transaction.set(rebuildReference(userId), {
					state: "pending",
					leaseToken: null,
					leaseExpiresAt: null,
				}, { merge: true });
			}
			return { state: "stale", processedRides, sourceGeneration: data.sourceGeneration ?? 0 };
		}

		if (nextCursor) {
			transaction.set(rebuildReference(userId), {
				state: "pending",
				cursor: nextCursor,
				processedRides,
				accumulator: claim.accumulator,
				leaseToken: null,
				leaseExpiresAt: null,
			}, { merge: true });
			return { state: "pending", processedRides, sourceGeneration: claim.targetGeneration, cursor: nextCursor };
		}

		const result = finalizeProfileAnalytics(claim.accumulator, {
			sourceGeneration: claim.targetGeneration,
			calculatedAt: now.toDate(),
			calendarTimeZone: claim.calendarTimeZone,
		});
		const persisted: PersistedProfileAnalytics = { ...result, calculatedAt: now };
		const historical: PersistedHistoricalAnalytics = {
			schemaVersion: HISTORICAL_ANALYTICS_SCHEMA_VERSION,
			policyVersion: HISTORICAL_ANALYTICS_POLICY_VERSION,
			rideAnalyticsAlgorithmVersion: RIDE_ANALYTICS_ALGORITHM_VERSION,
			sourceGeneration: claim.targetGeneration,
			calculatedAt: now,
			calendarTimeZone: claim.calendarTimeZone,
			coverage: claim.accumulator.coverage,
			monthly: Object.fromEntries(
				Object.entries(claim.accumulator.monthly).sort(([left], [right]) => left.localeCompare(right)),
			),
		};
		transaction.set(profileReference(userId), persisted);
		transaction.set(historyReference(userId), historical);
		transaction.set(rebuildReference(userId), {
			state: "completed",
			targetGeneration: claim.targetGeneration,
			cursor: null,
			processedRides,
			accumulator: FieldValue.delete(),
			leaseToken: null,
			leaseExpiresAt: null,
			lastCompletedAt: now,
			error: null,
		}, { merge: true });
		return { state: "completed", processedRides, sourceGeneration: claim.targetGeneration };
	});
}

export async function runProfileAnalyticsRebuild(
	userId: string,
	options: { maximumBatches?: number; force?: boolean; batchSize?: number } = {},
) {
	const maximumBatches = Math.min(Math.max(options.maximumBatches ?? 3, 1), 10);
	let outcome: ProfileRebuildOutcome | null = null;
	for (let index = 0; index < maximumBatches; index += 1) {
		outcome = await runProfileAnalyticsRebuildBatch(userId, {
			batchSize: options.batchSize,
			force: index === 0 && options.force,
		});
		if (outcome.state !== "pending" && outcome.state !== "stale") break;
	}
	return outcome!;
}

export async function getProfileAnalytics(userId: string) {
	const [profile, rebuild, calendarTimeZone] = await Promise.all([
		profileReference(userId).get(),
		rebuildReference(userId).get(),
		profileCalendarTimeZone(userId),
	]);
	const profileData = profile.exists ? profile.data() as PersistedProfileAnalytics : null;
	const rebuildData = rebuild.data() ?? {};
	const sourceGeneration = typeof rebuildData.sourceGeneration === "number" ? rebuildData.sourceGeneration : 0;
	const fresh = Boolean(
		profileData
		&& profileData.schemaVersion === PROFILE_ANALYTICS_SCHEMA_VERSION
		&& profileData.policyVersion === PROFILE_ANALYTICS_POLICY_VERSION
		&& profileData.rideAnalyticsAlgorithmVersion === RIDE_ANALYTICS_ALGORITHM_VERSION
		&& profileData.sourceGeneration === sourceGeneration
		&& profileData.calendarTimeZone === calendarTimeZone,
	);
	return {
		profile: profileData,
		fresh,
		rebuild: {
			state: rebuildData.state ?? "pending",
			sourceGeneration,
			targetGeneration: rebuildData.targetGeneration ?? null,
			processedRides: rebuildData.processedRides ?? 0,
			lastAttemptedAt: rebuildData.lastAttemptedAt ?? null,
			lastCompletedAt: rebuildData.lastCompletedAt ?? null,
			error: rebuildData.error ?? null,
		},
	};
}
