import { Encoder, Profile } from "@garmin/fitsdk";
import type { PlannedRoute, RouteManeuverType } from "@/lib/routes/types";

const SEMICIRCLES_PER_DEGREE = 2 ** 31 / 180;
const COURSE_CAPABILITIES = 0x00000001 | 0x00000002 | 0x00000004 |
  0x00000008 | 0x00000010 | 0x00000200;

const coursePointTypes: Record<RouteManeuverType, string> = {
  depart: "generic",
  left: "left",
  right: "right",
  sharp_left: "sharpLeft",
  sharp_right: "sharpRight",
  slight_left: "slightLeft",
  slight_right: "slightRight",
  straight: "straight",
  roundabout_enter: "generic",
  roundabout_exit: "generic",
  uturn: "uTurn",
  keep_left: "leftFork",
  keep_right: "rightFork",
  arrive: "generic",
  unknown: "generic",
};

function semicircles(degrees: number) {
  return Math.round(degrees * SEMICIRCLES_PER_DEGREE);
}

function timestampAtDistance(startMs: number, durationSeconds: number, distanceMeters: number, totalDistanceMeters: number) {
  const ratio = totalDistanceMeters > 0 ? Math.min(1, Math.max(0, distanceMeters / totalDistanceMeters)) : 0;
  return new Date(startMs + Math.round(durationSeconds * ratio) * 1000);
}

export function encodeRouteAsFitCourse(route: PlannedRoute, name: string, createdAt = new Date()) {
  if (route.geometry.length < 2 || !Number.isFinite(createdAt.getTime())) {
    throw new Error("The route does not contain enough data to create a FIT course.");
  }

  const encoder = new Encoder();
  const write = (message: Record<string, unknown>) => (
    encoder.writeMesg(message as unknown as Parameters<Encoder["writeMesg"]>[0])
  );
  const durationSeconds = Math.max(1, Math.round(route.durationSeconds ?? route.distanceMeters / 5));
  const startMs = Math.floor(createdAt.getTime() / 1000) * 1000;
  const end = new Date(startMs + durationSeconds * 1000);
  const first = route.geometry[0];
  const last = route.geometry.at(-1)!;

  write({
    mesgNum: Profile.MesgNum.FILE_ID,
    type: "course",
    manufacturer: "development",
    product: 1,
    timeCreated: new Date(startMs),
  });
  write({
    mesgNum: Profile.MesgNum.COURSE,
    sport: "cycling",
    subSport: "road",
    name: name.trim().slice(0, 120) || "Tudo route",
    capabilities: COURSE_CAPABILITIES,
  });

  const lap: Record<string, unknown> = {
    mesgNum: Profile.MesgNum.LAP,
    messageIndex: 0,
    timestamp: end,
    event: "lap",
    eventType: "stop",
    startTime: new Date(startMs),
    startPositionLat: semicircles(first.coordinate[1]),
    startPositionLong: semicircles(first.coordinate[0]),
    endPositionLat: semicircles(last.coordinate[1]),
    endPositionLong: semicircles(last.coordinate[0]),
    totalElapsedTime: durationSeconds,
    totalTimerTime: durationSeconds,
    totalDistance: route.distanceMeters,
    sport: "cycling",
    subSport: "road",
  };
  if (route.elevationGainMeters !== null) lap.totalAscent = Math.round(route.elevationGainMeters);
  if (route.elevationLossMeters !== null) lap.totalDescent = Math.round(route.elevationLossMeters);
  write(lap);
  write({ mesgNum: Profile.MesgNum.EVENT, timestamp: new Date(startMs), event: "timer", eventType: "start" });

  const maneuvers = [...route.maneuvers].sort((left, right) => left.routeDistanceMeters - right.routeDistanceMeters);
  let maneuverIndex = 0;
  for (const point of route.geometry) {
    const timestamp = timestampAtDistance(startMs, durationSeconds, point.distanceMeters, route.distanceMeters);
    const record: Record<string, unknown> = {
      mesgNum: Profile.MesgNum.RECORD,
      timestamp,
      positionLat: semicircles(point.coordinate[1]),
      positionLong: semicircles(point.coordinate[0]),
      distance: point.distanceMeters,
    };
    if (point.elevationMeters !== null) record.altitude = point.elevationMeters;
    write(record);

    while (maneuverIndex < maneuvers.length && maneuvers[maneuverIndex].routeDistanceMeters <= point.distanceMeters) {
      const maneuver = maneuvers[maneuverIndex];
      write({
        mesgNum: Profile.MesgNum.COURSE_POINT,
        messageIndex: maneuverIndex,
        timestamp: timestampAtDistance(startMs, durationSeconds, maneuver.routeDistanceMeters, route.distanceMeters),
        positionLat: semicircles(maneuver.coordinate[1]),
        positionLong: semicircles(maneuver.coordinate[0]),
        distance: maneuver.routeDistanceMeters,
        type: coursePointTypes[maneuver.type],
        name: maneuver.instruction.slice(0, 120),
      });
      maneuverIndex += 1;
    }
  }

  while (maneuverIndex < maneuvers.length) {
    const maneuver = maneuvers[maneuverIndex];
    write({
      mesgNum: Profile.MesgNum.COURSE_POINT,
      messageIndex: maneuverIndex,
      timestamp: end,
      positionLat: semicircles(maneuver.coordinate[1]),
      positionLong: semicircles(maneuver.coordinate[0]),
      distance: Math.min(route.distanceMeters, maneuver.routeDistanceMeters),
      type: coursePointTypes[maneuver.type],
      name: maneuver.instruction.slice(0, 120),
    });
    maneuverIndex += 1;
  }

  write({ mesgNum: Profile.MesgNum.EVENT, timestamp: end, event: "timer", eventType: "stopDisableAll" });
  return encoder.close();
}
