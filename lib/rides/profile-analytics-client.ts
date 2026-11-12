import type { ProfileAnalyticsResult } from "./profile-analytics-model.ts";

export interface ProfileAnalyticsApiResponse {
	profile: ProfileAnalyticsResult | null;
	fresh: boolean;
	rebuild: {
		state: "pending" | "processing" | "completed" | "failed";
		sourceGeneration: number;
		targetGeneration: number | null;
		processedRides: number;
		lastAttemptedAt: string | null;
		lastCompletedAt: string | null;
		error: { code: string; message: string } | null;
	};
	currentYear: {
		year: string;
		statistics: ProfileAnalyticsResult["lifetime"] | null;
	} | null;
}

export async function fetchProfileAnalytics(signal?: AbortSignal): Promise<ProfileAnalyticsApiResponse> {
	const response = await fetch("/api/rides/profile-analytics", {
		cache: "no-store",
		signal,
	});
	if (!response.ok) throw new Error("Profile analytics could not be loaded.");
	return await response.json() as ProfileAnalyticsApiResponse;
}
