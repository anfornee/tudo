"use client";

import { auth } from "@/lib/firebase-client";
import { processRideFile } from "@/lib/rides/import";
import {
	getRide,
	replaceRideAnalysis,
} from "@/lib/rides/persistence";
import type {
	RideSource,
	SavedRide,
} from "@/lib/rides/types";

export interface ReanalyzeRideResult {
	ride: SavedRide;
}

function getOriginalFileType(
	source: RideSource,
) {
	switch (source) {
		case "gpx":
			return "application/gpx+xml";

		case "fit":
			return "application/octet-stream";

		default:
			return "application/octet-stream";
	}
}

async function getOriginalRideFile(
	ride: SavedRide,
): Promise<File> {
	const user = auth.currentUser;

	if (!user) {
		throw new Error(
			"You must be signed in to re-analyze a ride.",
		);
	}

	if (!ride.originalFilePath) {
		throw new Error(
			"The original activity file is not available for this ride.",
		);
	}

	const idToken =
		await user.getIdToken();

	const response = await fetch(
		`/api/rides/${ride.id}/source`,
		{
			method: "POST",
			headers: {
				"Content-Type":
					"application/json",
				Authorization:
					`Bearer ${idToken}`,
			},
			body: JSON.stringify({
				originalFilePath:
					ride.originalFilePath,
			}),
		},
	);

	if (!response.ok) {
		let message =
			"Unable to load the original activity file.";

		try {
			const result =
				(await response.json()) as {
					error?: string;
				};

			if (result.error) {
				message = result.error;
			}
		} catch {
			// Response was not JSON.
		}

		throw new Error(message);
	}

	const blob =
		await response.blob();

	return new File(
		[blob],
		ride.originalFileName ||
			`ride.${ride.source}`,
		{
			type:
				blob.type ||
				getOriginalFileType(
					ride.source,
				),
		},
	);
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