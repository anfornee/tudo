import {
	CalendarDays,
	Clock3,
	Gauge,
	Mountain,
	Zap,
} from "lucide-react";
import Link from "next/link";

import {
	formatRideDuration,
} from "@/lib/rides/formatters";
import type { RideCalorieAnalysis } from "@/lib/rides/calories";
import type { RiderUnitSystem } from "@/lib/rider-profile/types";
import {
	formatProfileDistance,
	formatProfileElevation,
	formatProfileSpeed,
	formatRideComparison,
	type RideMetricComparisons,
} from "@/lib/rides/profile-presentation";
import type {
	RideSource,
	RideSummaryMetrics,
} from "@/lib/rides/types";

interface RideSummaryProps {
	ride: RideSummaryMetrics;
	source: RideSource;
	activityDate: Date | null;
	fileName?: string;
	calorieAnalysis?: RideCalorieAnalysis | null;
	units?: RiderUnitSystem;
	comparisons?: RideMetricComparisons[];
	comparisonNote?: string | null;
}

const calorieMethodLabels: Record<RideCalorieAnalysis["method"], string> = {
	recorded: "Recorded",
	power: "Estimated from power",
	heart_rate: "Estimated from heart rate",
	speed_met: "Estimated from speed and duration",
	duration_met: "Rough estimate",
};

function formatDate(date: Date | null) {
	if (!date) {
		return "Date unavailable";
	}

	return new Intl.DateTimeFormat(
		"en-US",
		{
			dateStyle: "medium",
			timeStyle: "short",
		},
	).format(date);
}

export function RideSummary({
	ride,
	source,
	activityDate,
	fileName,
	calorieAnalysis,
	units = "imperial",
	comparisons,
	comparisonNote,
}: RideSummaryProps) {
	const selectedAnalysis = calorieAnalysis === undefined
		? ride.calorieAnalysis ?? null
		: calorieAnalysis;
	const displayedCalories = selectedAnalysis?.calories ?? ride.calories ?? null;
	const calorieMethod = selectedAnalysis?.method ?? (ride.calories !== null ? "recorded" : null);
	const comparisonDetail = (metric: keyof RideMetricComparisons) => comparisons
		?.flatMap((group) => group[metric] ? [formatRideComparison(group[metric])] : [])
		.join(" · ") || undefined;
	const metrics = [
		{
			label: "Distance",
			value: formatProfileDistance(ride.distanceMiles, units),
		},
		{
			label: "Duration",
			value: formatRideDuration(
				ride.durationSeconds,
			),
		},
		...(Math.round(
			ride.movingTimeSeconds,
		) !==
		Math.round(
			ride.durationSeconds,
		)
			? [
					{
						label: "Moving time",
						value: formatRideDuration(
							ride.movingTimeSeconds,
						),
					},
				]
			: []),
		{
			label: "Average speed",
			value: formatProfileSpeed(ride.averageSpeedMph, units),
			detail: comparisonDetail("averageSpeed"),
		},
		{
			label: "Elevation",
			value: formatProfileElevation(ride.elevationGainFeet, units),
		},
		...(displayedCalories !== null
			? [
					{
						label: "Calories",
						value: `${Math.round(
							displayedCalories,
						)} kcal`,
						detail: `${calorieMethod ? calorieMethodLabels[calorieMethod] : "Estimated"}.${selectedAnalysis?.lowerCalories !== null && selectedAnalysis?.lowerCalories !== undefined && selectedAnalysis.upperCalories !== null ? ` Likely range ${selectedAnalysis.lowerCalories}–${selectedAnalysis.upperCalories} kcal.` : ""}${selectedAnalysis?.source === "recorded" || (!selectedAnalysis && ride.calories != null) ? " The source device does not specify whether this is gross or active energy." : " Gross cycling-period energy; resting calories are not added separately."}`,
					},
				]
			: []),
		...(ride.averagePower !== null
			? [
					{
						label: "Average power",
						value: `${Math.round(
							ride.averagePower,
						)} W`,
						detail: comparisonDetail("averagePower"),
					},
				]
			: []),
		...(ride.maxPower !== null
			? [
					{
						label: "Maximum power",
						value: `${Math.round(
							ride.maxPower,
						)} W`,
					},
				]
			: []),
		...(ride.normalizedPower !== null
			? [
					{
						label: "Normalized power",
						value: `${Math.round(
							ride.normalizedPower,
						)} W`,
						detail: comparisonDetail("normalizedPower"),
					},
				]
			: []),
		...(ride.averageCadence !== null
			? [
					{
						label: "Average cadence",
						value: `${Math.round(
							ride.averageCadence,
						)} rpm`,
						detail: comparisonDetail("averageCadence"),
					},
				]
			: []),
		...(ride.maxCadence !== null
			? [
					{
						label: "Maximum cadence",
						value: `${Math.round(
							ride.maxCadence,
						)} rpm`,
					},
				]
			: []),
		...(ride.averageHeartRate !== null
			? [
					{
						label: "Average heart rate",
						value: `${Math.round(
							ride.averageHeartRate,
						)} bpm`,
						detail: comparisonDetail("averageHeartRate"),
					},
				]
			: []),
		...(ride.maxHeartRate !== null
			? [
					{
						label: "Maximum heart rate",
						value: `${Math.round(
							ride.maxHeartRate,
						)} bpm`,
					},
				]
			: []),
	];

	return (
		<div className="space-y-4">
			<div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
				<span className="flex items-center gap-1.5">
					<CalendarDays className="size-4" />
					{formatDate(activityDate)}
				</span>

				<span className="rounded-md bg-muted px-2 py-1 text-xs font-medium uppercase">
					{source}
				</span>

				{fileName && (
					<span className="min-w-0 truncate">
						{fileName}
					</span>
				)}
			</div>

			<dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{metrics.map(
					(metric, index) => {
						const Icon = [
							Gauge,
							Clock3,
							Mountain,
							Zap,
						][index % 4];

						return (
							<div
								key={
									metric.label
								}
								className="rounded-xl border bg-background p-3"
							>
								<dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
									<Icon className="size-3.5" />
									{
										metric.label
									}
								</dt>

								<dd className="mt-1 font-semibold tabular-nums">
									{
										metric.value
									}
								</dd>
								{"detail" in metric && metric.detail ? (
									<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
										{metric.detail}
									</p>
								) : null}
							</div>
						);
					},
				)}
			</dl>
			{comparisonNote ? <p className="text-xs text-muted-foreground">{comparisonNote}</p> : null}
			{displayedCalories === null ? (
				<p className="text-sm text-muted-foreground">
					Add a dated weight in{" "}
					<Link href="/settings" className="font-medium text-primary hover:underline">
						Rider Profile
					</Link>{" "}
					to estimate calories when a ride has no recorded value or sufficiently complete power data.
				</p>
			) : null}
		</div>
	);
}
