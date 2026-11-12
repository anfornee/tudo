import type { RideSample } from "../ride.types.ts";
import {
	POWER_DURATION_SECONDS,
	RIDE_ANALYTICS_ALGORITHM_VERSION,
	RIDE_ANALYTICS_SCHEMA_VERSION,
	type PowerDurationCurve,
	type PowerDurationEffort,
	type PowerDurationSeconds,
	type RideAnalyticsResult,
	type RidePowerProvenance,
} from "./analytics-model.ts";

// A recorded value is held only until the next nearby record. Larger gaps are
// treated as unavailable and split the effort; they are never interpolated.
export const MAX_CONTINUOUS_SAMPLE_GAP_SECONDS = 5;

export interface RideAnalyticsInput {
	rideId: string;
	sourceRevision: string;
	calculatedAt?: Date;
	activityDate: Date | null;
	distanceMiles: number;
	elapsedDurationSeconds: number;
	movingDurationSeconds: number;
	elevationGainFeet: number;
	powerProvenance: RidePowerProvenance;
	samples: readonly RideSample[];
}

interface ValueSegment {
	start: number;
	end: number;
	value: number;
}

interface PowerRun {
	segments: ValueSegment[];
	prefixEnergy: number[];
	start: number;
	end: number;
}

function finite(value: number | null | undefined): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function orderedSamples(samples: readonly RideSample[]) {
	return [...samples]
		.filter((sample) => Number.isFinite(sample.elapsedSeconds) && sample.elapsedSeconds >= 0)
		.sort((left, right) => left.elapsedSeconds - right.elapsedSeconds)
		.filter((sample, index, all) => index === 0 || sample.elapsedSeconds > all[index - 1].elapsedSeconds);
}

function recordedValues(
	samples: readonly RideSample[],
	key: "power" | "speedMph" | "cadence" | "heartRate" | "elevationFeet",
) {
	return samples.map((sample) => sample[key]).filter(finite);
}

function maximum(values: readonly number[]) {
	return values.length ? Math.max(...values) : null;
}

