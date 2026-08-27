import { SudokuBlock } from "@/components/dashboard/SudokuBlock";
import { WeatherBar } from "@/components/dashboard/WeatherBar";

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

        <p className="mt-1 text-sm text-muted-foreground">Today at a glance.</p>
      </div>

      <WeatherBar />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SudokuBlock />

        {/* Future dashboard cards */}
      </div>
    </main>
  );
}
