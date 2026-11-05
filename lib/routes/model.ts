import { isRouteCoordinate } from "./geometry.ts";
import type {
  PlannedRoute,
  RouteFilePayload,
  RouteGeometryPoint,
  RouteManeuver,
  RouteManeuverType,
  RouteWaypoint,
} from "./types.ts";

const maneuverTypes = new Set<RouteManeuverType>([
  "depart", "left", "right", "sharp_left", "sharp_right", "slight_left", "slight_right",
  "straight", "roundabout_enter", "roundabout_exit", "uturn", "keep_left", "keep_right", "arrive", "unknown",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableFinite(value: unknown) {
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseWaypoints(value: unknown): RouteWaypoint[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 25) return null;
  const waypoints = value.flatMap((item) => {
    const waypoint = record(item);
    return waypoint && typeof waypoint.id === "string" && isRouteCoordinate(waypoint.coordinate)
      ? [{ id: waypoint.id, coordinate: waypoint.coordinate }]
      : [];
  });
  return waypoints.length === value.length ? waypoints : null;
}

function parseGeometry(value: unknown): RouteGeometryPoint[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 200_000) return null;
  const geometry = value.flatMap((item) => {
    const point = record(item);
    const distanceMeters = finite(point?.distanceMeters);
    const elevationMeters = nullableFinite(point?.elevationMeters);
    return point && isRouteCoordinate(point.coordinate) && distanceMeters !== null && distanceMeters >= 0 && elevationMeters !== undefined
      ? [{ coordinate: point.coordinate, distanceMeters, elevationMeters }]
      : [];
  });
  if (geometry.length !== value.length) return null;
  for (let index = 1; index < geometry.length; index += 1) {
    if (geometry[index].distanceMeters < geometry[index - 1].distanceMeters) return null;
  }
  return geometry;
}

function parseManeuvers(value: unknown): RouteManeuver[] | null {
  if (!Array.isArray(value) || value.length > 10_000) return null;
  const maneuvers = value.flatMap((item) => {
    const maneuver = record(item);
    const type = maneuver?.type;
    const distanceMeters = finite(maneuver?.distanceMeters);
    const durationSeconds = finite(maneuver?.durationSeconds);
    const routeDistanceMeters = finite(maneuver?.routeDistanceMeters);
    return maneuver && typeof maneuver.id === "string" && typeof maneuver.instruction === "string" &&
      typeof type === "string" && maneuverTypes.has(type as RouteManeuverType) && isRouteCoordinate(maneuver.coordinate) &&
      distanceMeters !== null && durationSeconds !== null && routeDistanceMeters !== null
      ? [{
          id: maneuver.id,
          type: type as RouteManeuverType,
          instruction: maneuver.instruction,
          coordinate: maneuver.coordinate,
          distanceMeters,
          durationSeconds,
          routeDistanceMeters,
        }]
      : [];
  });
  return maneuvers.length === value.length ? maneuvers : null;
}

export function parsePlannedRoute(value: unknown): PlannedRoute | null {
  const route = record(value);
  const waypoints = parseWaypoints(route?.waypoints);
  const geometry = parseGeometry(route?.geometry);
  const maneuvers = parseManeuvers(route?.maneuvers);
  const waypointGeometryIndices = Array.isArray(route?.waypointGeometryIndices)
    ? route.waypointGeometryIndices.flatMap((item) => Number.isSafeInteger(item) && (item as number) >= 0 ? [item as number] : [])
    : [];
  const provider = record(route?.provider);
  const preferences = record(route?.preferences);
  const distanceMeters = finite(route?.distanceMeters);
  const durationSeconds = nullableFinite(route?.durationSeconds);
  const elevationGainMeters = nullableFinite(route?.elevationGainMeters);
  const elevationLossMeters = nullableFinite(route?.elevationLossMeters);
  if (
    route?.version !== 1 || !waypoints || !geometry || !maneuvers ||
    typeof preferences?.avoidFerries !== "boolean" ||
    waypointGeometryIndices.length !== waypoints.length || waypointGeometryIndices.some((index) => index >= geometry.length) ||
    distanceMeters === null || distanceMeters <= 0 || durationSeconds === undefined ||
    elevationGainMeters === undefined || elevationLossMeters === undefined ||
    provider?.provider !== "openrouteservice" || provider.profile !== "cycling-road" ||
    typeof provider.attribution !== "string" || !(provider.engineVersion === null || typeof provider.engineVersion === "string")
  ) return null;
  return {
    version: 1,
    preferences: { avoidFerries: preferences.avoidFerries },
    waypoints,
    geometry,
    waypointGeometryIndices,
    distanceMeters,
    durationSeconds,
    elevationGainMeters,
    elevationLossMeters,
    maneuvers,
    provider: {
      provider: "openrouteservice",
      profile: "cycling-road",
      attribution: provider.attribution,
      engineVersion: provider.engineVersion,
    },
  };
}

export function parseRouteFilePayload(value: unknown): RouteFilePayload | null {
  const payload = record(value);
  const route = parsePlannedRoute(payload?.route);
  return payload?.version === 1 && typeof payload.name === "string" && typeof payload.description === "string" && route
    ? { version: 1, name: payload.name, description: payload.description, route }
    : null;
}
