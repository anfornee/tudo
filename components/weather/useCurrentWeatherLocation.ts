"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getCachedWeatherLocation,
  getGeolocationPermissionState,
  isCachedWeatherLocationFresh,
  requestCurrentWeatherLocation,
  WeatherLocationError,
  type CachedWeatherLocation,
  type GeolocationPermissionState,
} from "@/lib/weather-current-location";

interface CurrentWeatherLocationState {
  location: CachedWeatherLocation | null;
  loading: boolean;
  refreshing: boolean;
  message: string | null;
  permission: GeolocationPermissionState | null;
}

function errorMessage(error: unknown) {
  return error instanceof WeatherLocationError
    ? error.message
    : "Unable to determine your current location.";
}

export function useCurrentWeatherLocation(enabled: boolean) {
  const [state, setState] = useState<CurrentWeatherLocationState>({
    location: null,
    loading: enabled,
    refreshing: false,
    message: null,
    permission: null,
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    const initializeTimer = window.setTimeout(async () => {
      const cachedLocation = getCachedWeatherLocation();

      if (cachedLocation && active) {
        setState((current) => ({
          ...current,
          location: cachedLocation,
          loading: false,
        }));
      }

      if (cachedLocation && isCachedWeatherLocationFresh(cachedLocation)) {
        return;
      }

      const permission = await getGeolocationPermissionState();

      if (!active) {
        return;
      }

      setState((current) => ({ ...current, permission }));

      if (cachedLocation && permission !== "granted") {
        setState((current) => ({
          ...current,
          message:
            permission === "denied"
              ? "Using your last known location. Location access is denied in this browser."
              : "Using your last known location. Refresh to update it.",
        }));
        return;
      }

      if (!cachedLocation && permission === "denied") {
        setState((current) => ({
          ...current,
          loading: false,
          message: "Location access is denied in this browser.",
        }));
        return;
      }

      try {
        const location = await requestCurrentWeatherLocation();

        if (active) {
          setState({
            location,
            loading: false,
            refreshing: false,
            message: null,
            permission,
          });
        }
      } catch (error) {
        if (active) {
          setState((current) => ({
            ...current,
            loading: false,
            refreshing: false,
            message: cachedLocation
              ? "Using your last known location. Unable to refresh it right now."
              : errorMessage(error),
          }));
        }
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(initializeTimer);
    };
  }, [enabled]);

  const refresh = useCallback(async () => {
    setState((current) => ({
      ...current,
      refreshing: true,
      message: null,
    }));

    const permission = await getGeolocationPermissionState();

    if (permission === "denied") {
      setState((current) => ({
        ...current,
        refreshing: false,
        permission,
        message: "Location access is denied in this browser.",
      }));
      return null;
    }

    try {
      const location = await requestCurrentWeatherLocation();
      setState({
        location,
        loading: false,
        refreshing: false,
        message: null,
        permission,
      });
      return location;
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        permission,
        message: errorMessage(error),
      }));
      return null;
    }
  }, []);

  return { ...state, refresh };
}
