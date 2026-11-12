import { randomUUID } from "node:crypto";
import {
	Timestamp,
	getFirestore,
	type DocumentData,
} from "firebase-admin/firestore";

import { adminAuth } from "@/lib/firebase-admin";
import {
	findRidesNeedingAnalytics,
	processRideAnalyticsBatch,
} from "@/lib/rides/analytics-server";
import {
	ANALYTICS_RESYNC_SCHEMA_VERSION,
	analyticsResyncShouldStartNew,
	type AnalyticsResyncMode,
	type AnalyticsResyncStatus,
} from "@/lib/rides/analytics-resync-model";
import { runProfileAnalyticsRebuildBatch } from "@/lib/rides/profile-analytics-server";

const database = getFirestore(adminAuth.app);
const RESYNC_LEASE_MS = 2 * 60 * 1000;
const RIDE_SCAN_BATCH_SIZE = 5;

function resyncReference(userId: string) {
	return database.doc(`users/${userId}/profileAnalytics/resync`);
}

function timestampIso(value: unknown) {
	return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export function serializeAnalyticsResyncStatus(data: DocumentData | null): AnalyticsResyncStatus | null {
	if (!data || typeof data.operationId !== "string") return null;
	return {
		schemaVersion: ANALYTICS_RESYNC_SCHEMA_VERSION,
		operationId: data.operationId,
		mode: data.mode === "recalculate" ? "recalculate" : "update",
		state: data.state === "processing" || data.state === "completed" || data.state === "failed"
			? data.state
			: "pending",
		phase: data.phase === "ride_analytics" || data.phase === "profile_analytics"
			? data.phase
			: "checking",
		scannedRides: typeof data.scannedRides === "number" ? data.scannedRides : 0,
		selectedRides: typeof data.selectedRides === "number" ? data.selectedRides : 0,
		processedRides: typeof data.processedRides === "number" ? data.processedRides : 0,
		failedRides: typeof data.failedRides === "number" ? data.failedRides : 0,
		profileRides: typeof data.profileRides === "number" ? data.profileRides : 0,
		startedAt: timestampIso(data.startedAt) ?? new Date(0).toISOString(),
		updatedAt: timestampIso(data.updatedAt) ?? new Date(0).toISOString(),
		completedAt: timestampIso(data.completedAt),
		error: data.error && typeof data.error === "object"
			? {
				code: typeof data.error.code === "string" ? data.error.code : "resync_failed",
				message: typeof data.error.message === "string"
					? data.error.message
					: "Analytics could not be updated.",
			}
			: null,
		...(typeof data.retryAfterMs === "number" && data.retryAfterMs > 0
			? { retryAfterMs: data.retryAfterMs }
			: {}),
	};
}

export async function getAnalyticsResyncStatus(userId: string) {
	const snapshot = await resyncReference(userId).get();
	return serializeAnalyticsResyncStatus(snapshot.exists ? snapshot.data()! : null);
}

async function ensureOperation(userId: string, mode: AnalyticsResyncMode | undefined) {
	if (!mode) return;
	const reference = resyncReference(userId);
	await database.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(reference);
		const existing = snapshot.data();
		if (!analyticsResyncShouldStartNew(existing?.state)) return;
		const now = Timestamp.now();
		transaction.set(reference, {
			schemaVersion: ANALYTICS_RESYNC_SCHEMA_VERSION,
			operationId: randomUUID(),
			mode,
			state: "pending",
			phase: "checking",
			cursor: null,
			scannedRides: 0,
			selectedRides: 0,
			processedRides: 0,
			failedRides: 0,
			profileRides: 0,
			startedAt: now,
			updatedAt: now,
			completedAt: null,
			retryAfterMs: null,
			leaseToken: null,
			leaseExpiresAt: null,
			error: null,
		});
	});
}

interface ResyncClaim {
	operationId: string;
	leaseToken: string;
	mode: AnalyticsResyncMode;
	phase: "ride_analytics" | "profile_analytics";
	cursor: string | null;
}

