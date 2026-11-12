import {
	POWER_DURATION_SECONDS,
	RIDE_ANALYTICS_ALGORITHM_VERSION,
	type RideAnalyticsResult,
	type RideAnalyticsProcessingState,
} from "./analytics-model.ts";
import {
	MIN_FASTEST_RIDE_DISTANCE_MILES,
	MIN_FASTEST_RIDE_MOVING_SECONDS,
	PROFILE_ANALYTICS_POLICY_VERSION,
	PROFILE_ANALYTICS_SCHEMA_VERSION,
	type ProfileAggregateStatistics,
	type ProfileAnalyticsCoverage,
	type ProfileAnalyticsResult,
	type ProfilePersonalRecord,
	type ProfilePersonalRecords,
	type ProfileRecordUnit,
} from "./profile-analytics-model.ts";
import type {
	HistoricalStatisticsContribution,
	HistoricalWeightedContribution,
} from "./historical-analytics-model.ts";

type WeightedAccumulator = HistoricalWeightedContribution;

export type ProfileStatisticsAccumulator = HistoricalStatisticsContribution;

export interface ProfileAnalyticsAccumulator {
	lifetime: ProfileStatisticsAccumulator;
	annual: Record<string, ProfileStatisticsAccumulator>;
	monthly: Record<string, ProfileStatisticsAccumulator>;
	coverage: ProfileAnalyticsCoverage;
	personalRecords: ProfilePersonalRecords;
}

export interface ProfileRideSnapshot {
	rideId: string;
	analytics: RideAnalyticsResult | null;
	current: boolean;
	processingState: RideAnalyticsProcessingState | null;
	hasOutdatedAnalytics: boolean;
}

export function profileRebuildMayCommit(
	currentGeneration: number,
	currentLeaseToken: string | null,
	targetGeneration: number,
	expectedLeaseToken: string,
) {
	return currentGeneration === targetGeneration && currentLeaseToken === expectedLeaseToken;
}

export function createStatisticsAccumulator(): ProfileStatisticsAccumulator {
	const weighted = (): WeightedAccumulator => ({ valueSeconds: 0, durationSeconds: 0, rideCount: 0 });
	return {
		totalRides: 0,
		totalDistanceMiles: 0,
		totalMovingSeconds: 0,
		totalElapsedSeconds: 0,
		totalElevationGainFeet: 0,
		speedDistanceMiles: 0,
		speedMovingSeconds: 0,
		speedRideCount: 0,
		measuredPower: weighted(),
		estimatedPower: weighted(),
		normalizedPower: weighted(),
		cadence: weighted(),
		heartRate: weighted(),
	};
}

function emptyRecords(): ProfilePersonalRecords {
	return {
		longestDistance: null,
		longestMovingDuration: null,
		greatestTotalAscent: null,
		highestRecordedSpeed: null,
		highestMeasuredPower: null,
		fastestQualifyingAverageSpeed: null,
		greatestIndividualClimb: null,
		longestIndividualClimb: null,
		powerDuration: Object.fromEntries(POWER_DURATION_SECONDS.map((duration) => [String(duration), null])),
	};
}

export function createProfileAnalyticsAccumulator(): ProfileAnalyticsAccumulator {
	return {
		lifetime: createStatisticsAccumulator(),
		annual: {},
		monthly: {},
		coverage: {
			totalStoredRides: 0,
			currentAnalyticsRides: 0,
			pendingAnalyticsRides: 0,
			failedOrUnavailableAnalyticsRides: 0,
			outdatedAnalyticsRides: 0,
			measuredPowerRides: 0,
			estimatedPowerRides: 0,
			cadenceRides: 0,
			heartRateRides: 0,
		},
		personalRecords: emptyRecords(),
	};
}

function finiteNonNegative(value: number) {
	return Number.isFinite(value) && value >= 0;
}

