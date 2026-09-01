"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { aggregateRidesByDay, localDateKey, summarizeRideActivity, type RideHistoryItem } from "@/lib/rides/analytics";
import { formatElevationGain, formatRideDistance } from "@/lib/rides/formatters";

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const dayFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function RideCalendar({ rides }: { rides: RideHistoryItem[] }) {
  const latestDate = rides.find((ride) => ride.date)?.date ?? new Date();
  const [month, setMonth] = useState(() => new Date(latestDate.getFullYear(), latestDate.getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const ridesByDay = useMemo(() => aggregateRidesByDay(rides), [rides]);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingDays = (month.getDay() + 6) % 7;
  const todayKey = localDateKey(new Date());
  const selectedRides = selectedKey ? ridesByDay.get(selectedKey) ?? [] : [];
  const monthTotals = summarizeRideActivity(rides.filter((ride) =>
    ride.date?.getFullYear() === month.getFullYear() && ride.date.getMonth() === month.getMonth()
  ));

  function changeMonth(offset: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    setSelectedKey(null);
  }

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Ride calendar</h2>
          <p className="mt-1 text-sm text-muted-foreground">Select a marked day to see its rides.</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft /></Button>
          <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight /></Button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
        <div><p className="font-semibold tabular-nums">{formatRideDistance(monthTotals.distanceMiles)}</p><p className="text-xs text-muted-foreground">Monthly distance</p></div>
        <div><p className="font-semibold tabular-nums">{formatElevationGain(monthTotals.elevationGainFeet)}</p><p className="text-xs text-muted-foreground">Monthly elevation</p></div>
      </div>
      <p className="mt-4 text-center font-medium" aria-live="polite">{monthFormatter.format(month)}</p>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {weekdays.map((day) => <div key={day} className="py-1 text-[11px] font-medium text-muted-foreground sm:text-xs">{day}</div>)}
        {Array.from({ length: leadingDays }, (_, index) => <div key={`empty-${index}`} />)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
          const key = localDateKey(date);
          const dayRides = ridesByDay.get(key) ?? [];
          const hasRides = dayRides.length > 0;
          return (
            <button
              key={key}
              type="button"
              disabled={!hasRides}
              onClick={() => setSelectedKey(key)}
              aria-label={`${dayFormatter.format(date)}${hasRides ? `, ${dayRides.length} ${dayRides.length === 1 ? "ride" : "rides"}` : ", no rides"}`}
              className={`relative flex aspect-square min-h-9 items-center justify-center rounded-lg text-sm transition-colors ${hasRides ? "bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : "text-muted-foreground disabled:opacity-70"} ${key === todayKey ? "ring-2 ring-foreground/40 ring-offset-2 ring-offset-card" : ""} ${key === selectedKey ? "outline-2 outline-offset-2 outline-primary" : ""}`}
            >
              {index + 1}
              {dayRides.length > 1 && <span className="absolute right-1 top-0.5 text-[9px] font-bold" aria-hidden="true">{dayRides.length}</span>}
            </button>
          );
        })}
      </div>
      {selectedKey && (
        <div className="mt-4 border-t pt-4" aria-live="polite">
          <p className="text-sm font-medium">{dayFormatter.format(new Date(`${selectedKey}T12:00:00`))}</p>
          <ul className="mt-2 space-y-2">
            {selectedRides.map((ride) => (
              <li key={ride.id}><Link href={`/rides/${ride.id}`} className="flex min-h-10 items-center justify-between rounded-lg bg-muted/60 px-3 text-sm hover:bg-muted"><span>{formatRideDistance(ride.distanceMiles)}</span><span className="text-muted-foreground">View ride</span></Link></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
