import test from "node:test";
import assert from "node:assert/strict";

const {
  addReturnToStart,
  commitWaypoints,
  createWaypointHistory,
  insertWaypoint,
  moveWaypoint,
  redoWaypoints,
  removeWaypoint,
  routeReturnsToStart,
  shouldAcceptRoutingResponse,
  undoWaypoints,
} = await import("./editor.ts");

const start = { id: "start", coordinate: [-77, 38] };
const end = { id: "end", coordinate: [-76, 39] };

test("inserts, moves, and removes waypoints without mutating the source", () => {
  const source = [start, end];
  const inserted = insertWaypoint(source, 1, { id: "shape", coordinate: [-76.5, 38.5] });
  assert.deepEqual(source, [start, end]);
  assert.equal(inserted[1].id, "shape");
  assert.deepEqual(moveWaypoint(inserted, 1, [-76.4, 38.6])[1].coordinate, [-76.4, 38.6]);
  assert.deepEqual(removeWaypoint(inserted, 1), source);
});

test("undo and redo preserve meaningful edit history", () => {
  let history = createWaypointHistory([start]);
  history = commitWaypoints(history, [start, end]);
  history = undoWaypoints(history);
  assert.deepEqual(history.present, [start]);
  history = redoWaypoints(history);
  assert.deepEqual(history.present, [start, end]);
  assert.equal(commitWaypoints(history, [start, end]), history);
});

test("rejects out-of-order routing responses", () => {
  assert.equal(shouldAcceptRoutingResponse(3, 2), false);
  assert.equal(shouldAcceptRoutingResponse(3, 3), true);
});

test("adds an out-and-back return through outbound waypoints in reverse", () => {
  const middle = { id: "middle", coordinate: [-76.5, 38.5] };
  let nextId = 0;
  const result = addReturnToStart([start, middle, end], "out-and-back", () => `return-${nextId++}`);
  assert.deepEqual(result.map((waypoint) => waypoint.coordinate), [
    start.coordinate,
    middle.coordinate,
    end.coordinate,
    middle.coordinate,
    start.coordinate,
  ]);
  assert.equal(routeReturnsToStart(result), true);
  assert.notEqual(result[3].id, middle.id);
});

test("adds only the start for a best-route return", () => {
  const result = addReturnToStart([start, end], "best-route", () => "return-start");
  assert.deepEqual(result.map((waypoint) => waypoint.coordinate), [start.coordinate, end.coordinate, start.coordinate]);
  assert.equal(result.at(-1).id, "return-start");
});

test("uses outbound geometry to distinguish an out-and-back from a best return", () => {
  const geometry = [
    { coordinate: start.coordinate, elevationMeters: null, distanceMeters: 0 },
    { coordinate: [-76.75, 38.25], elevationMeters: null, distanceMeters: 1_000 },
    { coordinate: [-76.5, 38.5], elevationMeters: null, distanceMeters: 2_000 },
    { coordinate: [-76.25, 38.75], elevationMeters: null, distanceMeters: 3_000 },
    { coordinate: end.coordinate, elevationMeters: null, distanceMeters: 4_000 },
  ];
  let nextId = 0;
  const result = addReturnToStart(
    [start, end],
    "out-and-back",
    () => `return-${nextId++}`,
    { outboundGeometry: geometry, maximumWaypoints: 6 },
  );
  assert.deepEqual(result.map((waypoint) => waypoint.coordinate), [
    start.coordinate,
    end.coordinate,
    [-76.25, 38.75],
    [-76.5, 38.5],
    [-76.75, 38.25],
    start.coordinate,
  ]);
});

test("does not duplicate a completed return and enforces the waypoint limit", () => {
  const closed = [start, end, { id: "return", coordinate: start.coordinate }];
  assert.deepEqual(addReturnToStart(closed, "best-route", () => "unused"), closed);
  assert.throws(
    () => addReturnToStart(
      [start, { id: "middle", coordinate: [-76.5, 38.5] }, end],
      "out-and-back",
      () => "return",
      { maximumWaypoints: 4 },
    ),
    /needs 2 more waypoints/,
  );
});
