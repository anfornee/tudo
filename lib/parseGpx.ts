export interface TrackPoint {
	latitude: number
	longitude: number
	elevation?: number
	timestamp?: Date
	power?: number
	cadence?: number
	heartRate?: number
}

export interface DistanceMetrics {
	meters: number
	kilometers: number
	miles: number
}

export interface SpeedMetrics {
	kph: number
	mph: number
}

export interface ElevationMetrics {
	meters: number
	feet: number
}

export interface PowerBlock {
	startSeconds: number
	endSeconds: number
	averagePower: number
	maxPower: number
}

export interface RideSummary {
	durationSeconds: number

	distance: DistanceMetrics

	averageSpeed: SpeedMetrics
	maxSpeed: SpeedMetrics

	elevationGain: ElevationMetrics
	elevationLoss: ElevationMetrics

	averagePower?: number
	maxPower?: number
	normalizedPower?: number

	averageCadence?: number
	maxCadence?: number

	averageHeartRate?: number
	maxHeartRate?: number

	workKj?: number

	powerBlocks: PowerBlock[]

	points: TrackPoint[]
}

const GPX_NS = 'http://www.topografix.com/GPX/1/1'
const GPX_EXT_NS =
	'http://www.garmin.com/xmlschemas/TrackPointExtension/v1'

/**
 * Safely converts a string to a number.
 */
function numberOrUndefined(
	value: string | null | undefined,
): number | undefined {
	if (value === null || value === undefined || value === '') {
		return undefined
	}

	const number = Number(value)

	return Number.isFinite(number) ? number : undefined
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
	const earthRadius = 6_371_000

	const lat1Rad = (lat1 * Math.PI) / 180
	const lat2Rad = (lat2 * Math.PI) / 180

	const deltaLat = ((lat2 - lat1) * Math.PI) / 180
	const deltaLon = ((lon2 - lon1) * Math.PI) / 180

	const a =
		Math.sin(deltaLat / 2) ** 2 +
		Math.cos(lat1Rad) *
			Math.cos(lat2Rad) *
			Math.sin(deltaLon / 2) ** 2

	const c =
		2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

	return earthRadius * c
}

/**
 * Parse GPX XML into normalized track points.
 */
function parseTrackPoints(xml: string): TrackPoint[] {
	const parser = new DOMParser()

	const document = parser.parseFromString(
		xml,
		'application/xml',
	)

	const parserError =
		document.querySelector('parsererror')

	if (parserError) {
		throw new Error('Invalid GPX XML')
	}

	const trackPoints = Array.from(
		document.getElementsByTagNameNS(
			GPX_NS,
			'trkpt',
		),
	)

	/*
	 * Some GPX files don't use the GPX 1.1 namespace correctly.
	 * Fall back to searching for trkpt elements by tag name.
	 */
	const points =
		trackPoints.length > 0
			? trackPoints
			: Array.from(
					document.getElementsByTagName('trkpt'),
				)

	return points.map((point): TrackPoint => {
		const latitude = Number(
			point.getAttribute('lat'),
		)

		const longitude = Number(
			point.getAttribute('lon'),
		)

		const elevationElement =
			point.getElementsByTagNameNS(
				GPX_NS,
				'ele',
			)[0] ??
			point.getElementsByTagName('ele')[0]

		const elevation = numberOrUndefined(
			elevationElement?.textContent,
		)

		const timeElement =
			point.getElementsByTagNameNS(
				GPX_NS,
				'time',
			)[0] ??
			point.getElementsByTagName('time')[0]

		const timeString =
			timeElement?.textContent ?? undefined

		/*
		 * Power can appear directly under extensions
		 * depending on the GPX exporter.
		 */
		const powerElement =
			point.getElementsByTagName('power')[0]

		const power = numberOrUndefined(
			powerElement?.textContent,
		)

		const cadenceElement =
			point.getElementsByTagNameNS(
				GPX_EXT_NS,
				'cad',
			)[0] ??
			point.getElementsByTagName('cad')[0]

		const cadence = numberOrUndefined(
			cadenceElement?.textContent,
		)

		const heartRateElement =
			point.getElementsByTagNameNS(
				GPX_EXT_NS,
				'hr',
			)[0] ??
			point.getElementsByTagName('hr')[0]

		const heartRate = numberOrUndefined(
			heartRateElement?.textContent,
		)

		return {
			latitude,
			longitude,
			elevation,
			timestamp: timeString
				? new Date(timeString)
				: undefined,
			power,
			cadence,
			heartRate,
		}
	})
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
		)

	if (timestamps.length < 2) {
		return 0
	}

	return (
		(timestamps[timestamps.length - 1] -
			timestamps[0]) /
		1000
	)
}

