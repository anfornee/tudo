import type { RideSample } from "@/lib/ride.types";

export type RideSampleMetric = "power" | "speedMph" | "cadence" | "elevationFeet";
export type RideMetricDomainMode = "zero-based" | "padded";

export interface RideMetricDomain {
  minimum: number;
  maximum: number;
}

export function deriveRideMetricDomain(
  values: Array<number | null | undefined>,
  mode: RideMetricDomainMode,
): RideMetricDomain | null {
  const finiteValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (!finiteValues.length) return null;

  const minimum = Math.min(...finiteValues);
  const maximum = Math.max(...finiteValues);
  const recordedRange = maximum - minimum;

  if (mode === "zero-based") {
    const paddingRange = Math.max(recordedRange, maximum * 0.1, 1);
    return { minimum: 0, maximum: Math.max(1, maximum + paddingRange * 0.1) };
  }

  // Keep flat and tiny profiles visible without forcing low elevations to zero.
  const paddingRange = Math.max(recordedRange, 8);
  return {
    minimum: minimum - paddingRange * 0.1,
    maximum: maximum + paddingRange * 0.15,
  };
}

export function downsampleRideSamples(
  samples: RideSample[],
  metric: RideSampleMetric,
  maximumPoints = 360,
) {
  const available = samples.filter((sample) => sample[metric] !== null);
  if (available.length <= maximumPoints || maximumPoints < 4) return available;

  const result: RideSample[] = [available[0]];
  const bucketCount = Math.floor((maximumPoints - 2) / 2);
  const bucketSize = (available.length - 2) / bucketCount;

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = 1 + Math.floor(bucket * bucketSize);
    const end = Math.min(available.length - 1, 1 + Math.floor((bucket + 1) * bucketSize));
    const values = available.slice(start, Math.max(start + 1, end));
    let minimum = values[0];
    let maximum = values[0];
    values.forEach((sample) => {
      if (sample[metric]! < minimum[metric]!) minimum = sample;
      if (sample[metric]! > maximum[metric]!) maximum = sample;
    });
    result.push(...(minimum.elapsedSeconds <= maximum.elapsedSeconds ? [minimum, maximum] : [maximum, minimum]));
  }

  result.push(available.at(-1)!);
  return result.filter((sample, index, all) => index === 0 || sample !== all[index - 1]);
}
