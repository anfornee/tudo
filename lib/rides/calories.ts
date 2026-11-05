import type { RideData, RideSample } from "../ride.types.ts";
import { snapshotRiderProfile } from "../rider-profile/profile.ts";
import type { RiderProfile, RiderProfileSnapshot } from "../rider-profile/types.ts";

export type CalorieMethod = "recorded" | "power" | "heart_rate" | "speed_met" | "duration_met";
export type CalorieConfidence = "recorded" | "high" | "medium" | "low" | "very_low";

export interface CalorieInputAvailability {
  power: boolean;
  heartRate: boolean;
  speed: boolean;
  gps: boolean;
  elevation: boolean;
  riderWeight: boolean;
  riderAge: boolean;
  physiologicalSex: boolean;
  powerCoveragePercent: number | null;
  heartRateCoveragePercent: number | null;
}

export interface RideCalorieAnalysis {
  calories: number;
  lowerCalories: number | null;
  upperCalories: number | null;
  source: "recorded" | "estimated";
  method: CalorieMethod;
  confidence: CalorieConfidence;
  formulaVersion: "cycling-calories-v1";
  energyBasis: "source_reported" | "gross_activity";
  inputs: CalorieInputAvailability;
  profileSnapshot: RiderProfileSnapshot | null;
}

export interface CyclingCalorieInput {
  recordedCalories: number | null;
  durationSeconds: number;
  movingTimeSeconds: number;
  distanceMiles: number;
  averageSpeedMph: number;
  elevationGainFeet: number;
  activityDate: Date | null;
  samples: readonly RideSample[];
}

export function calorieInputFromRide(ride: RideData, activityDate: Date | null): CyclingCalorieInput {
  return {
    recordedCalories: ride.calories,
    durationSeconds: ride.durationSeconds,
    movingTimeSeconds: ride.movingTimeSeconds,
    distanceMiles: ride.distanceMiles,
    averageSpeedMph: ride.averageSpeedMph,
    elevationGainFeet: ride.elevationGainFeet,
    activityDate,
    samples: ride.samples,
  };
}

export function calorieInputFromSummary(
  ride: {
    calories: number | null;
    durationSeconds: number;
    movingTimeSeconds: number;
    distanceMiles: number;
    averageSpeedMph: number;
    elevationGainFeet: number;
    activityDate?: { toDate(): Date } | null;
  },
  samples: readonly RideSample[],
): CyclingCalorieInput {
  return {
    recordedCalories: ride.calories,
    durationSeconds: ride.durationSeconds,
    movingTimeSeconds: ride.movingTimeSeconds,
    distanceMiles: ride.distanceMiles,
    averageSpeedMph: ride.averageSpeedMph,
    elevationGainFeet: ride.elevationGainFeet,
    activityDate: ride.activityDate?.toDate() ?? null,
    samples,
  };
}

const FORMULA_VERSION = "cycling-calories-v1" as const;
const MAX_SENSOR_GAP_SECONDS = 10;
const MIN_ACTIVITY_SECONDS = 60;
const POWER_COVERAGE_REQUIRED = 0.95;
const HEART_RATE_COVERAGE_REQUIRED = 0.90;
const ASSUMED_GROSS_EFFICIENCY = 0.24;

function roundedCalories(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const increment = value >= 100 ? 10 : 5;
  return Math.max(increment, Math.round(value / increment) * increment);
}

function activityDuration(input: CyclingCalorieInput) {
  const elapsed = Number.isFinite(input.durationSeconds) && input.durationSeconds > 0 ? input.durationSeconds : 0;
  const moving = Number.isFinite(input.movingTimeSeconds) && input.movingTimeSeconds > 0 ? input.movingTimeSeconds : elapsed;
  return elapsed > 0 ? Math.min(moving, elapsed) : moving;
}

function integrateSamples(
  samples: readonly RideSample[],
  value: (sample: RideSample) => number | null | undefined,
  valid: (sampleValue: number) => boolean,
  integrateRate: (left: number, right: number, seconds: number) => number,
) {
  let total = 0;
  let coveredSeconds = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const seconds = current.elapsedSeconds - previous.elapsedSeconds;
    const left = value(previous);
    const right = value(current);
    if (
      !Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_SENSOR_GAP_SECONDS ||
      segmentIsStationary(previous, current) ||
      typeof left !== "number" || typeof right !== "number" || !valid(left) || !valid(right)
    ) continue;
    total += integrateRate(left, right, seconds);
    coveredSeconds += seconds;
  }
  return { total, coveredSeconds };
}

