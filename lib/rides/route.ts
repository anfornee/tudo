import { decodeFitActivity } from "@/lib/parseFit";
import { getGpxTrackElements } from "@/lib/parseGpx";
import type { RideSource } from "@/lib/rides/types";

type RoutePoint = [longitude: number, latitude: number];
export type RideRoute = RoutePoint[][];

function appendPoint(segment: RoutePoint[], longitude: number, latitude: number) {
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
      !Number.isFinite(latitude) || Math.abs(latitude) > 90) {
    return;
  }

  const previous = segment.at(-1);
  if (previous?.[0] !== longitude || previous[1] !== latitude) {
    segment.push([longitude, latitude]);
  }
}

export async function readRideRoute(file: File, source: RideSource): Promise<RideRoute> {
  const segments: RideRoute = [];

  if (source === "fit") {
    const { recordMesgs = [] } = decodeFitActivity(await file.arrayBuffer());
    const degreesPerSemicircle = 180 / 2 ** 31;
    const segment: RoutePoint[] = [];
    for (const record of recordMesgs) {
      const { positionLong, positionLat } = record;
      if (positionLong == null || positionLat == null ||
          positionLong === 0x7fffffff || positionLat === 0x7fffffff) continue;
      appendPoint(
        segment,
        positionLong * degreesPerSemicircle,
        positionLat * degreesPerSemicircle,
      );
    }
    segments.push(segment);
  } else {
    let parent: Element | null = null;
    let segment: RoutePoint[] = [];
    for (const point of getGpxTrackElements(await file.text())) {
      if (point.parentElement !== parent) {
        parent = point.parentElement;
        segment = [];
        segments.push(segment);
      }
      const longitude = point.getAttribute("lon");
      const latitude = point.getAttribute("lat");
      if (longitude?.trim() && latitude?.trim()) {
        appendPoint(segment, Number(longitude), Number(latitude));
      }
    }
  }

  return segments.filter((segment) => segment.length >= 2);
}
