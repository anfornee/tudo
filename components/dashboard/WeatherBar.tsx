"use client";

import {
	Cloud,
	CloudDrizzle,
	CloudFog,
	CloudLightning,
	CloudRain,
	CloudSnow,
	CloudSun,
	Droplets,
	Sun,
	Wind,
} from "lucide-react";
import { useState } from "react";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

import type {
	CurrentWeather,
	DailyWeather,
	HourlyWeather,
} from "@/lib/weather";

type WeatherView = "current" | "hourly" | "daily";

interface WeatherBarProps {
	current: CurrentWeather;
	hourly: HourlyWeather[];
	daily: DailyWeather[];
	locationName?: string;
}

function WeatherIcon({
	condition,
	className = "size-5",
}: {
	condition: string;
	className?: string;
}) {
	const normalized = condition.toLowerCase();

	if (
		normalized.includes("thunder") ||
		normalized.includes("storm")
	) {
		return <CloudLightning className={className} />;
	}

	if (normalized.includes("snow")) {
		return <CloudSnow className={className} />;
	}

	if (
		normalized.includes("rain") ||
		normalized.includes("shower")
	) {
		return <CloudRain className={className} />;
	}

	if (
		normalized.includes("drizzle") ||
		normalized.includes("sprinkle")
	) {
		return <CloudDrizzle className={className} />;
	}

	if (
		normalized.includes("fog") ||
		normalized.includes("mist") ||
		normalized.includes("haze")
	) {
		return <CloudFog className={className} />;
	}

	if (
		normalized.includes("partly") ||
		normalized.includes("mostly sunny") ||
		normalized.includes("mostly clear")
	) {
		return <CloudSun className={className} />;
	}

	if (
		normalized.includes("sunny") ||
		normalized.includes("clear")
	) {
		return <Sun className={className} />;
	}

	return <Cloud className={className} />;
}

function formatHour(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
	}).format(new Date(value));
}

function CurrentView({
	current,
}: {
	current: CurrentWeather;
}) {
	return (
		<div className="flex min-h-20 items-center gap-5">
			<div className="flex shrink-0 items-center gap-3">
				<WeatherIcon
					condition={current.condition}
					className="size-9 text-foreground"
				/>

				<div className="text-4xl font-medium tracking-tight">
					{current.temperature !== null
						? `${current.temperature}°`
						: "—"}
				</div>
			</div>

			<div className="min-w-0">
				<p className="truncate font-medium">
					{current.condition}
				</p>

				<div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
					{current.humidity !== null && (
						<span className="flex items-center gap-1.5">
							<Droplets className="size-3.5" />
							{current.humidity}%
						</span>
					)}

					{current.windSpeed !== null && (
						<span className="flex items-center gap-1.5">
							<Wind className="size-3.5" />
							{current.windSpeed} mph
						</span>
					)}
				</div>
			</div>
		</div>
	);
}

function HourlyView({
	hourly,
}: {
	hourly: HourlyWeather[];
}) {
	return (
		<div className="overflow-x-auto">
			<div className="flex min-w-max gap-2">
				{hourly.slice(0, 8).map((period) => (
					<div
						key={period.startTime}
						className="flex w-20 flex-col items-center gap-1.5 rounded-lg px-2 py-2 text-center"
					>
						<span className="text-xs text-muted-foreground">
							{formatHour(period.startTime)}
						</span>

						<WeatherIcon
							condition={period.shortForecast}
							className="size-5"
						/>

						<span className="font-medium">
							{period.temperature}°
						</span>

						{period.precipitationChance !== null &&
							period.precipitationChance > 0 && (
								<span className="text-xs text-muted-foreground">
									{period.precipitationChance}%
								</span>
							)}
					</div>
				))}
			</div>
		</div>
	);
}

function DailyView({
	daily,
}: {
	daily: DailyWeather[];
}) {
	return (
		<div className="grid grid-cols-5 gap-2">
			{daily.map((period) => (
				<div
					key={period.startTime}
					className="flex min-w-0 flex-col items-center gap-1.5 rounded-lg px-1 py-2 text-center"
				>
					<span className="w-full truncate text-xs text-muted-foreground">
						{period.name}
					</span>

					<WeatherIcon
						condition={period.shortForecast}
						className="size-5"
					/>

					<span className="font-medium">
						{period.temperature}°
					</span>

					{period.precipitationChance !== null &&
						period.precipitationChance > 0 && (
							<span className="text-xs text-muted-foreground">
								{period.precipitationChance}%
							</span>
						)}
				</div>
			))}
		</div>
	);
}

export function WeatherBar({
	current,
	hourly,
	daily,
	locationName = "Weather",
}: WeatherBarProps) {
	const [view, setView] =
		useState<WeatherView>("current");

	return (
		<section className="rounded-xl border bg-card text-card-foreground shadow-sm">
			<div className="flex items-center justify-between gap-4 border-b px-5 py-3">
				<div>
					<p className="text-sm font-medium">
						{locationName}
					</p>
				</div>

				<Select
					value={view}
					onValueChange={(value) =>
						setView(value as WeatherView)
					}
				>
					<SelectTrigger
						className="h-8 w-[120px]"
						aria-label="Weather view"
					>
						<SelectValue />
					</SelectTrigger>

					<SelectContent>
						<SelectItem value="current">
							Current
						</SelectItem>
						<SelectItem value="hourly">
							Hourly
						</SelectItem>
						<SelectItem value="daily">
							5 Days
						</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="px-5 py-4">
				{view === "current" && (
					<CurrentView current={current} />
				)}

				{view === "hourly" && (
					<HourlyView hourly={hourly} />
				)}

				{view === "daily" && (
					<DailyView daily={daily} />
				)}
			</div>
		</section>
	);
}