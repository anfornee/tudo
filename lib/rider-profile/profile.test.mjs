import test from "node:test";
import assert from "node:assert/strict";

const {
  ageOnDate,
  centimetersToInches,
  inchesToCentimeters,
  kilogramsToPounds,
  normalizeWeightHistory,
  poundsToKilograms,
  parseRiderProfile,
  snapshotRiderProfile,
  validateRiderProfile,
  weightForDate,
} = await import("./profile.ts");

test("converts rider units without meaningful precision loss", () => {
  assert.ok(Math.abs(poundsToKilograms(154.324) - 70) < 0.001);
  assert.ok(Math.abs(kilogramsToPounds(70) - 154.324) < 0.001);
  assert.ok(Math.abs(inchesToCentimeters(70) - 177.8) < 0.001);
  assert.ok(Math.abs(centimetersToInches(177.8) - 70) < 0.001);
});

test("normalizes duplicate dated weights and resolves history without future leakage", () => {
  const history = normalizeWeightHistory([
    { effectiveDate: "2025-01-01", weightKg: 75 },
    { effectiveDate: "2024-01-01", weightKg: 80 },
    { effectiveDate: "2025-01-01", weightKg: 74 },
  ]);
  assert.deepEqual(history, [
    { effectiveDate: "2024-01-01", weightKg: 80 },
    { effectiveDate: "2025-01-01", weightKg: 74 },
  ]);
  assert.equal(weightForDate(history, new Date("2024-06-01T00:00:00Z")).weightKg, 80);
  assert.equal(weightForDate(history, new Date("2023-06-01T00:00:00Z")), null);
});

test("calculates age on the activity date and captures an immutable profile snapshot", () => {
  assert.equal(ageOnDate("1990-06-15", new Date("2025-06-14T12:00:00Z")), 34);
  assert.equal(ageOnDate("1990-06-15", new Date("2025-06-15T12:00:00Z")), 35);
  const snapshot = snapshotRiderProfile({
    version: 4,
    preferredUnits: "metric",
    heightCm: null,
    dateOfBirth: "1990-06-15",
    physiologicalSex: "female",
    restingHeartRateBpm: 55,
    maxHeartRateBpm: 190,
    weightHistory: [{ effectiveDate: "2024-01-01", weightKg: 65 }],
  }, new Date("2025-06-15T12:00:00Z"));
  assert.deepEqual(snapshot, {
    profileVersion: 4,
    weightKg: 65,
    weightEffectiveDate: "2024-01-01",
    ageYears: 35,
    physiologicalSex: "female",
    restingHeartRateBpm: 55,
    maxHeartRateBpm: 190,
  });
});

test("validates physiological ranges while leaving fields optional", () => {
  const optional = {
    version: 0,
    preferredUnits: "imperial",
    heightCm: null,
    dateOfBirth: null,
    physiologicalSex: null,
    restingHeartRateBpm: null,
    maxHeartRateBpm: null,
    weightHistory: [],
  };
  assert.deepEqual(validateRiderProfile(optional), []);
  assert.ok(validateRiderProfile({ ...optional, heightCm: 90 }).length > 0);
  assert.ok(validateRiderProfile({ ...optional, restingHeartRateBpm: 90, maxHeartRateBpm: 80 }).length > 0);
  assert.ok(validateRiderProfile({ ...optional, weightHistory: [{ effectiveDate: "2020-01-01", weightKg: 500 }] }).length > 0);
  assert.ok(validateRiderProfile({ ...optional, weightHistory: [{ effectiveDate: "2025-02-31", weightKg: 70 }] }).length > 0);
});

test("decodes persisted profiles defensively", () => {
  const stored = {
    version: 1,
    preferredUnits: "metric",
    heightCm: null,
    dateOfBirth: null,
    physiologicalSex: null,
    restingHeartRateBpm: null,
    maxHeartRateBpm: null,
    weightHistory: [],
  };
  assert.deepEqual(parseRiderProfile(stored), stored);
  assert.equal(parseRiderProfile({ version: -1 }), null);
});
