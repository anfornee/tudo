"use client";

import { Component, useMemo, type ReactNode } from "react";
import type { LngLatBoundsLike } from "maplibre-gl";
import { Map, MapControls, MapMarker, MapRoute, MarkerContent } from "@/components/ui/map";
import type { RideSample } from "@/lib/ride.types";
import { createRouteCursorResolver, type RideCursor } from "@/lib/rides/cursor";
import type { RideRoute } from "@/lib/rides/route";

function getMapGeometry(segments: RideRoute) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  let previousLongitude = segments[0][0][0];

  const lines = segments.map((segment) => segment.map(([longitude, latitude]): [number, number] => {
    // Keep tracks continuous when crossing the antimeridian.
    longitude += 360 * Math.round((previousLongitude - longitude) / 360);
    previousLongitude = longitude;
    west = Math.min(west, longitude);
    south = Math.min(south, latitude);
    east = Math.max(east, longitude);
    north = Math.max(north, latitude);
    return [longitude, latitude];
  }));

  const bounds: LngLatBoundsLike = [[west, south], [east, north]];
  return { lines, bounds };
}

class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <p role="status" className="text-sm text-muted-foreground">The route map could not be displayed on this device.</p>;
    }
    return this.props.children;
  }
}

export default function RideRouteMap({ segments, samples, cursor, onCursorChange }: { segments: RideRoute; samples: RideSample[] | null; cursor: RideCursor | null; onCursorChange: (cursor: RideCursor | null) => void }) {
  const { lines, bounds } = getMapGeometry(segments);
  const routeCursor = useMemo(
    () => samples?.length ? createRouteCursorResolver(segments, samples) : null,
    [samples, segments],
  );
  const cursorCoordinate = cursor && routeCursor?.coordinateAt(cursor);

  return (
    <MapErrorBoundary>
      <div className="overflow-hidden rounded-lg border bg-muted" style={{ height: "clamp(18rem, 50vw, 24rem)" }}>
        <Map bounds={bounds} fitBoundsOptions={{ padding: 32, maxZoom: 16 }} scrollZoom={false} renderWorldCopies>
          <MapControls showZoom />
          {lines.map((coordinates, index) => (
            <MapRoute
              key={index}
              coordinates={coordinates}
              color="#e44d2e"
              width={4}
              opacity={1}
              interactive={Boolean(routeCursor)}
              onMouseMove={(event) => {
                const nextCursor = routeCursor?.cursorAt(event.lngLat.lng, event.lngLat.lat);
                if (nextCursor) onCursorChange(nextCursor);
              }}
              onMouseLeave={() => onCursorChange(null)}
            />
          ))}
          {cursorCoordinate && (
            <MapMarker longitude={cursorCoordinate[0]} latitude={cursorCoordinate[1]} anchor="center">
              <MarkerContent>
                <div className="size-4 rounded-full border-2 border-white bg-primary shadow-lg" />
              </MarkerContent>
            </MapMarker>
          )}
        </Map>
      </div>
    </MapErrorBoundary>
  );
}
