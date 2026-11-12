"use client";

import {
	Activity,
	ChevronDown,
	Gauge,
	Loader2,
	MoreHorizontal,
	RefreshCw,
	Trophy,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { PowerDurationCurve } from "@/components/rides/PowerDurationCurve";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { RiderUnitSystem } from "@/lib/rider-profile/types";
import { POWER_DURATION_SECONDS } from "@/lib/rides/analytics-model";
import { analyticsResyncLabel } from "@/lib/rides/analytics-resync-model";
import type { ProfileAnalyticsApiResponse } from "@/lib/rides/profile-analytics-client";
import type { ProfilePersonalRecord } from "@/lib/rides/profile-analytics-model";
import {
	formatProfileDistance,
	formatProfileDuration,
	formatProfileElevation,
	formatProfileRecord,
	formatProfileSpeed,
	profileCoverageMessage,
} from "@/lib/rides/profile-presentation";
import { useAnalyticsResync } from "@/lib/rides/use-analytics-resync";

interface ProfileStatsProps {
	data: ProfileAnalyticsApiResponse | null;
	loading: boolean;
	error: string | null;
	units: RiderUnitSystem;
	onRefresh: () => void | Promise<unknown>;
}

const POWER_DURATION_LABELS: Record<number, string> = {
	5: "5 sec", 15: "15 sec", 30: "30 sec", 60: "1 min", 120: "2 min",
	180: "3 min", 300: "5 min", 480: "8 min", 600: "10 min", 900: "15 min",
	1200: "20 min", 1800: "30 min", 2700: "45 min", 3600: "1 hr",
};
const HIGHLIGHTED_DURATIONS = new Set([5, 60, 300, 1200]);

function dateLabel(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
	return (
		<div className="min-w-0 rounded-xl border bg-background p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-1 truncate font-semibold tabular-nums" title={value}>{value}</p>
			{detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
		</div>
	);
}

function RecordTile({ label, record, units }: {
	label: string;
	record: ProfilePersonalRecord | null;
	units: RiderUnitSystem;
}) {
	const content = (
		<>
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-1 font-semibold tabular-nums">{record ? formatProfileRecord(record, units) : "—"}</p>
			{record ? <p className="mt-1 text-xs text-muted-foreground">{dateLabel(record.activityDate)}</p> : null}
		</>
	);
	return record?.rideId ? (
		<Link
			href={`/rides/${encodeURIComponent(record.rideId)}`}
			className="rounded-xl border bg-background p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			aria-label={`${label}: ${formatProfileRecord(record, units)}. Open originating ride.`}
		>
			{content}
		</Link>
	) : <div className="rounded-xl border bg-background p-3">{content}</div>;
}

function PowerRecord({ duration, record }: { duration: number; record: ProfilePersonalRecord | null }) {
	const content = (
		<>
			<p className="text-xs text-muted-foreground">{POWER_DURATION_LABELS[duration]}</p>
			<p className="mt-1 font-semibold tabular-nums">{record ? `${Math.round(record.value)} W` : "—"}</p>
			{record ? <p className="mt-1 text-xs text-muted-foreground">{dateLabel(record.activityDate)}</p> : null}
		</>
	);
	return record?.rideId ? (
		<Link
			href={`/rides/${encodeURIComponent(record.rideId)}`}
			className="rounded-xl border bg-background p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			aria-label={`${POWER_DURATION_LABELS[duration]} power best: ${Math.round(record.value)} watts. Open originating ride.`}
		>
			{content}
		</Link>
	) : <div className="rounded-xl border bg-background p-3">{content}</div>;
}

export function ProfileStats({ data, loading, error, units, onRefresh }: ProfileStatsProps) {
	const [confirmRecalculate, setConfirmRecalculate] = useState(false);
	const menuRef = useRef<HTMLDetailsElement>(null);
	const resync = useAnalyticsResync(async () => { await onRefresh(); });
	const profile = data?.profile ?? null;
	const coverage = profile?.coverage;
	const lifetime = profile?.lifetime;
	const records = profile?.personalRecords;
	const noEligibleRides = coverage?.totalStoredRides === 0 || coverage?.currentAnalyticsRides === 0;
	const resyncMessage = resync.status ? analyticsResyncLabel(resync.status) : null;

	const coverageMessage = profileCoverageMessage(coverage, {
		hasProfile: Boolean(data?.profile),
		fresh: data?.fresh ?? false,
	});
	const passiveStatusMessage = resync.status?.state === "failed"
		? `${resyncMessage}. Retry is available.`
		: data?.rebuild.state === "failed"
			? "Profile stats rebuild failed. Retry is available."
			: !data?.fresh && (data?.rebuild.state === "pending" || data?.rebuild.state === "processing")
				? `Profile stats rebuild pending. ${coverageMessage}`
				: coverageMessage;
	const calculatedAt = profile ? new Date(profile.calculatedAt) : null;
	const calculatedLabel = calculatedAt && !Number.isNaN(calculatedAt.getTime())
		? calculatedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
		: null;

	return (
		<section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="profile-stats-heading">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 id="profile-stats-heading" className="font-semibold">Profile Stats</h2>
					<p className="mt-1 text-sm text-muted-foreground">Lifetime averages and personal accomplishments.</p>
				</div>
				<details ref={menuRef} className="group relative">
					<summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Analytics management">
						{resync.running ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <MoreHorizontal className="size-5" />}
					</summary>
					<div className="absolute right-0 z-20 mt-2 w-64 space-y-1 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg">
						<button
							type="button"
							disabled={resync.running}
							onClick={() => { menuRef.current?.removeAttribute("open"); void resync.start("update"); }}
							className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
						>
							<span className="block font-medium">Update missing/outdated stats</span>
							<span className="mt-0.5 block text-xs text-muted-foreground">Retry eligible rides, then refresh profile stats.</span>
						</button>
						<button
							type="button"
							disabled={resync.running}
							onClick={() => { menuRef.current?.removeAttribute("open"); setConfirmRecalculate(true); }}
							className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
						>
							<span className="block font-medium">Recalculate all stats</span>
							<span className="mt-0.5 block text-xs text-muted-foreground">Reprocess stored ride data without contacting Wahoo.</span>
						</button>
					</div>
				</details>
			</div>

			<div className="mt-3 min-h-5 text-xs text-muted-foreground" role="status" aria-live="polite">
				{resync.running && resyncMessage ? <span className="inline-flex items-center gap-1.5"><RefreshCw className="size-3.5 animate-spin motion-reduce:animate-none" />{resyncMessage}</span> : passiveStatusMessage}
				{!resync.running && resync.status?.state === "completed" ? ` ${resyncMessage}.` : null}
				{!resync.running && calculatedLabel ? ` Last calculated ${calculatedLabel}.` : null}
				{resync.error && resync.status?.state !== "failed" ? <span className="ml-2 text-destructive">{resync.error} Retry is available.</span> : null}
			</div>

			{loading && !profile ? (
				<div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Loading profile statistics">
					{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />)}
				</div>
			) : error && !profile ? (
				<div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
			) : noEligibleRides || !profile || !lifetime || !records ? (
				<div className="mt-5 rounded-xl border border-dashed bg-background/50 px-5 py-8 text-center">
					<Activity className="mx-auto size-7 text-muted-foreground" />
					<p className="mt-2 font-medium">No profile statistics yet</p>
					<p className="mt-1 text-sm text-muted-foreground">Update analytics after saving rides with available activity samples.</p>
				</div>
			) : (
				<div className="mt-5 space-y-6">
					<div>
						<div className="mb-3 flex items-center gap-2"><Gauge className="size-4 text-primary" /><h3 className="text-sm font-medium">Lifetime averages</h3></div>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
							<StatTile label="Moving speed" value={lifetime.averageMovingSpeedMph === null ? "—" : formatProfileSpeed(lifetime.averageMovingSpeedMph, units)} />
							<StatTile label="Measured power" value={lifetime.averageMeasuredPowerWatts === null ? "—" : `${Math.round(lifetime.averageMeasuredPowerWatts)} W`} />
							<StatTile label="Cadence" value={lifetime.averageCadenceRpm === null ? "—" : `${Math.round(lifetime.averageCadenceRpm)} rpm`} />
							<StatTile label="Heart rate" value={lifetime.averageHeartRateBpm === null ? "—" : `${Math.round(lifetime.averageHeartRateBpm)} bpm`} />
							<StatTile label="Avg ride NP" value={lifetime.durationWeightedRideNormalizedPowerWatts === null ? "—" : `${Math.round(lifetime.durationWeightedRideNormalizedPowerWatts)} W`} detail="Ride-level NP, weighted by measured-power duration" />
						</div>
					</div>

					<div>
						<div className="mb-3 flex items-center gap-2"><Trophy className="size-4 text-primary" /><h3 className="text-sm font-medium">Lifetime accomplishments</h3></div>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							<StatTile label="Total rides" value={(coverage?.totalStoredRides ?? lifetime.totalRides).toLocaleString()} detail={`${lifetime.totalRides.toLocaleString()} with current analytics`} />
							<StatTile label="Total distance" value={formatProfileDistance(lifetime.totalDistanceMiles, units)} />
							<RecordTile label="Longest ride" record={records.longestDistance} units={units} />
							<RecordTile label="Highest measured power" record={records.highestMeasuredPower} units={units} />
						</div>
						<details className="group mt-3 rounded-xl border bg-background">
							<summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
								More lifetime totals <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
							</summary>
							<div className="grid grid-cols-2 gap-3 border-t p-3 sm:grid-cols-4">
								<StatTile label="Moving time" value={formatProfileDuration(lifetime.totalMovingSeconds)} />
								<StatTile label="Elevation gain" value={formatProfileElevation(lifetime.totalElevationGainFeet, units)} />
								<RecordTile label="Greatest ride ascent" record={records.greatestTotalAscent} units={units} />
								<RecordTile label="Fastest qualifying avg" record={records.fastestQualifyingAverageSpeed} units={units} />
							</div>
						</details>
					</div>

					<div>
						<div className="mb-3 flex items-center gap-2"><Zap className="size-4 text-primary" /><div><h3 className="text-sm font-medium">Power Bests</h3><p className="text-xs text-muted-foreground">Measured power only</p></div></div>
						{coverage?.measuredPowerRides === 0 ? (
							<div className="rounded-xl border border-dashed bg-background/50 p-4 text-sm text-muted-foreground">Power records require rides with measured power data.</div>
						) : (
							<>
								<PowerDurationCurve records={records.powerDuration} />
								<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
									{POWER_DURATION_SECONDS.filter((duration) => HIGHLIGHTED_DURATIONS.has(duration)).map((duration) => (
										<PowerRecord key={duration} duration={duration} record={records.powerDuration[String(duration)] ?? null} />
									))}
								</div>
								<details className="group mt-3 rounded-xl border bg-background">
									<summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
										View all 14 power bests <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
									</summary>
									<div className="grid grid-cols-2 gap-3 border-t p-3 sm:grid-cols-4 lg:grid-cols-7">
										{POWER_DURATION_SECONDS.map((duration) => <PowerRecord key={duration} duration={duration} record={records.powerDuration[String(duration)] ?? null} />)}
									</div>
								</details>
							</>
						)}
					</div>
				</div>
			)}

			<AlertDialog open={confirmRecalculate} onOpenChange={setConfirmRecalculate}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Recalculate all ride stats?</AlertDialogTitle>
						<AlertDialogDescription>This reprocesses every stored ride with available source samples, then rebuilds profile statistics. It does not download rides from Wahoo.</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={() => { setConfirmRecalculate(false); void resync.start("recalculate"); }}>Recalculate all</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	);
}
