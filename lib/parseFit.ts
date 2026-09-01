import { Decoder, Stream } from "@garmin/fitsdk";
import {
  calculateBestAverage,
  calculateNormalizedPower,
  calculatePowerPercentiles,
} from "./rideCalculations";
import type { RideData, RideSample } from "./ride.types";

interface FitRecordSample {
  timestamp: Date;
  power: number | null;
  cadence: number | null;
  speed: number | null;
  elevation: number | null;
  distance: number | null;
}

export async function parseZwiftFit(
	buffer: ArrayBuffer,
): Promise<RideData> {
  const stream = Stream.fromBuffer(new Uint8Array(buffer));
  const decoder = new Decoder(stream);

  const { messages, errors } = decoder.read({
    applyScaleAndOffset: true,
    convertTypesToStrings: true,
    convertDateTimesToDates: true,
    expandSubFields: true,
    expandComponents: true,
    includeUnknownData: false,
  });

  if (errors.length > 0) {
    throw new Error(`Failed to parse FIT file: ${errors.join(", ")}`);
  }

  const records = messages.recordMesgs ?? [];
  const sessions = messages.sessionMesgs ?? [];

  if (!records.length) {
    throw new Error("FIT file contains no record messages");
  }

  const session = sessions[0];

  const recordsWithTimestamps: FitRecordSample[] = records
    .map((record) => ({
      timestamp: record.timestamp,
      power: Number.isFinite(record.power) ? record.power : null,
      cadence: Number.isFinite(record.cadence) ? record.cadence : null,
      speed: Number.isFinite(record.speed) ? record.speed : null,
      elevation: Number.isFinite(record.enhancedAltitude)
        ? record.enhancedAltitude
        : Number.isFinite(record.altitude) ? record.altitude : null,
      distance: Number.isFinite(record.distance) ? record.distance : null,
    }))
    .filter((sample): sample is FitRecordSample => sample.timestamp instanceof Date);

  const powerSamples = recordsWithTimestamps
    .map((sample) => sample.power)
    .filter((value): value is number => value !== null);

  const cadenceSamples = recordsWithTimestamps
    .map((sample) => sample.cadence)
    .filter((value): value is number => value !== null);

  const speedSamples = recordsWithTimestamps
    .map((sample) => sample.speed)
    .filter((value): value is number => value !== null);

  const timestamps = recordsWithTimestamps.map((sample) => sample.timestamp);
  const firstTimestamp = timestamps[0]?.getTime() ?? 0;
  const samples: RideSample[] = recordsWithTimestamps.map((sample) => ({
    elapsedSeconds: Math.max(0, (sample.timestamp.getTime() - firstTimestamp) / 1000),
    power: sample.power,
    speedMph: sample.speed === null ? null : sample.speed * 2.236936,
    cadence: sample.cadence,
    elevationFeet: sample.elevation === null ? null : sample.elevation * 3.28084,
    distanceMiles: sample.distance === null ? null : sample.distance / 1609.344,
  }));

  const heartRateSamples = records
    .map((record) => record.heartRate)
    .filter((value): value is number => Number.isFinite(value));

  const averageHeartRate = heartRateSamples.length
    ? heartRateSamples.reduce((sum, value) => sum + value, 0) /
      heartRateSamples.length
    : null;

  const maxHeartRate = heartRateSamples.length
    ? Math.max(...heartRateSamples)
    : null;

  const averagePower = powerSamples.length
    ? powerSamples.reduce((sum, value) => sum + value, 0) / powerSamples.length
    : null;

  const averageCadence = cadenceSamples.length
    ? cadenceSamples.reduce((sum, value) => sum + value, 0) /
      cadenceSamples.length
    : null;

  const maxPower = powerSamples.length ? Math.max(...powerSamples) : null;

  const maxCadence = cadenceSamples.length ? Math.max(...cadenceSamples) : null;

  const durationSeconds =
    session?.totalElapsedTime ??
    (timestamps.length > 1
      ? (timestamps.at(-1)!.getTime() - timestamps[0].getTime()) / 1000
      : 0);

  const movingTimeSeconds = session?.totalTimerTime ?? durationSeconds;

  const distanceMeters = session?.totalDistance ?? 0;

  const averageSpeedMph = session?.avgSpeed
    ? session.avgSpeed * 2.236936
    : durationSeconds > 0
      ? (distanceMeters / durationSeconds) * 2.236936
      : 0;

  return {
    source: "fit",
    distanceMiles: distanceMeters / 1609.344,
    durationSeconds,
    movingTimeSeconds,

    averageSpeedMph,

    averagePower,
    maxPower,

    normalizedPower: calculateNormalizedPower(powerSamples),

    averageCadence,
    maxCadence,

    elevationGainFeet: (session?.totalAscent ?? 0) * 3.28084,

    calories: session?.totalCalories ?? null,

    zeroPowerSeconds: powerSamples.filter((power) => power === 0).length, // Zwift records power at 1 Hz, so each sample represents one second.

    bestPower: {
      oneMinute: calculateBestAverage(powerSamples, 60),
      fiveMinutes: calculateBestAverage(powerSamples, 300),
      tenMinutes: calculateBestAverage(powerSamples, 600),
      twentyMinutes: calculateBestAverage(powerSamples, 1200),
    },

    powerPercentiles: calculatePowerPercentiles(powerSamples),

    timestamps,
    powerSamples,
    cadenceSamples,
    speedSamples,
    averageHeartRate,
    maxHeartRate,
    heartRateSamples,
    samples,
  };
}
