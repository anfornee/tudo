import type { DailyRideActivity } from "@/lib/rides/analytics";
import { formatElevationGain, formatRideDistance } from "@/lib/rides/formatters";

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });

export function RideWeeklyActivityChart({ days }: { days: DailyRideActivity[] }) {
  const maximum = Math.max(1, ...days.map((day) => day.totalDistanceMiles));
  const totalDistanceMiles = days.reduce((total, day) => total + day.totalDistanceMiles, 0);
  const totalElevationGainFeet = days.reduce((total, day) => total + day.totalElevationGainFeet, 0);
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div>
        <h2 className="font-semibold">Weekly activity</h2>
        <p className="mt-1 text-sm text-muted-foreground">Distance for the current week, Monday through Sunday.</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div><p className="text-xl font-semibold tabular-nums">{formatRideDistance(totalDistanceMiles)}</p><p className="text-xs text-muted-foreground">Total distance</p></div>
        <div><p className="text-xl font-semibold tabular-nums">{formatElevationGain(totalElevationGainFeet)}</p><p className="text-xs text-muted-foreground">Elevation gain</p></div>
      </div>
      <div className="mt-5 flex h-52 items-end gap-1.5 border-b border-l px-2 pt-4 sm:gap-2" role="img" aria-label="Weekly riding distance bar chart">
        {days.map((day) => {
          const label = `${dateFormatter.format(day.date)}: ${formatRideDistance(day.totalDistanceMiles)}, ${formatElevationGain(day.totalElevationGainFeet)} climbed, ${day.rideCount} ${day.rideCount === 1 ? "ride" : "rides"}`;
          return (
            <div key={day.date.toISOString()} className="group relative flex h-full min-w-0 flex-1 items-end">
              <div
                className="w-full min-w-1 rounded-t-sm bg-primary/80 transition-colors group-hover:bg-primary group-focus-within:bg-primary"
                style={{ height: `${Math.max(day.totalDistanceMiles ? 4 : 1, day.totalDistanceMiles / maximum * 100)}%` }}
                title={label}
                tabIndex={0}
                aria-label={label}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max max-w-48 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-center text-xs text-popover-foreground shadow-sm group-hover:block group-focus-within:block">
                {label}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5 text-center text-xs text-muted-foreground sm:gap-2">
        {days.map((day) => <span key={day.date.toISOString()}>{weekdayFormatter.format(day.date)}</span>)}
      </div>
    </section>
  );
}
