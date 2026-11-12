import test from "node:test";
import assert from "node:assert/strict";

const { calculateRideAnalytics } = await import("./ride-analytics.ts");
const {
  buildPreRideStatistics,
  historicalAnalyticsIsCurrent,
  monthSequence,
  zonedMonthStart,
} = await import("./historical-analytics.ts");
const {
  accumulateProfileRide,
  calendarMonthForDate,
  createProfileAnalyticsAccumulator,
  createStatisticsAccumulator,
  finalizeStatistics,
  mergeStatisticsAccumulator,
} = await import("./profile-analytics.ts");

function samples(duration, power, cadence = 90, heartRate = 140, speedMph = 20) {
  return Array.from({ length: duration + 1 }, (_, elapsedSeconds) => ({
    elapsedSeconds,
    timestampMs: Date.parse("2025-01-01T00:00:00Z") + elapsedSeconds * 1000,
    power,
    speedMph,
    cadence,
    heartRate,
    elevationFeet: 100,
    distanceMiles: speedMph * elapsedSeconds / 3600,
  }));
}

function analytics(id, options = {}) {
  const duration = options.duration ?? 60;
  const power = options.power === undefined ? 200 : options.power;
  return calculateRideAnalytics({
    rideId: id,
    sourceRevision: options.revision ?? `${id}-revision`,
    calculatedAt: new Date("2026-01-01T00:00:00Z"),
    activityDate: new Date(options.activityDate ?? "2025-06-01T12:00:00Z"),
    distanceMiles: options.distance ?? 10,
    elapsedDurationSeconds: duration,
    movingDurationSeconds: options.moving ?? duration,
    elevationGainFeet: options.elevation ?? 500,
    powerProvenance: options.provenance ?? (power === null ? "unavailable" : "measured"),
    samples: samples(duration, power, options.cadence, options.heartRate, options.speedMph),
  });
}

function snapshot(value) {
  return { rideId: value.rideId, analytics: value, current: true, processingState: "completed", hasOutdatedAnalytics: false };
}

test("groups activity months using the configured calendar timezone", () => {
  assert.equal(calendarMonthForDate("2026-01-01T01:00:00Z", "America/Los_Angeles"), "2025-12");
  assert.equal(calendarMonthForDate("2026-01-01T12:00:00Z", "America/Los_Angeles"), "2026-01");
  assert.equal(zonedMonthStart("2025-03", "America/New_York").toISOString(), "2025-03-01T05:00:00.000Z");
});

test("creates deterministic month sequences including empty and partial months", () => {
  assert.deepEqual(monthSequence("2025-11", "2026-02"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.deepEqual(monthSequence("2026-02", "2025-11"), []);
  assert.deepEqual(monthSequence("bad", "2026-01"), []);
});

test("preserves weighted monthly averages and sensor provenance", () => {
  const accumulator = createProfileAnalyticsAccumulator();
  accumulateProfileRide(accumulator, snapshot(analytics("short", { duration: 10, power: 100, cadence: null })), "UTC");
  accumulateProfileRide(accumulator, snapshot(analytics("long", { duration: 20, power: 200, cadence: 100 })), "UTC");
  const june = finalizeStatistics(accumulator.monthly["2025-06"]);
  assert.ok(Math.abs(june.averageMeasuredPowerWatts - 166.6666667) < 0.001);
  assert.equal(june.contributors.measuredPower.durationSeconds, 30);
  assert.equal(june.averageCadenceRpm, 100);

  const estimated = createProfileAnalyticsAccumulator();
  accumulateProfileRide(estimated, snapshot(analytics("estimated", { power: 250, provenance: "estimated" })), "UTC");
  const estimatedJune = finalizeStatistics(estimated.monthly["2025-06"]);
  assert.equal(estimatedJune.averageMeasuredPowerWatts, null);
  assert.equal(estimatedJune.averageEstimatedPowerWatts, 250);
});

test("monthly contributions merge to the same lifetime result", () => {
  const rides = [
    analytics("jan", { activityDate: "2025-01-10T12:00:00Z", power: 150 }),
    analytics("mar", { activityDate: "2025-03-10T12:00:00Z", power: 250 }),
  ];
  const accumulator = createProfileAnalyticsAccumulator();
  rides.reverse().forEach((ride) => accumulateProfileRide(accumulator, snapshot(ride), "UTC"));
  const combined = createStatisticsAccumulator();
  Object.values(accumulator.monthly).forEach((month) => mergeStatisticsAccumulator(combined, month));
  assert.deepEqual(finalizeStatistics(combined), finalizeStatistics(accumulator.lifetime));
});

test("clean rebuilds handle out-of-order imports, deletion, and reprocessing", () => {
  const original = analytics("corrected", { activityDate: "2025-02-01T00:00:00Z", distance: 30, revision: "old" });
  const other = analytics("other", { activityDate: "2025-01-01T00:00:00Z", distance: 20 });
  const first = createProfileAnalyticsAccumulator();
  [original, other].forEach((ride) => accumulateProfileRide(first, snapshot(ride), "UTC"));
  assert.equal(finalizeStatistics(first.lifetime).totalDistanceMiles, 50);

  const corrected = analytics("corrected", { activityDate: "2025-02-01T00:00:00Z", distance: 10, revision: "new" });
  const rebuilt = createProfileAnalyticsAccumulator();
  [corrected].forEach((ride) => accumulateProfileRide(rebuilt, snapshot(ride), "UTC"));
  assert.equal(finalizeStatistics(rebuilt.lifetime).totalDistanceMiles, 10);
  assert.equal(Object.keys(rebuilt.monthly).length, 1);
});

test("pre-ride baselines exclude same-time and future rides", () => {
  const january = createProfileAnalyticsAccumulator();
  accumulateProfileRide(january, snapshot(analytics("jan", { activityDate: "2025-01-10T00:00:00Z", power: 100 })), "UTC");
  const candidates = [
    analytics("future", { activityDate: "2025-02-20T00:00:00Z", power: 400 }),
    analytics("same", { activityDate: "2025-02-15T00:00:00Z", power: 300 }),
    analytics("earlier", { activityDate: "2025-02-10T00:00:00Z", power: 200 }),
  ];
  const baseline = buildPreRideStatistics(january.monthly, "2025-02", "2025-02-15T00:00:00Z", candidates);
  assert.equal(baseline.totalRides, 2);
  assert.equal(baseline.averageMeasuredPowerWatts, 150);
});

test("generation, policy, algorithm, and timezone changes invalidate checkpoints", () => {
  const history = {
    schemaVersion: 1,
    policyVersion: 1,
    rideAnalyticsAlgorithmVersion: 2,
    sourceGeneration: 4,
    calendarTimeZone: "UTC",
    monthly: {},
    coverage: {},
  };
  assert.equal(historicalAnalyticsIsCurrent(history, 4, "UTC"), true);
  assert.equal(historicalAnalyticsIsCurrent(history, 5, "UTC"), false);
  assert.equal(historicalAnalyticsIsCurrent(history, 4, "America/New_York"), false);
  assert.equal(historicalAnalyticsIsCurrent({ ...history, policyVersion: 2 }, 4, "UTC"), false);
});
