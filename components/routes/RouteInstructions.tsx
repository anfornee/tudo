"use client";

import { Navigation } from "lucide-react";
import { formatRouteDistance } from "@/lib/routes/formatters";
import type { RouteManeuver } from "@/lib/routes/types";

export function RouteInstructions({ maneuvers, units, selectedId, onSelect }: {
  maneuvers: RouteManeuver[];
  units: "imperial" | "metric";
  selectedId: string | null;
  onSelect: (maneuver: RouteManeuver) => void;
}) {
  if (!maneuvers.length) return null;
  return (
    <details className="rounded-xl border bg-card">
      <summary className="cursor-pointer px-4 py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Turn-by-turn instructions ({maneuvers.length})</summary>
      <ol className="max-h-80 divide-y overflow-y-auto border-t">
        {maneuvers.map((maneuver, index) => (
          <li key={maneuver.id}>
            <button
              type="button"
              onClick={() => onSelect(maneuver)}
              aria-current={selectedId === maneuver.id ? "step" : undefined}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${selectedId === maneuver.id ? "bg-primary/10" : ""}`}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{maneuver.instruction}</span><span className="mt-0.5 block text-xs text-muted-foreground">{formatRouteDistance(maneuver.distanceMeters, units)} to next maneuver · {formatRouteDistance(maneuver.routeDistanceMeters, units)} from start</span></span>
              <Navigation className="mt-1 size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ol>
    </details>
  );
}
