import { WeatherPageContent } from "@/components/weather/WeatherPageContent";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function WeatherPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/api/auth/logout");
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Weather</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Current conditions and forecasts for the places you care about.
        </p>
      </div>

      <WeatherPageContent userId={user.uid} />
    </main>
  );
}
