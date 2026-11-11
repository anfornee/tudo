import test from "node:test";
import assert from "node:assert/strict";

const { filterAndSortRoutes } = await import("./library.ts");
const time = (value) => ({ toMillis: () => value });
const routes = [
  { id: "a", name: "Morning Hills", source: "gpx", distanceMeters: 30000, createdAt: time(1), updatedAt: time(3) },
  { id: "b", name: "River Loop", source: "tudo", distanceMeters: 15000, createdAt: time(2), updatedAt: time(2) },
  { id: "c", name: "Evening Hills", source: "tcx", distanceMeters: 45000, createdAt: time(3), updatedAt: time(1) },
];

test("searches, filters, and sorts route-library summaries", () => {
  const statuses = { a: { status: "synced" }, c: { status: "failed" } };
  assert.deepEqual(filterAndSortRoutes(routes, { search: "hills", source: "all", sync: "all", sort: "distance-asc", syncStatuses: statuses }).map(({ id }) => id), ["a", "c"]);
  assert.deepEqual(filterAndSortRoutes(routes, { search: "", source: "tcx", sync: "failed", sort: "newest", syncStatuses: statuses }).map(({ id }) => id), ["c"]);
  assert.deepEqual(filterAndSortRoutes(routes, { search: "", source: "all", sync: "not_synced", sort: "oldest", syncStatuses: statuses }).map(({ id }) => id), ["b"]);
});
