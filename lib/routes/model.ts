import { isRouteCoordinate } from "./geometry.ts";
import type {
  PlannedRoute,
  RouteFilePayload,
  RouteGeometryPoint,
  RouteManeuver,
  RouteManeuverType,
  RouteSourceMetadata,
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

function parseSegmentStartIndices(value: unknown, geometryLength: number) {
  if (value === undefined) return [0];
  if (!Array.isArray(value) || !value.length) return null;
  const indices = value.flatMap((item) => Number.isSafeInteger(item) ? [item as number] : []);
  if (
    indices.length !== value.length || indices[0] !== 0 ||
    indices.some((item, index) => item < 0 || item >= geometryLength || (index > 0 && item <= indices[index - 1]))
  ) return null;
  return indices;
}

function defaultSource(provider: PlannedRoute["provider"]["provider"]): RouteSourceMetadata {
  if (provider === "gpx") return { type: "gpx", label: "GPX import", originalFileName: null, importedAt: null };
  if (provider === "tcx") return { type: "tcx", label: "TCX import", originalFileName: null, importedAt: null };
  if (provider === "wahoo") return { type: "wahoo", label: "Wahoo", originalFileName: null, importedAt: null };
  return { type: "tudo", label: "Tudo", originalFileName: null, importedAt: null };
}

function parseSource(value: unknown, provider: PlannedRoute["provider"]["provider"]): RouteSourceMetadata | null {
  if (value === undefined) return defaultSource(provider);
  const source = record(value);
  if (
    !source || !["tudo", "gpx", "tcx", "wahoo"].includes(String(source.type)) ||
    typeof source.label !== "string" || source.label.length > 120 ||
    !(source.originalFileName === null || typeof source.originalFileName === "string") ||
    !(source.importedAt === null || typeof source.importedAt === "string")
  ) return null;
  return {
    type: source.type as RouteSourceMetadata["type"],
    label: source.label,
    originalFileName: source.originalFileName,
    importedAt: source.importedAt,
  };
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
  const segmentStartIndices = geometry ? parseSegmentStartIndices(route?.segmentStartIndices, geometry.length) : null;
  const providerName = provider?.provider;
  const profile = provider?.profile;
  if (
    route?.version !== 1 || !waypoints || !geometry || !maneuvers || !segmentStartIndices || !provider ||
    typeof preferences?.avoidFerries !== "boolean" ||
    waypointGeometryIndices.length !== waypoints.length || waypointGeometryIndices.some((index) => index >= geometry.length) ||
    distanceMeters === null || distanceMeters <= 0 || durationSeconds === undefined ||
    elevationGainMeters === undefined || elevationLossMeters === undefined ||
    !["openrouteservice", "gpx", "tcx", "wahoo"].includes(String(providerName)) ||
    !["cycling-road", "imported"].includes(String(profile)) ||
    (providerName === "openrouteservice" && profile !== "cycling-road") ||
    (providerName !== "openrouteservice" && profile !== "imported") ||
    typeof provider.attribution !== "string" || !(provider.engineVersion === null || typeof provider.engineVersion === "string")
  ) return null;
  return {
    version: 1,
    preferences: { avoidFerries: preferences.avoidFerries },
    waypoints,
    geometry,
    segmentStartIndices,
    waypointGeometryIndices,
    distanceMeters,
    durationSeconds,
    elevationGainMeters,
    elevationLossMeters,
    maneuvers,
    provider: {
      provider: providerName as PlannedRoute["provider"]["provider"],
      profile: profile as PlannedRoute["provider"]["profile"],
      attribution: provider.attribution,
      engineVersion: provider.engineVersion,
    },
  };
}

export function parseRouteFilePayload(value: unknown): RouteFilePayload | null {
  const payload = record(value);
  const route = parsePlannedRoute(payload?.route);
  const source = route ? parseSource(payload?.source, route.provider.provider) : null;
  return payload?.version === 1 && typeof payload.name === "string" && typeof payload.description === "string" && route && source
    ? { version: 1, name: payload.name, description: payload.description, source, route }
    : null;
}
