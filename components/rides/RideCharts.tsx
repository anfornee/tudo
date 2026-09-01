import type { RideSample } from "@/lib/ride.types";
import { RideMetricChart } from "@/components/rides/RideMetricChart";

export function RideCharts({ samples }: { samples: RideSample[] | null }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Ride charts</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sensor data plotted against elapsed ride time.</p>
      </div>
      {!samples ? (
        <div className="rounded-xl border border-dashed bg-card/50 px-5 py-8 text-center">
          <p className="font-medium">No detailed data available</p>
          <p className="mt-1 text-sm text-muted-foreground">This ride was saved before detailed samples were retained.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <RideMetricChart title="Power" samples={samples} metric="power" unit="W" />
          <RideMetricChart title="Speed" samples={samples} metric="speedMph" unit="mph" decimals={1} />
          <RideMetricChart title="Cadence" samples={samples} metric="cadence" unit="rpm" />
          <RideMetricChart title="Elevation" samples={samples} metric="elevationFeet" unit="ft" domainMode="padded" />
        </div>
      )}
    </section>
  );
}
