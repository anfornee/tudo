"use client";

import { Component, useEffect, useMemo, type ReactNode } from "react";
import type { LngLatBoundsLike, MapMouseEvent } from "maplibre-gl";
import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerLabel,
  useMap,
} from "@/components/ui/map";
import { createPlannedRouteCursorResolver } from "@/lib/routes/geometry";
import type { PlannedRoute, RouteCoordinate, RouteManeuver, RouteWaypoint } from "@/lib/routes/types";

const ROUTE_INTERACTION_LAYER = "route-interaction-layer-planned-road-route";

class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div role="status" className="flex min-h-[24rem] items-center justify-center rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">The route map could not be displayed. Check the configured map style and this device&apos;s WebGL support.</div>
      : this.props.children;
  }
}

function MapClickHandler({ onClick }: { onClick: (coordinate: RouteCoordinate) => void }) {
  const { map } = useMap();
  useEffect(() => {
    if (!map) return;
    const handleClick = (event: MapMouseEvent) => {
      if (event.originalEvent.defaultPrevented) return;
      if (map.getLayer(ROUTE_INTERACTION_LAYER) && map.queryRenderedFeatures(event.point, { layers: [ROUTE_INTERACTION_LAYER] }).length) return;
      onClick([event.lngLat.lng, event.lngLat.lat]);
    };
    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [map, onClick]);
  return null;
}

function FitRoute({ route, waypoints, fitToken }: { route: PlannedRoute | null; waypoints: RouteWaypoint[]; fitToken: number }) {
  const { map } = useMap();
  useEffect(() => {
    if (!map || (!route && !waypoints.length)) return;
    const coordinates = route?.geometry.map((point) => point.coordinate) ?? waypoints.map((point) => point.coordinate);
    if (!coordinates.length) return;
    const bounds = coordinates.reduce(
      (current, coordinate) => [
        [Math.min(current[0][0], coordinate[0]), Math.min(current[0][1], coordinate[1])],
        [Math.max(current[1][0], coordinate[0]), Math.max(current[1][1], coordinate[1])],
      ] as [[number, number], [number, number]],
      [[coordinates[0][0], coordinates[0][1]], [coordinates[0][0], coordinates[0][1]]] as [[number, number], [number, number]],
    );
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.fitBounds(bounds as LngLatBoundsLike, { padding: 48, maxZoom: 16, duration: reducedMotion ? 0 : 500 });
  }, [fitToken, map, route, waypoints]);
  return null;
}

function waypointAppearance(index: number, count: number) {
  if (index === 0) return { label: "S", name: "Start", color: "bg-emerald-600" };
  if (index === count - 1) return { label: "D", name: "Destination", color: "bg-rose-600" };
  return { label: String(index + 1), name: `Waypoint ${index + 1}`, color: "bg-primary" };
}

function MapFrame({ children }: { children: ReactNode }) {
  return <div role="region" aria-label="Interactive road cycling route map" className="h-[56vh] min-h-[24rem] max-h-[42rem] overflow-hidden rounded-xl border bg-muted sm:h-[38rem]">{children}</div>;
}

export default function RoutePlannerMap({
  mapStyleUrl,
  waypoints,
  route,
  cursorIndex,
  selectedWaypointIndex,
  selectedManeuver,
  fitToken,
  initialCenter,
  onMapClick,
  onWaypointSelect,
  onWaypointMove,
  onRouteInsert,
  onCursorChange,
}: {
  mapStyleUrl: string;
  waypoints: RouteWaypoint[];
  route: PlannedRoute | null;
  cursorIndex: number | null;
  selectedWaypointIndex: number | null;
  selectedManeuver: RouteManeuver | null;
  fitToken: number;
  initialCenter: RouteCoordinate;
  onMapClick: (coordinate: RouteCoordinate) => void;
  onWaypointSelect: (index: number) => void;
  onWaypointMove: (index: number, coordinate: RouteCoordinate) => void;
  onRouteInsert: (geometryIndex: number) => void;
  onCursorChange: (index: number | null) => void;
}) {
  const coordinates = useMemo(() => route?.geometry.map((point) => point.coordinate) ?? [], [route]);
  const resolver = useMemo(() => route ? createPlannedRouteCursorResolver(route.geometry) : null, [route]);
  const cursorPoint = cursorIndex === null ? null : route?.geometry[cursorIndex] ?? null;

  return (
    <MapErrorBoundary><MapFrame>
      <Map
        styles={{ light: mapStyleUrl, dark: mapStyleUrl }}
        center={initialCenter}
        zoom={11}
        scrollZoom={false}
        dragRotate={false}
        pitchWithRotate={false}
      >
        <MapControls showZoom showCompass showFullscreen />
        <MapClickHandler onClick={onMapClick} />
        <FitRoute route={route} waypoints={waypoints} fitToken={fitToken} />
        {coordinates.length > 1 ? (
          <MapRoute
            id="planned-road-route"
            coordinates={coordinates}
            color="#e44d2e"
            width={5}
            opacity={0.95}
            onClick={(event) => {
              event.originalEvent.preventDefault();
              const index = resolver?.indexAt([event.lngLat.lng, event.lngLat.lat]);
              if (index !== null && index !== undefined) onRouteInsert(index);
            }}
            onMouseMove={(event) => onCursorChange(resolver?.indexAt([event.lngLat.lng, event.lngLat.lat]) ?? null)}
            onMouseLeave={() => onCursorChange(null)}
          />
        ) : null}
        {waypoints.map((waypoint, index) => {
          const appearance = waypointAppearance(index, waypoints.length);
          return (
            <MapMarker
              key={waypoint.id}
              longitude={waypoint.coordinate[0]}
              latitude={waypoint.coordinate[1]}
              anchor="center"
              draggable
              onClick={(event) => {
                event.stopPropagation();
                onWaypointSelect(index);
              }}
              onDragEnd={(position) => onWaypointMove(index, [position.lng, position.lat])}
            >
              <MarkerContent>
                <button
                  type="button"
                  aria-label={`${appearance.name}${selectedWaypointIndex === index ? ", selected" : ""}`}
                  className={`flex size-10 items-center justify-center rounded-full border-2 font-semibold text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${appearance.color} ${selectedWaypointIndex === index ? "scale-110 ring-2 ring-white" : ""}`}
                >
                  {appearance.label}
                </button>
                <MarkerLabel position="bottom">{appearance.name}</MarkerLabel>
              </MarkerContent>
            </MapMarker>
          );
        })}
        {cursorPoint ? (
          <MapMarker longitude={cursorPoint.coordinate[0]} latitude={cursorPoint.coordinate[1]} anchor="center">
            <MarkerContent><div aria-hidden className="size-4 rounded-full border-2 border-white bg-slate-900 shadow-lg dark:bg-white" /></MarkerContent>
          </MapMarker>
        ) : null}
        {selectedManeuver ? (
          <MapMarker longitude={selectedManeuver.coordinate[0]} latitude={selectedManeuver.coordinate[1]} anchor="bottom">
            <MarkerContent><div className="rounded-md border bg-background px-2 py-1 text-xs font-medium shadow-lg">Selected turn</div></MarkerContent>
          </MapMarker>
        ) : null}
      </Map>
    </MapFrame></MapErrorBoundary>
  );
}
