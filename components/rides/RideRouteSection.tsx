"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { getOriginalRideFile } from "@/lib/rides/source";
import type { RideRoute } from "@/lib/rides/route";
import type { SavedRide } from "@/lib/rides/types";

const RideRouteMap = dynamic(() => import("./RideRouteMap"), {
  ssr: false,
  loading: () => <p role="status" className="text-sm text-muted-foreground">Loading map...</p>,
});

export function RideRouteSection({ ride }: { ride: SavedRide }) {
  const [result, setResult] = useState<RideRoute>([]);
  const { id, originalFilePath, originalFileName, source } = ride;

  useEffect(() => {
    if (!originalFilePath) return;
    const controller = new AbortController();

    async function loadRoute() {
      try {
        const [{ readRideRoute }, file] = await Promise.all([
          import("@/lib/rides/route"),
          getOriginalRideFile({ id, originalFilePath, originalFileName, source }, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        const route = await readRideRoute(file, source);
        if (!controller.signal.aborted) setResult(route);
      } catch {
        // The route card stays hidden when the track cannot be read.
      }
    }

    void loadRoute();
    return () => controller.abort();
  }, [id, originalFilePath, originalFileName, source]);

  if (result.length === 0) return null;

  return (
    <section aria-labelledby="ride-route-heading" className="space-y-3 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <h2 id="ride-route-heading" className="text-lg font-semibold">Ride route</h2>
      <RideRouteMap segments={result} />
    </section>
  );
}
