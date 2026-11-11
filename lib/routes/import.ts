import { XMLParser, XMLValidator } from "fast-xml-parser";
import {
  createPlannedRouteCursorResolver,
  deriveElevationChange,
  geometryFromCoordinateSegments,
  isRouteCoordinate,
} from "./geometry.ts";
import type {
  PlannedRoute,
  RouteCoordinate,
  RouteManeuver,
  RouteManeuverType,
  RouteSourceMetadata,
} from "./types.ts";

export const MAX_ROUTE_IMPORT_BYTES = 10 * 1024 * 1024;

export type RouteImportFormat = "gpx" | "tcx";

export interface ImportedRouteCandidate {
  id: string;
  name: string;
  description: string;
  route: PlannedRoute;
  source: RouteSourceMetadata;
}

export interface ParsedRouteImport {
  format: RouteImportFormat;
  candidates: ImportedRouteCandidate[];
}

type XmlRecord = Record<string, unknown>;
type CoordinateWithElevation = [longitude: number, latitude: number, elevation?: number];

const parser = new XMLParser({
  attributeNamePrefix: "@_",
  ignoreAttributes: false,
  parseTagValue: false,
  processEntities: false,
  removeNSPrefix: true,
  trimValues: true,
});

function asRecord(value: unknown): XmlRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as XmlRecord : null;
}

function asArray(value: unknown): unknown[] {
  return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
}

function asText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  const item = asRecord(value);
  return typeof item?.["#text"] === "string" ? item["#text"].trim() : "";
}