function average(values: readonly number[]) {
	return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function buildSegments(
	samples: readonly RideSample[],
	key: "power" | "cadence" | "heartRate",
) {
	const result: ValueSegment[] = [];
	for (let index = 0; index < samples.length - 1; index += 1) {
		const current = samples[index];
		const next = samples[index + 1];
		const duration = next.elapsedSeconds - current.elapsedSeconds;
		const value = current[key];
		if (finite(value) && duration > 0 && duration <= MAX_CONTINUOUS_SAMPLE_GAP_SECONDS) {
			result.push({ start: current.elapsedSeconds, end: next.elapsedSeconds, value });
		}
	}
	return result;
}

function durationWeightedAverage(segments: readonly ValueSegment[], fallbackValues: readonly number[]) {
	let duration = 0;
	let total = 0;
	for (const segment of segments) {
		const segmentDuration = segment.end - segment.start;
		duration += segmentDuration;
		total += segment.value * segmentDuration;
	}
	return duration > 0 ? total / duration : average(fallbackValues);
}

function segmentTotals(segments: readonly ValueSegment[], sampleCount: number) {
	let validDurationSeconds = 0;
	let valueSeconds = 0;
	for (const segment of segments) {
		const duration = segment.end - segment.start;
		validDurationSeconds += duration;
		valueSeconds += segment.value * duration;
	}
	return { sampleCount, validDurationSeconds, valueSeconds };
}

function buildPowerRuns(segments: readonly ValueSegment[]): PowerRun[] {
	const groups: ValueSegment[][] = [];
	for (const segment of segments) {
		const current = groups.at(-1);
		if (!current || Math.abs(current.at(-1)!.end - segment.start) > 1e-9) groups.push([segment]);
		else current.push(segment);
	}

	return groups.map((run) => {
		const prefixEnergy = [0];
		for (const segment of run) {
			prefixEnergy.push(prefixEnergy.at(-1)! + segment.value * (segment.end - segment.start));
		}
		return { segments: run, prefixEnergy, start: run[0].start, end: run.at(-1)!.end };
	});
}

function energyAt(run: PowerRun, elapsedSeconds: number) {
	if (elapsedSeconds <= run.start) return 0;
	if (elapsedSeconds >= run.end) return run.prefixEnergy.at(-1)!;

	let low = 0;
	let high = run.segments.length - 1;
	while (low <= high) {
		const middle = Math.floor((low + high) / 2);
		const segment = run.segments[middle];
		if (elapsedSeconds < segment.start) high = middle - 1;
		else if (elapsedSeconds >= segment.end) low = middle + 1;
		else return run.prefixEnergy[middle] + segment.value * (elapsedSeconds - segment.start);
	}
	return run.prefixEnergy[Math.max(0, low)];
}

function timestampOrigin(samples: readonly RideSample[]) {
	const sample = samples.find((value) => finite(value.timestampMs));
	return sample?.timestampMs == null ? null : sample.timestampMs - sample.elapsedSeconds * 1000;
}

function bestPowerForDuration(
	runs: readonly PowerRun[],
	durationSeconds: PowerDurationSeconds,
	timestampOriginMs: number | null,
): PowerDurationEffort | null {
	let best: PowerDurationEffort | null = null;
	for (const run of runs) {
		if (run.end - run.start + 1e-9 < durationSeconds) continue;
		const latestStart = run.end - durationSeconds;
		const candidates = new Set<number>([run.start, latestStart]);
		for (const segment of run.segments) {
			if (segment.start >= run.start && segment.start <= latestStart) candidates.add(segment.start);
			const alignedStart = segment.end - durationSeconds;
			if (alignedStart >= run.start && alignedStart <= latestStart) candidates.add(alignedStart);
		}

		for (const start of candidates) {
			const end = start + durationSeconds;
			const watts = (energyAt(run, end) - energyAt(run, start)) / durationSeconds;
			if (!best || watts > best.averageWatts) {
				best = {
					durationSeconds,
					averageWatts: Math.round(watts * 10) / 10,
					startElapsedSeconds: start,
					endElapsedSeconds: end,
					startTimestampMs: timestampOriginMs === null ? null : timestampOriginMs + start * 1000,
					endTimestampMs: timestampOriginMs === null ? null : timestampOriginMs + end * 1000,
				};
			}
		}
	}
	return best;
}

function normalizedPower(runs: readonly PowerRun[]) {
	let fourthPowerTotal = 0;
	let windowCount = 0;
	for (const run of runs) {
		if (run.end - run.start < 30) continue;
		// One-second evaluation cadence matches the established normalized-power
		// method while the integral keeps irregular source samples duration-aware.
		for (let end = run.start + 30; end <= run.end + 1e-9; end += 1) {
			const rollingAverage = (energyAt(run, end) - energyAt(run, end - 30)) / 30;
			fourthPowerTotal += rollingAverage ** 4;
			windowCount += 1;
		}
	}
	return windowCount ? Math.round((fourthPowerTotal / windowCount) ** 0.25) : null;
}

export function calculatePowerAnalytics(
	inputSamples: readonly RideSample[],
	powerProvenance: RidePowerProvenance,
) {
	const samples = orderedSamples(inputSamples);
	const powerValues = recordedValues(samples, "power");
	const measuredPower = powerProvenance === "measured";
	const powerSegments = buildSegments(samples, "power");
	const powerRuns = buildPowerRuns(powerSegments);
	const origin = timestampOrigin(samples);
	const powerDuration: PowerDurationCurve = {};
	for (const duration of POWER_DURATION_SECONDS) {
		powerDuration[String(duration)] = measuredPower
			? bestPowerForDuration(powerRuns, duration, origin)
			: null;
	}
	return {
		averageWatts: measuredPower ? durationWeightedAverage(powerSegments, powerValues) : null,
		maxWatts: measuredPower ? maximum(powerValues) : null,
		normalizedWatts: measuredPower ? normalizedPower(powerRuns) : null,
		powerDuration,
		coverage: segmentTotals(powerSegments, powerValues.length),
	};
}

export function calculateRideAnalytics(input: RideAnalyticsInput): RideAnalyticsResult {
	const samples = orderedSamples(input.samples);
	const powerValues = recordedValues(samples, "power");
	const speedValues = recordedValues(samples, "speedMph");
	const cadenceValues = recordedValues(samples, "cadence");
	const heartRateValues = recordedValues(samples, "heartRate");
	const elevationValues = recordedValues(samples, "elevationFeet");
	const power = calculatePowerAnalytics(samples, input.powerProvenance);
	const cadenceSegments = buildSegments(samples, "cadence");
	const heartRateSegments = buildSegments(samples, "heartRate");

	const movingAverageSpeed = input.movingDurationSeconds > 0 && input.distanceMiles >= 0
		? input.distanceMiles / (input.movingDurationSeconds / 3600)
		: null;

	return {
		schemaVersion: RIDE_ANALYTICS_SCHEMA_VERSION,
		algorithmVersion: RIDE_ANALYTICS_ALGORITHM_VERSION,
		rideId: input.rideId,
		sourceRevision: input.sourceRevision,
		calculatedAt: (input.calculatedAt ?? new Date()).toISOString(),
		activityDate: input.activityDate?.toISOString() ?? null,
		activity: {
			distanceMiles: input.distanceMiles,
			elapsedDurationSeconds: input.elapsedDurationSeconds,
			movingDurationSeconds: input.movingDurationSeconds,
			elevationGainFeet: input.elevationGainFeet,
		},
		speed: { averageMovingMph: movingAverageSpeed, maxRecordedMph: maximum(speedValues) },
		power: {
			provenance: input.powerProvenance,
			averageWatts: power.averageWatts,
			maxWatts: power.maxWatts,
			normalizedWatts: power.normalizedWatts,
		},
		cadence: {
			averageRpm: durationWeightedAverage(cadenceSegments, cadenceValues),
			maxRpm: maximum(cadenceValues),
		},
		heartRate: {
			averageBpm: durationWeightedAverage(heartRateSegments, heartRateValues),
			maxBpm: maximum(heartRateValues),
		},
		climbing: { largestClimbFeet: null, longestClimbDistanceMiles: null },
		powerDuration: power.powerDuration,
		availability: {
			speed: speedValues.length > 0,
			power: powerValues.length > 0,
			cadence: cadenceValues.length > 0,
			heartRate: heartRateValues.length > 0,
			elevation: elevationValues.length > 0 || input.elevationGainFeet > 0,
		},
		sensorCoverage: {
			power: power.coverage,
			cadence: segmentTotals(cadenceSegments, cadenceValues.length),
			heartRate: segmentTotals(heartRateSegments, heartRateValues.length),
			speedSampleCount: speedValues.length,
		},
	};
}
