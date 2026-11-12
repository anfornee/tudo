import type { RideSample } from "@/lib/ride.types";
import type { StoredRideSamples } from "@/lib/rides/types";

export function isRideSample(value: unknown): value is RideSample {
	if (!value || typeof value !== "object") return false;
	const sample = value as Record<string, unknown>;
	return typeof sample.elapsedSeconds === "number"
		&& Number.isFinite(sample.elapsedSeconds)
		&& [
			"timestampMs", "latitude", "longitude", "power", "speedMph", "cadence",
			"heartRate", "temperatureC", "elevationFeet", "distanceMiles",
		].every((key) => sample[key] == null
			|| (typeof sample[key] === "number" && Number.isFinite(sample[key])));
}

export function parseStoredRideSamples(value: unknown): StoredRideSamples {
	if (!value || typeof value !== "object") throw new Error("Invalid ride sample data.");
	const stored = value as Partial<StoredRideSamples>;
	if (stored.version !== 1 || !Array.isArray(stored.samples) || !stored.samples.every(isRideSample)) {
		throw new Error("Unsupported ride sample data.");
	}
	return { version: 1, samples: stored.samples };
}
