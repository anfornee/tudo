import type { RiderUnitSystem } from "../rider-profile/types.ts";
import type { HistoricalMonthSummary } from "./historical-analytics-model.ts";
import type { ProfileAggregateStatistics } from "./profile-analytics-model.ts";

const MILES_TO_KILOMETERS = 1.609344;
const FEET_TO_METERS = 0.3048;

export type HistoricalRange = "3" | "6" | "12" | "all";
export type HistoricalMetricKey =
	| "distance"
	| "movingTime"
	| "elevation"
	| "speed"
	| "power"
	| "cadence"
	| "heartRate"
	| "normalizedPower";

export interface HistoricalMetricDefinition {
	key: HistoricalMetricKey;
	label: string;
	mode: "bar" | "line";
}

export const HISTORICAL_METRICS: readonly HistoricalMetricDefinition[] = [
	{ key: "distance", label: "Distance", mode: "bar" },
	{ key: "movingTime", label: "Moving time", mode: "bar" },
	{ key: "elevation", label: "Elevation gain", mode: "bar" },
	{ key: "speed", label: "Average speed", mode: "line" },
	{ key: "power", label: "Average measured power", mode: "line" },
	{ key: "cadence", label: "Average cadence", mode: "line" },
	{ key: "heartRate", label: "Average heart rate", mode: "line" },
	{ key: "normalizedPower", label: "Avg ride NP", mode: "line" },
] as const;

export function historicalMetricValue(
	statistics: ProfileAggregateStatistics,
	metric: HistoricalMetricKey,
	units: RiderUnitSystem,
) {
	switch (metric) {
		case "distance": return statistics.totalDistanceMiles * (units === "metric" ? MILES_TO_KILOMETERS : 1);
		case "movingTime": return statistics.totalMovingSeconds / 3600;
		case "elevation": return statistics.totalElevationGainFeet * (units === "metric" ? FEET_TO_METERS : 1);
		case "speed": return statistics.averageMovingSpeedMph === null
			? null
			: statistics.averageMovingSpeedMph * (units === "metric" ? MILES_TO_KILOMETERS : 1);
		case "power": return statistics.averageMeasuredPowerWatts;
		case "cadence": return statistics.averageCadenceRpm;
		case "heartRate": return statistics.averageHeartRateBpm;
		case "normalizedPower": return statistics.durationWeightedRideNormalizedPowerWatts;
	}
}

export function historicalMetricUnit(metric: HistoricalMetricKey, units: RiderUnitSystem) {
	switch (metric) {
		case "distance": return units === "metric" ? "km" : "mi";
		case "movingTime": return "hr";
		case "elevation": return units === "metric" ? "m" : "ft";
		case "speed": return units === "metric" ? "km/h" : "mph";
		case "power":
		case "normalizedPower": return "W";
		case "cadence": return "rpm";
		case "heartRate": return "bpm";
	}
}

export function formatHistoricalMetric(value: number, metric: HistoricalMetricKey, units: RiderUnitSystem) {
	const unit = historicalMetricUnit(metric, units);
	const decimals = metric === "speed" || metric === "distance" || metric === "movingTime" ? 1 : 0;
	return `${value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${unit}`;
}

export function selectHistoricalRange(months: readonly HistoricalMonthSummary[], range: HistoricalRange) {
	if (range === "all") return [...months];
	return months.slice(-Number(range));
}

export function recommendedHistoricalRange(monthCount: number): HistoricalRange {
	if (monthCount <= 3) return "3";
	if (monthCount <= 6) return "6";
	return "12";
}
