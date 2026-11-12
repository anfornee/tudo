import type { AnalyticsTimestamp, PowerDurationCurve } from "./analytics-model.ts";

export const PROFILE_ANALYTICS_SCHEMA_VERSION = 1;
export const PROFILE_ANALYTICS_POLICY_VERSION = 1;
export const MIN_FASTEST_RIDE_DISTANCE_MILES = 5;
export const MIN_FASTEST_RIDE_MOVING_SECONDS = 15 * 60;

export interface ProfileMetricContributors {
	rideCount: number;
	durationSeconds: number;
}

export interface ProfileAggregateStatistics {
	totalRides: number;
	totalDistanceMiles: number;
	totalMovingSeconds: number;
	totalElapsedSeconds: number;
	totalElevationGainFeet: number;
	averageMovingSpeedMph: number | null;
	averageMeasuredPowerWatts: number | null;
	averageEstimatedPowerWatts: number | null;
	durationWeightedRideNormalizedPowerWatts: number | null;
	averageCadenceRpm: number | null;
	averageHeartRateBpm: number | null;
	contributors: {
		speed: ProfileMetricContributors;
		measuredPower: ProfileMetricContributors;
		estimatedPower: ProfileMetricContributors;
		normalizedPower: ProfileMetricContributors;
		cadence: ProfileMetricContributors;
		heartRate: ProfileMetricContributors;
	};
}

export interface ProfileAnalyticsCoverage {
	totalStoredRides: number;
	currentAnalyticsRides: number;
	pendingAnalyticsRides: number;
	failedOrUnavailableAnalyticsRides: number;
	outdatedAnalyticsRides: number;
	measuredPowerRides: number;
	estimatedPowerRides: number;
	cadenceRides: number;
	heartRateRides: number;
}

export type ProfileRecordUnit = "miles" | "seconds" | "feet" | "mph" | "watts";

export interface ProfilePersonalRecord {
	recordId: string;
	value: number;
	unit: ProfileRecordUnit;
	rideId: string;
	activityDate: string;
	analyticsAlgorithmVersion: number;
	sourceRevision: string;
	effortDurationSeconds: number | null;
	effortStartElapsedSeconds: number | null;
	effortEndElapsedSeconds: number | null;
	effortStartTimestampMs: number | null;
	effortEndTimestampMs: number | null;
}

export interface ProfilePersonalRecords {
	longestDistance: ProfilePersonalRecord | null;
	longestMovingDuration: ProfilePersonalRecord | null;
	greatestTotalAscent: ProfilePersonalRecord | null;
	highestRecordedSpeed: ProfilePersonalRecord | null;
	highestMeasuredPower: ProfilePersonalRecord | null;
	fastestQualifyingAverageSpeed: ProfilePersonalRecord | null;
	greatestIndividualClimb: null;
	longestIndividualClimb: null;
	powerDuration: Record<keyof PowerDurationCurve, ProfilePersonalRecord | null>;
}

export interface ProfileAnalyticsResult {
	schemaVersion: typeof PROFILE_ANALYTICS_SCHEMA_VERSION;
	policyVersion: typeof PROFILE_ANALYTICS_POLICY_VERSION;
	rideAnalyticsAlgorithmVersion: number;
	sourceGeneration: number;
	calculatedAt: string;
	calendarTimeZone: string;
	lifetime: ProfileAggregateStatistics;
	annual: Record<string, ProfileAggregateStatistics>;
	coverage: ProfileAnalyticsCoverage;
	personalRecords: ProfilePersonalRecords;
}

export interface PersistedProfileAnalytics extends Omit<ProfileAnalyticsResult, "calculatedAt"> {
	calculatedAt: AnalyticsTimestamp;
}

export type ProfileRebuildState = "pending" | "processing" | "completed" | "failed";

export interface ProfileRebuildStatus {
	state: ProfileRebuildState;
	sourceGeneration: number;
	targetGeneration: number | null;
	processedRides: number;
	cursor: string | null;
	leaseToken: string | null;
	leaseExpiresAt: AnalyticsTimestamp | null;
	lastAttemptedAt: AnalyticsTimestamp | null;
	lastCompletedAt: AnalyticsTimestamp | null;
	error: { code: string; message: string } | null;
}
