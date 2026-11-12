import { RIDE_ANALYTICS_ALGORITHM_VERSION } from "./analytics-model.ts";

export const ANALYTICS_LEASE_DURATION_MS = 5 * 60 * 1000;

export interface AnalyticsLifecycleSnapshot {
	analytics?: { algorithmVersion?: number; sourceRevision?: string } | null;
	processing?: {
		state?: string;
		algorithmVersion?: number;
		sourceRevision?: string | null;
		leaseExpiresAtMs?: number | null;
	} | null;
}

export function analyticsIsCurrent(snapshot: AnalyticsLifecycleSnapshot, sourceRevision: string) {
	return snapshot.analytics?.algorithmVersion === RIDE_ANALYTICS_ALGORITHM_VERSION
		&& snapshot.analytics.sourceRevision === sourceRevision;
}

export function analyticsLeaseIsActive(
	snapshot: AnalyticsLifecycleSnapshot,
	sourceRevision: string,
	nowMs: number,
) {
	return snapshot.processing?.state === "processing"
		&& snapshot.processing.algorithmVersion === RIDE_ANALYTICS_ALGORITHM_VERSION
		&& snapshot.processing.sourceRevision === sourceRevision
		&& (snapshot.processing.leaseExpiresAtMs ?? 0) > nowMs;
}

export function rideNeedsAnalytics(
	snapshot: AnalyticsLifecycleSnapshot,
	sourceRevision: string,
	nowMs: number,
) {
	return !analyticsIsCurrent(snapshot, sourceRevision)
		&& !analyticsLeaseIsActive(snapshot, sourceRevision, nowMs);
}

export function analyticsWorkerMayCommit(
	currentSourceRevision: string | null,
	processing: { leaseToken?: string | null; sourceRevision?: string | null } | null | undefined,
	expectedSourceRevision: string,
	expectedLeaseToken: string,
) {
	return currentSourceRevision === expectedSourceRevision
		&& processing?.sourceRevision === expectedSourceRevision
		&& processing.leaseToken === expectedLeaseToken;
}
