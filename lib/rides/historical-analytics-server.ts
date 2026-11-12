import {
	Timestamp,
	getFirestore,
	type DocumentData,
} from "firebase-admin/firestore";

import { adminAuth } from "@/lib/firebase-admin";
import {
	type HistoricalAnalyticsApiResponse,
	type HistoricalComparisonResponse,
	type PersistedHistoricalAnalytics,
} from "@/lib/rides/historical-analytics-model";
import {
	buildPreRideStatistics,
	historicalAnalyticsIsCurrent,
	monthSequence,
	zonedMonthStart,
} from "@/lib/rides/historical-analytics";
import {
	calendarMonthForDate,
	createStatisticsAccumulator,
	finalizeStatistics,
} from "@/lib/rides/profile-analytics";
import {
	profileCalendarTimeZone,
	profileRideSnapshot,
} from "@/lib/rides/profile-analytics-server";

const database = getFirestore(adminAuth.app);
const MAX_PARTIAL_MONTH_RIDES = 200;

function historyReference(userId: string) {
	return database.doc(`users/${userId}/profileAnalytics/history`);
}

function rebuildReference(userId: string) {
	return database.doc(`users/${userId}/profileAnalytics/rebuild`);
}

function ridesCollection(userId: string) {
	return database.collection("users").doc(userId).collection("rides");
}

function timestampIso(value: unknown) {
	return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

async function historyContext(userId: string) {
	const [historySnapshot, rebuildSnapshot, calendarTimeZone] = await Promise.all([
		historyReference(userId).get(),
		rebuildReference(userId).get(),
		profileCalendarTimeZone(userId),
	]);
	const history = historySnapshot.exists
		? historySnapshot.data() as PersistedHistoricalAnalytics
		: null;
	const rebuild = rebuildSnapshot.data() ?? {};
	const sourceGeneration = typeof rebuild.sourceGeneration === "number" ? rebuild.sourceGeneration : 0;
	return {
		history,
		sourceGeneration,
		calendarTimeZone,
		fresh: historicalAnalyticsIsCurrent(history, sourceGeneration, calendarTimeZone),
	};
}

export async function getHistoricalAnalytics(userId: string): Promise<HistoricalAnalyticsApiResponse> {
	const context = await historyContext(userId);
	if (!context.history) {
		return {
			fresh: false,
			sourceGeneration: null,
			calculatedAt: null,
			calendarTimeZone: context.calendarTimeZone,
			coverage: null,
			months: [],
		};
	}
	const monthly = context.history.monthly ?? {};
	const storedMonths = Object.keys(monthly).sort();
	const currentMonth = calendarMonthForDate(new Date().toISOString(), context.history.calendarTimeZone);
	const firstMonth = storedMonths[0] ?? currentMonth;
	const sequence = firstMonth && currentMonth
		? monthSequence(firstMonth, currentMonth)
		: storedMonths;
	const keys = sequence.length ? sequence : storedMonths;
	return {
		fresh: context.fresh,
		sourceGeneration: context.history.sourceGeneration,
		calculatedAt: timestampIso(context.history.calculatedAt),
		calendarTimeZone: context.history.calendarTimeZone,
		coverage: context.history.coverage ?? null,
		months: keys.map((month) => ({
			month,
			statistics: finalizeStatistics(
				monthly[month] ?? createStatisticsAccumulator(),
			),
			isCurrentMonth: month === currentMonth,
		})),
	};
}

function historyDocumentCurrent(data: DocumentData | undefined, generation: number, timeZone: string) {
	return historicalAnalyticsIsCurrent(
		data as Partial<PersistedHistoricalAnalytics> | undefined ?? null,
		generation,
		timeZone,
	);
}

export async function getHistoricalRideComparison(
	userId: string,
	rideId: string,
): Promise<HistoricalComparisonResponse> {
	const [targetDocument, context] = await Promise.all([
		ridesCollection(userId).doc(rideId).get(),
		historyContext(userId),
	]);
	if (!targetDocument.exists) {
		return { available: false, reason: "target_unavailable", sourceGeneration: null, statistics: null };
	}
	const target = profileRideSnapshot(targetDocument);
	if (!target.current || !target.analytics?.activityDate || !context.history || !context.fresh) {
		return {
			available: false,
			reason: context.history && !context.fresh ? "stale" : "target_unavailable",
			sourceGeneration: context.history?.sourceGeneration ?? null,
			statistics: null,
		};
	}
	const targetDate = new Date(target.analytics.activityDate);
	const targetMonth = calendarMonthForDate(target.analytics.activityDate, context.calendarTimeZone);
	const monthStart = targetMonth ? zonedMonthStart(targetMonth, context.calendarTimeZone) : null;
	if (!targetMonth || !monthStart || !Number.isFinite(targetDate.getTime())) {
		return { available: false, reason: "target_unavailable", sourceGeneration: context.sourceGeneration, statistics: null };
	}

	const partialMonth = await ridesCollection(userId)
		.where("activityDate", ">=", Timestamp.fromDate(monthStart))
		.where("activityDate", "<", Timestamp.fromDate(targetDate))
		.orderBy("activityDate")
		.limit(MAX_PARTIAL_MONTH_RIDES + 1)
		.get();
	if (partialMonth.size > MAX_PARTIAL_MONTH_RIDES) {
		return { available: false, reason: "month_too_large", sourceGeneration: context.sourceGeneration, statistics: null };
	}
	const priorTargetMonthRides = [];
	for (const document of partialMonth.docs) {
		const ride = profileRideSnapshot(document);
		if (ride.current && ride.analytics) priorTargetMonthRides.push(ride.analytics);
	}

	const latest = await database.runTransaction(async (transaction) => {
		const rebuild = await transaction.get(rebuildReference(userId));
		const history = await transaction.get(historyReference(userId));
		return {
			generation: rebuild.data()?.sourceGeneration ?? 0,
			history: history.data(),
		};
	});
	if (
		latest.generation !== context.sourceGeneration
		|| !historyDocumentCurrent(latest.history, latest.generation, context.calendarTimeZone)
	) {
		return { available: false, reason: "stale", sourceGeneration: latest.generation, statistics: null };
	}
	const statistics = buildPreRideStatistics(
		context.history.monthly,
		targetMonth,
		target.analytics.activityDate,
		priorTargetMonthRides,
	);
	if (!statistics) {
		return { available: false, reason: "no_prior_rides", sourceGeneration: context.sourceGeneration, statistics: null };
	}
	return {
		available: true,
		reason: "available",
		sourceGeneration: context.sourceGeneration,
		statistics,
	};
}
