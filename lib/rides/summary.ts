import type { RideData } from "@/lib/ride.types";

export function summaryFromRide(ride: RideData) {
	return {
		distanceMiles: ride.distanceMiles,
		durationSeconds: ride.durationSeconds,
		movingTimeSeconds: ride.movingTimeSeconds,
		averageSpeedMph: ride.averageSpeedMph,
		elevationGainFeet: ride.elevationGainFeet,
		calories: ride.calories,
		averagePower: ride.averagePower,
		maxPower: ride.maxPower,
		normalizedPower: ride.normalizedPower,
		averageCadence: ride.averageCadence,
		maxCadence: ride.maxCadence,
		averageHeartRate: ride.averageHeartRate,
		maxHeartRate: ride.maxHeartRate,
	};
}
