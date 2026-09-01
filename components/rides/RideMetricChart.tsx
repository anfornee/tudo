"use client";

import { useMemo, useState } from "react";

import type { RideSample } from "@/lib/ride.types";
import { formatRideElapsedTime } from "@/lib/rides/formatters";
import { deriveRideMetricDomain, downsampleRideSamples, type RideMetricDomainMode, type RideSampleMetric } from "@/lib/rides/samples";

const WIDTH = 640;
const HEIGHT = 210;
const PADDING = { top: 12, right: 12, bottom: 28, left: 48 };

interface RideMetricChartProps {
  title: string;
  samples: RideSample[];
  metric: RideSampleMetric;
  unit: string;
  decimals?: number;
  domainMode?: RideMetricDomainMode;
}

export function RideMetricChart({ title, samples, metric, unit, decimals = 0, domainMode = "zero-based" }: RideMetricChartProps) {
  const data = useMemo(() => downsampleRideSamples(samples, metric), [metric, samples]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  if (!data.length) {
    return (
      <article className="rounded-xl border bg-background p-4">
        <h3 className="font-medium">{title}</h3>
        <p className="mt-8 pb-8 text-center text-sm text-muted-foreground">No {title.toLowerCase()} data recorded.</p>
      </article>
    );
  }

  const values = data.map((sample) => sample[metric]!);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const domain = deriveRideMetricDomain(values, domainMode)!;
  const yMinimum = domain.minimum;
  const yMaximum = domain.maximum;
  const elapsedMaximum = Math.max(1, data.at(-1)!.elapsedSeconds);
  const x = (seconds: number) => PADDING.left + seconds / elapsedMaximum * (WIDTH - PADDING.left - PADDING.right);
  const y = (value: number) => PADDING.top + (yMaximum - value) / (yMaximum - yMinimum) * (HEIGHT - PADDING.top - PADDING.bottom);
  const path = data.map((sample, index) => `${index ? "L" : "M"}${x(sample.elapsedSeconds).toFixed(1)},${y(sample[metric]!).toFixed(1)}`).join(" ");
  const active = activeIndex === null ? null : data[activeIndex];
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const formatValue = (value: number) => `${value.toFixed(decimals)} ${unit}`;

  function selectNearest(clientX: number, bounds: DOMRect) {
    const elapsed = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)) * elapsedMaximum;
    let nearest = 0;
    for (let index = 1; index < data.length; index += 1) {
      if (Math.abs(data[index].elapsedSeconds - elapsed) < Math.abs(data[nearest].elapsedSeconds - elapsed)) nearest = index;
    }
    setActiveIndex(nearest);
  }

  return (
    <article className="rounded-xl border bg-background p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">Avg {formatValue(average)}</span>
      </div>
      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full touch-pan-y"
          role="img"
          aria-label={`${title} over elapsed ride time. Minimum ${formatValue(minimum)}, average ${formatValue(average)}, maximum ${formatValue(maximum)}.`}
          onPointerMove={(event) => selectNearest(event.clientX, event.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActiveIndex(null)}
        >
          {[0, 0.5, 1].map((position) => {
            const gridY = PADDING.top + position * (HEIGHT - PADDING.top - PADDING.bottom);
            const labelValue = yMaximum - position * (yMaximum - yMinimum);
            return <g key={position}><line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={gridY} y2={gridY} className="stroke-border" /><text x={PADDING.left - 8} y={gridY + 4} textAnchor="end" className="fill-muted-foreground text-[13px]">{labelValue.toFixed(decimals)}</text></g>;
          })}
          <text x={PADDING.left} y={HEIGHT - 5} className="fill-muted-foreground text-[13px]">0:00</text>
          <text x={WIDTH - PADDING.right} y={HEIGHT - 5} textAnchor="end" className="fill-muted-foreground text-[13px]">{formatRideElapsedTime(elapsedMaximum)}</text>
          <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {active && <g><line x1={x(active.elapsedSeconds)} x2={x(active.elapsedSeconds)} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} className="stroke-muted-foreground" strokeDasharray="3 3" /><circle cx={x(active.elapsedSeconds)} cy={y(active[metric]!)} r="4" fill="var(--primary)" /></g>}
        </svg>
        {active && (
          <div className="pointer-events-none absolute right-2 top-2 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm">
            <span className="font-medium">{formatValue(active[metric]!)}</span>
            <span className="ml-2 text-muted-foreground">{formatRideElapsedTime(active.elapsedSeconds)}</span>
          </div>
        )}
      </div>
    </article>
  );
}
