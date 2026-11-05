import test from "node:test";
import assert from "node:assert/strict";

const { estimateCyclingCalories } = await import("./calories.ts");

function profile(weightKg = 70, effectiveDate = "2020-01-01") {
  return {
    version: 3,
    preferredUnits: "metric",
    heightCm: 175,
    dateOfBirth: "1990-06-15",
    physiologicalSex: "male",
    restingHeartRateBpm: 55,
    maxHeartRateBpm: 190,
    weightHistory: [{ effectiveDate, weightKg }],
  };
}

function samples(duration, interval, values) {
  const result = [];
  for (let seconds = 0; seconds <= duration; seconds += interval) {
    result.push({
      elapsedSeconds: seconds,
      power: values.power ?? null,
      speedMph: values.speedMph ?? null,
      cadence: null,
      heartRate: values.heartRate ?? null,
      elevationFeet: null,
      distanceMiles: values.speedMph ? values.speedMph * seconds / 3600 : null,
    });
  }
  return result;
}

function input(overrides = {}) {
  return {
    recordedCalories: null,
    durationSeconds: 3600,
    movingTimeSeconds: 3600,
    distanceMiles: 12,
    averageSpeedMph: 12,
    elevationGainFeet: 500,
    activityDate: new Date("2025-01-15T12:00:00Z"),
    samples: [],
    ...overrides,
  };
}

test("preserves a valid recorded calorie value ahead of every estimate", () => {
  const analysis = estimateCyclingCalories(input({
    recordedCalories: 503,
    samples: samples(3600, 10, { power: 200, heartRate: 140, speedMph: 20 }),
  }), profile());
  assert.equal(analysis.source, "recorded");
  assert.equal(analysis.method, "recorded");
  assert.equal(analysis.calories, 503);
  assert.equal(analysis.energyBasis, "source_reported");
});

test("integrates timestamped power and reports the gross-efficiency range", () => {
  const analysis = estimateCyclingCalories(input({
    distanceMiles: 20,
    averageSpeedMph: 20,
    samples: samples(3600, 10, { power: 200, speedMph: 20 }),
  }), null);
  assert.equal(analysis.method, "power");
  assert.equal(analysis.calories, 720);
  assert.equal(analysis.lowerCalories, 690);
  assert.equal(analysis.upperCalories, 860);
  assert.equal(analysis.inputs.powerCoveragePercent, 100);
  assert.equal(analysis.profileSnapshot, null);
});

test("does not extrapolate sparse power across long gaps", () => {
  const analysis = estimateCyclingCalories(input({
    samples: [
      { elapsedSeconds: 0, power: 250, speedMph: 12, cadence: null, elevationFeet: null, distanceMiles: 0 },
      { elapsedSeconds: 600, power: 250, speedMph: 12, cadence: null, elevationFeet: null, distanceMiles: 2 },
    ],
  }), profile());
  assert.equal(analysis.method, "speed_met");
  assert.equal(analysis.inputs.powerCoveragePercent, 0);
});

test("excludes stationary paused intervals from sensor coverage and power work", () => {
  const rideSamples = [];
  for (let seconds = 0; seconds <= 3600; seconds += 10) {
    const moving = seconds <= 1800;
    rideSamples.push({
      elapsedSeconds: seconds,
      power: moving ? 200 : 0,
      speedMph: moving ? 12 : 0,
      cadence: null,
      elevationFeet: null,
      distanceMiles: moving ? 12 * seconds / 3600 : 6,
    });
  }
  const analysis = estimateCyclingCalories(input({
    durationSeconds: 3600,
    movingTimeSeconds: 1800,
    distanceMiles: 6,
    samples: rideSamples,
  }), null);
  assert.equal(analysis.method, "power");
  assert.equal(analysis.calories, 360);
  assert.ok(analysis.inputs.powerCoveragePercent >= 99);
});

test("uses the Keytel heart-rate model only with sufficient coverage and profile inputs", () => {
  const analysis = estimateCyclingCalories(input({
    samples: samples(3600, 10, { heartRate: 140, speedMph: 12 }),
  }), profile());
  assert.equal(analysis.method, "heart_rate");
  assert.equal(analysis.calories, 770);
  assert.equal(analysis.inputs.heartRateCoveragePercent, 100);
  assert.equal(analysis.profileSnapshot.weightKg, 70);
  assert.equal(analysis.profileSnapshot.ageYears, 34);
});

test("falls through implausible heart rate to the speed MET category", () => {
  const analysis = estimateCyclingCalories(input({
    samples: samples(3600, 10, { heartRate: 230, speedMph: 12 }),
  }), profile());
  assert.equal(analysis.method, "speed_met");
  assert.equal(analysis.calories, 590);
});

test("uses moving time and excludes a stationary pause from the MET estimate", () => {
  const analysis = estimateCyclingCalories(input({
    durationSeconds: 3600,
    movingTimeSeconds: 1800,
    distanceMiles: 6,
    averageSpeedMph: 6,
  }), profile());
  assert.equal(analysis.method, "speed_met");
  assert.equal(analysis.calories, 290);
});

test("uses a broad low-confidence duration-only range when speed is absent", () => {
  const analysis = estimateCyclingCalories(input({ distanceMiles: 0, averageSpeedMph: 0 }), profile());
  assert.equal(analysis.method, "duration_met");
  assert.equal(analysis.confidence, "very_low");
  assert.equal(analysis.calories, 510);
  assert.equal(analysis.lowerCalories, 290);
  assert.equal(analysis.upperCalories, 880);
});

test("uses the 2024 Compendium speed category boundaries", () => {
  const estimates = [9.9, 10, 12, 14, 16, 20.1].map((averageSpeedMph) =>
    estimateCyclingCalories(input({ distanceMiles: averageSpeedMph, averageSpeedMph }), profile()).calories
  );
  assert.deepEqual(estimates, [290, 500, 590, 740, 880, 1230]);
});

test("requires dated rider weight for MET estimates but not measured power", () => {
  assert.equal(estimateCyclingCalories(input(), null), null);
  const power = estimateCyclingCalories(input({ samples: samples(3600, 10, { power: 150 }) }), null);
  assert.equal(power.method, "power");
});

test("selects the latest historical weight available on the activity date", () => {
  const rider = profile();
  rider.weightHistory = [
    { effectiveDate: "2020-01-01", weightKg: 80 },
    { effectiveDate: "2025-02-01", weightKg: 70 },
  ];
  const analysis = estimateCyclingCalories(input({ activityDate: new Date("2025-01-15T12:00:00Z") }), rider);
  assert.equal(analysis.profileSnapshot.weightKg, 80);
  assert.equal(analysis.profileSnapshot.weightEffectiveDate, "2020-01-01");
  assert.equal(analysis.calories, 670);
});

test("does not use a future weight record for an older ride", () => {
  assert.equal(estimateCyclingCalories(input({ activityDate: new Date("2019-01-01T00:00:00Z") }), profile()), null);
});

test("rejects activities too short to estimate", () => {
  assert.equal(estimateCyclingCalories(input({ durationSeconds: 30, movingTimeSeconds: 30 }), profile()), null);
});
