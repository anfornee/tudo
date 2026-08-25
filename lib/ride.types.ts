export interface RideData {
	source: "gpx" | "fit";

	distanceMiles: number;
	durationSeconds: number;
	movingTimeSeconds: number;
	averageSpeedMph: number;

	averagePower: number | null;
	maxPower: number | null;
	normalizedPower: number | null;

	averageCadence: number | null;
	maxCadence: number | null;

	averageHeartRate: number | null;
	maxHeartRate: number | null;

	elevationGainFeet: number;
	calories: number | null;

	zeroPowerSeconds: number;

	bestPower: {
		oneMinute: number | null;
		fiveMinutes: number | null;
		tenMinutes: number | null;
		twentyMinutes: number | null;
	};

	powerPercentiles: {
		p10: number;
		p25: number;
		p50: number;
		p75: number;
		p90: number;
		p95: number;
	};

	timestamps: Date[];
	powerSamples: number[];
	cadenceSamples: number[];
	speedSamples: number[];
	heartRateSamples: number[];
}