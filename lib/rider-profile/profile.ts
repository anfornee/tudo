import type {
  RiderProfile,
  RiderProfileSnapshot,
  RiderWeightRecord,
} from "./types.ts";

export const POUNDS_PER_KILOGRAM = 2.2046226218;
export const CENTIMETERS_PER_INCH = 2.54;

export function poundsToKilograms(pounds: number) {
  return pounds / POUNDS_PER_KILOGRAM;
}

export function kilogramsToPounds(kilograms: number) {
  return kilograms * POUNDS_PER_KILOGRAM;
}

export function inchesToCentimeters(inches: number) {
  return inches * CENTIMETERS_PER_INCH;
}

export function centimetersToInches(centimeters: number) {
  return centimeters / CENTIMETERS_PER_INCH;
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function ageOnDate(dateOfBirth: string | null, date: Date) {
  if (!dateOfBirth || !isIsoDate(dateOfBirth) || !Number.isFinite(date.getTime())) return null;
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  let age = date.getUTCFullYear() - year;
  const beforeBirthday = date.getUTCMonth() + 1 < month ||
    (date.getUTCMonth() + 1 === month && date.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

export function normalizeWeightHistory(records: readonly RiderWeightRecord[]) {
  const byDate = new Map<string, number>();
  for (const record of records) {
    if (isIsoDate(record.effectiveDate) && Number.isFinite(record.weightKg)) {
      byDate.set(record.effectiveDate, record.weightKg);
    }
  }
  return [...byDate]
    .map(([effectiveDate, weightKg]) => ({ effectiveDate, weightKg }))
    .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
}

export function parseRiderProfile(value: unknown): RiderProfile | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const weightHistory = Array.isArray(data.weightHistory)
    ? data.weightHistory.flatMap((record) => {
        if (!record || typeof record !== "object") return [];
        const item = record as Record<string, unknown>;
        return typeof item.effectiveDate === "string" && typeof item.weightKg === "number"
          ? [{ effectiveDate: item.effectiveDate, weightKg: item.weightKg }]
          : [];
      })
    : [];
  const profile: RiderProfile = {
    version: typeof data.version === "number" ? data.version : 0,
    preferredUnits: data.preferredUnits === "metric" ? "metric" : "imperial",
    heightCm: typeof data.heightCm === "number" ? data.heightCm : null,
    dateOfBirth: typeof data.dateOfBirth === "string" ? data.dateOfBirth : null,
    physiologicalSex: data.physiologicalSex === "female" || data.physiologicalSex === "male" ? data.physiologicalSex : null,
    restingHeartRateBpm: typeof data.restingHeartRateBpm === "number" ? data.restingHeartRateBpm : null,
    maxHeartRateBpm: typeof data.maxHeartRateBpm === "number" ? data.maxHeartRateBpm : null,
    weightHistory: normalizeWeightHistory(weightHistory),
  };
  return validateRiderProfile(profile).length ? null : profile;
}

export function weightForDate(records: readonly RiderWeightRecord[], date: Date) {
  if (!Number.isFinite(date.getTime())) return null;
  const target = date.toISOString().slice(0, 10);
  let selected: RiderWeightRecord | null = null;
  for (const record of normalizeWeightHistory(records)) {
    if (record.effectiveDate > target) break;
    selected = record;
  }
  return selected;
}

export function validateRiderProfile(profile: RiderProfile) {
  const errors: string[] = [];
  if (!Number.isSafeInteger(profile.version) || profile.version < 0) errors.push("Invalid profile version.");
  if (!(["imperial", "metric"] as const).includes(profile.preferredUnits)) errors.push("Choose a valid unit system.");
  if (profile.heightCm !== null && (!Number.isFinite(profile.heightCm) || profile.heightCm < 100 || profile.heightCm > 250)) {
    errors.push("Height must be between 100 and 250 cm.");
  }
  if (profile.dateOfBirth !== null) {
    const age = ageOnDate(profile.dateOfBirth, new Date());
    if (age === null || age < 13 || age > 110) errors.push("Enter a valid date of birth.");
  }
  if (profile.physiologicalSex !== null && !(["female", "male"] as const).includes(profile.physiologicalSex)) {
    errors.push("Choose a valid physiological sex option.");
  }
  if (profile.restingHeartRateBpm !== null && (!Number.isFinite(profile.restingHeartRateBpm) || profile.restingHeartRateBpm < 30 || profile.restingHeartRateBpm > 120)) {
    errors.push("Resting heart rate must be between 30 and 120 bpm.");
  }
  if (profile.maxHeartRateBpm !== null && (!Number.isFinite(profile.maxHeartRateBpm) || profile.maxHeartRateBpm < 100 || profile.maxHeartRateBpm > 240)) {
    errors.push("Maximum heart rate must be between 100 and 240 bpm.");
  }
  if (profile.restingHeartRateBpm !== null && profile.maxHeartRateBpm !== null && profile.restingHeartRateBpm >= profile.maxHeartRateBpm) {
    errors.push("Maximum heart rate must be higher than resting heart rate.");
  }
  if (profile.weightHistory.length > 100) errors.push("Keep at most 100 weight records.");
  for (const record of profile.weightHistory) {
    if (!isIsoDate(record.effectiveDate) || record.effectiveDate > new Date().toISOString().slice(0, 10) || !Number.isFinite(record.weightKg) || record.weightKg < 30 || record.weightKg > 300) {
      errors.push("Each weight must be between 30 and 300 kg with a valid effective date.");
      break;
    }
  }
  return errors;
}

export function snapshotRiderProfile(profile: RiderProfile | null, activityDate: Date): RiderProfileSnapshot | null {
  if (!profile) return null;
  const weight = weightForDate(profile.weightHistory, activityDate);
  return {
    profileVersion: profile.version,
    weightKg: weight?.weightKg ?? null,
    weightEffectiveDate: weight?.effectiveDate ?? null,
    ageYears: ageOnDate(profile.dateOfBirth, activityDate),
    physiologicalSex: profile.physiologicalSex,
    restingHeartRateBpm: profile.restingHeartRateBpm,
    maxHeartRateBpm: profile.maxHeartRateBpm,
  };
}
