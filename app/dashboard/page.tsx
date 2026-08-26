import { WeatherBar } from "@/components/dashboard/WeatherBar";
import { getWeather } from "@/lib/weather";

export default async function DashboardPage() {
	const latitude = 28.390556;
	const longitude = -81.380278;

	const weather = await getWeather(latitude, longitude);

	return (
		<main className="mx-auto w-full max-w-6xl space-y-6 p-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">
					Dashboard
				</h1>

				<p className="mt-1 text-sm text-muted-foreground">
					Today at a glance.
				</p>
			</div>

			<WeatherBar
				current={weather.current}
				hourly={weather.hourly}
				daily={weather.daily}
				locationName="Orlando"
			/>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{/* Future dashboard cards */}
			</div>
		</main>
	);
}