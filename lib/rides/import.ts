import { parseZwiftFit } from "@/lib/parseFit";
import { analyzeGpx } from "@/lib/parseGpx";
import type { RideData } from "@/lib/ride.types";
import type { ProcessedRide, RideSource } from "@/lib/rides/types";

export const MAX_RIDE_FILE_SIZE = 10 * 1024 * 1024;

export function getRideFileSource(fileName: string): RideSource | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension === "fit" || extension === "gpx" ? extension : null;
}

function activityDateFromRide(ride: RideData): Date | null {
  const timestamp = ride.timestamps.find(
    (value) => value instanceof Date && Number.isFinite(value.getTime()),
  );
  return timestamp ?? null;
}

function validateRide(ride: RideData) {
  const requiredMetrics = [
    ride.distanceMiles,
    ride.durationSeconds,
    ride.movingTimeSeconds,
    ride.averageSpeedMph,
    ride.elevationGainFeet,
  ];

  if (requiredMetrics.some((value) => !Number.isFinite(value))) {
    throw new Error("The activity contains invalid summary data.");
  }

  if (ride.distanceMiles <= 0 && ride.durationSeconds <= 0) {
    throw new Error("The activity does not contain a usable ride.");
  }
}

export async function processRideFile(file: File): Promise<ProcessedRide> {
  const source = getRideFileSource(file.name);

  if (!source) {
    throw new Error("Choose a .fit or .gpx cycling activity file.");
  }

  if (file.size === 0) {
    throw new Error("The selected activity file is empty.");
  }

  if (file.size > MAX_RIDE_FILE_SIZE) {
    throw new Error("Choose an activity file smaller than 10 MB.");
  }

  try {
    const ride =
      source === "fit"
        ? await parseZwiftFit(await file.arrayBuffer())
        : analyzeGpx(await file.text());

    validateRide(ride);
    return { file, ride, activityDate: activityDateFromRide(ride) };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("Choose") ||
        error.message.startsWith("The activity"))
    ) {
      throw error;
    }

    throw new Error(
      `Unable to process this ${source.toUpperCase()} file. Make sure it contains a valid cycling activity.`,
    );
  }
}
