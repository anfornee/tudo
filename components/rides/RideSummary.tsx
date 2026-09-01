import { CalendarDays, Clock3, Gauge, Mountain, Zap } from "lucide-react";

import { formatElevationGain, formatRideDistance, formatRideDuration } from "@/lib/rides/formatters";
import type { RideSummaryMetrics, RideSource } from "@/lib/rides/types";

interface RideSummaryProps {
  ride: RideSummaryMetrics;
  source: RideSource;
  activityDate: Date | null;
  fileName?: string;
}

function formatDate(date: Date | null) {
  if (!date) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function RideSummary({
  ride,
  source,
  activityDate,
  fileName,
}: RideSummaryProps) {
  const metrics = [
    { label: "Distance", value: formatRideDistance(ride.distanceMiles) },
    { label: "Duration", value: formatRideDuration(ride.durationSeconds) },
    ...(Math.round(ride.movingTimeSeconds) !== Math.round(ride.durationSeconds)
      ? [{ label: "Moving time", value: formatRideDuration(ride.movingTimeSeconds) }]
      : []),
    { label: "Average speed", value: `${ride.averageSpeedMph.toFixed(1)} mph` },
    { label: "Elevation", value: formatElevationGain(ride.elevationGainFeet) },
    ...(ride.calories !== null
      ? [{ label: "Calories", value: `${Math.round(ride.calories)} kcal` }]
      : []),
    ...(ride.averagePower !== null
      ? [{ label: "Average power", value: `${Math.round(ride.averagePower)} W` }]
      : []),
    ...(ride.maxPower !== null
      ? [{ label: "Maximum power", value: `${Math.round(ride.maxPower)} W` }]
      : []),
    ...(ride.normalizedPower !== null
      ? [{ label: "Normalized power", value: `${Math.round(ride.normalizedPower)} W` }]
      : []),
    ...(ride.averageCadence !== null
      ? [{ label: "Average cadence", value: `${Math.round(ride.averageCadence)} rpm` }]
      : []),
    ...(ride.maxCadence !== null
      ? [{ label: "Maximum cadence", value: `${Math.round(ride.maxCadence)} rpm` }]
      : []),
    ...(ride.averageHeartRate !== null
      ? [{ label: "Average heart rate", value: `${Math.round(ride.averageHeartRate)} bpm` }]
      : []),
    ...(ride.maxHeartRate !== null
      ? [{ label: "Maximum heart rate", value: `${Math.round(ride.maxHeartRate)} bpm` }]
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
        {fileName && <span className="min-w-0 truncate">{fileName}</span>}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {metrics.map((metric, index) => {
          const Icon = [Gauge, Clock3, Mountain, Zap][index % 4];
          return (
            <div key={metric.label} className="rounded-xl border bg-background p-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="size-3.5" />
                {metric.label}
              </dt>
              <dd className="mt-1 font-semibold tabular-nums">{metric.value}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
