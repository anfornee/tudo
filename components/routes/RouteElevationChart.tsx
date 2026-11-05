"use client";

import { useMemo } from "react";
import { nearestGeometryIndexByDistance } from "@/lib/routes/geometry";
import { formatRouteDistance, formatRouteElevation } from "@/lib/routes/formatters";
import type { RouteGeometryPoint } from "@/lib/routes/types";

const WIDTH = 720;
const HEIGHT = 210;
const PADDING = { top: 14, right: 14, bottom: 30, left: 52 };

export function RouteElevationChart({ points, units, cursorIndex, onCursorChange }: {
  points: RouteGeometryPoint[];
  units: "imperial" | "metric";
  cursorIndex: number | null;
  onCursorChange: (index: number | null) => void;
}) {
  const eligible = useMemo(() => points.flatMap((point, index) => point.elevationMeters === null ? [] : [{ point, index }]), [points]);
  const data = useMemo(() => {
    if (eligible.length <= 800) return eligible;
    const result = [];
    for (let index = 0; index < 800; index += 1) result.push(eligible[Math.round(index / 799 * (eligible.length - 1))]);
    return result;
  }, [eligible]);
  if (data.length < 2) {
    return <div className="rounded-xl border border-dashed bg-background px-4 py-7 text-center text-sm text-muted-foreground">Elevation data is unavailable for this route.</div>;
  }
  const values = data.map(({ point }) => point.elevationMeters!);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max(5, (maximum - minimum) * 0.1);
  const yMinimum = minimum - padding;
  const yMaximum = maximum + padding;
  const distanceMaximum = Math.max(1, points.at(-1)?.distanceMeters ?? 1);
  const x = (distance: number) => PADDING.left + distance / distanceMaximum * (WIDTH - PADDING.left - PADDING.right);
  const y = (elevation: number) => PADDING.top + (yMaximum - elevation) / (yMaximum - yMinimum) * (HEIGHT - PADDING.top - PADDING.bottom);
  const path = data.map(({ point }, index) => `${index ? "L" : "M"}${x(point.distanceMeters).toFixed(1)},${y(point.elevationMeters!).toFixed(1)}`).join(" ");
  const active = cursorIndex === null || points[cursorIndex]?.elevationMeters === null ? null : points[cursorIndex];

  function select(clientX: number, bounds: DOMRect) {
    const distance = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)) * distanceMaximum;
    onCursorChange(nearestGeometryIndexByDistance(points, distance));
  }

  function move(direction: -1 | 1) {
    const index = Math.max(0, Math.min(points.length - 1, (cursorIndex ?? 0) + direction));
    onCursorChange(index);
  }

  return (
    <div className="relative rounded-xl border bg-background p-3 sm:p-4">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full touch-pan-y"
        role="img"
        tabIndex={0}
        aria-label={`Route elevation over distance. Minimum ${formatRouteElevation(minimum, units)}, maximum ${formatRouteElevation(maximum, units)}.`}
        onPointerMove={(event) => select(event.clientX, event.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => onCursorChange(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
          else if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
          else if (event.key === "Escape") onCursorChange(null);
        }}
      >
        {[0, 0.5, 1].map((position) => {
          const gridY = PADDING.top + position * (HEIGHT - PADDING.top - PADDING.bottom);
          const elevation = yMaximum - position * (yMaximum - yMinimum);
          return <g key={position}><line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={gridY} y2={gridY} className="stroke-border" /><text x={PADDING.left - 7} y={gridY + 4} textAnchor="end" className="fill-muted-foreground text-[13px]">{units === "imperial" ? Math.round(elevation * 3.28084) : Math.round(elevation)}</text></g>;
        })}
        <text x={PADDING.left} y={HEIGHT - 5} className="fill-muted-foreground text-[13px]">0</text>
        <text x={WIDTH - PADDING.right} y={HEIGHT - 5} textAnchor="end" className="fill-muted-foreground text-[13px]">{formatRouteDistance(distanceMaximum, units)}</text>
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {active ? <g><line x1={x(active.distanceMeters)} x2={x(active.distanceMeters)} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} className="stroke-muted-foreground" strokeDasharray="3 3" /><circle cx={x(active.distanceMeters)} cy={y(active.elevationMeters!)} r="4" fill="var(--primary)" /></g> : null}
      </svg>
      {active ? <p aria-live="polite" className="pointer-events-none absolute right-5 top-5 rounded-md border bg-popover px-2 py-1 text-xs shadow-sm"><strong>{formatRouteElevation(active.elevationMeters, units)}</strong><span className="ml-2 text-muted-foreground">{formatRouteDistance(active.distanceMeters, units)}</span></p> : null}
    </div>
  );
}
