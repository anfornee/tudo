import test from "node:test";
import assert from "node:assert/strict";

const { calculateRideAnalytics } = await import("./ride-analytics.ts");

function sample(elapsedSeconds, power, overrides = {}) {
  return {
    elapsedSeconds,
    timestampMs: 1_700_000_000_000 + elapsedSeconds * 1000,
    power,
    speedMph: 18,
    cadence: 90,
    heartRate: 140,
    elevationFeet: 100,
    distanceMiles: elapsedSeconds / 200,
    ...overrides,
  };
}

function regular(duration, value) {
  return Array.from({ length: duration + 1 }, (_, second) => sample(second, value));
}

function input(samples, overrides = {}) {
  return {
    rideId: "ride-1",
    sourceRevision: "samples-v1",
    calculatedAt: new Date("2026-01-01T00:00:00Z"),
    activityDate: new Date("2025-12-31T12:00:00Z"),
    distanceMiles: 10,
    elapsedDurationSeconds: 3600,
    movingDurationSeconds: 1800,
    elevationGainFeet: 500,
    powerProvenance: "measured",
    samples,
    ...overrides,
  };
}

test("calculates constant-power metrics, normalized power, and exact-duration efforts", () => {
  const analytics = calculateRideAnalytics(input(regular(60, 200)));
  assert.equal(analytics.power.averageWatts, 200);
  assert.equal(analytics.power.maxWatts, 200);
  assert.equal(analytics.power.normalizedWatts, 200);
  assert.equal(analytics.powerDuration[60].averageWatts, 200);
  assert.equal(analytics.powerDuration[60].startElapsedSeconds, 0);
  assert.equal(analytics.powerDuration[120], null);
  assert.equal(analytics.speed.averageMovingMph, 20);
  assert.deepEqual(analytics.sensorCoverage.power, {
    sampleCount: 61,
    validDurationSeconds: 60,
    valueSeconds: 12000,
  });
});

test("calculates variable-power normalized power with the 30-second fourth-power method", () => {
  const samples = Array.from({ length: 61 }, (_, second) => sample(second, second < 30 ? 100 : 300));
  const analytics = calculateRideAnalytics(input(samples));
  const rolling = Array.from({ length: 31 }, (_, index) => (3000 + index * 200) / 30);
  const expected = Math.round((rolling.reduce((sum, watts) => sum + watts ** 4, 0) / rolling.length) ** 0.25);
  assert.equal(analytics.power.normalizedWatts, expected);
  assert.ok(analytics.power.normalizedWatts > analytics.power.averageWatts);
  assert.equal(analytics.powerDuration[30].averageWatts, 300);
});

test("keeps true zero-power intervals and missing power distinct", () => {
  const zero = calculateRideAnalytics(input([
    sample(0, 250), sample(2, 0), sample(5, 0), sample(7, 250), sample(10, 250),
  ]));
  assert.equal(zero.powerDuration[5].averageWatts, 150);

  const missing = calculateRideAnalytics(input([
    sample(0, 250), sample(2, null), sample(4, 250), sample(6, 250),
  ]));
  assert.equal(missing.powerDuration[5], null);
});

test("weights irregular timing without assuming one sample per second", () => {
  const analytics = calculateRideAnalytics(input([
    sample(0, 100), sample(2, 200), sample(5, 300),
  ]));
  assert.equal(analytics.power.averageWatts, 160);
  assert.equal(analytics.power.maxWatts, 300);
  assert.equal(analytics.powerDuration[5].averageWatts, 160);
});

test("never bridges long gaps or pauses to manufacture an effort", () => {
  const gap = calculateRideAnalytics(input([sample(0, 500), sample(10, 500)]));
  assert.equal(gap.powerDuration[5], null);

  const paused = calculateRideAnalytics(input([
    ...regular(30, 220),
    ...Array.from({ length: 31 }, (_, index) => sample(90 + index, 220)),
  ]));
  assert.equal(paused.powerDuration[30].averageWatts, 220);
  assert.equal(paused.powerDuration[60], null);
});

test("returns null for short targets and a result when duration matches exactly", () => {
  const short = calculateRideAnalytics(input(regular(4, 180)));
  assert.equal(short.powerDuration[5], null);
  const exact = calculateRideAnalytics(input(regular(5, 180)));
  assert.equal(exact.powerDuration[5].averageWatts, 180);
});

test("estimated-only power is available but excluded from measured analytics", () => {
  const analytics = calculateRideAnalytics(input(regular(60, 240), { powerProvenance: "estimated" }));
  assert.equal(analytics.availability.power, true);
  assert.equal(analytics.power.provenance, "estimated");
  assert.equal(analytics.power.averageWatts, null);
  assert.equal(analytics.power.normalizedWatts, null);
  assert.equal(analytics.powerDuration[5], null);
});

test("represents absent sensors as unavailable rather than zero", () => {
  const samples = regular(10, null).map((value) => ({ ...value, cadence: null, heartRate: null }));
  const analytics = calculateRideAnalytics(input(samples, { powerProvenance: "unavailable" }));
  assert.equal(analytics.power.averageWatts, null);
  assert.equal(analytics.cadence.averageRpm, null);
  assert.equal(analytics.heartRate.averageBpm, null);
  assert.equal(analytics.availability.cadence, false);
  assert.equal(analytics.availability.heartRate, false);
});
