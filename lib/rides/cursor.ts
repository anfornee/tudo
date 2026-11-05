import type { RideSample } from "../ride.types";

export interface RideCursor {
  sampleIndex: number;
  timestampMs: number | null;
  distanceMiles: number | null;
}

const sampleLookupCache = new WeakMap<RideSample[], Map<string, Array<{ value: number; index: number }>>>();

export function cursorFromSample(sample: RideSample, sampleIndex: number): RideCursor {
  return {
    sampleIndex,
    timestampMs: sample.timestampMs ?? null,
    distanceMiles: sample.distanceMiles ?? null,
  };
}

export function nearestRideSampleIndex(
  samples: RideSample[],
  value: number,
  axis: "elapsedSeconds" | "distanceMiles" = "elapsedSeconds",
): number | null {
  if (!samples.length || !Number.isFinite(value)) return null;
  let lookup = sampleLookupCache.get(samples);
  if (!lookup) {
    lookup = new Map();
    sampleLookupCache.set(samples, lookup);
  }
  let sorted = lookup.get(axis);
  if (!sorted) {
    sorted = samples
      .map((sample, index) => ({ value: sample[axis], index }))
      .filter((entry): entry is { value: number; index: number } => typeof entry.value === "number" && Number.isFinite(entry.value))
      .sort((a, b) => a.value - b.value);
    lookup.set(axis, sorted);
  }
  if (!sorted.length) return null;

  let low = 0;
  let high = sorted.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sorted[middle].value < value) low = middle + 1;
    else high = middle;
  }
  const previous = sorted[Math.max(0, low - 1)];
  const current = sorted[low]!;
  return previous && Math.abs(previous.value - value) <= Math.abs(current.value - value)
    ? previous.index
    : current.index;
}

export function nearestRouteSampleIndex(
  samples: RideSample[],
  longitude: number,
  latitude: number,
): number | null {
  let nearest: number | null = null;
  let nearestDistance = Infinity;
  samples.forEach((sample, index) => {
    if (sample.latitude == null || sample.longitude == null) return;
    const longitudeScale = Math.cos((latitude * Math.PI) / 180);
    const distance = ((sample.longitude - longitude) * longitudeScale) ** 2 + (sample.latitude - latitude) ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = index;
    }
  });
  return nearest;
}

/** Builds a small spatial hash so map pointer moves do not scan the whole ride. */
export function createRouteSampleResolver(samples: RideSample[]) {
  const cellSize = 0.002;
  const cells = new Map<string, number[]>();
  samples.forEach((sample, index) => {
    if (sample.latitude == null || sample.longitude == null) return;
    const key = `${Math.floor(sample.longitude / cellSize)}:${Math.floor(sample.latitude / cellSize)}`;
    cells.set(key, [...(cells.get(key) ?? []), index]);
  });
  return (longitude: number, latitude: number) => {
    const x = Math.floor(longitude / cellSize);
    const y = Math.floor(latitude / cellSize);
    const candidates = [...Array(9)].flatMap((_, offset) => {
      const dx = (offset % 3) - 1;
      const dy = Math.floor(offset / 3) - 1;
      return cells.get(`${x + dx}:${y + dy}`) ?? [];
    });
    if (!candidates.length) return nearestRouteSampleIndex(samples, longitude, latitude);
    let nearest: number | null = null;
    let nearestDistance = Infinity;
    for (const index of candidates) {
      const sample = samples[index];
      if (sample?.latitude == null || sample.longitude == null) continue;
      const distance = (sample.longitude - longitude) ** 2 + (sample.latitude - latitude) ** 2;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    }
    return nearest;
  };
}
