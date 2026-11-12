import test from "node:test";
import assert from "node:assert/strict";

const {
  ANALYTICS_LEASE_DURATION_MS,
  analyticsIsCurrent,
  analyticsLeaseIsActive,
  analyticsWorkerMayCommit,
  rideNeedsAnalytics,
} = await import("./analytics-lifecycle.ts");

const now = 1_800_000_000_000;

test("current analytics suppress duplicate processing requests", () => {
  const snapshot = { analytics: { algorithmVersion: 2, sourceRevision: "rev-1" } };
  assert.equal(analyticsIsCurrent(snapshot, "rev-1"), true);
  assert.equal(rideNeedsAnalytics(snapshot, "rev-1", now), false);
});

test("version and source revision changes make analytics eligible", () => {
  assert.equal(rideNeedsAnalytics({ analytics: { algorithmVersion: 1, sourceRevision: "rev-1" } }, "rev-1", now), true);
  assert.equal(rideNeedsAnalytics({ analytics: { algorithmVersion: 2, sourceRevision: "rev-1" } }, "rev-2", now), true);
  assert.equal(rideNeedsAnalytics({}, "rev-1", now), true);
});

test("an active matching lease prevents concurrent processing", () => {
  const snapshot = {
    processing: {
      state: "processing",
      algorithmVersion: 2,
      sourceRevision: "rev-1",
      leaseExpiresAtMs: now + ANALYTICS_LEASE_DURATION_MS,
    },
  };
  assert.equal(analyticsLeaseIsActive(snapshot, "rev-1", now), true);
  assert.equal(rideNeedsAnalytics(snapshot, "rev-1", now), false);
});

test("failed and interrupted processing becomes retryable after a stale lease", () => {
  const stale = {
    processing: {
      state: "processing",
      algorithmVersion: 2,
      sourceRevision: "rev-1",
      leaseExpiresAtMs: now - 1,
    },
  };
  assert.equal(analyticsLeaseIsActive(stale, "rev-1", now), false);
  assert.equal(rideNeedsAnalytics(stale, "rev-1", now), true);
  assert.equal(rideNeedsAnalytics({ processing: { state: "failed", sourceRevision: "rev-1" } }, "rev-1", now), true);
});

test("stale workers cannot overwrite a new revision or another lease", () => {
  const processing = { sourceRevision: "rev-1", leaseToken: "worker-a" };
  assert.equal(analyticsWorkerMayCommit("rev-1", processing, "rev-1", "worker-a"), true);
  assert.equal(analyticsWorkerMayCommit("rev-2", processing, "rev-1", "worker-a"), false);
  assert.equal(analyticsWorkerMayCommit("rev-1", processing, "rev-1", "worker-b"), false);
});
