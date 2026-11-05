import { Encoder, Profile } from "@garmin/fitsdk";
import type { RideSample } from "@/lib/ride.types";

const SEMICIRCLES_PER_DEGREE = 2 ** 31 / 180;

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

export function encodeRideSamplesAsFit(
  samples: RideSample[],
  activityDate: Date,
  activityName = "Tudo ride",
): Uint8Array {
  const usable = samples.filter((sample) => Number.isFinite(sample.elapsedSeconds));
  if (!usable.length || !Number.isFinite(activityDate.getTime())) {
    throw new Error("The ride does not contain enough data to export as FIT.");
  }
  const encoder = new Encoder();
  const write = (message: Record<string, unknown>) => encoder.writeMesg(message as unknown as Parameters<Encoder["writeMesg"]>[0]);
  const start = activityDate.getTime();
  const end = start + usable.at(-1)!.elapsedSeconds * 1000;
  const durationSeconds = Math.max(0, (end - start) / 1000);
  const distanceMeters = (usable.at(-1)!.distanceMiles ?? 0) * 1609.344;

  write({ mesgNum: Profile.MesgNum.FILE_ID, type: "activity", manufacturer: "development", product: 1, timeCreated: new Date(start) });
  write({ mesgNum: Profile.MesgNum.SESSION, sport: "cycling", subSport: "generic", startTime: new Date(start), timestamp: new Date(end), totalElapsedTime: durationSeconds, totalTimerTime: durationSeconds, totalDistance: distanceMeters });
  write({ mesgNum: Profile.MesgNum.LAP, startTime: new Date(start), timestamp: new Date(end), totalElapsedTime: durationSeconds, totalTimerTime: durationSeconds, totalDistance: distanceMeters });
  for (const sample of usable) {
    const timestampMs = sample.timestampMs ?? start + sample.elapsedSeconds * 1000;
    const record: Record<string, unknown> = { mesgNum: Profile.MesgNum.RECORD, timestamp: new Date(timestampMs) };
    if (finite(sample.latitude) && finite(sample.longitude)) {
      record.positionLat = Math.round(sample.latitude * SEMICIRCLES_PER_DEGREE);
      record.positionLong = Math.round(sample.longitude * SEMICIRCLES_PER_DEGREE);
    }
    if (finite(sample.elevationFeet)) record.altitude = sample.elevationFeet / 3.28084;
    if (finite(sample.distanceMiles)) record.distance = sample.distanceMiles * 1609.344;
    if (finite(sample.speedMph)) record.enhancedSpeed = sample.speedMph / 2.236936;
    if (finite(sample.power)) record.power = sample.power;
    if (finite(sample.cadence)) record.cadence = sample.cadence;
    if (finite(sample.heartRate)) record.heartRate = sample.heartRate;
    if (finite(sample.temperatureC)) record.temperature = sample.temperatureC;
    write(record);
  }
  write({ mesgNum: Profile.MesgNum.ACTIVITY, timestamp: new Date(end), totalTimerTime: durationSeconds, numSessions: 1, type: "manual", event: "activity", eventType: "stop", name: activityName });
  return encoder.close();
}

export function downloadRideFile(bytes: ArrayBuffer | Uint8Array<ArrayBufferLike>, filename: string, type = "application/octet-stream") {
  const normalized = bytes instanceof Uint8Array ? bytes.slice().buffer as ArrayBuffer : bytes;
  const url = URL.createObjectURL(new Blob([normalized], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
