import test from "node:test";
import assert from "node:assert/strict";

const {
  createPlannedRouteCursorResolver,
  deriveElevationChange,
  geometryWithCumulativeDistance,
  insertShapingWaypoint,
  nearestGeometryIndexByDistance,
} = await import("./geometry.ts");

const geometry = geometryWithCumulativeDistance([
  [-77.04, 38.9, 10],
  [-77.03, 38.91, 20],
  [-77.02, 38.92, 15],
  [-77.01, 38.93, 30],
]);

test("calculates cumulative distance plus elevation gain and loss", () => {
  assert.equal(geometry[0].distanceMeters, 0);
  assert.ok(geometry[3].distanceMeters > geometry[2].distanceMeters);
  assert.deepEqual(deriveElevationChange(geometry), { gainMeters: 25, lossMeters: 5 });
});

test("resolves chart and map cursor positions efficiently", () => {
  assert.equal(nearestGeometryIndexByDistance(geometry, geometry[2].distanceMeters - 1), 2);
  const resolver = createPlannedRouteCursorResolver(geometry);
  assert.equal(resolver.indexAt([-77.03001, 38.91001]), 1);
});

test("inserts a shaping waypoint into the corresponding routed leg", () => {
  const route = {
    waypoints: [
      { id: "a", coordinate: geometry[0].coordinate },
      { id: "b", coordinate: geometry[2].coordinate },
      { id: "c", coordinate: geometry[3].coordinate },
    ],
    waypointGeometryIndices: [0, 2, 3],
    geometry,
  };
  const insertion = insertShapingWaypoint(route, 1, "shape");
  assert.equal(insertion.index, 1);
  assert.deepEqual(insertion.waypoint, { id: "shape", coordinate: geometry[1].coordinate });
});

test("handles missing elevation without inventing gain", () => {
  const noElevation = geometry.map((point) => ({ ...point, elevationMeters: null }));
  assert.equal(deriveElevationChange(noElevation), null);
});
