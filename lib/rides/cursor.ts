import type { RideSample } from "../ride.types";
import type { RideRoute } from "./route";

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

type Coordinate = [longitude: number, latitude: number];
interface IndexedRoutePoint { coordinate: Coordinate; distanceMiles: number }
const EARTH_RADIUS_MILES = 3958.7613;

function haversineMiles(first: Coordinate, second: Coordinate) {
  const latitudeDelta = ((second[1] - first[1]) * Math.PI) / 180;
  const longitudeDelta = ((second[0] - first[0]) * Math.PI) / 180;
  const firstLatitude = (first[1] * Math.PI) / 180;
  const secondLatitude = (second[1] * Math.PI) / 180;
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export interface RouteCursorResolver {
  cursorAt(longitude: number, latitude: number): RideCursor | null;
  coordinateAt(cursor: RideCursor): Coordinate | null;
}

/** Aligns route geometry with samples, including old sidecars without GPS fields. */
export function createRouteCursorResolver(segments: RideRoute, samples: RideSample[]): RouteCursorResolver {
  const points: IndexedRoutePoint[] = [];
  let totalRouteDistance = 0;
  for (const segment of segments) {
    segment.forEach((coordinate, index) => {
      if (index > 0) totalRouteDistance += haversineMiles(segment[index - 1], coordinate);
      points.push({ coordinate, distanceMiles: totalRouteDistance });
    });
  }
  const maximumSampleDistance = samples.reduce(
    (maximum, sample) => Math.max(maximum, sample.distanceMiles ?? 0),
    0,
  );
  const maximumElapsed = samples.at(-1)?.elapsedSeconds ?? 0;
  const cellSize = 0.002;
  const cells = new Map<string, number[]>();
  points.forEach((point, index) => {
    const key = `${Math.floor(point.coordinate[0] / cellSize)}:${Math.floor(point.coordinate[1] / cellSize)}`;
    cells.set(key, [...(cells.get(key) ?? []), index]);
  });

  function nearestPointIndex(longitude: number, latitude: number) {
    const x = Math.floor(longitude / cellSize);
    const y = Math.floor(latitude / cellSize);
    const nearby = [...Array(25)].flatMap((_, offset) => {
      const dx = (offset % 5) - 2;
      const dy = Math.floor(offset / 5) - 2;
      return cells.get(`${x + dx}:${y + dy}`) ?? [];
    });
    const candidates = nearby.length ? nearby : points.map((_, index) => index);
    let nearest: number | null = null;
    let nearestDistance = Infinity;
    const longitudeScale = Math.cos((latitude * Math.PI) / 180);
    for (const index of candidates) {
      const coordinate = points[index].coordinate;
      const distance = ((coordinate[0] - longitude) * longitudeScale) ** 2
        + (coordinate[1] - latitude) ** 2;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    }
    return nearest;
  }

  function pointAtDistance(targetDistance: number): Coordinate | null {
    if (!points.length) return null;
    let low = 0;
    let high = points.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (points[middle].distanceMiles < targetDistance) low = middle + 1;
      else high = middle;
    }
    const current = points[low];
    const previous = points[Math.max(0, low - 1)];
    const span = current.distanceMiles - previous.distanceMiles;
    if (span <= 0) return current.coordinate;
    const fraction = Math.max(0, Math.min(1, (targetDistance - previous.distanceMiles) / span));
    return [
      previous.coordinate[0] + (current.coordinate[0] - previous.coordinate[0]) * fraction,
      previous.coordinate[1] + (current.coordinate[1] - previous.coordinate[1]) * fraction,
    ];
  }

  return {
    cursorAt(longitude, latitude) {
      const routeIndex = nearestPointIndex(longitude, latitude);
      if (routeIndex == null || !samples.length || totalRouteDistance <= 0) return null;
      const fraction = points[routeIndex].distanceMiles / totalRouteDistance;
      const sampleIndex = maximumSampleDistance > 0
        ? nearestRideSampleIndex(samples, fraction * maximumSampleDistance, "distanceMiles")
        : nearestRideSampleIndex(samples, fraction * maximumElapsed);
      return sampleIndex == null ? null : cursorFromSample(samples[sampleIndex], sampleIndex);
    },
    coordinateAt(cursor) {
      const sample = samples[cursor.sampleIndex];
      if (sample?.longitude != null && sample.latitude != null) return [sample.longitude, sample.latitude];
      if (totalRouteDistance <= 0) return points[0]?.coordinate ?? null;
      const distanceFraction = maximumSampleDistance > 0 && cursor.distanceMiles != null
        ? cursor.distanceMiles / maximumSampleDistance
        : maximumElapsed > 0 ? (sample?.elapsedSeconds ?? 0) / maximumElapsed : 0;
      return pointAtDistance(Math.max(0, Math.min(1, distanceFraction)) * totalRouteDistance);
    },
  };
}
