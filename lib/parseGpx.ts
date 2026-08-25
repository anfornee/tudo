import type { RideData } from "./ride.types";
import {
	calculateBestAverage,
	calculateNormalizedPower,
	calculatePowerPercentiles,
} from "./rideCalculations";

export interface TrackPoint {
	latitude: number;
	longitude: number;
	elevation?: number;
	timestamp?: Date;
	power?: number;
	cadence?: number;
	heartRate?: number;
}

const GPX_NS = "http://www.topografix.com/GPX/1/1";
const GPX_EXT_NS =
	"http://www.garmin.com/xmlschemas/TrackPointExtension/v1";

/**
 * Safely converts a string to a number.
 */
function numberOrUndefined(
	value: string | null | undefined,
): number | undefined {
	if (value === null || value === undefined || value === "") {
		return undefined;
	}

	const number = Number(value);

	return Number.isFinite(number) ? number : undefined;
}

/**
 * Calculate distance between two GPS coordinates using the
 * Haversine formula.
 *
 * Returns meters.
 */
function haversineDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const earthRadius = 6_371_000;

	const lat1Rad = (lat1 * Math.PI) / 180;
	const lat2Rad = (lat2 * Math.PI) / 180;

	const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
	const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

	const a =
		Math.sin(deltaLat / 2) ** 2 +
		Math.cos(lat1Rad) *
			Math.cos(lat2Rad) *
			Math.sin(deltaLon / 2) ** 2;

	const c =
		2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return earthRadius * c;
}

/**
 * Parse GPX XML into normalized track points.
 */
function parseTrackPoints(xml: string): TrackPoint[] {
	const parser = new DOMParser();

	const document = parser.parseFromString(
		xml,
		"application/xml",
	);

	const parserError =
		document.querySelector("parsererror");

	if (parserError) {
		throw new Error("Invalid GPX XML");
	}

	const trackPoints = Array.from(
		document.getElementsByTagNameNS(
			GPX_NS,
			"trkpt",
		),
	);

	/*
	 * Some GPX files don't use the GPX 1.1 namespace correctly.
	 * Fall back to searching for trkpt elements by tag name.
	 */
	const points =
		trackPoints.length > 0
			? trackPoints
			: Array.from(
					document.getElementsByTagName("trkpt"),
				);

	return points.map((point): TrackPoint => {
		const latitude = Number(
			point.getAttribute("lat"),
		);

		const longitude = Number(
			point.getAttribute("lon"),
		);

		if (
			!Number.isFinite(latitude) ||
			!Number.isFinite(longitude)
		) {
			throw new Error(
				"GPX contains an invalid track point",
			);
		}

		const elevationElement =
			point.getElementsByTagNameNS(
				GPX_NS,
				"ele",
			)[0] ??
			point.getElementsByTagName("ele")[0];

		const elevation = numberOrUndefined(
			elevationElement?.textContent,
		);

		const timeElement =
			point.getElementsByTagNameNS(
				GPX_NS,
				"time",
			)[0] ??
			point.getElementsByTagName("time")[0];

		const timeString =
			timeElement?.textContent ?? undefined;

		const timestamp = timeString
			? new Date(timeString)
			: undefined;

		/*
		 * Power can appear directly under extensions
		 * depending on the GPX exporter.
		 */
		const powerElement =
			point.getElementsByTagName("power")[0];

		const power = numberOrUndefined(
			powerElement?.textContent,
		);

		const cadenceElement =
			point.getElementsByTagNameNS(
				GPX_EXT_NS,
				"cad",
			)[0] ??
			point.getElementsByTagName("cad")[0];

		const cadence = numberOrUndefined(
			cadenceElement?.textContent,
		);

		const heartRateElement =
			point.getElementsByTagNameNS(
				GPX_EXT_NS,
				"hr",
			)[0] ??
			point.getElementsByTagName("hr")[0];

		const heartRate = numberOrUndefined(
			heartRateElement?.textContent,
		);

		return {
			latitude,
			longitude,
			elevation,
			timestamp,
			power,
			cadence,
			heartRate,
		};
	});
}

/**
 * Calculate elapsed ride duration in seconds.
 */
function calculateDuration(
	points: TrackPoint[],
): number {
	const timestamps = points
		.map((point) => point.timestamp?.getTime())
		.filter(
			(value): value is number =>
				value !== undefined,
		);

	if (timestamps.length < 2) {
		return 0;
	}

	return (
		(timestamps[timestamps.length - 1] -
			timestamps[0]) /
		1000
	);
}

/**
 * Calculate total GPS distance.
 *
 * Returns meters.
 */
function calculateDistance(
	points: TrackPoint[],
): number {
	let distance = 0;

	for (let i = 1; i < points.length; i++) {
		const previous = points[i - 1];
		const current = points[i];

		distance += haversineDistance(
			previous.latitude,
			previous.longitude,
			current.latitude,
			current.longitude,
		);
	}

	return distance;
}

/**
 * Calculate elevation gain and loss.
 *
 * A 1-meter threshold is used to reduce GPS
 * elevation noise.
 */
function calculateElevation(
	points: TrackPoint[],
): {
	gain: number;
	loss: number;
} {
	let gain = 0;
	let loss = 0;

	for (let i = 1; i < points.length; i++) {
		const previousElevation =
			points[i - 1].elevation;

		const currentElevation =
			points[i].elevation;

		if (
			previousElevation === undefined ||
			currentElevation === undefined
		) {
			continue;
		}

		const difference =
			currentElevation -
			previousElevation;

		// Ignore small GPS elevation fluctuations.
		if (Math.abs(difference) < 1) {
			continue;
		}

		if (difference > 0) {
			gain += difference;
		} else {
			loss += Math.abs(difference);
		}
	}

	return {
		gain,
		loss,
	};
}