function segmentIsStationary(previous: RideSample, current: RideSample) {
  if (
    (typeof previous.power === "number" && previous.power > 0) ||
    (typeof current.power === "number" && current.power > 0) ||
    (typeof previous.cadence === "number" && previous.cadence > 0) ||
    (typeof current.cadence === "number" && current.cadence > 0)
  ) return false;
  const previousSpeed = previous.speedMph;
  const currentSpeed = current.speedMph;
  if (
    typeof previousSpeed === "number" && Number.isFinite(previousSpeed) &&
    typeof currentSpeed === "number" && Number.isFinite(currentSpeed)
  ) {
    return previousSpeed < 1 && currentSpeed < 1;
  }
  if (typeof previous.distanceMiles === "number" && typeof current.distanceMiles === "number") {
    return Math.abs(current.distanceMiles - previous.distanceMiles) < 0.0001;
  }
  return false;
}

function availability(input: CyclingCalorieInput, snapshot: RiderProfileSnapshot | null): CalorieInputAvailability {
  return {
    power: input.samples.some((sample) => typeof sample.power === "number" && sample.power >= 0 && sample.power <= 2500),
    heartRate: input.samples.some((sample) => typeof sample.heartRate === "number" && sample.heartRate >= 40 && sample.heartRate <= 240),
    speed: (Number.isFinite(input.averageSpeedMph) && input.averageSpeedMph > 0) ||
      input.samples.some((sample) => typeof sample.speedMph === "number" && sample.speedMph > 0 && sample.speedMph <= 80),
    gps: input.samples.some((sample) => typeof sample.latitude === "number" && typeof sample.longitude === "number"),
    elevation: input.elevationGainFeet > 0 || input.samples.some((sample) => typeof sample.elevationFeet === "number"),
    riderWeight: snapshot?.weightKg !== null && snapshot?.weightKg !== undefined,
    riderAge: snapshot?.ageYears !== null && snapshot?.ageYears !== undefined,
    physiologicalSex: snapshot?.physiologicalSex !== null && snapshot?.physiologicalSex !== undefined,
    powerCoveragePercent: null,
    heartRateCoveragePercent: null,
  };
}

function result(
  calories: number,
  range: [number, number] | null,
  method: CalorieMethod,
  confidence: CalorieConfidence,
  inputs: CalorieInputAvailability,
  profileSnapshot: RiderProfileSnapshot | null,
  source: "recorded" | "estimated" = "estimated",
): RideCalorieAnalysis {
  return {
    calories: source === "recorded" ? calories : roundedCalories(calories),
    lowerCalories: range ? roundedCalories(range[0]) : null,
    upperCalories: range ? roundedCalories(range[1]) : null,
    source,
    method,
    confidence,
    formulaVersion: FORMULA_VERSION,
    energyBasis: source === "recorded" ? "source_reported" : "gross_activity",
    inputs,
    profileSnapshot,
  };
}

function metMotion(input: CyclingCalorieInput, fallbackDuration: number) {
  let coveredSeconds = 0;
  let movingSeconds = 0;
  let movingDistanceMiles = 0;

  for (let index = 1; index < input.samples.length; index += 1) {
    const previous = input.samples[index - 1];
    const current = input.samples[index];
    const seconds = current.elapsedSeconds - previous.elapsedSeconds;
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 30) continue;

    let speedMph = current.speedMph;
    if (
      (typeof speedMph !== "number" || !Number.isFinite(speedMph)) &&
      typeof previous.distanceMiles === "number" &&
      typeof current.distanceMiles === "number"
    ) {
      speedMph = Math.max(0, current.distanceMiles - previous.distanceMiles) / (seconds / 3600);
    }
    if (typeof speedMph !== "number" || !Number.isFinite(speedMph) || speedMph < 0 || speedMph > 80) continue;

    coveredSeconds += seconds;
    if (speedMph >= 1) {
      movingSeconds += seconds;
      movingDistanceMiles += speedMph * seconds / 3600;
    }
  }

  if (coveredSeconds >= Math.min(fallbackDuration, input.durationSeconds) * 0.8 && movingSeconds >= MIN_ACTIVITY_SECONDS) {
    return { durationSeconds: movingSeconds, speedMph: movingDistanceMiles / (movingSeconds / 3600) };
  }

  const speedMph = input.distanceMiles > 0 && fallbackDuration > 0
    ? input.distanceMiles / (fallbackDuration / 3600)
    : input.averageSpeedMph;
  return { durationSeconds: fallbackDuration, speedMph };
}

