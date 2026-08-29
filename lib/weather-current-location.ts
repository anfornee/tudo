export const WEATHER_LOCATION_STORAGE_KEY = "tudo:weather:last-location";
export const WEATHER_LOCATION_FRESHNESS_MS = 6 * 60 * 60 * 1000;

export interface CachedWeatherLocation {
  latitude: number;
  longitude: number;
  updatedAt: number;
}

export type GeolocationPermissionState = PermissionState | "unsupported";

export class WeatherLocationError extends Error {
  constructor(
    public readonly reason:
      | "denied"
      | "dismissed"
      | "timeout"
      | "unavailable"
      | "unsupported",
    message: string,
  ) {
    super(message);
    this.name = "WeatherLocationError";
  }
}

let inFlightLocationRequest: Promise<CachedWeatherLocation> | null = null;

function isValidCoordinate(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function parseCachedWeatherLocation(
  value: string,
): CachedWeatherLocation | null {
  try {
    const parsed = JSON.parse(value) as Partial<CachedWeatherLocation>;

    if (
      !isValidCoordinate(parsed.latitude, -90, 90) ||
      !isValidCoordinate(parsed.longitude, -180, 180) ||
      typeof parsed.updatedAt !== "number" ||
      !Number.isFinite(parsed.updatedAt) ||
      parsed.updatedAt <= 0 ||
      parsed.updatedAt > Date.now() + 60_000
    ) {
      return null;
    }

    return {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function getCachedWeatherLocation(): CachedWeatherLocation | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(WEATHER_LOCATION_STORAGE_KEY);

    if (!value) {
      return null;
    }

    const location = parseCachedWeatherLocation(value);

    if (!location) {
      window.localStorage.removeItem(WEATHER_LOCATION_STORAGE_KEY);
    }

    return location;
  } catch {
    return null;
  }
}

export function isCachedWeatherLocationFresh(
  location: CachedWeatherLocation,
  now = Date.now(),
) {
  return now - location.updatedAt < WEATHER_LOCATION_FRESHNESS_MS;
}

function cacheWeatherLocation(location: CachedWeatherLocation) {
  try {
    window.localStorage.setItem(
      WEATHER_LOCATION_STORAGE_KEY,
      JSON.stringify(location),
    );
  } catch {
    // Weather can still use the resolved coordinates when storage is unavailable.
  }
}

export async function getGeolocationPermissionState(): Promise<GeolocationPermissionState> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return "unsupported";
  }

  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unsupported";
  }
}

function geolocationError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return new WeatherLocationError(
      "dismissed",
      "Location access was not granted.",
    );
  }

  if (error.code === error.TIMEOUT) {
    return new WeatherLocationError(
      "timeout",
      "Determining your location took too long.",
    );
  }

  return new WeatherLocationError(
    "unavailable",
    "Unable to determine your current location.",
  );
}

export function requestCurrentWeatherLocation(): Promise<CachedWeatherLocation> {
  if (inFlightLocationRequest) {
    return inFlightLocationRequest;
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(
      new WeatherLocationError(
        "unsupported",
        "Location is not supported by this browser.",
      ),
    );
  }

  inFlightLocationRequest = new Promise<CachedWeatherLocation>(
    (resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            updatedAt: Date.now(),
          };

          cacheWeatherLocation(location);
          resolve(location);
        },
        (error) => reject(geolocationError(error)),
        {
          enableHighAccuracy: false,
          timeout: 10_000,
          maximumAge: 5 * 60 * 1000,
        },
      );
    },
  ).finally(() => {
    inFlightLocationRequest = null;
  });

  return inFlightLocationRequest;
}