function addWeighted(target: WeightedAccumulator, valueSeconds: number, durationSeconds: number) {
	if (!Number.isFinite(valueSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
	target.valueSeconds += valueSeconds;
	target.durationSeconds += durationSeconds;
	target.rideCount += 1;
}

export function addStatistics(target: ProfileStatisticsAccumulator, analytics: RideAnalyticsResult) {
	const { activity, sensorCoverage } = analytics;
	target.totalRides += 1;
	if (finiteNonNegative(activity.distanceMiles)) target.totalDistanceMiles += activity.distanceMiles;
	if (finiteNonNegative(activity.movingDurationSeconds)) target.totalMovingSeconds += activity.movingDurationSeconds;
	if (finiteNonNegative(activity.elapsedDurationSeconds)) target.totalElapsedSeconds += activity.elapsedDurationSeconds;
	if (finiteNonNegative(activity.elevationGainFeet)) target.totalElevationGainFeet += activity.elevationGainFeet;
	if (activity.distanceMiles >= 0 && activity.movingDurationSeconds > 0) {
		target.speedDistanceMiles += activity.distanceMiles;
		target.speedMovingSeconds += activity.movingDurationSeconds;
		target.speedRideCount += 1;
	}

	const powerCoverage = sensorCoverage.power;
	if (analytics.power.provenance === "measured") {
		addWeighted(target.measuredPower, powerCoverage.valueSeconds, powerCoverage.validDurationSeconds);
		if (analytics.power.normalizedWatts !== null) {
			addWeighted(
				target.normalizedPower,
				analytics.power.normalizedWatts * powerCoverage.validDurationSeconds,
				powerCoverage.validDurationSeconds,
			);
		}
	} else if (analytics.power.provenance === "estimated") {
		addWeighted(target.estimatedPower, powerCoverage.valueSeconds, powerCoverage.validDurationSeconds);
	}
	addWeighted(target.cadence, sensorCoverage.cadence.valueSeconds, sensorCoverage.cadence.validDurationSeconds);
	addWeighted(target.heartRate, sensorCoverage.heartRate.valueSeconds, sensorCoverage.heartRate.validDurationSeconds);
}

export function calendarYearForDate(activityDate: string, timeZone: string) {
	const date = new Date(activityDate);
	if (!Number.isFinite(date.getTime())) return null;
	try {
		const year = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" })
			.formatToParts(date)
			.find((part) => part.type === "year")?.value;
		return year && /^\d{4}$/.test(year) ? year : null;
	} catch {
		return null;
	}
}

export function calendarMonthForDate(activityDate: string, timeZone: string) {
	const date = new Date(activityDate);
	if (!Number.isFinite(date.getTime())) return null;
	try {
		const parts = new Intl.DateTimeFormat("en-US", {
			timeZone,
			year: "numeric",
			month: "2-digit",
		}).formatToParts(date);
		const year = parts.find((part) => part.type === "year")?.value;
		const month = parts.find((part) => part.type === "month")?.value;
		return year && month && /^\d{4}$/.test(year) && /^\d{2}$/.test(month)
			? `${year}-${month}`
			: null;
	} catch {
		return null;
	}
}

function record(
	analytics: RideAnalyticsResult,
	rideId: string,
	recordId: string,
	value: number | null,
	unit: ProfileRecordUnit,
	effort: {
		durationSeconds?: number;
		startElapsedSeconds?: number;
		endElapsedSeconds?: number;
		startTimestampMs?: number | null;
		endTimestampMs?: number | null;
	} = {},
): ProfilePersonalRecord | null {
	if (value === null || !Number.isFinite(value) || analytics.activityDate === null) return null;
	return {
		recordId,
		value,
		unit,
		rideId,
		activityDate: analytics.activityDate,
		analyticsAlgorithmVersion: analytics.algorithmVersion,
		sourceRevision: analytics.sourceRevision,
		effortDurationSeconds: effort.durationSeconds ?? null,
		effortStartElapsedSeconds: effort.startElapsedSeconds ?? null,
		effortEndElapsedSeconds: effort.endElapsedSeconds ?? null,
		effortStartTimestampMs: effort.startTimestampMs ?? null,
		effortEndTimestampMs: effort.endTimestampMs ?? null,
	};
}

export function recordIsBetter(candidate: ProfilePersonalRecord, current: ProfilePersonalRecord | null) {
	if (!current) return true;
	if (candidate.value !== current.value) return candidate.value > current.value;
	if (candidate.activityDate !== current.activityDate) return candidate.activityDate < current.activityDate;
	return candidate.rideId < current.rideId;
}

function consider(
	records: ProfilePersonalRecords,
	key: Exclude<keyof ProfilePersonalRecords, "powerDuration" | "greatestIndividualClimb" | "longestIndividualClimb">,
	candidate: ProfilePersonalRecord | null,
) {
	if (candidate && recordIsBetter(candidate, records[key])) records[key] = candidate;
}

function addRecords(records: ProfilePersonalRecords, ride: ProfileRideSnapshot, analytics: RideAnalyticsResult) {
	const activity = analytics.activity;
	consider(records, "longestDistance", record(analytics, ride.rideId, "longest_distance", activity.distanceMiles, "miles"));
	consider(records, "longestMovingDuration", record(analytics, ride.rideId, "longest_moving_duration", activity.movingDurationSeconds, "seconds"));
	consider(records, "greatestTotalAscent", record(analytics, ride.rideId, "greatest_total_ascent", activity.elevationGainFeet, "feet"));
	consider(records, "highestRecordedSpeed", record(analytics, ride.rideId, "highest_recorded_speed", analytics.speed.maxRecordedMph, "mph"));
	if (analytics.power.provenance === "measured") {
		consider(records, "highestMeasuredPower", record(analytics, ride.rideId, "highest_measured_power", analytics.power.maxWatts, "watts"));
	}
	if (
		activity.distanceMiles >= MIN_FASTEST_RIDE_DISTANCE_MILES
		&& activity.movingDurationSeconds >= MIN_FASTEST_RIDE_MOVING_SECONDS
	) {
		consider(records, "fastestQualifyingAverageSpeed", record(
			analytics,
			ride.rideId,
			"fastest_qualifying_average_speed",
			analytics.speed.averageMovingMph,
			"mph",
		));
	}

	if (analytics.power.provenance !== "measured") return;
	for (const duration of POWER_DURATION_SECONDS) {
		const effort = analytics.powerDuration[String(duration)];
		if (!effort) continue;
		const candidate = record(analytics, ride.rideId, `power_${duration}_seconds`, effort.averageWatts, "watts", {
			durationSeconds: duration,
			startElapsedSeconds: effort.startElapsedSeconds,
			endElapsedSeconds: effort.endElapsedSeconds,
			startTimestampMs: effort.startTimestampMs,
			endTimestampMs: effort.endTimestampMs,
		});
		if (candidate && recordIsBetter(candidate, records.powerDuration[String(duration)])) {
			records.powerDuration[String(duration)] = candidate;
		}
	}
}

export function accumulateProfileRide(
	accumulator: ProfileAnalyticsAccumulator,
	ride: ProfileRideSnapshot,
	calendarTimeZone: string,
) {
	accumulator.coverage.totalStoredRides += 1;
	if (!ride.current || !ride.analytics) {
		if (ride.processingState === "failed") accumulator.coverage.failedOrUnavailableAnalyticsRides += 1;
		else accumulator.coverage.pendingAnalyticsRides += 1;
		if (ride.hasOutdatedAnalytics) accumulator.coverage.outdatedAnalyticsRides += 1;
		return accumulator;
	}

	const analytics = ride.analytics;
	accumulator.coverage.currentAnalyticsRides += 1;
	if (analytics.power.provenance === "measured") accumulator.coverage.measuredPowerRides += 1;
	if (analytics.power.provenance === "estimated") accumulator.coverage.estimatedPowerRides += 1;
	if (analytics.availability.cadence) accumulator.coverage.cadenceRides += 1;
	if (analytics.availability.heartRate) accumulator.coverage.heartRateRides += 1;
	addStatistics(accumulator.lifetime, analytics);
	if (analytics.activityDate) {
		const year = calendarYearForDate(analytics.activityDate, calendarTimeZone);
		if (year) {
			accumulator.annual[year] ??= createStatisticsAccumulator();
			addStatistics(accumulator.annual[year], analytics);
		}
		const month = calendarMonthForDate(analytics.activityDate, calendarTimeZone);
		if (month) {
			accumulator.monthly[month] ??= createStatisticsAccumulator();
			addStatistics(accumulator.monthly[month], analytics);
		}
	}
	addRecords(accumulator.personalRecords, ride, analytics);
	return accumulator;
}

function divide(value: number, denominator: number) {
	return denominator > 0 && Number.isFinite(value) && Number.isFinite(denominator)
		? value / denominator
		: null;
}

export function finalizeStatistics(value: ProfileStatisticsAccumulator): ProfileAggregateStatistics {
	return {
		totalRides: value.totalRides,
		totalDistanceMiles: value.totalDistanceMiles,
		totalMovingSeconds: value.totalMovingSeconds,
		totalElapsedSeconds: value.totalElapsedSeconds,
		totalElevationGainFeet: value.totalElevationGainFeet,
		averageMovingSpeedMph: value.speedMovingSeconds > 0
			? value.speedDistanceMiles / (value.speedMovingSeconds / 3600)
			: null,
		averageMeasuredPowerWatts: divide(value.measuredPower.valueSeconds, value.measuredPower.durationSeconds),
		averageEstimatedPowerWatts: divide(value.estimatedPower.valueSeconds, value.estimatedPower.durationSeconds),
		durationWeightedRideNormalizedPowerWatts: divide(value.normalizedPower.valueSeconds, value.normalizedPower.durationSeconds),
		averageCadenceRpm: divide(value.cadence.valueSeconds, value.cadence.durationSeconds),
		averageHeartRateBpm: divide(value.heartRate.valueSeconds, value.heartRate.durationSeconds),
		contributors: {
			speed: { rideCount: value.speedRideCount, durationSeconds: value.speedMovingSeconds },
			measuredPower: { rideCount: value.measuredPower.rideCount, durationSeconds: value.measuredPower.durationSeconds },
			estimatedPower: { rideCount: value.estimatedPower.rideCount, durationSeconds: value.estimatedPower.durationSeconds },
			normalizedPower: { rideCount: value.normalizedPower.rideCount, durationSeconds: value.normalizedPower.durationSeconds },
			cadence: { rideCount: value.cadence.rideCount, durationSeconds: value.cadence.durationSeconds },
			heartRate: { rideCount: value.heartRate.rideCount, durationSeconds: value.heartRate.durationSeconds },
		},
	};
}

export function mergeStatisticsAccumulator(
	target: ProfileStatisticsAccumulator,
	source: ProfileStatisticsAccumulator,
) {
	target.totalRides += source.totalRides;
	target.totalDistanceMiles += source.totalDistanceMiles;
	target.totalMovingSeconds += source.totalMovingSeconds;
	target.totalElapsedSeconds += source.totalElapsedSeconds;
	target.totalElevationGainFeet += source.totalElevationGainFeet;
	target.speedDistanceMiles += source.speedDistanceMiles;
	target.speedMovingSeconds += source.speedMovingSeconds;
	target.speedRideCount += source.speedRideCount;
	for (const key of ["measuredPower", "estimatedPower", "normalizedPower", "cadence", "heartRate"] as const) {
		target[key].valueSeconds += source[key].valueSeconds;
		target[key].durationSeconds += source[key].durationSeconds;
		target[key].rideCount += source[key].rideCount;
	}
	return target;
}

export function finalizeProfileAnalytics(
	accumulator: ProfileAnalyticsAccumulator,
	options: { sourceGeneration: number; calculatedAt: Date; calendarTimeZone: string },
): ProfileAnalyticsResult {
	return {
		schemaVersion: PROFILE_ANALYTICS_SCHEMA_VERSION,
		policyVersion: PROFILE_ANALYTICS_POLICY_VERSION,
		rideAnalyticsAlgorithmVersion: RIDE_ANALYTICS_ALGORITHM_VERSION,
		sourceGeneration: options.sourceGeneration,
		calculatedAt: options.calculatedAt.toISOString(),
		calendarTimeZone: options.calendarTimeZone,
		lifetime: finalizeStatistics(accumulator.lifetime),
		annual: Object.fromEntries(Object.entries(accumulator.annual)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([year, statistics]) => [year, finalizeStatistics(statistics)])),
		coverage: accumulator.coverage,
		personalRecords: accumulator.personalRecords,
	};
}
