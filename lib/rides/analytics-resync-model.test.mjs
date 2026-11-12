import test from "node:test";
import assert from "node:assert/strict";

const {
  analyticsResyncIsActive,
  analyticsResyncLabel,
  analyticsResyncShouldStartNew,
} = await import("./analytics-resync-model.ts");

function status(overrides = {}) {
  return {
    schemaVersion: 1,
    operationId: "operation-1",
    mode: "update",
    state: "pending",
    phase: "checking",
    scannedRides: 0,
    selectedRides: 0,
    processedRides: 0,
    failedRides: 0,
    profileRides: 0,
    startedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    error: null,
    ...overrides,
  };
}

test("treats pending and leased processing operations as resumable", () => {
  assert.equal(analyticsResyncIsActive(status()), true);
  assert.equal(analyticsResyncIsActive(status({ state: "processing" })), true);
  assert.equal(analyticsResyncIsActive(status({ state: "completed" })), false);
  assert.equal(analyticsResyncIsActive(status({ state: "failed" })), false);
});

test("coalesces duplicate starts but permits retries after terminal states", () => {
  assert.equal(analyticsResyncShouldStartNew("pending"), false);
  assert.equal(analyticsResyncShouldStartNew("processing"), false);
  assert.equal(analyticsResyncShouldStartNew("completed"), true);
  assert.equal(analyticsResyncShouldStartNew("failed"), true);
  assert.equal(analyticsResyncShouldStartNew(undefined), true);
});

test("reports bounded ride and profile progress without invented percentages", () => {
  assert.equal(analyticsResyncLabel(status()), "Checking rides");
  assert.equal(analyticsResyncLabel(status({ phase: "ride_analytics", processedRides: 310 })), "Processing ride analytics · 310 processed");
  assert.equal(analyticsResyncLabel(status({ phase: "profile_analytics", profileRides: 400 })), "Rebuilding profile stats · 400 rides checked");
});

test("surfaces retryable failures and incomplete ride sources", () => {
  assert.equal(analyticsResyncLabel(status({ state: "failed" })), "Analytics update failed");
  assert.equal(analyticsResyncLabel(status({ state: "completed", failedRides: 2 })), "Completed with 2 rides still unavailable");
});
