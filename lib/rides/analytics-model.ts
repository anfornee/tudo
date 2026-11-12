import type { RidePowerProvenance } from "../ride.types.ts";

export const RIDE_ANALYTICS_SCHEMA_VERSION = 1;
export const RIDE_ANALYTICS_ALGORITHM_VERSION = 2;

export const POWER_DURATION_SECONDS = [
	5, 15, 30, 60, 120, 180, 300, 480, 600, 900, 1200, 1800, 2700, 3600,
] as const;

export type PowerDurationSeconds = (typeof POWER_DURATION_SECONDS)[number];
export type { RidePowerProvenance } from "../ride.types.ts";
export type RideAnalyticsProcessingState = "pending" | "processing" | "completed" | "failed";

export interface AnalyticsTimestamp {
	toDate(): Date;
	toMillis(): number;
}

export interface PowerDurationEffort {
	durationSeconds: PowerDurationSeconds;
	averageWatts: number;
	startElapsedSeconds: number;
	endElapsedSeconds: number;
	startTimestampMs: number | null;
	endTimestampMs: number | null;
}

export type PowerDurationCurve = Record<string, PowerDurationEffort | null>;

export interface RideSensorCoverage {
	sampleCount: number;
	validDurationSeconds: number;
	valueSeconds: number;
}

export interface RideAnalyticsResult {
	schemaVersion: typeof RIDE_ANALYTICS_SCHEMA_VERSION;
	algorithmVersion: typeof RIDE_ANALYTICS_ALGORITHM_VERSION;
	rideId: string;
	sourceRevision: string;
	calculatedAt: string;
	activityDate: string | null;
	activity: {
		distanceMiles: number;
		elapsedDurationSeconds: number;
		movingDurationSeconds: number;
		elevationGainFeet: number;
	};
	speed: {
		averageMovingMph: number | null;
		maxRecordedMph: number | null;
	};
	power: {
		provenance: RidePowerProvenance;
		averageWatts: number | null;
		maxWatts: number | null;
		normalizedWatts: number | null;
	};
	cadence: {
		averageRpm: number | null;
		maxRpm: number | null;
	};
	heartRate: {
		averageBpm: number | null;
		maxBpm: number | null;
	};
	climbing: {
		largestClimbFeet: null;
		longestClimbDistanceMiles: null;
	};
	powerDuration: PowerDurationCurve;
	availability: {
		speed: boolean;
		power: boolean;
		cadence: boolean;
		heartRate: boolean;
		elevation: boolean;
	};
	sensorCoverage: {
		power: RideSensorCoverage;
		cadence: RideSensorCoverage;
		heartRate: RideSensorCoverage;
		speedSampleCount: number;
	};
}

export interface RideAnalyticsProcessing {
	state: RideAnalyticsProcessingState;
	algorithmVersion: number;
	sourceRevision: string | null;
	lastAttemptedAt: AnalyticsTimestamp | null;
	lastSuccessfulAt: AnalyticsTimestamp | null;
	leaseToken: string | null;
	leaseExpiresAt: AnalyticsTimestamp | null;
	error: {
		code: string;
		message: string;
	} | null;
}

export interface PersistedRideAnalytics extends Omit<RideAnalyticsResult, "calculatedAt"> {
	calculatedAt: AnalyticsTimestamp;
}
