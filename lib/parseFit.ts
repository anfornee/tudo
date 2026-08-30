import { Decoder, Stream } from "@garmin/fitsdk";
import {
  calculateBestAverage,
  calculateNormalizedPower,
  calculatePowerPercentiles,
} from "./rideCalculations";
import { RideData } from "./ride.types";

interface RideSample {
  timestamp: Date;
  power: number | null;
  cadence: number | null;
  speed: number | null;
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

  const samples: RideSample[] = records
    .map((record) => ({
      timestamp: record.timestamp,
      power: Number.isFinite(record.power) ? record.power : null,
      cadence: Number.isFinite(record.cadence) ? record.cadence : null,
      speed: Number.isFinite(record.speed) ? record.speed : null,
    }))
    .filter((sample): sample is RideSample => sample.timestamp instanceof Date);

  const powerSamples = samples
    .map((sample) => sample.power)
    .filter((value): value is number => value !== null);

  const cadenceSamples = samples
    .map((sample) => sample.cadence)
    .filter((value): value is number => value !== null);

  const speedSamples = samples
    .map((sample) => sample.speed)
    .filter((value): value is number => value !== null);

  const timestamps = samples.map((sample) => sample.timestamp);

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
  };
}
