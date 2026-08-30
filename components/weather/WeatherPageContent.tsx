"use client";

import { GripVertical, Loader2, MapPin, Plus } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  saveWeatherLocationOrder,
} from "@/lib/weather-locations";
import { cn } from "@/lib/utils";

interface WeatherPageContentProps {
  userId: string;
}

export function WeatherPageContent({ userId }: WeatherPageContentProps) {
  const [locations, setLocations] = useState<SavedWeatherLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [keyboardDragging, setKeyboardDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const locationsRef = useRef(locations);
  const startingLocationsRef = useRef<SavedWeatherLocation[]>(locations);
  const activeLocationRef = useRef<string | null>(null);

  function updateLocations(nextLocations: SavedWeatherLocation[]) {
    locationsRef.current = nextLocations;
    setLocations(nextLocations);
  }

  useEffect(() => {
    locationsRef.current = locations;
  }, [locations]);

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
    const nextSortOrder = locations.reduce(
      (maximum, savedLocation) =>
        Math.max(maximum, savedLocation.sortOrder ?? -1),
      -1,
    ) + 1;
    const savedLocation = await addSavedWeatherLocation(
      userId,
      location,
      nextSortOrder,
    );
    setLocations((current) => [...current, savedLocation]);
  }

  function moveLocation(locationId: string, targetIndex: number) {
    const current = locationsRef.current;
    const currentIndex = current.findIndex((location) => location.id === locationId);
    const boundedIndex = Math.max(0, Math.min(current.length - 1, targetIndex));
    if (currentIndex === -1 || currentIndex === boundedIndex) return;

    const next = [...current];
    const [moved] = next.splice(currentIndex, 1);
    next.splice(boundedIndex, 0, moved);
    updateLocations(next);
  }

  function beginLocationDrag(locationId: string) {
    startingLocationsRef.current = [...locationsRef.current];
    activeLocationRef.current = locationId;
    setActiveLocationId(locationId);
    setLocationsError(null);
  }

  function announceLocationPosition(locationId: string) {
    const location = locationsRef.current.find((item) => item.id === locationId);
    const position = locationsRef.current.findIndex((item) => item.id === locationId) + 1;
    setAnnouncement(
      `${location?.name ?? "Location"} moved to position ${position} of ${locationsRef.current.length}.`,
    );
  }

  function finishLocationDrag(locationId: string) {
    activeLocationRef.current = null;
    setActiveLocationId(null);
    setKeyboardDragging(false);
    announceLocationPosition(locationId);

    const nextIds = locationsRef.current.map((location) => location.id);
    const previousIds = startingLocationsRef.current.map((location) => location.id);
    if (nextIds.every((id, index) => id === previousIds[index])) return;

    void saveWeatherLocationOrder(userId, nextIds).catch((error) => {
      console.error("Unable to save weather location order:", error);
      setLocationsError(
        "Location order could not be saved. The current order remains usable.",
      );
    });
  }

  function handleLocationKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    locationId: string,
  ) {
    if (!keyboardDragging || activeLocationId !== locationId) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        beginLocationDrag(locationId);
        setKeyboardDragging(true);
        setAnnouncement(
          "Location picked up. Use arrow keys to move it, then press Enter or Space to save.",
        );
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      updateLocations(startingLocationsRef.current);
      activeLocationRef.current = null;
      setActiveLocationId(null);
      setKeyboardDragging(false);
      setAnnouncement("Location reorder canceled.");
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      finishLocationDrag(locationId);
      return;
    }

    const currentIndex = locationsRef.current.findIndex(
      (location) => location.id === locationId,
    );
    let targetIndex = currentIndex;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") targetIndex -= 1;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") targetIndex += 1;
    if (event.key === "Home") targetIndex = 0;
    if (event.key === "End") targetIndex = locationsRef.current.length - 1;

    if (targetIndex !== currentIndex) {
      event.preventDefault();
      moveLocation(locationId, targetIndex);
      announceLocationPosition(locationId);
    }
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
          <ul className="grid min-w-0 gap-4">
            {locations.map((location) => {
              const active = activeLocationId === location.id;
              const dragHandle = (
                <button
                  type="button"
                  aria-label={`Reorder ${location.name}`}
                  aria-pressed={active}
                  disabled={removingId === location.id}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    beginLocationDrag(location.id);
                  }}
                  onPointerMove={(event) => {
                    if (
                      activeLocationRef.current !== location.id ||
                      keyboardDragging
                    ) {
                      return;
                    }

                    const target = document
                      .elementFromPoint(event.clientX, event.clientY)
                      ?.closest<HTMLElement>("[data-weather-location-id]");
                    const targetId = target?.dataset.weatherLocationId;
                    if (!targetId || targetId === location.id) return;

                    const targetIndex = locationsRef.current.findIndex(
                      (item) => item.id === targetId,
                    );
                    if (targetIndex !== -1) {
                      moveLocation(location.id, targetIndex);
                    }
                  }}
                  onPointerUp={(event) => {
                    if (
                      activeLocationRef.current !== location.id ||
                      keyboardDragging
                    ) {
                      return;
                    }
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    finishLocationDrag(location.id);
                  }}
                  onPointerCancel={() => {
                    if (
                      activeLocationRef.current !== location.id ||
                      keyboardDragging
                    ) {
                      return;
                    }
                    updateLocations(startingLocationsRef.current);
                    activeLocationRef.current = null;
                    setActiveLocationId(null);
                  }}
                  onKeyDown={(event) =>
                    handleLocationKeyDown(event, location.id)
                  }
                  className={cn(
                    "touch-none rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                    active
                      ? "cursor-grabbing bg-muted text-foreground"
                      : "cursor-grab",
                  )}
                >
                  <GripVertical className="size-5" />
                </button>
              );

              return (
                <li
                  key={location.id}
                  data-weather-location-id={location.id}
                  className={cn(
                    "min-w-0 rounded-xl motion-safe:transition-[opacity,box-shadow]",
                    active &&
                      "opacity-75 ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                >
                  <SwipeToDeleteWeatherBar
                    location={location}
                    removing={removingId === location.id}
                    onRemove={() => removeLocation(location.id)}
                    dragHandle={dragHandle}
                  />
                </li>
              );
            })}
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

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
