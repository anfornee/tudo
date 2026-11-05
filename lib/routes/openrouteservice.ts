import { deriveElevationChange, geometryWithCumulativeDistance, isRouteCoordinate } from "./geometry.ts";
import type {
  PlannedRoute,
  RoadCyclingPreferences,
  RouteCalculationRequest,
  RouteManeuver,
  RouteManeuverType,
  RouteWaypoint,
} from "./types.ts";

const maneuverTypes: Record<number, RouteManeuverType> = {
  0: "left",
  1: "right",
  2: "sharp_left",
  3: "sharp_right",
  4: "slight_left",
  5: "slight_right",
  6: "straight",
  7: "roundabout_enter",
  8: "roundabout_exit",
  9: "uturn",
  10: "arrive",
  11: "depart",
  12: "keep_left",
  13: "keep_right",
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberPair(value: unknown): [number, number] | null {
  return Array.isArray(value) && value.length >= 2 && finite(value[0]) !== null && finite(value[1]) !== null
    ? [value[0] as number, value[1] as number]
    : null;
}

export function openRouteServiceRequestBody(request: RouteCalculationRequest) {
  const body: Record<string, unknown> = {
    coordinates: request.waypoints.map((waypoint) => waypoint.coordinate),
    elevation: true,
    instructions: true,
    instructions_format: "text",
    language: "en",
    preference: "recommended",
    units: "m",
  };
  if (request.preferences.avoidFerries) body.options = { avoid_features: ["ferries"] };
  return body;
}

function parseManeuvers(properties: Record<string, unknown>, geometry: PlannedRoute["geometry"]) {
  const maneuvers: RouteManeuver[] = [];
  const segments = Array.isArray(properties.segments) ? properties.segments : [];
  for (const segment of segments) {
    const segmentRecord = record(segment);
    const steps = Array.isArray(segmentRecord?.steps) ? segmentRecord.steps : [];
    for (const step of steps) {
      const item = record(step);
      if (!item) continue;
      const waypointPair = numberPair(item.way_points);
      const geometryIndex = waypointPair ? Math.max(0, Math.min(geometry.length - 1, Math.round(waypointPair[0]))) : 0;
      const point = geometry[geometryIndex];
      const instruction = stringValue(item.instruction);
      if (!point || !instruction) continue;
      const typeNumber = finite(item.type);
      maneuvers.push({
        id: `maneuver-${maneuvers.length}`,
        type: typeNumber === null ? "unknown" : maneuverTypes[typeNumber] ?? "unknown",
        instruction,
        coordinate: point.coordinate,
        distanceMeters: finite(item.distance) ?? 0,
        durationSeconds: finite(item.duration) ?? 0,
        routeDistanceMeters: point.distanceMeters,
      });
    }
  }
  return maneuvers;
}

export function adaptOpenRouteServiceResponse(
  value: unknown,
  waypoints: RouteWaypoint[],
  preferences: RoadCyclingPreferences = { avoidFerries: false },
): PlannedRoute {
  const response = record(value);
  const features = Array.isArray(response?.features) ? response.features : [];
  const feature = record(features[0]);
  const geometryRecord = record(feature?.geometry);
  const rawCoordinates = Array.isArray(geometryRecord?.coordinates) ? geometryRecord.coordinates : [];
  const coordinates = rawCoordinates.flatMap((coordinate) => {
    if (!isRouteCoordinate(coordinate)) return [];
    const rawCoordinate = coordinate as unknown[];
    const elevation = finite(rawCoordinate[2]);
    return [[coordinate[0], coordinate[1], ...(elevation === null ? [] : [elevation])] as [number, number, number?]];
  });
  if (geometryRecord?.type !== "LineString" || coordinates.length < 2) {
    throw new Error("The routing provider returned invalid route geometry.");
  }
  const geometry = geometryWithCumulativeDistance(coordinates);
  const properties = record(feature?.properties) ?? {};
  const summary = record(properties.summary) ?? {};
  const rawWaypointIndices = Array.isArray(properties.way_points) ? properties.way_points : [];
  const waypointGeometryIndices = rawWaypointIndices.flatMap((item) => {
    const index = finite(item);
    return index === null ? [] : [Math.max(0, Math.min(geometry.length - 1, Math.round(index)))];
  });
  const normalizedWaypointIndices = waypointGeometryIndices.length === waypoints.length
    ? waypointGeometryIndices
    : waypoints.map((_, index) => Math.round(index / Math.max(1, waypoints.length - 1) * (geometry.length - 1)));
  const elevation = deriveElevationChange(geometry);
  const metadata = record(response?.metadata);
  const engine = record(metadata?.engine);
  const distance = finite(summary.distance) ?? geometry.at(-1)?.distanceMeters ?? 0;
  if (!(distance > 0)) throw new Error("The routing provider returned an empty route.");

  return {
    version: 1,
    preferences,
    waypoints,
    geometry,
    waypointGeometryIndices: normalizedWaypointIndices,
    distanceMeters: distance,
    durationSeconds: finite(summary.duration),
    elevationGainMeters: finite(summary.ascent) ?? elevation?.gainMeters ?? null,
    elevationLossMeters: finite(summary.descent) ?? elevation?.lossMeters ?? null,
    maneuvers: parseManeuvers(properties, geometry),
    provider: {
      provider: "openrouteservice",
      profile: "cycling-road",
      attribution: stringValue(metadata?.attribution) ?? "openrouteservice.org | OpenStreetMap contributors",
      engineVersion: stringValue(engine?.version),
    },
  };
}

export function validateRouteCalculationRequest(value: unknown): RouteCalculationRequest {
  const body = record(value);
  if (!body || !Array.isArray(body.waypoints) || body.waypoints.length < 2 || body.waypoints.length > 25) {
    throw new Error("Add between 2 and 25 waypoints.");
  }
  const waypoints = body.waypoints.map((value, index): RouteWaypoint => {
    const waypoint = record(value);
    if (!waypoint || typeof waypoint.id !== "string" || waypoint.id.length < 1 || waypoint.id.length > 100 || !isRouteCoordinate(waypoint.coordinate)) {
      throw new Error(`Waypoint ${index + 1} is invalid.`);
    }
    return { id: waypoint.id, coordinate: waypoint.coordinate };
  });
  for (let index = 1; index < waypoints.length; index += 1) {
    if (waypoints[index].coordinate[0] === waypoints[index - 1].coordinate[0] && waypoints[index].coordinate[1] === waypoints[index - 1].coordinate[1]) {
      throw new Error("Consecutive waypoints must be in different locations.");
    }
  }
  const preferencesRecord = record(body.preferences);
  const preferences: RoadCyclingPreferences = { avoidFerries: preferencesRecord?.avoidFerries === true };
  return { waypoints, preferences };
}
