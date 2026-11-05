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

export function deriveElevationChange(points: readonly RouteGeometryPoint[]) {
  let gain = 0;
  let loss = 0;
  let segments = 0;
  for (let index = 1; index < points.length; index += 1) {
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
