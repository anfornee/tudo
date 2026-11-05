import test from "node:test";
import assert from "node:assert/strict";

const {
  commitWaypoints,
  createWaypointHistory,
  insertWaypoint,
  moveWaypoint,
  redoWaypoints,
  removeWaypoint,
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
