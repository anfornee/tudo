import test from "node:test";
import assert from "node:assert/strict";

const { routeFilename, routeToGpx, routeToTcx } = await import("./export.ts");
const { parseRouteFilePayload } = await import("./model.ts");

const route = {
  version: 1,
  preferences: { avoidFerries: false },
  waypoints: [{ id: "a", coordinate: [-77, 38] }, { id: "b", coordinate: [-76.99, 38.01] }],
  geometry: [
    { coordinate: [-77, 38], elevationMeters: 10, distanceMeters: 0 },
    { coordinate: [-76.99, 38.01], elevationMeters: 20, distanceMeters: 1500 },
  ],
  waypointGeometryIndices: [0, 1],
  distanceMeters: 1500,
  durationSeconds: 300,
  elevationGainMeters: 10,
  elevationLossMeters: 0,
  maneuvers: [
    { id: "m0", type: "depart", instruction: "Start & go <east>", coordinate: [-77, 38], distanceMeters: 1500, durationSeconds: 300, routeDistanceMeters: 0 },
    { id: "m1", type: "arrive", instruction: "Arrive", coordinate: [-76.99, 38.01], distanceMeters: 0, durationSeconds: 0, routeDistanceMeters: 1500 },
  ],
  provider: { provider: "openrouteservice", profile: "cycling-road", attribution: "ORS", engineVersion: null },
};

test("exports valid GPX structure with ordered coordinates, elevation, and escaped metadata", () => {
  const gpx = routeToGpx(route, "A & B", "Use <quiet> roads");
  assert.match(gpx, /^<\?xml version="1.0"/);
  assert.match(gpx, /<gpx version="1.1"/);
  assert.match(gpx, /<name>A &amp; B<\/name>/);
  assert.match(gpx, /<desc>Use &lt;quiet&gt; roads<\/desc>/);
  assert.ok(gpx.indexOf('lat="38.0000000"') < gpx.indexOf('lat="38.0100000"'));
  assert.equal((gpx.match(/<trkpt /g) ?? []).length, 2);
});

test("exports TCX CoursePoints with valid units and mapped cue types", () => {
  const tcx = routeToTcx(route, "Morning course", "Cues & route");
  assert.match(tcx, /<TrainingCenterDatabase /);
  assert.match(tcx, /<DistanceMeters>1500.00<\/DistanceMeters>/);
  assert.match(tcx, /<CoursePoint>/);
  assert.match(tcx, /<PointType>Generic<\/PointType>/);
  assert.match(tcx, /Start &amp; go &lt;east&gt;/);
  assert.equal((tcx.match(/<Trackpoint>/g) ?? []).length, 2);
  assert.equal((tcx.match(/<CoursePoint>/g) ?? []).length, 2);
});

test("does not fabricate TCX cues and creates readable filenames", () => {
  assert.throws(() => routeToTcx({ ...route, maneuvers: [] }, "No cues"));
  assert.equal(routeFilename("  Côte & Coffee Ride  ", "gpx"), "cote-coffee-ride.gpx");
});

test("round-trips the normalized Storage payload defensively", () => {
  const payload = { version: 1, name: "Route", description: "", route };
  assert.deepEqual(parseRouteFilePayload(JSON.parse(JSON.stringify(payload))), payload);
  assert.equal(parseRouteFilePayload({ ...payload, route: { ...route, geometry: [] } }), null);
});
