import type { RideData } from "@/lib/ride.types";
import type { RiderProfile } from "@/lib/rider-profile/types";
import { calorieInputFromRide, estimateCyclingCalories } from "@/lib/rides/calories";

export function summaryFromRide(ride: RideData, profile: RiderProfile | null = null, activityDate: Date | null = null) {
	return {
		distanceMiles: ride.distanceMiles,
		durationSeconds: ride.durationSeconds,
		movingTimeSeconds: ride.movingTimeSeconds,
		averageSpeedMph: ride.averageSpeedMph,
		elevationGainFeet: ride.elevationGainFeet,
		calories: ride.calories,
		calorieAnalysis: estimateCyclingCalories(calorieInputFromRide(ride, activityDate), profile),
		averagePower: ride.averagePower,
		maxPower: ride.maxPower,
		normalizedPower: ride.normalizedPower,
		averageCadence: ride.averageCadence,
		maxCadence: ride.maxCadence,
		averageHeartRate: ride.averageHeartRate,
		maxHeartRate: ride.maxHeartRate,
	};
}
