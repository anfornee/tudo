import test from "node:test";
import assert from "node:assert/strict";

const {
  buildRideComparisons,
  formatProfileDistance,
  formatProfileElevation,
  formatProfileSpeed,
  formatRideComparison,
  profileCoverageMessage,
  rideAnalyticsIsCurrent,
} = await import("./profile-presentation.ts");

const baseline = {
  averageMovingSpeedMph: 18,
  averageMeasuredPowerWatts: 180,
  durationWeightedRideNormalizedPowerWatts: 210,
  averageCadenceRpm: 85,
  averageHeartRateBpm: 145,
};

test("formats profile units consistently", () => {
  assert.equal(formatProfileDistance(10, "imperial"), "10.0 mi");
  assert.equal(formatProfileDistance(10, "metric"), "16.1 km");
  assert.equal(formatProfileElevation(1000, "metric"), "305 m");
  assert.equal(formatProfileSpeed(20, "metric"), "32.2 km/h");
});

test("builds positive, negative, and zero neutral lifetime comparisons", () => {
  const comparisons = buildRideComparisons({
    averageMovingSpeedMph: 20,
    averagePowerWatts: 168,
    normalizedPowerWatts: 210,
    averageCadenceRpm: 85,
    averageHeartRateBpm: 150,
    powerProvenance: "measured",
  }, baseline, "imperial");
  assert.equal(formatRideComparison(comparisons.averageSpeed), "+2.0 mph vs current lifetime avg");
  assert.equal(formatRideComparison(comparisons.averagePower), "−12 W vs current lifetime avg");
  assert.equal(formatRideComparison(comparisons.normalizedPower), "No difference vs current lifetime avg");
});

test("labels chronological comparison baselines explicitly", () => {
  const comparisons = buildRideComparisons({
    averageMovingSpeedMph: 20,
    averagePowerWatts: 190,
    normalizedPowerWatts: null,
    averageCadenceRpm: null,
    averageHeartRateBpm: null,
    powerProvenance: "measured",
  }, baseline, "imperial", "previous rides");
  assert.equal(formatRideComparison(comparisons.averagePower), "+10 W vs previous rides");
});

test("never compares estimated power with measured profile power", () => {
  const comparisons = buildRideComparisons({
    averageMovingSpeedMph: 20,
    averagePowerWatts: 220,
    normalizedPowerWatts: 250,
    averageCadenceRpm: null,
    averageHeartRateBpm: null,
    powerProvenance: "estimated",
  }, baseline);
  assert.equal(comparisons.averagePower, undefined);
  assert.equal(comparisons.normalizedPower, undefined);
  assert.ok(comparisons.averageSpeed);
});

test("describes complete, partial, empty, and stale profile coverage", () => {
  assert.equal(profileCoverageMessage({ totalStoredRides: 48, currentAnalyticsRides: 42 }, { hasProfile: true, fresh: true }), "Stats calculated from 42 of 48 rides.");
  assert.equal(profileCoverageMessage({ totalStoredRides: 1, currentAnalyticsRides: 1 }, { hasProfile: true, fresh: true }), "Stats include all 1 ride.");
  assert.equal(profileCoverageMessage({ totalStoredRides: 0, currentAnalyticsRides: 0 }, { hasProfile: false, fresh: false }), "No eligible rides yet.");
  assert.equal(profileCoverageMessage({ totalStoredRides: 2, currentAnalyticsRides: 2 }, { hasProfile: true, fresh: false }), "Showing last calculated stats. Stats include all 2 rides.");
});

test("accepts only current ride analytics for comparisons", () => {
  const timestamp = { toDate: () => new Date(), toMillis: () => Date.now() };
  const current = {
    sourceRevision: "revision-2",
    analytics: {
      schemaVersion: 1,
      algorithmVersion: 2,
      sourceRevision: "revision-2",
      calculatedAt: timestamp,
    },
    analyticsProcessing: {
      state: "completed",
      algorithmVersion: 2,
      sourceRevision: "revision-2",
    },
  };
  assert.equal(rideAnalyticsIsCurrent(current), true);
  assert.equal(rideAnalyticsIsCurrent({ ...current, sourceRevision: "revision-3" }), false);
  assert.equal(rideAnalyticsIsCurrent({ ...current, analyticsProcessing: { ...current.analyticsProcessing, state: "processing" } }), false);
});