/**
 * Calculate total GPS distance.
 *
 * Returns meters.
 */
function calculateDistance(
	points: TrackPoint[],
): number {
	let distance = 0

	for (let i = 1; i < points.length; i++) {
		const previous = points[i - 1]
		const current = points[i]

		distance += haversineDistance(
			previous.latitude,
			previous.longitude,
			current.latitude,
			current.longitude,
		)
	}

	return distance
}

/**
 * Convert meters into multiple useful units.
 */
function createDistanceMetrics(
	meters: number,
): DistanceMetrics {
	return {
		meters,
		kilometers: meters / 1000,
		miles: meters / 1609.344,
	}
}

/**
 * Convert meters/second into kph and mph.
 */
function createSpeedMetrics(
	metersPerSecond: number,
): SpeedMetrics {
	return {
		kph: metersPerSecond * 3.6,
		mph: metersPerSecond * 2.236936,
	}
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
	gain: number
	loss: number
} {
	let gain = 0
	let loss = 0

	for (let i = 1; i < points.length; i++) {
		const previousElevation =
			points[i - 1].elevation

		const currentElevation =
			points[i].elevation

		if (
			previousElevation === undefined ||
			currentElevation === undefined
		) {
			continue
		}

		const difference =
			currentElevation -
			previousElevation

		// Ignore small GPS elevation fluctuations.
		if (Math.abs(difference) < 1) {
			continue
		}

		if (difference > 0) {
			gain += difference
		} else {
			loss += Math.abs(difference)
		}
	}

	return {
		gain,
		loss,
	}
}

/**
 * Convert elevation into meters and feet.
 */
function createElevationMetrics(
	meters: number,
): ElevationMetrics {
	return {
		meters,
		feet: meters * 3.28084,
	}
}

/**
 * Calculate average value.
 */
function calculateAverage(
	values: number[],
): number | undefined {
	if (!values.length) {
		return undefined
	}

	return (
		values.reduce(
			(sum, value) => sum + value,
			0,
		) / values.length
	)
}

/**
 * Calculate maximum value.
 */
function calculateMax(
	values: number[],
): number | undefined {
	if (!values.length) {
		return undefined
	}

	return Math.max(...values)
}

/**
 * Calculate maximum instantaneous speed from
 * consecutive GPS points.
 *
 * Returns meters/second.
 */
function calculateMaxSpeed(
	points: TrackPoint[],
): number {
	let maxSpeed = 0

	for (let i = 1; i < points.length; i++) {
		const previous = points[i - 1]
		const current = points[i]

		if (
			!previous.timestamp ||
			!current.timestamp
		) {
			continue
		}

		const elapsedSeconds =
			(current.timestamp.getTime() -
				previous.timestamp.getTime()) /
			1000

		if (elapsedSeconds <= 0) {
			continue
		}

		const distance = haversineDistance(
			previous.latitude,
			previous.longitude,
			current.latitude,
			current.longitude,
		)

		const speed =
			distance / elapsedSeconds

		maxSpeed = Math.max(
			maxSpeed,
			speed,
		)
	}

	return maxSpeed
}

/**
 * Calculate Normalized Power.
 *
 * Uses a 30-point rolling average followed by
 * the fourth-power calculation.
 *
 * Note:
 * This assumes the GPX contains reasonably
 * consistent power sampling.
 */
function calculateNormalizedPower(
	points: TrackPoint[],
): number | undefined {
	const powerPoints = points.filter(
		(
			point,
		): point is TrackPoint & {
			power: number
		} => point.power !== undefined,
	)

	if (powerPoints.length < 30) {
		return undefined
	}

	const rollingPowers: number[] = []

	for (
		let i = 29;
		i < powerPoints.length;
		i++
	) {
		const window =
			powerPoints.slice(
				i - 29,
				i + 1,
			)

		const average =
			window.reduce(
				(sum, point) =>
					sum + point.power,
				0,
			) / window.length

		rollingPowers.push(
			average,
		)
	}

	if (!rollingPowers.length) {
		return undefined
	}

	const fourthPowerAverage =
		rollingPowers.reduce(
			(sum, power) =>
				sum + power ** 4,
			0,
		) / rollingPowers.length

	return fourthPowerAverage ** 0.25
}

