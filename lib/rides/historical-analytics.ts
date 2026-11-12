import { RIDE_ANALYTICS_ALGORITHM_VERSION, type RideAnalyticsResult } from "./analytics-model.ts";
import {
	HISTORICAL_ANALYTICS_POLICY_VERSION,
	HISTORICAL_ANALYTICS_SCHEMA_VERSION,
	type HistoricalStatisticsContribution,
	type PersistedHistoricalAnalytics,
} from "./historical-analytics-model.ts";
import {
	addStatistics,
	createStatisticsAccumulator,
	finalizeStatistics,
	mergeStatisticsAccumulator,
} from "./profile-analytics.ts";

export function historicalAnalyticsIsCurrent(
	history: Partial<PersistedHistoricalAnalytics> | null,
	sourceGeneration: number,
	calendarTimeZone: string,
) {
	return Boolean(
		history
		&& history.schemaVersion === HISTORICAL_ANALYTICS_SCHEMA_VERSION
		&& history.policyVersion === HISTORICAL_ANALYTICS_POLICY_VERSION
		&& history.rideAnalyticsAlgorithmVersion === RIDE_ANALYTICS_ALGORITHM_VERSION
		&& history.sourceGeneration === sourceGeneration
		&& history.calendarTimeZone === calendarTimeZone
		&& history.monthly !== null
		&& typeof history.monthly === "object"
		&& history.coverage !== null
		&& typeof history.coverage === "object",
	);
}

export function monthSequence(firstMonth: string, lastMonth: string, maximum = 600) {
	if (!/^\d{4}-\d{2}$/.test(firstMonth) || !/^\d{4}-\d{2}$/.test(lastMonth)) return [];
	const [firstYear, firstIndex] = firstMonth.split("-").map(Number);
	const [lastYear, lastIndex] = lastMonth.split("-").map(Number);
	if (firstIndex < 1 || firstIndex > 12 || lastIndex < 1 || lastIndex > 12) return [];
	const first = firstYear * 12 + firstIndex - 1;
	const last = lastYear * 12 + lastIndex - 1;
	if (last < first || last - first + 1 > maximum) return [];
	return Array.from({ length: last - first + 1 }, (_, offset) => {
		const absolute = first + offset;
		return `${Math.floor(absolute / 12)}-${String(absolute % 12 + 1).padStart(2, "0")}`;
	});
}

function zonedParts(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
	return {
		year: value("year"),
		month: value("month"),
		day: value("day"),
		hour: value("hour"),
		minute: value("minute"),
		second: value("second"),
	};
}

export function zonedMonthStart(month: string, timeZone: string) {
	const match = /^(\d{4})-(\d{2})$/.exec(month);
	if (!match) return null;
	if (Number(match[2]) < 1 || Number(match[2]) > 12) return null;
	const desired = Date.UTC(Number(match[1]), Number(match[2]) - 1, 1);
	let instant = desired;
	try {
		for (let iteration = 0; iteration < 4; iteration += 1) {
			const parts = zonedParts(new Date(instant), timeZone);
			const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
			instant = desired - (represented - instant);
		}
		return new Date(instant);
	} catch {
		return null;
	}
}

export function buildPreRideStatistics(
	monthly: Record<string, HistoricalStatisticsContribution>,
	targetMonth: string,
	targetActivityDate: string,
	priorTargetMonthRides: readonly RideAnalyticsResult[],
) {
	const accumulator = createStatisticsAccumulator();
	for (const [month, contribution] of Object.entries(monthly)) {
		if (month < targetMonth) mergeStatisticsAccumulator(accumulator, contribution);
	}
	const targetTime = new Date(targetActivityDate).getTime();
	for (const analytics of priorTargetMonthRides) {
		const candidateTime = analytics.activityDate ? new Date(analytics.activityDate).getTime() : Number.NaN;
		if (Number.isFinite(candidateTime) && candidateTime < targetTime) addStatistics(accumulator, analytics);
	}
	return accumulator.totalRides > 0 ? finalizeStatistics(accumulator) : null;
}