async function claimStep(userId: string): Promise<ResyncClaim | AnalyticsResyncStatus | null> {
	const reference = resyncReference(userId);
	const leaseToken = randomUUID();
	const now = Timestamp.now();
	return database.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(reference);
		if (!snapshot.exists) return null;
		const data = snapshot.data()!;
		const serialized = serializeAnalyticsResyncStatus(data)!;
		if (data.state === "completed" || data.state === "failed") return serialized;
		const leaseExpiresAt = data.leaseExpiresAt instanceof Timestamp
			? data.leaseExpiresAt.toMillis()
			: 0;
		if (data.state === "processing" && leaseExpiresAt > now.toMillis()) {
			return { ...serialized, retryAfterMs: Math.min(5_000, leaseExpiresAt - now.toMillis()) };
		}
		const phase = data.phase === "profile_analytics" ? "profile_analytics" : "ride_analytics";
		transaction.update(reference, {
			state: "processing",
			phase,
			leaseToken,
			leaseExpiresAt: Timestamp.fromMillis(now.toMillis() + RESYNC_LEASE_MS),
			updatedAt: now,
			error: null,
			retryAfterMs: null,
		});
		return {
			operationId: data.operationId as string,
			leaseToken,
			mode: data.mode === "recalculate" ? "recalculate" : "update",
			phase,
			cursor: typeof data.cursor === "string" ? data.cursor : null,
		};
	});
}

async function commitRideStep(
	userId: string,
	claim: ResyncClaim,
	page: Awaited<ReturnType<typeof findRidesNeedingAnalytics>>,
	results: Awaited<ReturnType<typeof processRideAnalyticsBatch>>,
) {
	const reference = resyncReference(userId);
	await database.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(reference);
		const data = snapshot.data();
		if (data?.operationId !== claim.operationId || data.leaseToken !== claim.leaseToken) return;
		const failed = results.filter((result) => result.outcome === "failed").length;
		transaction.update(reference, {
			state: "pending",
			phase: page.nextCursor ? "ride_analytics" : "profile_analytics",
			cursor: page.nextCursor,
			scannedRides: (data.scannedRides ?? 0) + page.scannedRides,
			selectedRides: (data.selectedRides ?? 0) + page.rideIds.length,
			processedRides: (data.processedRides ?? 0) + results.length,
			failedRides: (data.failedRides ?? 0) + failed,
			leaseToken: null,
			leaseExpiresAt: null,
			updatedAt: Timestamp.now(),
			retryAfterMs: null,
		});
	});
}

async function commitProfileStep(
	userId: string,
	claim: ResyncClaim,
	outcome: Awaited<ReturnType<typeof runProfileAnalyticsRebuildBatch>>,
) {
	const reference = resyncReference(userId);
	await database.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(reference);
		const data = snapshot.data();
		if (data?.operationId !== claim.operationId || data.leaseToken !== claim.leaseToken) return;
		const completed = outcome.state === "completed";
		const now = Timestamp.now();
		transaction.update(reference, {
			state: completed ? "completed" : "pending",
			phase: "profile_analytics",
			profileRides: outcome.processedRides,
			leaseToken: null,
			leaseExpiresAt: null,
			updatedAt: now,
			completedAt: completed ? now : null,
			retryAfterMs: outcome.state === "busy" ? 2_000 : null,
		});
	});
}

async function failStep(userId: string, claim: ResyncClaim) {
	const reference = resyncReference(userId);
	await database.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(reference);
		const data = snapshot.data();
		if (data?.operationId !== claim.operationId || data.leaseToken !== claim.leaseToken) return;
		transaction.update(reference, {
			state: "failed",
			leaseToken: null,
			leaseExpiresAt: null,
			updatedAt: Timestamp.now(),
			error: { code: "resync_failed", message: "Analytics could not be updated. Retry when ready." },
		});
	});
}

export async function runAnalyticsResyncStep(
	userId: string,
	options: { startMode?: AnalyticsResyncMode } = {},
) {
	await ensureOperation(userId, options.startMode);
	const claim = await claimStep(userId);
	if (!claim || "state" in claim) return claim;
	try {
		if (claim.phase === "ride_analytics") {
			const page = await findRidesNeedingAnalytics(userId, {
				cursor: claim.cursor ?? undefined,
				scanLimit: RIDE_SCAN_BATCH_SIZE,
				force: claim.mode === "recalculate",
			});
			const results = await processRideAnalyticsBatch(
				userId,
				page.rideIds,
				claim.mode === "recalculate",
			);
			await commitRideStep(userId, claim, page, results);
		} else {
			const outcome = await runProfileAnalyticsRebuildBatch(userId);
			await commitProfileStep(userId, claim, outcome);
		}
	} catch (error) {
		await failStep(userId, claim);
		throw error;
	}
	return await getAnalyticsResyncStatus(userId);
}