/**
 * Calculate power in fixed-duration blocks.
 *
 * Defaults to 5-minute blocks.
 */
function calculatePowerBlocks(
	points: TrackPoint[],
	blockDurationSeconds = 300,
): PowerBlock[] {
	const powerPoints = points.filter(
		(
			point,
		): point is TrackPoint & {
			power: number
			timestamp: Date
		} =>
			point.power !== undefined &&
			point.timestamp !== undefined,
	)

	if (!powerPoints.length) {
		return []
	}

	const startTime =
		powerPoints[0].timestamp.getTime()

	const blocks = new Map<
		number,
		number[]
	>()

	for (const point of powerPoints) {
		const elapsedSeconds =
			(point.timestamp.getTime() -
				startTime) /
			1000

		const blockIndex =
			Math.floor(
				elapsedSeconds /
					blockDurationSeconds,
			)

		const existing =
			blocks.get(blockIndex) ?? []

		existing.push(point.power)

		blocks.set(
			blockIndex,
			existing,
		)
	}

	return Array.from(
		blocks.entries(),
	).map(
		([
			blockIndex,
			powers,
		]) => ({
			startSeconds:
				blockIndex *
				blockDurationSeconds,

			endSeconds:
				(blockIndex + 1) *
				blockDurationSeconds,

			averagePower:
				powers.reduce(
					(sum, power) =>
						sum + power,
					0,
				) /
				powers.length,

			maxPower: Math.max(
				...powers,
			),
		}),
	)
}

/**
 * Analyze a GPX file.
 */
export function analyzeGpx(
	xml: string,
): RideSummary {
	const points =
		parseTrackPoints(xml)

	if (points.length < 2) {
		throw new Error(
			'GPX file does not contain enough track points',
		)
	}

	const durationSeconds =
		calculateDuration(points)

	const distanceMeters =
		calculateDistance(points)

	const distance =
		createDistanceMetrics(
			distanceMeters,
		)

	const elevation =
		calculateElevation(points)

	const elevationGain =
		createElevationMetrics(
			elevation.gain,
		)

	const elevationLoss =
		createElevationMetrics(
			elevation.loss,
		)

	/*
	 * Average speed.
	 */
	const averageSpeedMps =
		durationSeconds > 0
			? distanceMeters /
				durationSeconds
			: 0

	const averageSpeed =
		createSpeedMetrics(
			averageSpeedMps,
		)

	/*
	 * Maximum speed.
	 */
	const maxSpeedMps =
		calculateMaxSpeed(points)

	const maxSpeed =
		createSpeedMetrics(
			maxSpeedMps,
		)

	/*
	 * Power.
	 */
	const power = points
		.map((point) => point.power)
		.filter(
			(value): value is number =>
				value !== undefined,
		)

	const averagePower =
		calculateAverage(power)

	const maxPower =
		calculateMax(power)

	const normalizedPower =
		calculateNormalizedPower(
			points,
		)

	/*
	 * Cadence.
	 */
	const cadence = points
		.map((point) => point.cadence)
		.filter(
			(value): value is number =>
				value !== undefined,
		)

	const averageCadence =
		calculateAverage(cadence)

	const maxCadence =
		calculateMax(cadence)

	/*
	 * Heart rate.
	 */
	const heartRate = points
		.map(
			(point) => point.heartRate,
		)
		.filter(
			(value): value is number =>
				value !== undefined,
		)

	const averageHeartRate =
		calculateAverage(
			heartRate,
		)

	const maxHeartRate =
		calculateMax(heartRate)

	/*
	 * Work.
	 *
	 * Watts × seconds = joules
	 *
	 * Divide by 1000 for kJ.
	 */
	const workKj =
		averagePower !== undefined
			? (averagePower *
					durationSeconds) /
				1000
			: undefined

	/*
	 * Power blocks.
	 */
	const powerBlocks =
		calculatePowerBlocks(
			points,
			300,
		)

	return {
		durationSeconds,

		distance,

		averageSpeed,
		maxSpeed,

		elevationGain,
		elevationLoss,

		averagePower,
		maxPower,
		normalizedPower,

		averageCadence,
		maxCadence,

		averageHeartRate,
		maxHeartRate,

		workKj,

		powerBlocks,

		points,
	}
}