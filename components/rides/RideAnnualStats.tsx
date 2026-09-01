import { Bike, Gauge, Mountain } from "lucide-react";

import type { RideHistoryItem } from "@/lib/rides/analytics";
import { summarizeRideActivity } from "@/lib/rides/analytics";
import { formatElevationGain, formatRideDistance } from "@/lib/rides/formatters";

export function RideAnnualStats({ rides, year = new Date().getFullYear() }: { rides: RideHistoryItem[]; year?: number }) {
  const totals = summarizeRideActivity(rides.filter((ride) => ride.date?.getFullYear() === year));
  const stats = [
    { label: "Rides", value: totals.rideCount.toLocaleString("en-US"), icon: Bike },
    { label: "Distance", value: formatRideDistance(totals.distanceMiles), icon: Gauge },
    { label: "Elevation", value: formatElevationGain(totals.elevationGainFeet), icon: Mountain },
  ];

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="annual-ride-stats-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="annual-ride-stats-title" className="font-semibold">Annual stats</h2>
        <span className="text-sm text-muted-foreground">{year}</span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="min-w-0 rounded-lg bg-muted/50 p-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="size-3.5 shrink-0" />{label}</dt>
            <dd className="mt-1 truncate font-semibold tabular-nums sm:text-lg" title={value}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
