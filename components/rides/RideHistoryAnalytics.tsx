import { Flame, Trophy } from "lucide-react";

import { RideAnnualStats } from "@/components/rides/RideAnnualStats";
import { RideCalendar } from "@/components/rides/RideCalendar";
import { RideWeeklyActivityChart } from "@/components/rides/RideWeeklyActivityChart";
import { aggregateCurrentWeekByDay, calculateWeeklyRideStreak, type RideHistoryItem } from "@/lib/rides/analytics";

export function RideHistoryAnalytics({ rides }: { rides: RideHistoryItem[] }) {
  const currentWeekDays = aggregateCurrentWeekByDay(rides);
  const streak = calculateWeeklyRideStreak(rides);
  if (!rides.length) return null;

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm"><Flame className="size-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Current streak</p><p className="mt-1 text-2xl font-semibold tabular-nums">{streak.current} <span className="text-sm font-normal text-muted-foreground">{streak.current === 1 ? "week" : "weeks"}</span></p></div>
        <div className="rounded-xl border bg-card p-4 shadow-sm"><Trophy className="size-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Longest streak</p><p className="mt-1 text-2xl font-semibold tabular-nums">{streak.longest} <span className="text-sm font-normal text-muted-foreground">{streak.longest === 1 ? "week" : "weeks"}</span></p></div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <RideWeeklyActivityChart days={currentWeekDays} />
        <RideCalendar rides={rides} />
      </div>
      <RideAnnualStats rides={rides} />
    </section>
  );
}