function asFiniteNumber(value: unknown) {
  const parsed = Number(asText(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function coordinate(longitude: unknown, latitude: unknown, elevation: unknown): CoordinateWithElevation | null {
  const lon = asFiniteNumber(longitude);
  const lat = asFiniteNumber(latitude);
  const ele = asFiniteNumber(elevation);
  if (lon === null || lat === null || !isRouteCoordinate([lon, lat])) return null;
  return ele === null ? [lon, lat] : [lon, lat, ele];
}

function sourceLabel(format: RouteImportFormat, creator: string) {
  const normalized = creator.toLowerCase();
  const service = normalized.includes("strava") ? "Strava"
    : normalized.includes("komoot") ? "Komoot"
    : normalized.includes("ride with gps") || normalized.includes("ridewithgps") ? "Ride with GPS"
    : normalized.includes("wahoo") ? "Wahoo"
    : "";
  return service ? `${service} ${format.toUpperCase()}` : `${format.toUpperCase()} import`;
}

function importedSource(format: RouteImportFormat, fileName: string, creator: string): RouteSourceMetadata {
  return {
    type: format,
    label: sourceLabel(format, creator),
    originalFileName: fileName.slice(0, 255),
    importedAt: new Date().toISOString(),
  };
}

function maneuverType(value: string): RouteManeuverType {
  const normalized = value.toLowerCase().replaceAll(/[^a-z]+/g, " ").trim();
  if (normalized.includes("sharp") && normalized.includes("left")) return "sharp_left";
  if (normalized.includes("sharp") && normalized.includes("right")) return "sharp_right";
  if (normalized.includes("slight") && normalized.includes("left")) return "slight_left";
  if (normalized.includes("slight") && normalized.includes("right")) return "slight_right";
  if (normalized.includes("left")) return "left";
  if (normalized.includes("right")) return "right";
  if (normalized.includes("straight")) return "straight";
  if (normalized.includes("summit") || normalized.includes("generic")) return "unknown";
  return "unknown";
}

function createRoute(
  format: RouteImportFormat,
  segments: CoordinateWithElevation[][],
  cues: Array<{ coordinate: RouteCoordinate; name: string; type: string }> = [],
): PlannedRoute | null {
  const validSegments = segments.filter((segment) => segment.length >= 2);
  const pointCount = validSegments.reduce((sum, segment) => sum + segment.length, 0);
  if (pointCount > 200_000) throw new Error("Route files may contain at most 200,000 valid points per route.");
  if (cues.length > 10_000) throw new Error("Route files may contain at most 10,000 navigation cues per route.");
  const { geometry, segmentStartIndices } = geometryFromCoordinateSegments(validSegments);
  if (geometry.length < 2) return null;
  const elevation = deriveElevationChange(geometry, segmentStartIndices);
  const cursor = createPlannedRouteCursorResolver(geometry);
  const maneuvers: RouteManeuver[] = cues.flatMap((cue, index) => {
    const geometryIndex = cursor.indexAt(cue.coordinate);
    const point = geometryIndex === null ? null : geometry[geometryIndex];
    if (!point) return [];
    return [{
      id: `import-cue-${index + 1}`,
      type: maneuverType(cue.type),
      instruction: cue.name || cue.type || "Course point",
      coordinate: cue.coordinate,
      distanceMeters: 0,
      durationSeconds: 0,
      routeDistanceMeters: point.distanceMeters,
    }];
  });
  const lastIndex = geometry.length - 1;
  return {
    version: 1,
    preferences: { avoidFerries: false },
    waypoints: [
      { id: "import-start", coordinate: geometry[0].coordinate },
      { id: "import-finish", coordinate: geometry[lastIndex].coordinate },
    ],
    geometry,
    segmentStartIndices,
    waypointGeometryIndices: [0, lastIndex],
    distanceMeters: geometry[lastIndex].distanceMeters,
    durationSeconds: null,
    elevationGainMeters: elevation?.gainMeters ?? null,
    elevationLossMeters: elevation?.lossMeters ?? null,
    maneuvers,
    provider: {
      provider: format,
      profile: "imported",
      attribution: `${format.toUpperCase()} import`,
      engineVersion: null,
    },
  };
}

function parseGpxPoint(value: unknown) {
  const point = asRecord(value);
  return point ? coordinate(point["@_lon"], point["@_lat"], point.ele) : null;
}

function parseGpx(root: XmlRecord, fileName: string): ImportedRouteCandidate[] {
  const gpx = asRecord(root.gpx);
  if (!gpx) throw new Error("This file does not contain a GPX document.");
  const version = asText(gpx["@_version"]);
  if (version && version !== "1.0" && version !== "1.1") throw new Error(`GPX ${version} is not supported.`);
  const creator = asText(gpx["@_creator"]);
  const metadata = asRecord(gpx.metadata);
  const metadataName = asText(metadata?.name);
  const metadataDescription = asText(metadata?.desc);
  const source = importedSource("gpx", fileName, creator);
  const candidates: ImportedRouteCandidate[] = [];

  asArray(gpx.trk).forEach((value, trackIndex) => {
    const track = asRecord(value);
    if (!track) return;
    const segments = asArray(track.trkseg).flatMap((segmentValue) => {
      const segment = asRecord(segmentValue);
      const rawPoints = asArray(segment?.trkpt);
      const parsedPoints = rawPoints.map(parseGpxPoint);
      if (parsedPoints.some((point) => point === null)) throw new Error("The GPX file contains an invalid track coordinate.");
      const points = parsedPoints.filter((point): point is CoordinateWithElevation => point !== null);
      return points.length >= 2 ? [points] : [];
    });
    const route = createRoute("gpx", segments);
    if (!route) return;
    candidates.push({
      id: `gpx-track-${trackIndex + 1}`,
      name: asText(track.name) || (trackIndex === 0 ? metadataName : "") || `Imported route ${candidates.length + 1}`,
      description: asText(track.desc) || asText(track.cmt) || (trackIndex === 0 ? metadataDescription : ""),
      route,
      source,
    });
  });

  asArray(gpx.rte).forEach((value, routeIndex) => {
    const routeElement = asRecord(value);
    if (!routeElement) return;
    const rawRoutePoints = asArray(routeElement.rtept);
    const parsedRoutePoints = rawRoutePoints.map((pointValue) => ({ pointValue, parsed: parseGpxPoint(pointValue) }));
    if (parsedRoutePoints.some(({ parsed }) => parsed === null)) throw new Error("The GPX file contains an invalid route coordinate.");
    const routePoints = parsedRoutePoints.flatMap(({ pointValue, parsed }) => {
      const point = asRecord(pointValue);
      return parsed ? [{ parsed, point }] : [];
    });
    const route = createRoute("gpx", [routePoints.map(({ parsed }) => parsed)], routePoints.flatMap(({ parsed, point }) => {
      const name = asText(point?.name);
      return name ? [{ coordinate: [parsed[0], parsed[1]] as RouteCoordinate, name, type: asText(point?.type) }] : [];
    }));
    if (!route) return;
    candidates.push({
      id: `gpx-route-${routeIndex + 1}`,
      name: asText(routeElement.name) || (!candidates.length && routeIndex === 0 ? metadataName : "") || `Imported route ${candidates.length + 1}`,
      description: asText(routeElement.desc) || asText(routeElement.cmt) || (!candidates.length && routeIndex === 0 ? metadataDescription : ""),
      route,
      source,
    });
  });

  return candidates;
}

function tcxPosition(value: unknown) {
  const point = asRecord(value);
  const position = asRecord(point?.Position);
  return point && position
    ? coordinate(position.LongitudeDegrees, position.LatitudeDegrees, point.AltitudeMeters)
    : null;
}

function parseTcx(root: XmlRecord, fileName: string): ImportedRouteCandidate[] {
  const database = asRecord(root.TrainingCenterDatabase);
  const courses = asRecord(database?.Courses);
  if (!database) throw new Error("This file does not contain a TCX document.");
  const creator = asText(asRecord(database?.Author)?.Name);
  const source = importedSource("tcx", fileName, creator);
  return asArray(courses?.Course).flatMap((value, courseIndex) => {
    const course = asRecord(value);
    if (!course) return [];
    const courseTracks = asArray(course.Track);
    const lapTracks = asArray(course.Lap).flatMap((lapValue) => {
      const lap = asRecord(lapValue);
      return asArray(lap?.Track);
    });
    const segments = [...courseTracks, ...lapTracks].flatMap((trackValue) => {
      const track = asRecord(trackValue);
      const rawPoints = asArray(track?.Trackpoint);
      const parsedPoints = rawPoints.map(tcxPosition);
      if (parsedPoints.some((point) => point === null)) throw new Error("The TCX file contains a trackpoint without a valid position.");
      const points = parsedPoints.filter((point): point is CoordinateWithElevation => point !== null);
      return points.length >= 2 ? [points] : [];
    });
    const cues = asArray(course.CoursePoint).flatMap((cueValue) => {
      const cue = asRecord(cueValue);
      const position = asRecord(cue?.Position);
      const parsed = position ? coordinate(position.LongitudeDegrees, position.LatitudeDegrees, null) : null;
      if (!cue || !parsed) return [];
      return [{
        coordinate: [parsed[0], parsed[1]] as RouteCoordinate,
        name: asText(cue.Name) || asText(cue.Notes),
        type: asText(cue.PointType),
      }];
    });
    const route = createRoute("tcx", segments, cues);
    return route ? [{
      id: `tcx-course-${courseIndex + 1}`,
      name: asText(course.Name) || `Imported route ${courseIndex + 1}`,
      description: asText(course.Notes),
      route,
      source,
    }] : [];
  });
}

export function detectRouteImportFormat(fileName: string, xml: string): RouteImportFormat {
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "gpx") return "gpx";
  if (extension === "tcx") return "tcx";
  if (/<(?:\w+:)?gpx(?:\s|>)/i.test(xml)) return "gpx";
  if (/<(?:\w+:)?TrainingCenterDatabase(?:\s|>)/i.test(xml)) return "tcx";
  throw new Error("Choose a GPX or TCX route file.");
}

export function parseRouteXml(xml: string, fileName = "route.gpx"): ParsedRouteImport {
  if (!xml.trim()) throw new Error("The route file is empty.");
  if (new TextEncoder().encode(xml).byteLength > MAX_ROUTE_IMPORT_BYTES) {
    throw new Error("Route files must be 10 MB or smaller.");
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("DTD and entity declarations are not allowed in route files.");
  const validation = XMLValidator.validate(xml);
  if (validation !== true) throw new Error(`The route file contains malformed XML: ${validation.err.msg}`);
  const format = detectRouteImportFormat(fileName, xml);
  const root = asRecord(parser.parse(xml));
  if (!root) throw new Error("The route file could not be read.");
  const candidates = format === "gpx" ? parseGpx(root, fileName) : parseTcx(root, fileName);
  if (!candidates.length) throw new Error(`No route with at least two valid points was found in this ${format.toUpperCase()} file.`);
  return { format, candidates };
}

export async function parseRouteFile(file: File): Promise<ParsedRouteImport> {
  if (file.size > MAX_ROUTE_IMPORT_BYTES) throw new Error("Route files must be 10 MB or smaller.");
  return parseRouteXml(await file.text(), file.name);
}

export async function routeImportFingerprint(file: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
