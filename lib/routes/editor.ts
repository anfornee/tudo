import type { RouteGeometryPoint, RouteWaypoint } from "./types.ts";

export interface WaypointHistory {
  past: RouteWaypoint[][];
  present: RouteWaypoint[];
  future: RouteWaypoint[][];
}

function sameWaypoints(left: readonly RouteWaypoint[], right: readonly RouteWaypoint[]) {
  return left.length === right.length && left.every((waypoint, index) =>
    waypoint.id === right[index].id &&
    waypoint.coordinate[0] === right[index].coordinate[0] &&
    waypoint.coordinate[1] === right[index].coordinate[1]
  );
}

export function createWaypointHistory(waypoints: RouteWaypoint[] = []): WaypointHistory {
  return { past: [], present: waypoints, future: [] };
}

export function commitWaypoints(history: WaypointHistory, waypoints: RouteWaypoint[]): WaypointHistory {
  if (sameWaypoints(history.present, waypoints)) return history;
  return { past: [...history.past, history.present], present: waypoints, future: [] };
}

export function undoWaypoints(history: WaypointHistory): WaypointHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoWaypoints(history: WaypointHistory): WaypointHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}

export function moveWaypoint(waypoints: readonly RouteWaypoint[], index: number, coordinate: [number, number]) {
  return waypoints.map((waypoint, waypointIndex) => waypointIndex === index ? { ...waypoint, coordinate } : waypoint);
}

export function removeWaypoint(waypoints: readonly RouteWaypoint[], index: number) {
  return waypoints.filter((_, waypointIndex) => waypointIndex !== index);
}

export function insertWaypoint(waypoints: readonly RouteWaypoint[], index: number, waypoint: RouteWaypoint) {
  return [...waypoints.slice(0, index), waypoint, ...waypoints.slice(index)];
}

export type ReturnToStartMode = "out-and-back" | "best-route";

export interface ReturnToStartOptions {
  maximumWaypoints?: number;
  outboundGeometry?: readonly RouteGeometryPoint[];
}

export function routeReturnsToStart(waypoints: readonly RouteWaypoint[]) {
  if (waypoints.length < 2) return false;
  const start = waypoints[0].coordinate;
  const end = waypoints.at(-1)?.coordinate;
  return end?.[0] === start[0] && end[1] === start[1];
}

export function addReturnToStart(
  waypoints: readonly RouteWaypoint[],
  mode: ReturnToStartMode,
  createId: () => string,
  options: ReturnToStartOptions = {},
) {
  if (waypoints.length < 2 || routeReturnsToStart(waypoints)) return [...waypoints];
  const maximumWaypoints = options.maximumWaypoints ?? 25;
  const availableReturnPoints = maximumWaypoints - waypoints.length;
  const outboundGeometry = options.outboundGeometry ?? [];
  const intermediateBudget = Math.max(0, availableReturnPoints - 1);
  const intermediateCount = Math.min(10, intermediateBudget, Math.max(0, outboundGeometry.length - 2));
  const geometryReturnPoints = Array.from({ length: intermediateCount }, (_, index) => {
    const geometryIndex = Math.round(
      (outboundGeometry.length - 1) * (intermediateCount - index) / (intermediateCount + 1),
    );
    return outboundGeometry[geometryIndex];
  });
  const returnPoints = mode === "out-and-back" && geometryReturnPoints.length
    ? [...geometryReturnPoints.map((point) => ({ coordinate: point.coordinate })), waypoints[0]]
    : mode === "out-and-back"
      ? waypoints.slice(0, -1).reverse()
      : [waypoints[0]];
  if (waypoints.length + returnPoints.length > maximumWaypoints) {
    throw new RangeError(
      mode === "out-and-back"
        ? `Out and back needs ${returnPoints.length} more waypoints. Remove some waypoints or choose Best route back.`
        : "This route already uses the maximum number of waypoints.",
    );
  }
  return [
    ...waypoints,
    ...returnPoints.map((waypoint) => ({
      id: createId(),
      coordinate: [...waypoint.coordinate] as RouteWaypoint["coordinate"],
    })),
  ];
}

export function shouldAcceptRoutingResponse(activeRequest: number, responseRequest: number) {
  return activeRequest === responseRequest;
}
