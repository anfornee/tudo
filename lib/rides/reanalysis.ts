"use client";

import { getOriginalRideFile } from "@/lib/rides/source";
import { processRideFile } from "@/lib/rides/import";
import {
	getRide,
	replaceRideAnalysis,
} from "@/lib/rides/persistence";
import type {
	SavedRide,
} from "@/lib/rides/types";

export interface ReanalyzeRideResult {
	ride: SavedRide;
}

export async function reanalyzeRide(
	userId: string,
	rideId: string,
): Promise<ReanalyzeRideResult> {
	const existingRide =
		await getRide(
			userId,
			rideId,
		);

	if (!existingRide) {
		throw new Error(
			"Ride not found.",
		);
	}

	/*
	 * Download through our same-origin Next.js API route
	 * instead of requesting Firebase Storage directly from
	 * the browser.
	 */
	const file =
		await getOriginalRideFile(
			existingRide,
		);

	/*
	 * This deliberately uses the same processing path as a
	 * newly imported ride.
	 */
	const processedRide =
		await processRideFile(file);

	if (
		processedRide.ride.source !==
		existingRide.source
	) {
		throw new Error(
			"The activity file type does not match the saved ride.",
		);
	}

	const updatedRide =
		await replaceRideAnalysis(
			userId,
			existingRide,
			processedRide.ride,
			processedRide.activityDate,
		);

	return {
		ride: updatedRide,
	};
}