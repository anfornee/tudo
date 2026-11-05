import type { PlannedRoute, RouteManeuverType } from "./types.ts";

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function routeFilename(name: string, extension: "gpx" | "tcx") {
  const base = name.trim().toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "tudo-route";
  return `${base}.${extension}`;
}

export function routeToGpx(route: PlannedRoute, name: string, description = "") {
  const points = route.geometry.map((point) => {
    const elevation = point.elevationMeters === null ? "" : `<ele>${point.elevationMeters.toFixed(2)}</ele>`;
    return `<trkpt lat="${point.coordinate[1].toFixed(7)}" lon="${point.coordinate[0].toFixed(7)}">${elevation}</trkpt>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Tudo" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"><metadata><name>${xml(name)}</name>${description ? `<desc>${xml(description)}</desc>` : ""}</metadata><trk><name>${xml(name)}</name>${description ? `<desc>${xml(description)}</desc>` : ""}<type>Road cycling</type><trkseg>${points}</trkseg></trk></gpx>`;
}

const tcxPointTypes: Partial<Record<RouteManeuverType, string>> = {
  left: "Left",
  right: "Right",
  sharp_left: "Left",
  sharp_right: "Right",
  slight_left: "Left",
  slight_right: "Right",
  straight: "Straight",
  keep_left: "Left",
  keep_right: "Right",
  uturn: "Generic",
  roundabout_enter: "Generic",
  roundabout_exit: "Generic",
  arrive: "Generic",
  depart: "Generic",
  unknown: "Generic",
};

function courseDuration(route: PlannedRoute) {
  return route.durationSeconds ?? Math.max(1, route.distanceMeters / 5.5);
}

function timeAtDistance(route: PlannedRoute, distanceMeters: number) {
  const duration = courseDuration(route);
  const fraction = route.distanceMeters > 0 ? Math.max(0, Math.min(1, distanceMeters / route.distanceMeters)) : 0;
  return new Date(Date.UTC(2000, 0, 1) + duration * fraction * 1000).toISOString();
}

export function routeToTcx(route: PlannedRoute, name: string, description = "") {
  if (!route.maneuvers.length) throw new Error("TCX navigation export requires turn instructions.");
  const track = route.geometry.map((point) => {
    const altitude = point.elevationMeters === null ? "" : `<AltitudeMeters>${point.elevationMeters.toFixed(2)}</AltitudeMeters>`;
    return `<Trackpoint><Time>${timeAtDistance(route, point.distanceMeters)}</Time><Position><LatitudeDegrees>${point.coordinate[1].toFixed(7)}</LatitudeDegrees><LongitudeDegrees>${point.coordinate[0].toFixed(7)}</LongitudeDegrees></Position>${altitude}<DistanceMeters>${point.distanceMeters.toFixed(2)}</DistanceMeters></Trackpoint>`;
  }).join("");
  const coursePoints = route.maneuvers.map((maneuver, index) => {
    const shortName = maneuver.instruction.replace(/\s+/g, " ").trim().slice(0, 10) || `Cue ${index + 1}`;
    return `<CoursePoint><Name>${xml(shortName)}</Name><Time>${timeAtDistance(route, maneuver.routeDistanceMeters)}</Time><Position><LatitudeDegrees>${maneuver.coordinate[1].toFixed(7)}</LatitudeDegrees><LongitudeDegrees>${maneuver.coordinate[0].toFixed(7)}</LongitudeDegrees></Position><PointType>${tcxPointTypes[maneuver.type] ?? "Generic"}</PointType><Notes>${xml(maneuver.instruction)}</Notes></CoursePoint>`;
  }).join("");
  const duration = courseDuration(route);
  const begin = route.geometry[0];
  const end = route.geometry.at(-1)!;
  const beginAltitude = begin.elevationMeters === null ? "" : `<BeginAltitudeMeters>${begin.elevationMeters.toFixed(2)}</BeginAltitudeMeters>`;
  const endAltitude = end.elevationMeters === null ? "" : `<EndAltitudeMeters>${end.elevationMeters.toFixed(2)}</EndAltitudeMeters>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd"><Courses><Course><Name>${xml(name.slice(0, 15))}</Name><Lap><TotalTimeSeconds>${duration.toFixed(1)}</TotalTimeSeconds><DistanceMeters>${route.distanceMeters.toFixed(2)}</DistanceMeters><BeginPosition><LatitudeDegrees>${begin.coordinate[1].toFixed(7)}</LatitudeDegrees><LongitudeDegrees>${begin.coordinate[0].toFixed(7)}</LongitudeDegrees></BeginPosition>${beginAltitude}<EndPosition><LatitudeDegrees>${end.coordinate[1].toFixed(7)}</LatitudeDegrees><LongitudeDegrees>${end.coordinate[0].toFixed(7)}</LongitudeDegrees></EndPosition>${endAltitude}<Intensity>Active</Intensity></Lap><Track>${track}</Track>${description ? `<Notes>${xml(description)}</Notes>` : ""}${coursePoints}</Course></Courses></TrainingCenterDatabase>`;
}

export function downloadRouteText(contents: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
