export const ANALYTICS_RESYNC_SCHEMA_VERSION = 1;

export type AnalyticsResyncMode = "update" | "recalculate";
export type AnalyticsResyncPhase = "checking" | "ride_analytics" | "profile_analytics";
export type AnalyticsResyncState = "pending" | "processing" | "completed" | "failed";

export interface AnalyticsResyncStatus {
	schemaVersion: typeof ANALYTICS_RESYNC_SCHEMA_VERSION;
	operationId: string;
	mode: AnalyticsResyncMode;
	state: AnalyticsResyncState;
	phase: AnalyticsResyncPhase;
	scannedRides: number;
	selectedRides: number;
	processedRides: number;
	failedRides: number;
	profileRides: number;
	startedAt: string;
	updatedAt: string;
	completedAt: string | null;
	error: { code: string; message: string } | null;
	retryAfterMs?: number;
}

export function analyticsResyncIsActive(status: AnalyticsResyncStatus | null) {
	return status?.state === "pending" || status?.state === "processing";
}

export function analyticsResyncShouldStartNew(state: AnalyticsResyncState | null | undefined) {
	return state !== "pending" && state !== "processing";
}

export function analyticsResyncLabel(status: AnalyticsResyncStatus) {
	if (status.state === "failed") return "Analytics update failed";
	if (status.state === "completed") {
		return status.failedRides > 0
			? `Completed with ${status.failedRides} ${status.failedRides === 1 ? "ride" : "rides"} still unavailable`
			: "Analytics update completed";
	}
	if (status.phase === "profile_analytics") {
		return status.profileRides > 0
			? `Rebuilding profile stats · ${status.profileRides} rides checked`
			: "Rebuilding profile stats";
	}
	if (status.phase === "ride_analytics") {
		return status.processedRides > 0
			? `Processing ride analytics · ${status.processedRides} processed`
			: "Processing ride analytics";
	}
	return "Checking rides";
}
