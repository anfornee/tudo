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
  LoaderCircle,
  MapPin,
  RefreshCw,
  Sun,
  Wind,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
  WeatherData,
} from "@/lib/weather";

type WeatherView = "current" | "hourly" | "daily";

function WeatherIcon({
  condition,
  className = "size-5",
}: {
  condition: string;
  className?: string;
}) {
  const normalized = condition.toLowerCase();

  if (normalized.includes("thunder") || normalized.includes("storm")) {
    return <CloudLightning className={className} />;
  }

  if (normalized.includes("snow")) {
    return <CloudSnow className={className} />;
  }

  if (normalized.includes("rain") || normalized.includes("shower")) {
    return <CloudRain className={className} />;
  }

  if (normalized.includes("drizzle") || normalized.includes("sprinkle")) {
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

  if (normalized.includes("sunny") || normalized.includes("clear")) {
    return <Sun className={className} />;
  }

  return <Cloud className={className} />;
}

function formatHour(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
  }).format(new Date(value));
}

function CurrentView({ current }: { current: CurrentWeather }) {
  return (
    <div className="flex min-h-20 items-center gap-5">
      <div className="flex shrink-0 items-center gap-3">
        <WeatherIcon
          condition={current.condition}
          className="size-9 text-foreground"
        />

        <div className="text-4xl font-medium tracking-tight">
          {current.temperature !== null ? `${current.temperature}°` : "—"}
        </div>
      </div>

      <div className="min-w-0">
        <p className="truncate font-medium">{current.condition}</p>

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

function HourlyView({ hourly }: { hourly: HourlyWeather[] }) {
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

            <WeatherIcon condition={period.shortForecast} className="size-5" />

            <span className="font-medium">{period.temperature}°</span>

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

function DailyView({ daily }: { daily: DailyWeather[] }) {
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

          <WeatherIcon condition={period.shortForecast} className="size-5" />

          <span className="font-medium">{period.temperature}°</span>

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

export function WeatherBar() {
  const [view, setView] = useState<WeatherView>("current");

  const [weather, setWeather] = useState<WeatherData | null>(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);

  const loadWeather = useCallback(async (backgroundRefresh = false) => {
    if (!navigator.geolocation) {
      setError("Location is not supported by this device.");

      setLoading(false);

      return;
    }

    if (backgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch("/api/weather", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          });

          if (!response.ok) {
            throw new Error("Weather request failed.");
          }

          const data = (await response.json()) as WeatherData;

          if (!isMounted.current) {
            return;
          }

          setWeather(data);
        } catch (error) {
          console.error("Unable to load weather:", error);

          if (isMounted.current) {
            setError("Unable to load weather.");
          }
        } finally {
          if (isMounted.current) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      },
      (error) => {
        console.error("Unable to retrieve location:", error);

        if (!isMounted.current) {
          return;
        }

        if (error.code === error.PERMISSION_DENIED) {
          setError("Location permission is needed to show local weather.");
        } else {
          setError("Unable to determine your location.");
        }

        setLoading(false);
        setRefreshing(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 5 * 60 * 1000,
      },
    );
  }, []);

  useEffect(() => {
    isMounted.current = true;

    loadWeather();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadWeather(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted.current = false;

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadWeather]);

  return (
    <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="size-3.5 shrink-0 text-muted-foreground" />

          <p className="truncate text-sm font-medium">
            {weather?.locationName ?? "Local weather"}
          </p>

          <button
            type="button"
            onClick={() => loadWeather(true)}
            disabled={refreshing}
            aria-label="Refresh weather"
            title="Refresh weather"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <Select
          value={view}
          onValueChange={(value) => setView(value as WeatherView)}
          disabled={!weather}
        >
          <SelectTrigger className="h-8 w-[120px]" aria-label="Weather view">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="current">Current</SelectItem>

            <SelectItem value="hourly">Hourly</SelectItem>

            <SelectItem value="daily">5 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="relative min-h-28 px-5 py-4">
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
            loading && !weather
              ? "opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        >
          <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
        </div>

        <div
          className={`transition-opacity duration-500 ${
            weather ? "opacity-100" : "opacity-0"
          }`}
        >
          {weather && view === "current" && (
            <CurrentView current={weather.current} />
          )}

          {weather && view === "hourly" && (
            <HourlyView hourly={weather.hourly} />
          )}

          {weather && view === "daily" && <DailyView daily={weather.daily} />}
        </div>

        {error && !weather && !loading && (
          <div className="flex min-h-20 items-center justify-center text-center">
            <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
          </div>
        )}
      </div>
    </section>
  );
}
