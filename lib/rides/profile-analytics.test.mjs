import test from "node:test";
import assert from "node:assert/strict";

const { calculateRideAnalytics } = await import("./ride-analytics.ts");
const {
  accumulateProfileRide,
  calendarYearForDate,
  createProfileAnalyticsAccumulator,
  finalizeProfileAnalytics,
  profileRebuildMayCommit,
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

function analytics(id, overrides = {}) {
  const duration = overrides.duration ?? 60;
  const power = overrides.power === undefined ? 200 : overrides.power;
  const provenance = overrides.provenance ?? (power === null ? "unavailable" : "measured");
  const rideSamples = samples(
    duration,
    power,
    overrides.cadence === undefined ? 90 : overrides.cadence,
    overrides.heartRate === undefined ? 140 : overrides.heartRate,
    overrides.speedMph ?? 20,
  );
  return calculateRideAnalytics({
    rideId: id,
    sourceRevision: overrides.revision ?? `${id}-revision`,
    calculatedAt: new Date("2026-01-01T00:00:00Z"),
    activityDate: new Date(overrides.activityDate ?? "2025-06-01T12:00:00Z"),
    distanceMiles: overrides.distance ?? 10,
    elapsedDurationSeconds: overrides.elapsed ?? duration,
    movingDurationSeconds: overrides.moving ?? duration,
    elevationGainFeet: overrides.elevation ?? 500,
    powerProvenance: provenance,
    samples: rideSamples,
  });
}

function ride(id, value, overrides = {}) {
  return {
    rideId: id,
    analytics: value,
    current: overrides.current ?? true,
    processingState: overrides.processingState ?? "completed",
    hasOutdatedAnalytics: overrides.hasOutdatedAnalytics ?? false,
  };
}

function aggregate(rides, timeZone = "UTC") {
  const accumulator = createProfileAnalyticsAccumulator();
  rides.forEach((value) => accumulateProfileRide(accumulator, value, timeZone));
  return finalizeProfileAnalytics(accumulator, {
    sourceGeneration: 4,
    calculatedAt: new Date("2026-01-01T00:00:00Z"),
    calendarTimeZone: timeZone,
  });
}

test("builds an empty profile without NaN or invented values", () => {
  const profile = aggregate([]);
  assert.equal(profile.lifetime.totalRides, 0);
  assert.equal(profile.lifetime.averageMovingSpeedMph, null);
  assert.equal(profile.lifetime.averageMeasuredPowerWatts, null);
  assert.equal(profile.personalRecords.longestDistance, null);
});

test("builds lifetime and annual values for a single ride", () => {
  const profile = aggregate([ride("one", analytics("one", { duration: 60, distance: 10 }))]);
  assert.equal(profile.lifetime.totalRides, 1);
  assert.equal(profile.lifetime.totalDistanceMiles, 10);
  assert.equal(profile.annual[2025].totalRides, 1);
  assert.equal(profile.coverage.currentAnalyticsRides, 1);
  assert.equal(profile.personalRecords.longestDistance.rideId, "one");
});

test("uses duration and distance denominators instead of averaging ride averages", () => {
  const first = analytics("first", { duration: 10, moving: 3600, distance: 10, power: 100, cadence: 80, heartRate: 120 });
  const second = analytics("second", { duration: 20, moving: 1800, distance: 20, power: 200, cadence: 100, heartRate: 150 });
  const profile = aggregate([ride("first", first), ride("second", second)]);
  assert.equal(profile.lifetime.averageMovingSpeedMph, 20);
  assert.ok(Math.abs(profile.lifetime.averageMeasuredPowerWatts - 166.6666667) < 0.001);
  assert.ok(Math.abs(profile.lifetime.averageCadenceRpm - 93.3333333) < 0.001);
  assert.ok(Math.abs(profile.lifetime.averageHeartRateBpm - 140) < 0.001);
  assert.equal(profile.lifetime.contributors.measuredPower.durationSeconds, 30);
});

test("separates estimated power and excludes missing sensors", () => {
  const measured = analytics("measured", { duration: 10, power: 200, cadence: null, heartRate: null });
  const estimated = analytics("estimated", { duration: 20, power: 250, provenance: "estimated" });
  const missing = analytics("missing", { duration: 10, power: null, cadence: null, heartRate: null });
  const profile = aggregate([
    ride("measured", measured), ride("estimated", estimated), ride("missing", missing),
  ]);
  assert.equal(profile.lifetime.averageMeasuredPowerWatts, 200);
  assert.equal(profile.lifetime.averageEstimatedPowerWatts, 250);
  assert.equal(profile.coverage.measuredPowerRides, 1);
  assert.equal(profile.coverage.estimatedPowerRides, 1);
  assert.equal(profile.lifetime.averageCadenceRpm, 90);
});

test("applies the configured calendar timezone at year boundaries", () => {
  assert.equal(calendarYearForDate("2026-01-01T01:00:00Z", "America/Los_Angeles"), "2025");
  const profile = aggregate([
    ride("west", analytics("west", { activityDate: "2026-01-01T01:00:00Z" })),
    ride("new-year", analytics("new-year", { activityDate: "2026-01-01T12:00:00Z" })),
  ], "America/Los_Angeles");
  assert.equal(profile.annual[2025].totalRides, 1);
  assert.equal(profile.annual[2026].totalRides, 1);
});

test("counts pending, failed, and stale analytics without treating them as zero", () => {
  const valid = analytics("valid");
  const profile = aggregate([
    ride("valid", valid),
    ride("pending", null, { current: false, processingState: "pending" }),
    ride("failed", null, { current: false, processingState: "failed" }),
    ride("stale", valid, { current: false, processingState: "completed", hasOutdatedAnalytics: true }),
  ]);
  assert.equal(profile.coverage.totalStoredRides, 4);
  assert.equal(profile.coverage.currentAnalyticsRides, 1);
  assert.equal(profile.coverage.pendingAnalyticsRides, 2);
  assert.equal(profile.coverage.failedOrUnavailableAnalyticsRides, 1);
  assert.equal(profile.coverage.outdatedAnalyticsRides, 1);
  assert.equal(profile.lifetime.totalRides, 1);
});

test("rebuild replaces reprocessed rides and invalidates deleted record holders", () => {
  const strongest = ride("strongest", analytics("strongest", { power: 400, distance: 30 }));
  const next = ride("next", analytics("next", { power: 300, distance: 20 }));
  assert.equal(aggregate([strongest, next]).personalRecords.highestMeasuredPower.rideId, "strongest");
  assert.equal(aggregate([next]).personalRecords.highestMeasuredPower.rideId, "next");
  const corrected = ride("strongest", analytics("strongest", { power: 250, distance: 15, revision: "corrected" }));
  const rebuilt = aggregate([corrected, next]);
  assert.equal(rebuilt.lifetime.totalRides, 2);
  assert.equal(rebuilt.personalRecords.highestMeasuredPower.rideId, "next");
});

test("uses activity date then ride id as deterministic record tie breakers", () => {
  const later = ride("a", analytics("a", { power: 300, activityDate: "2025-02-01T00:00:00Z" }));
  const earlierZ = ride("z", analytics("z", { power: 300, activityDate: "2025-01-01T00:00:00Z" }));
  const earlierA = ride("b", analytics("b", { power: 300, activityDate: "2025-01-01T00:00:00Z" }));
  assert.equal(aggregate([later, earlierZ, earlierA]).personalRecords.highestMeasuredPower.rideId, "b");
});

test("power-duration records retain effort and source provenance", () => {
  const profile = aggregate([ride("effort", analytics("effort", { duration: 60, power: 310 }))]);
  const record = profile.personalRecords.powerDuration[60];
  assert.equal(record.rideId, "effort");
  assert.equal(record.value, 310);
  assert.equal(record.effortDurationSeconds, 60);
  assert.equal(record.effortStartElapsedSeconds, 0);
  assert.equal(record.effortEndElapsedSeconds, 60);
  assert.equal(record.sourceRevision, "effort-revision");
});

test("resumed accumulator and clean rebuilds are deterministic and idempotent", () => {
  const rides = [
    ride("one", analytics("one", { power: 150 })),
    ride("two", analytics("two", { power: 250 })),
  ];
  const interrupted = createProfileAnalyticsAccumulator();
  accumulateProfileRide(interrupted, rides[0], "UTC");
  const resumed = JSON.parse(JSON.stringify(interrupted));
  accumulateProfileRide(resumed, rides[1], "UTC");
  const resumedResult = finalizeProfileAnalytics(resumed, {
    sourceGeneration: 4,
    calculatedAt: new Date("2026-01-01T00:00:00Z"),
    calendarTimeZone: "UTC",
  });
  assert.deepEqual(resumedResult, aggregate(rides));
  assert.deepEqual(aggregate(rides), aggregate(rides));
});

test("generation and lease guards reject stale concurrent rebuilds", () => {
  assert.equal(profileRebuildMayCommit(4, "worker-a", 4, "worker-a"), true);
  assert.equal(profileRebuildMayCommit(5, "worker-a", 4, "worker-a"), false);
  assert.equal(profileRebuildMayCommit(4, "worker-b", 4, "worker-a"), false);
});
