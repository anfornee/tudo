import type {
	HistoricalAnalyticsApiResponse,
	HistoricalComparisonResponse,
} from "./historical-analytics-model.ts";

async function readJson<T>(response: Response, message: string): Promise<T> {
	if (!response.ok) throw new Error(message);
	return await response.json() as T;
}

export async function fetchHistoricalAnalytics(signal?: AbortSignal) {
	return readJson<HistoricalAnalyticsApiResponse>(
		await fetch("/api/rides/profile-analytics/history", { cache: "no-store", signal }),
		"Performance history could not be loaded.",
	);
}

export async function fetchHistoricalComparison(rideId: string, signal?: AbortSignal) {
	return readJson<HistoricalComparisonResponse>(
		await fetch(`/api/rides/${encodeURIComponent(rideId)}/comparison`, { cache: "no-store", signal }),
		"Previous-rides comparison could not be loaded.",
	);
}
