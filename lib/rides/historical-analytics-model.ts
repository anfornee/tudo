import type { AnalyticsTimestamp } from "./analytics-model.ts";
import type {
	ProfileAggregateStatistics,
	ProfileAnalyticsCoverage,
} from "./profile-analytics-model.ts";

export const HISTORICAL_ANALYTICS_SCHEMA_VERSION = 1;
export const HISTORICAL_ANALYTICS_POLICY_VERSION = 1;

export interface HistoricalWeightedContribution {
	valueSeconds: number;
	durationSeconds: number;
	rideCount: number;
}

export interface HistoricalStatisticsContribution {
	totalRides: number;
	totalDistanceMiles: number;
	totalMovingSeconds: number;
	totalElapsedSeconds: number;
	totalElevationGainFeet: number;
	speedDistanceMiles: number;
	speedMovingSeconds: number;
	speedRideCount: number;
	measuredPower: HistoricalWeightedContribution;
	estimatedPower: HistoricalWeightedContribution;
	normalizedPower: HistoricalWeightedContribution;
	cadence: HistoricalWeightedContribution;
	heartRate: HistoricalWeightedContribution;
}

export interface HistoricalAnalyticsResult {
	schemaVersion: typeof HISTORICAL_ANALYTICS_SCHEMA_VERSION;
	policyVersion: typeof HISTORICAL_ANALYTICS_POLICY_VERSION;
	rideAnalyticsAlgorithmVersion: number;
	sourceGeneration: number;
	calculatedAt: string;
	calendarTimeZone: string;
	coverage: ProfileAnalyticsCoverage;
	monthly: Record<string, HistoricalStatisticsContribution>;
}

export interface PersistedHistoricalAnalytics extends Omit<HistoricalAnalyticsResult, "calculatedAt"> {
	calculatedAt: AnalyticsTimestamp;
}

export interface HistoricalMonthSummary {
	month: string;
	statistics: ProfileAggregateStatistics;
	isCurrentMonth: boolean;
}

export interface HistoricalAnalyticsApiResponse {
	fresh: boolean;
	sourceGeneration: number | null;
	calculatedAt: string | null;
	calendarTimeZone: string;
	coverage: ProfileAnalyticsCoverage | null;
	months: HistoricalMonthSummary[];
}

export interface HistoricalComparisonResponse {
	available: boolean;
	reason: "available" | "stale" | "no_prior_rides" | "target_unavailable" | "month_too_large";
	sourceGeneration: number | null;
	statistics: ProfileAggregateStatistics | null;
}
