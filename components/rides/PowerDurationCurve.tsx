import Link from "next/link";

import { POWER_DURATION_SECONDS } from "@/lib/rides/analytics-model";
import type { ProfilePersonalRecords } from "@/lib/rides/profile-analytics-model";
import { powerDurationRecordPoints } from "@/lib/rides/profile-presentation";

const LABELS: Record<number, string> = {
	5: "5s", 15: "15s", 30: "30s", 60: "1m", 120: "2m", 180: "3m", 300: "5m",
	480: "8m", 600: "10m", 900: "15m", 1200: "20m", 1800: "30m", 2700: "45m", 3600: "1h",
};
const AXIS_DURATIONS = [5, 60, 300, 1200, 3600];

function xPosition(duration: number) {
	const minimum = Math.log10(POWER_DURATION_SECONDS[0]);
	const maximum = Math.log10(POWER_DURATION_SECONDS.at(-1)!);
	return (Math.log10(duration) - minimum) / (maximum - minimum) * 100;
}

export function PowerDurationCurve({ records }: { records: ProfilePersonalRecords["powerDuration"] }) {
	const points = powerDurationRecordPoints(records);
	if (!points.length) return null;
	const maximumWatts = Math.max(...points.map(({ record }) => record.value));
	const yMaximum = Math.max(100, Math.ceil(maximumWatts / 100) * 100);
	return (
		<figure className="mb-4 rounded-xl border bg-background p-3" aria-labelledby="power-curve-caption">
			<div className="relative ml-9 h-52 border-b border-l" role="img" aria-label="Discrete lifetime mean maximal measured power records by effort duration">
				{[0, 0.5, 1].map((ratio) => (
					<div key={ratio} className="absolute left-0 right-0 border-t border-dashed border-border/70" style={{ top: `${ratio * 100}%` }}>
						<span className="absolute right-full -translate-y-1/2 pr-2 text-[10px] tabular-nums text-muted-foreground">{Math.round(yMaximum * (1 - ratio))} W</span>
					</div>
				))}
				{AXIS_DURATIONS.map((duration) => (
					<div key={duration} className="absolute bottom-0 top-0 border-l border-dashed border-border/50" style={{ left: `${xPosition(duration)}%` }}>
						<span className="absolute top-full -translate-x-1/2 pt-1 text-[10px] text-muted-foreground">{LABELS[duration]}</span>
					</div>
				))}
				{points.map(({ duration, record, href }) => {
					const date = new Date(record.activityDate);
					const dateText = Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString();
					const label = `${LABELS[duration]}: ${Math.round(record.value)} watts, ${dateText}`;
					return (
						<div
							key={duration}
							className="group absolute -translate-x-1/2 -translate-y-1/2"
							style={{ left: `${xPosition(duration)}%`, top: `${(1 - record.value / yMaximum) * 100}%` }}
						>
							<Link
								href={href}
								className="block size-3 rounded-full border-2 border-background bg-primary shadow-sm outline-none ring-offset-2 transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
								aria-label={`${label}. Open originating ride.`}
							/>
							<span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max max-w-48 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-center text-xs text-popover-foreground shadow-sm group-hover:block group-focus-within:block">
								{label}
							</span>
						</div>
					);
				})}
			</div>
			<figcaption id="power-curve-caption" className="mt-6 text-xs text-muted-foreground">
				Duration uses logarithmic spacing. Points are discrete measured-power records and are not interpolated.
			</figcaption>
		</figure>
	);
}
