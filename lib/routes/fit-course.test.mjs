import test from "node:test";
import assert from "node:assert/strict";
import { Decoder, Stream } from "@garmin/fitsdk";

const { encodeRouteAsFitCourse } = await import("./fit-course.ts");

const route = {
  version: 1,
  preferences: { avoidFerries: false },
  waypoints: [{ id: "a", coordinate: [-77, 38] }, { id: "b", coordinate: [-76.99, 38.01] }],
  geometry: [
    { coordinate: [-77, 38], elevationMeters: 10, distanceMeters: 0 },
    { coordinate: [-76.995, 38.005], elevationMeters: 15, distanceMeters: 750 },
    { coordinate: [-76.99, 38.01], elevationMeters: 20, distanceMeters: 1500 },
  ],
  segmentStartIndices: [0],
  waypointGeometryIndices: [0, 2],
  distanceMeters: 1500,
  durationSeconds: 300,
  elevationGainMeters: 10,
  elevationLossMeters: 0,
  maneuvers: [
    { id: "m0", type: "depart", instruction: "Start east", coordinate: [-77, 38], distanceMeters: 750, durationSeconds: 150, routeDistanceMeters: 0 },
    { id: "m1", type: "right", instruction: "Turn right", coordinate: [-76.995, 38.005], distanceMeters: 750, durationSeconds: 150, routeDistanceMeters: 750 },
    { id: "m2", type: "arrive", instruction: "Arrive", coordinate: [-76.99, 38.01], distanceMeters: 0, durationSeconds: 0, routeDistanceMeters: 1500 },
  ],
  provider: { provider: "openrouteservice", profile: "cycling-road", attribution: "ORS", engineVersion: null },
};

test("encodes a valid FIT cycling course with geometry and cues", () => {
  const bytes = encodeRouteAsFitCourse(route, "Morning route", new Date("2026-01-02T12:00:00Z"));
  const decoder = new Decoder(Stream.fromByteArray(bytes));
  assert.equal(decoder.checkIntegrity(), true);
  const { messages, errors } = decoder.read();

  assert.deepEqual(errors, []);
  assert.equal(messages.fileIdMesgs?.[0].type, "course");
  assert.equal(messages.courseMesgs?.[0].sport, "cycling");
  assert.equal(messages.courseMesgs?.[0].name, "Morning route");
  assert.equal(messages.recordMesgs?.length, 3);
  assert.equal(messages.coursePointMesgs?.length, 3);
  assert.equal(messages.coursePointMesgs?.[1].type, "right");
  assert.equal(messages.lapMesgs?.[0].totalDistance, 1500);
  assert.equal(messages.eventMesgs?.[0].eventType, "start");
  assert.equal(messages.eventMesgs?.at(-1)?.eventType, "stopDisableAll");
});

test("does not fabricate missing route elevation", () => {
  const bytes = encodeRouteAsFitCourse({
    ...route,
    elevationGainMeters: null,
    elevationLossMeters: null,
    geometry: route.geometry.map((point) => ({ ...point, elevationMeters: null })),
  }, "Flat unknown", new Date("2026-01-02T12:00:00Z"));
  const { messages } = new Decoder(Stream.fromByteArray(bytes)).read();
  assert.equal(messages.lapMesgs?.[0].totalAscent, undefined);
  assert.equal(messages.recordMesgs?.[0].altitude, undefined);
});
