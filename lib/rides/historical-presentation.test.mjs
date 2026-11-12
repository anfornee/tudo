import test from "node:test";
import assert from "node:assert/strict";

const {
  formatHistoricalMetric,
  historicalMetricValue,
  recommendedHistoricalRange,
  selectHistoricalRange,
} = await import("./historical-presentation.ts");
const { powerDurationRecordPoints } = await import("./profile-presentation.ts");

const statistics = {
  totalDistanceMiles: 10,
  totalMovingSeconds: 7200,
  totalElevationGainFeet: 1000,
  averageMovingSpeedMph: 20,
  averageMeasuredPowerWatts: 200,
  averageCadenceRpm: 90,
  averageHeartRateBpm: 140,
  durationWeightedRideNormalizedPowerWatts: 220,
};

test("converts historical chart values using rider units", () => {
  assert.ok(Math.abs(historicalMetricValue(statistics, "distance", "metric") - 16.09344) < 0.00001);
  assert.ok(Math.abs(historicalMetricValue(statistics, "elevation", "metric") - 304.8) < 0.00001);
  assert.equal(historicalMetricValue(statistics, "power", "metric"), 200);
  assert.equal(formatHistoricalMetric(32.18688, "speed", "metric"), "32.2 km/h");
  assert.equal(historicalMetricValue({ ...statistics, averageMeasuredPowerWatts: null }, "power", "imperial"), null);
});

test("selects compact historical ranges without recomputing aggregates", () => {
  const months = Array.from({ length: 14 }, (_, index) => ({ month: String(index) }));
  assert.deepEqual(selectHistoricalRange(months, "3").map((month) => month.month), ["11", "12", "13"]);
  assert.equal(selectHistoricalRange(months, "all").length, 14);
  assert.equal(recommendedHistoricalRange(2), "3");
  assert.equal(recommendedHistoricalRange(5), "6");
  assert.equal(recommendedHistoricalRange(9), "12");
});

test("power chart points omit unavailable durations and retain ride navigation", () => {
  const record = { rideId: "ride one", value: 500 };
  const points = powerDurationRecordPoints({ 5: record, 60: null });
  assert.equal(points.length, 1);
  assert.equal(points[0].duration, 5);
  assert.equal(points[0].href, "/rides/ride%20one");
});
