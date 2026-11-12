import type { Timestamp } from "firebase/firestore";

import type { RideData, RideSample } from "@/lib/ride.types";
import type { RideCalorieAnalysis } from "@/lib/rides/calories";
import type {
  PersistedRideAnalytics,
  RideAnalyticsProcessing,
  RidePowerProvenance,
} from "@/lib/rides/analytics-model";

export type RideSource = RideData["source"];

export interface RideSummaryMetrics {
  distanceMiles: number;
  durationSeconds: number;
  movingTimeSeconds: number;
  averageSpeedMph: number;
  elevationGainFeet: number;
  calories: number | null;
  calorieAnalysis?: RideCalorieAnalysis | null;
  averagePower: number | null;
  maxPower: number | null;
  normalizedPower: number | null;
  averageCadence: number | null;
  maxCadence: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
}

export interface SavedRide extends RideSummaryMetrics {
  id: string;
  userId: string;
  activityDate: Timestamp | null;
  importedAt: Timestamp | null;
  originalFileName: string;
  source: RideSource;
  originalFilePath: string;
  sampleFilePath?: string | null;
  sourceRevision?: string | null;
  powerProvenance?: RidePowerProvenance;
  analytics?: PersistedRideAnalytics | null;
  analyticsProcessing?: RideAnalyticsProcessing | null;
}

export interface StoredRideSamples {
  version: 1;
  samples: RideSample[];
}

export interface ProcessedRide {
  file: File;
  ride: RideData;
  activityDate: Date | null;
}
