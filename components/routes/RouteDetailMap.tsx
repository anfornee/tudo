"use client";

import { useEffect, useMemo } from "react";
import type { LngLatBoundsLike } from "maplibre-gl";
import { Map, MapControls, MapMarker, MapRoute, MarkerContent, MarkerLabel, useMap } from "@/components/ui/map";
import { createPlannedRouteCursorResolver, splitRouteGeometry } from "@/lib/routes/geometry";
import type { PlannedRoute } from "@/lib/routes/types";

function FitRoute({ route }: { route: PlannedRoute }) {
  const { map } = useMap();
  useEffect(() => {
    if (!map || route.geometry.length < 2) return;
    const coordinates = route.geometry.map((point) => point.coordinate);
    const bounds = coordinates.reduce(
      (current, coordinate) => [
        [Math.min(current[0][0], coordinate[0]), Math.min(current[0][1], coordinate[1])],
        [Math.max(current[1][0], coordinate[0]), Math.max(current[1][1], coordinate[1])],
      ] as [[number, number], [number, number]],
      [[coordinates[0][0], coordinates[0][1]], [coordinates[0][0], coordinates[0][1]]] as [[number, number], [number, number]],
    );
    map.fitBounds(bounds as LngLatBoundsLike, { padding: 48, maxZoom: 16, duration: 0 });
  }, [map, route]);
  return null;
}

export default function RouteDetailMap({
  route,
  mapStyleUrl,
  cursorIndex,
  onCursorChange,
}: {
  route: PlannedRoute;
  mapStyleUrl: string | null;
  cursorIndex: number | null;
  onCursorChange: (index: number | null) => void;
}) {
  const segments = useMemo(() => splitRouteGeometry(route.geometry, route.segmentStartIndices), [route]);
  const cursorResolver = useMemo(() => createPlannedRouteCursorResolver(route.geometry), [route.geometry]);
  const cursorPoint = cursorIndex === null ? null : route.geometry[cursorIndex] ?? null;
  const start = route.geometry[0].coordinate;
  const finish = route.geometry.at(-1)!.coordinate;
  return (
    <div role="region" aria-label="Route map" className="h-[48vh] min-h-80 max-h-[42rem] overflow-hidden rounded-2xl border bg-muted sm:h-[38rem]">
      <Map styles={mapStyleUrl ? { light: mapStyleUrl, dark: mapStyleUrl } : undefined} center={start} zoom={11} scrollZoom={false} dragRotate={false} pitchWithRotate={false}>
        <MapControls showZoom showCompass showFullscreen />
        <FitRoute route={route} />
        {segments.map((segment, index) => (
          <MapRoute
            key={index}
            id={`route-detail-${index}`}
            coordinates={segment.map((point) => point.coordinate)}
            color="#e44d2e"
            width={5}
            opacity={0.95}
            onMouseMove={(event) => onCursorChange(cursorResolver.indexAt([event.lngLat.lng, event.lngLat.lat]))}
            onMouseLeave={() => onCursorChange(null)}
          />
        ))}
        <MapMarker longitude={start[0]} latitude={start[1]} anchor="center"><MarkerContent><div className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-emerald-600 font-semibold text-white shadow-lg">S</div><MarkerLabel position="bottom">Start</MarkerLabel></MarkerContent></MapMarker>
        <MapMarker longitude={finish[0]} latitude={finish[1]} anchor="center"><MarkerContent><div className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-rose-600 font-semibold text-white shadow-lg">F</div><MarkerLabel position="bottom">Finish</MarkerLabel></MarkerContent></MapMarker>
        {cursorPoint ? (
          <MapMarker longitude={cursorPoint.coordinate[0]} latitude={cursorPoint.coordinate[1]} anchor="center">
            <MarkerContent><div aria-hidden className="size-4 rounded-full border-2 border-white bg-slate-900 shadow-lg dark:bg-white" /></MarkerContent>
          </MapMarker>
        ) : null}
      </Map>
    </div>
  );
}
