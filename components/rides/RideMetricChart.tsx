"use client";

import { useMemo } from "react";

import type { RideSample } from "@/lib/ride.types";
import { cursorFromSample, nearestRideSampleIndex, type RideCursor } from "@/lib/rides/cursor";
import { formatRideDistance, formatRideElapsedTime } from "@/lib/rides/formatters";
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
  xAxis?: "elapsed-time" | "distance";
  cursor: RideCursor | null;
  onCursorChange: (cursor: RideCursor | null) => void;
}

export function RideMetricChart({ title, samples, metric, unit, decimals = 0, domainMode = "zero-based", xAxis = "elapsed-time", cursor, onCursorChange }: RideMetricChartProps) {
  const data = useMemo(() => {
    const eligibleSamples = xAxis === "distance"
      ? samples.filter((sample) => sample.distanceMiles !== null && Number.isFinite(sample.distanceMiles))
      : samples;
    return downsampleRideSamples(eligibleSamples, metric);
  }, [metric, samples, xAxis]);
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
  const xValue = (sample: RideSample) => xAxis === "distance" ? sample.distanceMiles! : sample.elapsedSeconds;
  const xMaximum = Math.max(xAxis === "distance" ? 0.1 : 1, ...data.map(xValue));
  const x = (value: number) => PADDING.left + value / xMaximum * (WIDTH - PADDING.left - PADDING.right);
  const y = (value: number) => PADDING.top + (yMaximum - value) / (yMaximum - yMinimum) * (HEIGHT - PADDING.top - PADDING.bottom);
  const path = data.map((sample, index) => `${index ? "L" : "M"}${x(xValue(sample)).toFixed(1)},${y(sample[metric]!).toFixed(1)}`).join(" ");
  const activeSourceIndex = cursor ? nearestRideSampleIndex(samples, xAxis === "distance" ? (cursor.distanceMiles ?? 0) : (cursor.timestampMs == null ? samples[cursor.sampleIndex]?.elapsedSeconds ?? 0 : samples[cursor.sampleIndex]?.elapsedSeconds ?? 0), xAxis === "distance" ? "distanceMiles" : "elapsedSeconds") : null;
  const active = activeSourceIndex === null ? null : data.reduce<RideSample | null>((nearest, sample) => {
    if (!nearest) return sample;
    return Math.abs(sample.elapsedSeconds - samples[activeSourceIndex].elapsedSeconds) < Math.abs(nearest.elapsedSeconds - samples[activeSourceIndex].elapsedSeconds) ? sample : nearest;
  }, null);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const formatValue = (value: number) => `${value.toFixed(decimals)} ${unit}`;
  const formatXAxisValue = (value: number) => xAxis === "distance" ? formatRideDistance(value) : formatRideElapsedTime(value);
  const xAxisDescription = xAxis === "distance" ? "distance" : "elapsed ride time";

  function moveWithKeyboard(direction: 1 | -1) {
    const current = cursor?.sampleIndex ?? samples.indexOf(data[0]);
    const next = Math.max(0, Math.min(samples.length - 1, current + direction));
    onCursorChange(cursorFromSample(samples[next], next));
  }

  function selectNearest(clientX: number, bounds: DOMRect) {
    const selectedValue = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)) * xMaximum;
    let nearest = 0;
    for (let index = 1; index < data.length; index += 1) {
      if (Math.abs(xValue(data[index]) - selectedValue) < Math.abs(xValue(data[nearest]) - selectedValue)) nearest = index;
    }
    const sample = data[nearest];
    const sampleIndex = samples.indexOf(sample);
    if (sampleIndex >= 0) onCursorChange(cursorFromSample(sample, sampleIndex));
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
		  tabIndex={0}
          aria-label={`${title} over ${xAxisDescription}. Minimum ${formatValue(minimum)}, average ${formatValue(average)}, maximum ${formatValue(maximum)}.`}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault();
              moveWithKeyboard(-1);
            } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
              event.preventDefault();
              moveWithKeyboard(1);
            } else if (event.key === "Escape") {
              onCursorChange(null);
            }
          }}
          onPointerMove={(event) => selectNearest(event.clientX, event.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => onCursorChange(null)}
        >
          {[0, 0.5, 1].map((position) => {
            const gridY = PADDING.top + position * (HEIGHT - PADDING.top - PADDING.bottom);
            const labelValue = yMaximum - position * (yMaximum - yMinimum);
            return <g key={position}><line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={gridY} y2={gridY} className="stroke-border" /><text x={PADDING.left - 8} y={gridY + 4} textAnchor="end" className="fill-muted-foreground text-[13px]">{labelValue.toFixed(decimals)}</text></g>;
          })}
          <text x={PADDING.left} y={HEIGHT - 5} className="fill-muted-foreground text-[13px]">{formatXAxisValue(0)}</text>
          <text x={WIDTH - PADDING.right} y={HEIGHT - 5} textAnchor="end" className="fill-muted-foreground text-[13px]">{formatXAxisValue(xMaximum)}</text>
          <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {active && <g><line x1={x(xValue(active))} x2={x(xValue(active))} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} className="stroke-muted-foreground" strokeDasharray="3 3" /><circle cx={x(xValue(active))} cy={y(active[metric]!)} r="4" fill="var(--primary)" /></g>}
        </svg>
        {active && (
          <div className="pointer-events-none absolute right-2 top-2 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm">
            <span className="font-medium">{formatValue(active[metric]!)}</span>
            <span className="ml-2 text-muted-foreground">{formatXAxisValue(xValue(active))}</span>
          </div>
        )}
      </div>
    </article>
  );
}
