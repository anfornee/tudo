import test from "node:test";
import assert from "node:assert/strict";

const {
  adaptOpenRouteServiceResponse,
  openRouteServiceRequestBody,
  validateRouteCalculationRequest,
} = await import("./openrouteservice.ts");

const waypoints = [
  { id: "start", coordinate: [-77.04, 38.9] },
  { id: "end", coordinate: [-77.0, 38.92] },
];

const response = {
  type: "FeatureCollection",
  metadata: { attribution: "ORS attribution", engine: { version: "9.0" } },
  features: [{
    type: "Feature",
    geometry: { type: "LineString", coordinates: [[-77.04, 38.9, 10], [-77.02, 38.91, 20], [-77.0, 38.92, 15]] },
    properties: {
      summary: { distance: 4500, duration: 900, ascent: 10, descent: 5 },
      way_points: [0, 2],
      segments: [{ steps: [
        { distance: 2000, duration: 400, type: 11, instruction: "Head east", way_points: [0, 1] },
        { distance: 2500, duration: 500, type: 1, instruction: "Turn right", way_points: [1, 2] },
        { distance: 0, duration: 0, type: 10, instruction: "Arrive", way_points: [2, 2] },
      ] }],
    },
  }],
};

test("normalizes ORS geometry, elevation, waypoint indexes, and maneuver types", () => {
  const route = adaptOpenRouteServiceResponse(response, waypoints, { avoidFerries: true });
  assert.equal(route.distanceMeters, 4500);
  assert.equal(route.durationSeconds, 900);
  assert.deepEqual(route.waypointGeometryIndices, [0, 2]);
  assert.equal(route.geometry[1].elevationMeters, 20);
  assert.ok(route.geometry[2].distanceMeters > route.geometry[1].distanceMeters);
  assert.deepEqual(route.maneuvers.map((item) => item.type), ["depart", "right", "arrive"]);
  assert.equal(route.maneuvers[1].coordinate[0], -77.02);
  assert.equal(route.preferences.avoidFerries, true);
});

test("builds a cycling-road request without leaking provider response shapes", () => {
  const body = openRouteServiceRequestBody({ waypoints, preferences: { avoidFerries: true } });
  assert.deepEqual(body.coordinates, waypoints.map((item) => item.coordinate));
  assert.deepEqual(body.options, { avoid_features: ["ferries"] });
  assert.equal(body.elevation, true);
  assert.equal(body.instructions, true);
});

test("validates waypoint limits, coordinates, preferences, and overlapping points", () => {
  assert.deepEqual(validateRouteCalculationRequest({ waypoints, preferences: { avoidFerries: true } }), { waypoints, preferences: { avoidFerries: true } });
  assert.throws(() => validateRouteCalculationRequest({ waypoints: [waypoints[0]] }));
  assert.throws(() => validateRouteCalculationRequest({ waypoints: [waypoints[0], waypoints[0]] }));
  assert.throws(() => validateRouteCalculationRequest({ waypoints: [{ id: "a", coordinate: [200, 0] }, waypoints[1]] }));
});

test("rejects malformed and empty provider responses", () => {
  assert.throws(() => adaptOpenRouteServiceResponse({ features: [] }, waypoints, { avoidFerries: false }));
  assert.throws(() => adaptOpenRouteServiceResponse({ features: [{ geometry: { type: "LineString", coordinates: [[0, 0]] } }] }, waypoints, { avoidFerries: false }));
});