function metCalories(met: number, weightKg: number, durationSeconds: number) {
  return met * 3.5 * weightKg / 200 * (durationSeconds / 60);
}

function speedMet(speedMph: number) {
  if (speedMph < 10) return 4;
  if (speedMph < 12) return 6.8;
  if (speedMph < 14) return 8;
  if (speedMph < 16) return 10;
  if (speedMph <= 20) return 12;
  return 16.8;
}

function heartRateKjPerMinute(sex: "female" | "male", heartRate: number, weightKg: number, ageYears: number) {
  return sex === "male"
    ? -55.0969 + 0.6309 * heartRate + 0.1988 * weightKg + 0.2017 * ageYears
    : -20.4022 + 0.4472 * heartRate - 0.1263 * weightKg + 0.074 * ageYears;
}

export function estimateCyclingCalories(input: CyclingCalorieInput, profile: RiderProfile | null): RideCalorieAnalysis | null {
  const activityDate = input.activityDate && Number.isFinite(input.activityDate.getTime()) ? input.activityDate : new Date();
  const snapshot = snapshotRiderProfile(profile, activityDate);
  const inputs = availability(input, snapshot);

  if (typeof input.recordedCalories === "number" && Number.isFinite(input.recordedCalories) && input.recordedCalories > 0) {
    return result(input.recordedCalories, null, "recorded", "recorded", inputs, null, "recorded");
  }

  const durationSeconds = activityDuration(input);
  if (durationSeconds < MIN_ACTIVITY_SECONDS) return null;

  const power = integrateSamples(
    input.samples,
    (sample) => sample.power,
    (watts) => watts >= 0 && watts <= 2500,
    (left, right, seconds) => (left + right) / 2 * seconds,
  );
  const powerCoverage = Math.min(1, power.coveredSeconds / durationSeconds);
  inputs.powerCoveragePercent = Math.round(powerCoverage * 100);
  if (power.total > 0 && powerCoverage >= POWER_COVERAGE_REQUIRED) {
    const scaledMechanicalJoules = power.total / powerCoverage;
    const calories = scaledMechanicalJoules / ASSUMED_GROSS_EFFICIENCY / 4184;
    return result(
      calories,
      [scaledMechanicalJoules / 0.25 / 4184, scaledMechanicalJoules / 0.20 / 4184],
      "power",
      "high",
      inputs,
      null,
    );
  }

  const weightKg = snapshot?.weightKg;
  const ageYears = snapshot?.ageYears;
  const sex = snapshot?.physiologicalSex;
  if (weightKg && ageYears !== null && ageYears !== undefined && ageYears >= 18 && ageYears <= 80 && sex) {
    const maxValidHeartRate = snapshot?.maxHeartRateBpm ? Math.min(240, snapshot.maxHeartRateBpm * 1.05) : 240;
    const heartRate = integrateSamples(
      input.samples,
      (sample) => sample.heartRate,
      (bpm) => bpm >= 50 && bpm <= maxValidHeartRate,
      (left, right, seconds) => {
        const kjPerMinute = heartRateKjPerMinute(sex, (left + right) / 2, weightKg, ageYears);
        return Math.max(0, kjPerMinute / 4.184) * seconds / 60;
      },
    );
    const heartRateCoverage = Math.min(1, heartRate.coveredSeconds / durationSeconds);
    inputs.heartRateCoveragePercent = Math.round(heartRateCoverage * 100);
    if (heartRate.total > 0 && heartRateCoverage >= HEART_RATE_COVERAGE_REQUIRED) {
      const calories = heartRate.total / heartRateCoverage;
      return result(calories, [calories * 0.8, calories * 1.2], "heart_rate", "medium", inputs, snapshot);
    }
  }

  if (!weightKg) return null;
  const motion = metMotion(input, durationSeconds);
  const speed = Math.round(motion.speedMph * 100) / 100;
  if (Number.isFinite(speed) && speed > 0 && speed <= 80) {
    const met = speedMet(speed);
    const calories = metCalories(met, weightKg, motion.durationSeconds);
    return result(calories, [calories * 0.75, calories * 1.25], "speed_met", "low", inputs, snapshot);
  }

  const calories = metCalories(7, weightKg, durationSeconds);
  return result(
    calories,
    [metCalories(4, weightKg, durationSeconds), metCalories(12, weightKg, durationSeconds)],
    "duration_met",
    "very_low",
    inputs,
    snapshot,
  );
}