/**
 * Calculate maximum instantaneous GPS speed.
 *
 * Returns meters/second.
 */
function calculateMaxSpeed(
	points: TrackPoint[],
): number {
	let maxSpeed = 0;

	for (let i = 1; i < points.length; i++) {
		const previous = points[i - 1];
		const current = points[i];

		if (
			!previous.timestamp ||
			!current.timestamp
		) {
			continue;
		}

		const elapsedSeconds =
			(current.timestamp.getTime() -
				previous.timestamp.getTime()) /
			1000;

		if (elapsedSeconds <= 0) {
			continue;
		}

		const distance = haversineDistance(
			previous.latitude,
			previous.longitude,
			current.latitude,
			current.longitude,
		);

		const speed =
			distance / elapsedSeconds;

		maxSpeed = Math.max(maxSpeed, speed);
	}

	return maxSpeed;
}

/**
 * Calculate average value.
 */
function calculateAverage(
	values: number[],
): number | null {
	if (!values.length) {
		return null;
	}

	return (
		values.reduce(
			(sum, value) => sum + value,
			0,
		) / values.length
	);
}

/**
 * Calculate maximum value.
 */
function calculateMax(
	values: number[],
): number | null {
	if (!values.length) {
		return null;
	}

	return Math.max(...values);
}

/**
 * Analyze a GPX file and return the normalized
 * RideData format used by both GPX and FIT.
 */
export function analyzeGpx(
	xml: string,
): RideData {
	const points = parseTrackPoints(xml);

	if (points.length < 2) {
		throw new Error(
			"GPX file does not contain enough track points",
		);
	}

	const durationSeconds =
		calculateDuration(points);

	const distanceMeters =
		calculateDistance(points);

	const elevation =
		calculateElevation(points);

	const averageSpeedMps =
		durationSeconds > 0
			? distanceMeters / durationSeconds
			: 0;

	/*
	 * Power.
	 */
	const powerSamples = points
		.map((point) => point.power)
		.filter(
			(value): value is number =>
				value !== undefined,
		);

	const averagePower =
		calculateAverage(powerSamples);

	const maxPower =
		calculateMax(powerSamples);

	/*
	 * Cadence.
	 */
	const cadenceSamples = points
		.map((point) => point.cadence)
		.filter(
			(value): value is number =>
				value !== undefined,
		);

	const averageCadence =
		calculateAverage(cadenceSamples);

	const maxCadence =
		calculateMax(cadenceSamples);

	/*
	 * Heart rate.
	 */
	const heartRateSamples = points
		.map((point) => point.heartRate)
		.filter(
			(value): value is number =>
				value !== undefined,
		);

	const averageHeartRate =
		calculateAverage(heartRateSamples);

	const maxHeartRate =
		calculateMax(heartRateSamples);

	/*
	 * Speed.
	 */
	const maxSpeedMps =
		calculateMaxSpeed(points);

	/*
	 * Work.
	 *
	 * Watts × seconds = joules.
	 * Divide by 1000 for kJ.
	 *
	 * This is an estimate because GPX files don't
	 * necessarily contain a power sample for every
	 * second.
	 */
	const workKj =
		averagePower !== null
			? (averagePower * durationSeconds) /
				1000
			: null;

	return {
		source: "gpx",

		distanceMiles:
			distanceMeters / 1609.344,

		durationSeconds,

		/*
		 * GPX doesn't provide a reliable equivalent
		 * to FIT's timer time, so use elapsed time.
		 */
		movingTimeSeconds: durationSeconds,

		averageSpeedMph:
			averageSpeedMps * 2.236936,

		averagePower,
		maxPower,

		normalizedPower:
			calculateNormalizedPower(
				powerSamples,
			),

		averageCadence,
		maxCadence,

		averageHeartRate,
		maxHeartRate,

		elevationGainFeet:
			elevation.gain * 3.28084,

		calories: null,

		zeroPowerSeconds:
			powerSamples.filter(
				(power) => power === 0,
			).length,

		bestPower: {
			oneMinute:
				calculateBestAverage(
					powerSamples,
					60,
				),

			fiveMinutes:
				calculateBestAverage(
					powerSamples,
					300,
				),

			tenMinutes:
				calculateBestAverage(
					powerSamples,
					600,
				),

			twentyMinutes:
				calculateBestAverage(
					powerSamples,
					1200,
				),
		},

		powerPercentiles:
			calculatePowerPercentiles(
				powerSamples,
			),

		timestamps: points
			.map((point) => point.timestamp)
			.filter(
				(value): value is Date =>
					value instanceof Date,
			),

		powerSamples,
		cadenceSamples,

		/*
		 * GPX doesn't normally contain speed samples,
		 * so derive instantaneous speed from GPS points.
		 */
		speedSamples: points
			.slice(1)
			.map((point, index) => {
				const previous =
					points[index];

				if (
					!previous.timestamp ||
					!point.timestamp
				) {
					return null;
				}

				const elapsedSeconds =
					(point.timestamp.getTime() -
						previous.timestamp.getTime()) /
					1000;

				if (elapsedSeconds <= 0) {
					return null;
				}

				const distance =
					haversineDistance(
						previous.latitude,
						previous.longitude,
						point.latitude,
						point.longitude,
					);

				return (
					distance /
					elapsedSeconds *
					2.236936
				);
			})
			.filter(
				(value): value is number =>
					value !== null &&
					Number.isFinite(value),
			),

		heartRateSamples,

		/*
		 * Keep the unused values intentionally out of
		 * RideData. GPX-specific GPS information can be
		 * added later if the UI needs it.
		 */
	};
}