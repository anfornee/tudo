import type { RouteWaypoint } from "./types.ts";

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

export function shouldAcceptRoutingResponse(activeRequest: number, responseRequest: number) {
  return activeRequest === responseRequest;
}
