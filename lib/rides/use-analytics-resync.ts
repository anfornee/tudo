"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
	analyticsResyncIsActive,
	type AnalyticsResyncMode,
	type AnalyticsResyncStatus,
} from "./analytics-resync-model";

interface ResyncResponse {
	status: AnalyticsResyncStatus | null;
	error?: string;
}

function delay(milliseconds: number, signal: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		const timeout = window.setTimeout(resolve, milliseconds);
		signal.addEventListener("abort", () => {
			window.clearTimeout(timeout);
			reject(new DOMException("Aborted", "AbortError"));
		}, { once: true });
	});
}

export function useAnalyticsResync(onCompleted: () => void | Promise<void>) {
	const [status, setStatus] = useState<AnalyticsResyncStatus | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const controllerRef = useRef<AbortController | null>(null);
	const runningRef = useRef(false);
	const completedOperationRef = useRef<string | null>(null);
	const onCompletedRef = useRef(onCompleted);
	useEffect(() => {
		onCompletedRef.current = onCompleted;
	}, [onCompleted]);

	const run = useCallback(async (mode?: AnalyticsResyncMode) => {
		if (runningRef.current) return;
		runningRef.current = true;
		setError(null);
		controllerRef.current?.abort();
		const controller = new AbortController();
		controllerRef.current = controller;
		try {
			let nextMode = mode;
			while (!controller.signal.aborted) {
				const response = await fetch("/api/rides/profile-analytics/resync", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(nextMode ? { mode: nextMode } : {}),
					cache: "no-store",
					signal: controller.signal,
				});
				nextMode = undefined;
				const result = await response.json() as ResyncResponse;
				if (!response.ok) throw new Error(result.error ?? "Analytics could not be updated.");
				setStatus(result.status);
				if (!result.status || !analyticsResyncIsActive(result.status)) {
					if (
						result.status?.state === "completed"
						&& completedOperationRef.current !== result.status.operationId
					) {
						completedOperationRef.current = result.status.operationId;
						await onCompletedRef.current();
					}
					break;
				}
				if (result.status.retryAfterMs) {
					await delay(result.status.retryAfterMs, controller.signal);
				}
			}
		} catch (runError) {
			if (!(runError instanceof DOMException && runError.name === "AbortError")) {
				const message = runError instanceof Error ? runError.message : "Analytics could not be updated.";
				setError(message);
				setStatus((current) => current ? {
					...current,
					state: "failed",
					error: { code: "resync_failed", message },
					retryAfterMs: undefined,
				} : current);
			}
		} finally {
			runningRef.current = false;
		}
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		void fetch("/api/rides/profile-analytics/resync", {
			cache: "no-store",
			signal: controller.signal,
		})
			.then(async (response) => {
				if (!response.ok) throw new Error("Analytics update status could not be loaded.");
				return await response.json() as ResyncResponse;
			})
			.then((result) => {
				setStatus(result.status);
				if (analyticsResyncIsActive(result.status)) void run();
			})
			.catch((loadError) => {
				if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
					setError(loadError instanceof Error ? loadError.message : "Analytics update status could not be loaded.");
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => {
			controller.abort();
			controllerRef.current?.abort();
		};
	}, [run]);

	return {
		status,
		error,
		loading,
		running: analyticsResyncIsActive(status),
		start: run,
	};
}
