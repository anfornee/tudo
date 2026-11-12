"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
	fetchProfileAnalytics,
	type ProfileAnalyticsApiResponse,
} from "./profile-analytics-client";

export function useProfileAnalytics() {
	const [data, setData] = useState<ProfileAnalyticsApiResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const inFlightRef = useRef<Promise<ProfileAnalyticsApiResponse | null> | null>(null);

	const refresh = useCallback((signal?: AbortSignal) => {
		if (inFlightRef.current) return inFlightRef.current;
		const request = (async () => {
			setError(null);
			try {
				const result = await fetchProfileAnalytics(signal);
				setData(result);
				return result;
			} catch (loadError) {
				if (loadError instanceof DOMException && loadError.name === "AbortError") return null;
				setError(loadError instanceof Error ? loadError.message : "Profile analytics could not be loaded.");
				return null;
			} finally {
				if (!signal?.aborted) setLoading(false);
				inFlightRef.current = null;
			}
		})();
		inFlightRef.current = request;
		return request;
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		void Promise.resolve().then(() => refresh(controller.signal));
		return () => controller.abort();
	}, [refresh]);

	useEffect(() => {
		const refreshVisibleProfile = () => {
			if (document.visibilityState === "visible") void refresh();
		};
		window.addEventListener("focus", refreshVisibleProfile);
		document.addEventListener("visibilitychange", refreshVisibleProfile);
		return () => {
			window.removeEventListener("focus", refreshVisibleProfile);
			document.removeEventListener("visibilitychange", refreshVisibleProfile);
		};
	}, [refresh]);

	return { data, loading, error, refresh };
}
