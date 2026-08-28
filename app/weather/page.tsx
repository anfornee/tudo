import { WeatherBar } from "@/components/dashboard/WeatherBar";

export default function WeatherPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Weather</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Current conditions and the forecast for your location.
        </p>
      </div>

      <WeatherBar />
    </main>
  );
}
