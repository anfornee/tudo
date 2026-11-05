export type RiderUnitSystem = "imperial" | "metric";
export type PhysiologicalSex = "female" | "male";

export interface RiderWeightRecord {
  effectiveDate: string;
  weightKg: number;
}

export interface RiderProfile {
  version: number;
  preferredUnits: RiderUnitSystem;
  heightCm: number | null;
  dateOfBirth: string | null;
  physiologicalSex: PhysiologicalSex | null;
  restingHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  weightHistory: RiderWeightRecord[];
}

export interface RiderProfileSnapshot {
  profileVersion: number;
  weightKg: number | null;
  weightEffectiveDate: string | null;
  ageYears: number | null;
  physiologicalSex: PhysiologicalSex | null;
  restingHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
}
