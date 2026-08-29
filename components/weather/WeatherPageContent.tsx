"use client";

import { Loader2, MapPin, Plus } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";

import { WeatherBar } from "@/components/dashboard/WeatherBar";
import { Button } from "@/components/ui/button";
import { AddWeatherLocationDialog } from "@/components/weather/AddWeatherLocationDialog";
import { SwipeToDeleteWeatherBar } from "@/components/weather/SwipeToDeleteWeatherBar";
import { auth } from "@/lib/firebase-client";
import type {
  SavedWeatherLocation,
  WeatherLocationSearchResult,
} from "@/lib/weather-location-types";
import {
  addSavedWeatherLocation,
  getSavedWeatherLocations,
  removeSavedWeatherLocation,
} from "@/lib/weather-locations";

interface WeatherPageContentProps {
  userId: string;
}

export function WeatherPageContent({ userId }: WeatherPageContentProps) {
  const [locations, setLocations] = useState<SavedWeatherLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showAddLocation, setShowAddLocation] = useState(false);

  const loadLocations = useCallback(async () => {
    setLoadingLocations(true);
    setLocationsError(null);

    try {
      const savedLocations = await getSavedWeatherLocations(userId);
      setLocations(savedLocations);
    } catch (error) {
      console.error("Unable to load saved weather locations:", error);
      setLocationsError("Unable to load your saved locations.");
    } finally {
      setLoadingLocations(false);
    }
  }, [userId]);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user || user.uid !== userId) {
        window.location.assign("/api/auth/logout");
        return;
      }

      void loadLocations();
    });
  }, [loadLocations, userId]);

  const savedProviderLocationIds = useMemo(
    () => new Set(locations.map((location) => location.providerLocationId)),
    [locations],
  );

  async function addLocation(location: WeatherLocationSearchResult) {
    const savedLocation = await addSavedWeatherLocation(userId, location);
    setLocations((current) => [...current, savedLocation]);
  }

  async function removeLocation(locationId: string) {
    setRemovingId(locationId);
    setLocationsError(null);

    try {
      await removeSavedWeatherLocation(userId, locationId);
      setLocations((current) =>
        current.filter((location) => location.id !== locationId),
      );
    } catch (error) {
      console.error("Unable to remove saved weather location:", error);
      setLocationsError("Unable to remove that location.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Current location</h2>
          <p className="text-sm text-muted-foreground">
            Determined by this device and never saved automatically.
          </p>
        </div>
        <WeatherBar />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Saved locations</h2>
          </div>
          <Button type="button" onClick={() => setShowAddLocation(true)}>
            <Plus className="size-4" />
            Add location
          </Button>
        </div>

        {loadingLocations && (
          <div className="flex min-h-24 items-center justify-center rounded-xl border bg-card">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {locationsError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <span>{locationsError}</span>
            <Button type="button" variant="outline" size="sm" onClick={loadLocations}>
              Retry
            </Button>
          </div>
        )}

        {!loadingLocations && locations.length === 0 && (
          <div className="rounded-xl border border-dashed bg-card/50 px-5 py-8 text-center">
            <MapPin className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-2 font-medium">No saved locations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a city for quick access to its weather.
            </p>
          </div>
        )}

        {locations.length > 0 && (
          <ul className="grid gap-4">
            {locations.map((location) => (
              <li key={location.id}>
                <SwipeToDeleteWeatherBar
                  location={location}
                  removing={removingId === location.id}
                  onRemove={() => removeLocation(location.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {showAddLocation && (
        <AddWeatherLocationDialog
          savedProviderLocationIds={savedProviderLocationIds}
          onAdd={addLocation}
          onClose={() => setShowAddLocation(false)}
        />
      )}
    </div>
  );
}
