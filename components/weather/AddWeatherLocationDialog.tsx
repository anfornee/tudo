"use client";

import { Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import type { WeatherLocationSearchResult } from "@/lib/weather-location-types";

interface AddWeatherLocationDialogProps {
  savedProviderLocationIds: ReadonlySet<number>;
  onAdd: (location: WeatherLocationSearchResult) => Promise<void>;
  onClose: () => void;
}

interface SearchResponse {
  results?: WeatherLocationSearchResult[];
  error?: string;
}

function locationSubtitle(location: WeatherLocationSearchResult) {
  return [location.region, location.country].filter(Boolean).join(", ");
}

export function AddWeatherLocationDialog({
  savedProviderLocationIds,
  onAdd,
  onClose,
}: AddWeatherLocationDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<WeatherLocationSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();

    if (normalizedQuery.length < 3) {
      return;
    }

    const abortController = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/weather/locations?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: abortController.signal },
        );
        const data = (await response.json()) as SearchResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to search for locations.");
        }

        setResults(data.results ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setError(
          error instanceof Error
            ? error.message
            : "Unable to search for locations.",
        );
        setResults([]);
      } finally {
        if (!abortController.signal.aborted) {
          setSearching(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      abortController.abort();
    };
  }, [searchQuery]);

  async function addLocation(location: WeatherLocationSearchResult) {
    setSavingId(location.providerLocationId);
    setError(null);

    try {
      await onAdd(location);
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to save location.",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-location-title"
    >
      <button
        type="button"
        aria-label="Close add location"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-in fade-in-0"
      />

      <section className="absolute inset-x-0 bottom-0 flex max-h-[min(80dvh,42rem)] flex-col rounded-t-3xl border-t bg-background shadow-2xl animate-in slide-in-from-bottom duration-300 sm:top-1/2 sm:right-auto sm:bottom-auto sm:left-1/2 sm:w-[min(32rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border sm:slide-in-from-bottom-4">
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div>
            <h2 id="add-location-title" className="text-lg font-semibold">
              Add location
            </h2>
            <p className="text-sm text-muted-foreground">
              Search for a U.S. city or postal code.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close add location"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="shrink-0 p-4 sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={searchQuery}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setSearchQuery(nextQuery);

                if (nextQuery.trim().length < 3) {
                  setResults([]);
                  setSearching(false);
                  setError(null);
                }
              }}
              placeholder="Search city or ZIP code"
              aria-label="Search for a weather location"
              className="h-11 pr-10 pl-9"
            />
            {searching && (
              <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="min-h-28 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-5">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {!error && searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Enter at least three characters.
            </p>
          )}

          {!error && !searching && searchQuery.trim().length >= 3 && results.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No matching locations found.
            </p>
          )}

          <ul className="grid gap-2">
            {results.map((location) => {
              const isSaved = savedProviderLocationIds.has(
                location.providerLocationId,
              );
              const isSaving = savingId === location.providerLocationId;

              return (
                <li key={location.providerLocationId}>
                  <button
                    type="button"
                    disabled={isSaved || savingId !== null}
                    onClick={() => addLocation(location)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    <MapPin className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {location.name}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {locationSubtitle(location)}
                      </span>
                    </span>
                    {isSaving && <Loader2 className="size-4 animate-spin" />}
                    {isSaved && (
                      <span className="text-xs text-muted-foreground">Saved</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
