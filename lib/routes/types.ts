export type RouteCoordinate = [longitude: number, latitude: number];

export interface RouteWaypoint {
  id: string;
  coordinate: RouteCoordinate;
}

export interface RouteGeometryPoint {
  coordinate: RouteCoordinate;
  elevationMeters: number | null;
  distanceMeters: number;
}

export type RouteManeuverType =
  | "depart"
  | "left"
  | "right"
  | "sharp_left"
  | "sharp_right"
  | "slight_left"
  | "slight_right"
  | "straight"
  | "roundabout_enter"
  | "roundabout_exit"
  | "uturn"
  | "keep_left"
  | "keep_right"
  | "arrive"
  | "unknown";

export interface RouteManeuver {
  id: string;
  type: RouteManeuverType;
  instruction: string;
  coordinate: RouteCoordinate;
  distanceMeters: number;
  durationSeconds: number;
  routeDistanceMeters: number;
}

export interface RouteProviderMetadata {
  provider: "openrouteservice";
  profile: "cycling-road";
  attribution: string;
  engineVersion: string | null;
}

export interface PlannedRoute {
  version: 1;
  preferences: RoadCyclingPreferences;
  waypoints: RouteWaypoint[];
  geometry: RouteGeometryPoint[];
  waypointGeometryIndices: number[];
  distanceMeters: number;
  durationSeconds: number | null;
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
  maneuvers: RouteManeuver[];
  provider: RouteProviderMetadata;
}

export interface RoadCyclingPreferences {
  avoidFerries: boolean;
}

export interface RouteCalculationRequest {
  waypoints: RouteWaypoint[];
  preferences: RoadCyclingPreferences;
}

export interface RouteFilePayload {
  version: 1;
  name: string;
  description: string;
  route: PlannedRoute;
}
