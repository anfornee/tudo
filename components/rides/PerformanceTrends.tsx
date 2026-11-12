"use client";

import { Activity, ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type { RiderUnitSystem } from "@/lib/rider-profile/types";
import { fetchHistoricalAnalytics } from "@/lib/rides/historical-analytics-client";
import type { HistoricalAnalyticsApiResponse, HistoricalMonthSummary } from "@/lib/rides/historical-analytics-model";
import {
	HISTORICAL_METRICS,
	formatHistoricalMetric,
	historicalMetricValue,
	recommendedHistoricalRange,
	selectHistoricalRange,
	type HistoricalMetricKey,
	type HistoricalRange,
} from "@/lib/rides/historical-presentation";

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit", timeZone: "UTC" });

function monthLabel(month: string) {
	return monthFormatter.format(new Date(`${month}-01T00:00:00Z`));
}

function TrendChart({ months, metric, units }: {
	months: HistoricalMonthSummary[];
	metric: HistoricalMetricKey;
	units: RiderUnitSystem;
}) {
	const definition = HISTORICAL_METRICS.find((candidate) => candidate.key === metric)!;
	const values = months.map((month) => historicalMetricValue(month.statistics, metric, units));
	const available = values.filter((value): value is number => value !== null && Number.isFinite(value));
	if (!available.length || (definition.mode === "bar" && available.every((value) => value === 0))) {
		return <div className="flex h-52 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">No qualifying data for this metric.</div>;
	}
	const maximum = Math.max(1, ...available);
	const width = Math.max(560, months.length * 58);
	return (
		<div className="overflow-x-auto pb-2">
			<div className="relative h-64" style={{ width }}>
				<div className="absolute bottom-7 left-9 right-2 top-2 border-b border-l">
					<span className="absolute bottom-full right-full pr-2 text-[10px] tabular-nums text-muted-foreground">{formatHistoricalMetric(maximum, metric, units)}</span>
					<span className="absolute bottom-0 right-full translate-y-1/2 pr-2 text-[10px] tabular-nums text-muted-foreground">0</span>
					{definition.mode === "line" ? (
						<svg className="absolute inset-0 size-full overflow-visible" aria-hidden="true" preserveAspectRatio="none">
							{months.slice(0, -1).map((month, index) => {
								const first = values[index];
								const second = values[index + 1];
								if (first === null || second === null) return null;
								return <line key={month.month} x1={`${(index + 0.5) / months.length * 100}%`} y1={`${(1 - first / maximum) * 100}%`} x2={`${(index + 1.5) / months.length * 100}%`} y2={`${(1 - second / maximum) * 100}%`} className="stroke-primary" strokeWidth="2" vectorEffect="non-scaling-stroke" />;
							})}
						</svg>
					) : null}
					{months.map((month, index) => {
						const value = values[index];
						const label = `${monthLabel(month.month)}: ${value === null ? "Unavailable" : formatHistoricalMetric(value, metric, units)}${month.isCurrentMonth ? ", current partial month" : ""}`;
						return (
							<div key={month.month} className="group absolute bottom-0 top-0" style={{ left: `${index / months.length * 100}%`, width: `${100 / months.length}%` }}>
								{value !== null ? definition.mode === "bar" ? (
									<button type="button" className="absolute bottom-0 left-[20%] w-[60%] rounded-t-sm bg-primary/80 outline-none hover:bg-primary focus-visible:bg-primary focus-visible:ring-2 focus-visible:ring-ring" style={{ height: `${Math.max(value > 0 ? 2 : 0.5, value / maximum * 100)}%` }} aria-label={label} />
								) : (
									<button type="button" className="absolute left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring" style={{ top: `${(1 - value / maximum) * 100}%` }} aria-label={label} />
								) : null}
								<span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max max-w-48 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-center text-xs shadow-sm group-hover:block group-focus-within:block">{label}</span>
								<span className="absolute top-full mt-1 w-full truncate px-0.5 text-center text-[10px] text-muted-foreground">{monthLabel(month.month)}{month.isCurrentMonth ? "*" : ""}</span>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

export function PerformanceTrends({ units, expectedGeneration }: { units: RiderUnitSystem; expectedGeneration: number | null }) {
	const [data, setData] = useState<HistoricalAnalyticsApiResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [metric, setMetric] = useState<HistoricalMetricKey>("distance");
	const [range, setRange] = useState<HistoricalRange>("12");

	const load = useCallback(async () => {
		if (loading || data) return;
		setLoading(true);
		setError(null);
		try {
			const result = await fetchHistoricalAnalytics();
			setData(result);
			setRange(recommendedHistoricalRange(result.months.length));
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Performance history could not be loaded.");
		} finally {
			setLoading(false);
		}
	}, [data, loading]);
	const months = useMemo(() => selectHistoricalRange(data?.months ?? [], range), [data, range]);
	const incompleteCoverage = data?.coverage && data.coverage.currentAnalyticsRides < data.coverage.totalStoredRides;
	const generationMatches = expectedGeneration === null || data?.sourceGeneration === expectedGeneration;

	return (
		<section className="rounded-xl border bg-card shadow-sm">
			<details className="group" onToggle={(event) => { if (event.currentTarget.open) void load(); }}>
				<summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5">
					<div><h2 className="font-semibold">Performance Trends</h2><p className="mt-1 text-sm text-muted-foreground">Monthly riding volume and measured performance.</p></div>
					<ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
				</summary>
				<div className="border-t p-4 sm:p-5">
					{loading ? <div className="flex h-52 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground motion-reduce:animate-none" /></div> : error ? (
						<div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-3 min-h-9 rounded-full border border-destructive/40 px-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Retry</button></div>
					) : !data?.months.length ? (
						<div className="rounded-xl border border-dashed px-5 py-8 text-center"><Activity className="mx-auto size-7 text-muted-foreground" /><p className="mt-2 font-medium">No performance history yet</p><p className="mt-1 text-sm text-muted-foreground">Monthly trends appear after profile analytics are rebuilt.</p></div>
					) : (
						<div className="space-y-4">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<label className="text-sm font-medium">Metric <select value={metric} onChange={(event) => setMetric(event.target.value as HistoricalMetricKey)} className="ml-2 h-9 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">{HISTORICAL_METRICS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
								<div className="flex flex-wrap gap-1" aria-label="Trend time range">{(["3", "6", "12", "all"] as const).map((value) => <button key={value} type="button" onClick={() => setRange(value)} aria-pressed={range === value} className="min-h-9 rounded-full border px-3 text-xs font-medium aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground">{value === "all" ? "All time" : `${value} mo`}</button>)}</div>
							</div>
							{!data.fresh || !generationMatches ? <p className="text-xs text-amber-700 dark:text-amber-300">Showing last calculated history. Update analytics before treating these trends as current.</p> : incompleteCoverage ? <p className="text-xs text-muted-foreground">History includes {data.coverage?.currentAnalyticsRides} of {data.coverage?.totalStoredRides} rides with current analytics.</p> : null}
							<TrendChart months={months} metric={metric} units={units} />
							<p className="text-xs text-muted-foreground">* Current month is incomplete. Missing sensor values are unavailable, not zero.</p>
						</div>
					)}
				</div>
			</details>
		</section>
	);
}
