import type { RiderUnitSystem } from "../rider-profile/types.ts";
import {
	POWER_DURATION_SECONDS,
	RIDE_ANALYTICS_ALGORITHM_VERSION,
	RIDE_ANALYTICS_SCHEMA_VERSION,
	type PersistedRideAnalytics,
	type RideAnalyticsProcessing,
} from "./analytics-model.ts";
import type {
	ProfileAggregateStatistics,
	ProfilePersonalRecord,
	ProfilePersonalRecords,
} from "./profile-analytics-model.ts";

const MILES_TO_KILOMETERS = 1.609344;
const FEET_TO_METERS = 0.3048;

export type ComparisonMetric =
	| "averageSpeed"
	| "averagePower"
	| "normalizedPower"
	| "averageCadence"
	| "averageHeartRate";

export interface RideMetricComparison {
	delta: number;
	unit: "mph" | "km/h" | "W" | "rpm" | "bpm";
	precision: number;
	baselineLabel: string;
}

export type RideMetricComparisons = Partial<Record<ComparisonMetric, RideMetricComparison>>;

export function powerDurationRecordPoints(records: ProfilePersonalRecords["powerDuration"]) {
	return POWER_DURATION_SECONDS.flatMap((duration) => {
		const record = records[String(duration)];
		return record ? [{ duration, record, href: `/rides/${encodeURIComponent(record.rideId)}` }] : [];
	});
}

export function rideAnalyticsIsCurrent(ride: {
	sourceRevision?: string | null;
	analytics?: PersistedRideAnalytics | null;
	analyticsProcessing?: RideAnalyticsProcessing | null;
}) {
	const revision = ride.sourceRevision;
	return Boolean(
		revision
		&& ride.analytics?.schemaVersion === RIDE_ANALYTICS_SCHEMA_VERSION
		&& ride.analytics.algorithmVersion === RIDE_ANALYTICS_ALGORITHM_VERSION
		&& ride.analytics.sourceRevision === revision
		&& ride.analyticsProcessing?.state === "completed"
		&& ride.analyticsProcessing.algorithmVersion === RIDE_ANALYTICS_ALGORITHM_VERSION
		&& ride.analyticsProcessing.sourceRevision === revision,
	);
}

function finite(value: number | null | undefined): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

export function formatProfileDistance(miles: number, units: RiderUnitSystem) {
	return units === "metric"
		? `${(miles * MILES_TO_KILOMETERS).toFixed(1)} km`
		: `${miles.toFixed(1)} mi`;
}

export function formatProfileElevation(feet: number, units: RiderUnitSystem) {
	return units === "metric"
		? `${Math.round(feet * FEET_TO_METERS).toLocaleString()} m`
		: `${Math.round(feet).toLocaleString()} ft`;
}

export function formatProfileSpeed(mph: number, units: RiderUnitSystem) {
	return units === "metric"
		? `${(mph * MILES_TO_KILOMETERS).toFixed(1)} km/h`
		: `${mph.toFixed(1)} mph`;
}

export function formatProfileDuration(seconds: number) {
	const roundedMinutes = Math.round(seconds / 60);
	const days = Math.floor(roundedMinutes / (24 * 60));
	const hours = Math.floor((roundedMinutes % (24 * 60)) / 60);
	const minutes = roundedMinutes % 60;
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
}

export function formatProfileRecord(record: ProfilePersonalRecord, units: RiderUnitSystem) {
	switch (record.unit) {
		case "miles": return formatProfileDistance(record.value, units);
		case "feet": return formatProfileElevation(record.value, units);
		case "mph": return formatProfileSpeed(record.value, units);
		case "seconds": return formatProfileDuration(record.value);
		case "watts": return `${Math.round(record.value)} W`;
	}
}

export function buildRideComparisons(
	ride: {
		averageMovingSpeedMph: number | null;
		averagePowerWatts: number | null;
		normalizedPowerWatts: number | null;
		averageCadenceRpm: number | null;
		averageHeartRateBpm: number | null;
		powerProvenance: "measured" | "estimated" | "unavailable";
	},
	baseline: ProfileAggregateStatistics,
	units: RiderUnitSystem = "imperial",
	baselineLabel = "current lifetime avg",
): RideMetricComparisons {
	const comparisons: RideMetricComparisons = {};
	if (finite(ride.averageMovingSpeedMph) && finite(baseline.averageMovingSpeedMph)) {
		const multiplier = units === "metric" ? MILES_TO_KILOMETERS : 1;
		comparisons.averageSpeed = {
			delta: (ride.averageMovingSpeedMph - baseline.averageMovingSpeedMph) * multiplier,
			unit: units === "metric" ? "km/h" : "mph",
			precision: 1,
			baselineLabel,
		};
	}
	if (
		ride.powerProvenance === "measured"
		&& finite(ride.averagePowerWatts)
		&& finite(baseline.averageMeasuredPowerWatts)
	) {
		comparisons.averagePower = {
			delta: ride.averagePowerWatts - baseline.averageMeasuredPowerWatts,
			unit: "W",
			precision: 0,
			baselineLabel,
		};
	}
	if (
		ride.powerProvenance === "measured"
		&& finite(ride.normalizedPowerWatts)
		&& finite(baseline.durationWeightedRideNormalizedPowerWatts)
	) {
		comparisons.normalizedPower = {
			delta: ride.normalizedPowerWatts - baseline.durationWeightedRideNormalizedPowerWatts,
			unit: "W",
			precision: 0,
			baselineLabel,
		};
	}
	if (finite(ride.averageCadenceRpm) && finite(baseline.averageCadenceRpm)) {
		comparisons.averageCadence = {
			delta: ride.averageCadenceRpm - baseline.averageCadenceRpm,
			unit: "rpm",
			precision: 0,
			baselineLabel,
		};
	}
	if (finite(ride.averageHeartRateBpm) && finite(baseline.averageHeartRateBpm)) {
		comparisons.averageHeartRate = {
			delta: ride.averageHeartRateBpm - baseline.averageHeartRateBpm,
			unit: "bpm",
			precision: 0,
			baselineLabel,
		};
	}
	return comparisons;
}

export function formatRideComparison(comparison: RideMetricComparison) {
	const rounded = Number(comparison.delta.toFixed(comparison.precision));
	const value = Math.abs(rounded).toFixed(comparison.precision);
	if (rounded === 0) return `No difference vs ${comparison.baselineLabel}`;
	return `${rounded > 0 ? "+" : "−"}${value} ${comparison.unit} vs ${comparison.baselineLabel}`;
}

export function profileCoverageMessage(
	coverage: {
		totalStoredRides: number;
		currentAnalyticsRides: number;
	} | null | undefined,
	options: { hasProfile: boolean; fresh: boolean },
) {
	if (!coverage) return "Lifetime statistics are unavailable.";
	let message: string;
	if (coverage.totalStoredRides === 0) {
		message = "No eligible rides yet.";
	} else if (coverage.currentAnalyticsRides < coverage.totalStoredRides) {
		message = `Stats calculated from ${coverage.currentAnalyticsRides} of ${coverage.totalStoredRides} rides.`;
	} else {
		message = `Stats include all ${coverage.totalStoredRides} ${coverage.totalStoredRides === 1 ? "ride" : "rides"}.`;
	}
	return options.hasProfile && !options.fresh ? `Showing last calculated stats. ${message}` : message;
}
