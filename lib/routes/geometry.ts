import type { PlannedRoute, RouteCoordinate, RouteGeometryPoint, RouteWaypoint } from "./types.ts";

const EARTH_RADIUS_METERS = 6_371_008.8;

export function isRouteCoordinate(value: unknown): value is RouteCoordinate {
  return Array.isArray(value) && value.length >= 2 &&
    typeof value[0] === "number" && Number.isFinite(value[0]) && value[0] >= -180 && value[0] <= 180 &&
    typeof value[1] === "number" && Number.isFinite(value[1]) && value[1] >= -90 && value[1] <= 90;
}

export function distanceBetweenCoordinates(left: RouteCoordinate, right: RouteCoordinate) {
  const latitudeDelta = (right[1] - left[1]) * Math.PI / 180;
  const longitudeDelta = (right[0] - left[0]) * Math.PI / 180;
  const leftLatitude = left[1] * Math.PI / 180;
  const rightLatitude = right[1] * Math.PI / 180;
  const value = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function geometryWithCumulativeDistance(
  coordinates: readonly [number, number, number?][],
): RouteGeometryPoint[] {
  let distanceMeters = 0;
  return coordinates.map((coordinate, index) => {
    if (index > 0) {
      const previous = coordinates[index - 1];
      distanceMeters += distanceBetweenCoordinates([previous[0], previous[1]], [coordinate[0], coordinate[1]]);
    }
    const elevation = coordinate[2];
    return {
      coordinate: [coordinate[0], coordinate[1]],
      elevationMeters: typeof elevation === "number" && Number.isFinite(elevation) ? elevation : null,
      distanceMeters,
    };
  });
}

export function geometryFromCoordinateSegments(
  segments: readonly (readonly [number, number, number?][])[],
) {
  const geometry: RouteGeometryPoint[] = [];
  const segmentStartIndices: number[] = [];
  let distanceMeters = 0;

  for (const segment of segments) {
    if (segment.length < 2) continue;
    segmentStartIndices.push(geometry.length);
    segment.forEach((coordinate, index) => {
      if (index > 0) {
        const previous = segment[index - 1];
        distanceMeters += distanceBetweenCoordinates(
          [previous[0], previous[1]],
          [coordinate[0], coordinate[1]],
        );
      }
      const elevation = coordinate[2];
      geometry.push({
        coordinate: [coordinate[0], coordinate[1]],
        elevationMeters: typeof elevation === "number" && Number.isFinite(elevation) ? elevation : null,
        distanceMeters,
      });
    });
  }

  return { geometry, segmentStartIndices };
}

export function splitRouteGeometry(
  geometry: readonly RouteGeometryPoint[],
  segmentStartIndices: readonly number[] = [0],
) {
  const starts = [...new Set(segmentStartIndices)]
    .filter((index) => Number.isSafeInteger(index) && index >= 0 && index < geometry.length)
    .sort((left, right) => left - right);
  if (!starts.length || starts[0] !== 0) starts.unshift(0);
  return starts.map((start, index) => geometry.slice(start, starts[index + 1] ?? geometry.length));
}

export function deriveElevationChange(points: readonly RouteGeometryPoint[], segmentStartIndices: readonly number[] = [0]) {
  let gain = 0;
  let loss = 0;
  let segments = 0;
  const starts = new Set(segmentStartIndices);
  for (let index = 1; index < points.length; index += 1) {
    if (starts.has(index)) continue;
    const previous = points[index - 1].elevationMeters;
    const current = points[index].elevationMeters;
    if (previous === null || current === null) continue;
    const change = current - previous;
    if (change > 0) gain += change;
    else loss += Math.abs(change);
    segments += 1;
  }
  return segments ? { gainMeters: gain, lossMeters: loss } : null;
}

export function createRoutePreviewPath(route: Pick<PlannedRoute, "geometry" | "segmentStartIndices">, maxPoints = 160) {
  const segments = splitRouteGeometry(route.geometry, route.segmentStartIndices).filter((segment) => segment.length > 1);
  if (!segments.length) return "";
  const totalPoints = segments.reduce((sum, segment) => sum + segment.length, 0);
  const sampled = segments.map((segment) => {
    const budget = Math.max(2, Math.floor(maxPoints * segment.length / totalPoints));
    if (segment.length <= budget) return segment;
    return Array.from({ length: budget }, (_, index) => (
      segment[Math.round(index / (budget - 1) * (segment.length - 1))]
    ));
  });
  const coordinates = sampled.flatMap((segment) => segment.map((point) => point.coordinate));
  const meanLatitude = coordinates.reduce((sum, coordinate) => sum + coordinate[1], 0) / coordinates.length;
  const longitudeScale = Math.max(0.1, Math.cos(meanLatitude * Math.PI / 180));
  const projected = sampled.map((segment) => segment.map((point) => ({
    x: point.coordinate[0] * longitudeScale,
    y: point.coordinate[1],
  })));
  const all = projected.flat();
  const minX = Math.min(...all.map((point) => point.x));
  const maxX = Math.max(...all.map((point) => point.x));
  const minY = Math.min(...all.map((point) => point.y));
  const maxY = Math.max(...all.map((point) => point.y));
  const spanX = Math.max(1e-9, maxX - minX);
  const spanY = Math.max(1e-9, maxY - minY);
  const scale = Math.min(900 / spanX, 900 / spanY);
  const width = spanX * scale;
  const height = spanY * scale;
  const offsetX = (1000 - width) / 2;
  const offsetY = (1000 - height) / 2;
  return projected.map((segment) => segment.map((point, index) => {
    const x = offsetX + (point.x - minX) * scale;
    const y = 1000 - (offsetY + (point.y - minY) * scale);
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ")).join(" ");
}

export function nearestGeometryIndexByDistance(points: readonly RouteGeometryPoint[], distanceMeters: number) {
  if (!points.length || !Number.isFinite(distanceMeters)) return null;
  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].distanceMeters < distanceMeters) low = middle + 1;
    else high = middle;
  }
  const previous = points[Math.max(0, low - 1)];
  const current = points[low];
  return Math.abs(previous.distanceMeters - distanceMeters) <= Math.abs(current.distanceMeters - distanceMeters)
    ? Math.max(0, low - 1)
    : low;
}

export interface PlannedRouteCursorResolver {
  indexAt(coordinate: RouteCoordinate): number | null;
}

export function createPlannedRouteCursorResolver(points: readonly RouteGeometryPoint[]): PlannedRouteCursorResolver {
  const cellSize = 0.002;
  const cells = new Map<string, number[]>();
  points.forEach((point, index) => {
    const key = `${Math.floor(point.coordinate[0] / cellSize)}:${Math.floor(point.coordinate[1] / cellSize)}`;
    cells.set(key, [...(cells.get(key) ?? []), index]);
  });

  return {
    indexAt([longitude, latitude]) {
      if (!points.length) return null;
      const cellX = Math.floor(longitude / cellSize);
      const cellY = Math.floor(latitude / cellSize);
      const nearby: number[] = [];
      for (let x = -2; x <= 2; x += 1) {
        for (let y = -2; y <= 2; y += 1) nearby.push(...(cells.get(`${cellX + x}:${cellY + y}`) ?? []));
      }
      const candidates = nearby.length ? nearby : points.map((_, index) => index);
      const longitudeScale = Math.cos(latitude * Math.PI / 180);
      let nearestIndex = candidates[0];
      let nearestDistance = Infinity;
      for (const index of candidates) {
        const coordinate = points[index].coordinate;
        const distance = ((coordinate[0] - longitude) * longitudeScale) ** 2 + (coordinate[1] - latitude) ** 2;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      }
      return nearestIndex;
    },
  };
}

export function waypointInsertionIndex(route: PlannedRoute, geometryIndex: number) {
  for (let index = 1; index < route.waypointGeometryIndices.length; index += 1) {
    if (geometryIndex <= route.waypointGeometryIndices[index]) return index;
  }
  return Math.max(1, route.waypoints.length - 1);
}

export function insertShapingWaypoint(
  route: PlannedRoute,
  geometryIndex: number,
  waypointId: string,
): { index: number; waypoint: RouteWaypoint } | null {
  const point = route.geometry[geometryIndex];
  if (!point) return null;
  return {
    index: waypointInsertionIndex(route, geometryIndex),
    waypoint: { id: waypointId, coordinate: point.coordinate },
  };
}
