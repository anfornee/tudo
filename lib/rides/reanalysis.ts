"use client";

import { getBytes, ref } from "firebase/storage";

import { storage } from "@/lib/firebase-client";
import { processRideFile } from "@/lib/rides/import";
import {
    getRide,
    replaceRideAnalysis,
} from "@/lib/rides/persistence";
import type { SavedRide } from "@/lib/rides/types";

export interface ReanalyzeRideResult {
    ride: SavedRide;
}

function getOriginalFileType(ride: SavedRide) {
    switch (ride.source) {
        case "gpx":
            return "application/gpx+xml";

        case "fit":
            return "application/octet-stream";

        default:
            return "application/octet-stream";
    }
}

export async function reanalyzeRide(
    userId: string,
    rideId: string,
): Promise<ReanalyzeRideResult> {
    const existingRide = await getRide(userId, rideId);

    if (!existingRide) {
        throw new Error("Ride not found.");
    }

    if (!existingRide.originalFilePath) {
        throw new Error(
            "The original activity file is not available for this ride.",
        );
    }

    const bytes = await getBytes(
        ref(storage, existingRide.originalFilePath),
    );

    const file = new File(
        [bytes],
        existingRide.originalFileName ||
        `ride.${existingRide.source}`,
        {
            type: getOriginalFileType(existingRide),
        },
    );

    const processedRide = await processRideFile(file);

    /*
     * Sanity check that the parser still agrees with the
     * originally stored file type.
     */
    if (processedRide.ride.source !== existingRide.source) {
        throw new Error(
            "The activity file type no longer matches the saved ride.",
        );
    }

    const updatedRide = await replaceRideAnalysis(
        userId,
        existingRide,
        processedRide.ride,
        processedRide.activityDate,
    );

    return {
        ride: updatedRide,
    };
}