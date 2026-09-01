export interface RideHistoryItem {
  id: string;
  date: Date | null;
  distanceMiles: number;
  durationSeconds: number;
  elevationGainFeet: number;
}

export interface WeeklyRideActivity {
  weekStart: Date;
  rideCount: number;
  totalDistanceMiles: number;
  totalDurationSeconds: number;
}

export interface DailyRideActivity {
  date: Date;
  rideCount: number;
  totalDistanceMiles: number;
  totalDurationSeconds: number;
  totalElevationGainFeet: number;
}

export interface RideActivityTotals {
  rideCount: number;
  distanceMiles: number;
  durationSeconds: number;
  elevationGainFeet: number;
}

export interface WeeklyRideStreak {
  current: number;
  longest: number;
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfLocalWeek(date: Date) {
  const result = startOfLocalDay(date);
  const mondayOffset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - mondayOffset);
  return result;
}

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addLocalDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function aggregateCurrentWeekByDay(
  rides: RideHistoryItem[],
  now = new Date(),
): DailyRideActivity[] {
  const weekStart = startOfLocalWeek(now);
  const ridesByDay = aggregateRidesByDay(rides);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addLocalDays(weekStart, index);
    const dayRides = ridesByDay.get(localDateKey(date)) ?? [];
    return {
      date,
      rideCount: dayRides.length,
      totalDistanceMiles: dayRides.reduce((total, ride) => total + ride.distanceMiles, 0),
      totalDurationSeconds: dayRides.reduce((total, ride) => total + ride.durationSeconds, 0),
      totalElevationGainFeet: dayRides.reduce((total, ride) => total + ride.elevationGainFeet, 0),
    };
  });
}

export function summarizeRideActivity(rides: RideHistoryItem[]): RideActivityTotals {
  return rides.reduce<RideActivityTotals>((totals, ride) => ({
    rideCount: totals.rideCount + 1,
    distanceMiles: totals.distanceMiles + ride.distanceMiles,
    durationSeconds: totals.durationSeconds + ride.durationSeconds,
    elevationGainFeet: totals.elevationGainFeet + ride.elevationGainFeet,
  }), { rideCount: 0, distanceMiles: 0, durationSeconds: 0, elevationGainFeet: 0 });
}

export function aggregateRidesByDay(rides: RideHistoryItem[]) {
  const days = new Map<string, RideHistoryItem[]>();
  rides.forEach((ride) => {
    if (!ride.date || !Number.isFinite(ride.date.getTime())) return;
    const key = localDateKey(ride.date);
    days.set(key, [...(days.get(key) ?? []), ride]);
  });
  return days;
}

export function aggregateRidesByWeek(rides: RideHistoryItem[]) {
  const weeks = new Map<string, WeeklyRideActivity>();
  rides.forEach((ride) => {
    if (!ride.date || !Number.isFinite(ride.date.getTime())) return;
    const weekStart = startOfLocalWeek(ride.date);
    const key = localDateKey(weekStart);
    const existing = weeks.get(key) ?? {
      weekStart,
      rideCount: 0,
      totalDistanceMiles: 0,
      totalDurationSeconds: 0,
    };
    existing.rideCount += 1;
    existing.totalDistanceMiles += ride.distanceMiles;
    existing.totalDurationSeconds += ride.durationSeconds;
    weeks.set(key, existing);
  });
  return [...weeks.values()].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
}

export function fillWeeklyRideActivity(
  weeks: WeeklyRideActivity[],
  maximumWeeks = 16,
  now = new Date(),
) {
  if (!weeks.length) return [];
  const byKey = new Map(weeks.map((week) => [localDateKey(week.weekStart), week]));
  const latestRideWeek = weeks.at(-1)!.weekStart;
  const currentWeek = startOfLocalWeek(now);
  const lastWeek = latestRideWeek > currentWeek ? latestRideWeek : currentWeek;
  const firstAvailable = weeks[0].weekStart;
  const firstWeek = new Date(Math.max(
    firstAvailable.getTime(),
    addLocalDays(lastWeek, -(maximumWeeks - 1) * 7).getTime(),
  ));
  const result: WeeklyRideActivity[] = [];
  for (let cursor = firstWeek; cursor <= lastWeek; cursor = addLocalDays(cursor, 7)) {
    result.push(byKey.get(localDateKey(cursor)) ?? {
      weekStart: cursor,
      rideCount: 0,
      totalDistanceMiles: 0,
      totalDurationSeconds: 0,
    });
  }
  return result;
}

export function calculateWeeklyRideStreak(
  rides: RideHistoryItem[],
  now = new Date(),
): WeeklyRideStreak {
  const weekStarts = new Set(
    aggregateRidesByWeek(rides).map((week) => localDateKey(week.weekStart)),
  );
  if (!weekStarts.size) return { current: 0, longest: 0 };

  const sorted = [...weekStarts].map((key) => startOfLocalDay(new Date(`${key}T12:00:00`)))
    .sort((a, b) => a.getTime() - b.getTime());
  let longest = 1;
  let run = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    const days = Math.round((sorted[index].getTime() - sorted[index - 1].getTime()) / 86_400_000);
    run = days === 7 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const currentWeek = startOfLocalWeek(now);
  const anchor = weekStarts.has(localDateKey(currentWeek)) ? currentWeek : addLocalDays(currentWeek, -7);
  let current = 0;
  for (let cursor = anchor; weekStarts.has(localDateKey(cursor)); cursor = addLocalDays(cursor, -7)) {
    current += 1;
  }
  return { current, longest };
}

export function weekDateRange(weekStart: Date) {
  return { start: weekStart, end: addLocalDays(weekStart, 6) };
}
