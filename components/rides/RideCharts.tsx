import type { RideSample } from "@/lib/ride.types";
import type { RideCursor } from "@/lib/rides/cursor";
import { RideMetricChart } from "@/components/rides/RideMetricChart";

export function RideCharts({ samples, cursor, onCursorChange }: { samples: RideSample[] | null; cursor: RideCursor | null; onCursorChange: (cursor: RideCursor | null) => void }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Ride charts</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sensor data over elapsed time, with elevation plotted over distance.</p>
      </div>
      {!samples ? (
        <div className="rounded-xl border border-dashed bg-card/50 px-5 py-8 text-center">
          <p className="font-medium">No detailed data available</p>
          <p className="mt-1 text-sm text-muted-foreground">This ride was saved before detailed samples were retained.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <RideMetricChart title="Power" samples={samples} metric="power" unit="W" cursor={cursor} onCursorChange={onCursorChange} />
          <RideMetricChart title="Speed" samples={samples} metric="speedMph" unit="mph" decimals={1} cursor={cursor} onCursorChange={onCursorChange} />
          <RideMetricChart title="Cadence" samples={samples} metric="cadence" unit="rpm" cursor={cursor} onCursorChange={onCursorChange} />
          <RideMetricChart title="Elevation" samples={samples} metric="elevationFeet" unit="ft" domainMode="padded" xAxis="distance" cursor={cursor} onCursorChange={onCursorChange} />
        </div>
      )}
    </section>
  );
}
