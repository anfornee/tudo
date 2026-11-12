import {
	collection,
	doc,
	getDoc,
	getDocs,
	runTransaction,
	serverTimestamp,
	setDoc,
	Timestamp,
	updateDoc,
} from "firebase/firestore";
import {
	deleteObject,
	ref,
	uploadBytes,
} from "firebase/storage";

import {
	auth,
	db,
	storage,
} from "@/lib/firebase-client";
import type {
	RideData,
	RideSample,
} from "@/lib/ride.types";
import type {
	SavedRide,
	StoredRideSamples,
} from "@/lib/rides/types";

import { summaryFromRide } from "@/lib/rides/summary";
import { getRiderProfile } from "@/lib/rider-profile/persistence";
import type { RiderProfile } from "@/lib/rider-profile/types";
import { calorieInputFromSummary, estimateCyclingCalories } from "@/lib/rides/calories";
import { RIDE_ANALYTICS_ALGORITHM_VERSION } from "@/lib/rides/analytics-model";
import { parseStoredRideSamples } from "@/lib/rides/sample-payload";

function ridesCollection(userId: string) {
	return collection(db, "users", userId, "rides");
}

function rideFromDocument(
	id: string,
	data: Omit<SavedRide, "id">,
): SavedRide {
	return {
		id,
		...data,
	};
}

export async function getRides(
	userId: string,
): Promise<SavedRide[]> {
	const snapshot = await getDocs(ridesCollection(userId));

	const rides = snapshot.docs.map((rideDocument) =>
		rideFromDocument(
			rideDocument.id,
			rideDocument.data() as Omit<SavedRide, "id">,
		),
	);

	return rides.sort((first, second) => {
		const firstDate =
			first.activityDate ?? first.importedAt;

		const secondDate =
			second.activityDate ?? second.importedAt;

		return (
			(secondDate?.toMillis() ?? 0) -
			(firstDate?.toMillis() ?? 0)
		);
	});
}

export async function getRide(
	userId: string,
	rideId: string,
): Promise<SavedRide | null> {
	const snapshot = await getDoc(
		doc(ridesCollection(userId), rideId),
	);

	if (!snapshot.exists()) {
		return null;
	}

	return rideFromDocument(
		snapshot.id,
		snapshot.data() as Omit<SavedRide, "id">,
	);
}

export async function getRideSamples(
	ride: SavedRide,
): Promise<RideSample[] | null> {
	if (!ride.sampleFilePath) {
		return null;
	}

	const user =
		auth.currentUser;

	if (!user) {
		throw new Error(
			"You must be signed in to load ride samples.",
		);
	}

	const idToken =
		await user.getIdToken();

	const response = await fetch(
		`/api/rides/${ride.id}/samples`,
		{
			method: "POST",
			headers: {
				"Content-Type":
					"application/json",
				Authorization:
					`Bearer ${idToken}`,
			},
			body: JSON.stringify({
				sampleFilePath:
					ride.sampleFilePath,
			}),
		},
	);

	if (!response.ok) {
		let message =
			"Unable to load ride sample data.";

		try {
			const result =
				(await response.json()) as {
					error?: string;
				};

			if (result.error) {
				message =
					result.error;
			}
		} catch {
			// Non-JSON response.
		}

		throw new Error(
			message,
		);
	}

	const parsed: unknown =
		await response.json();

	if (
		!parsed ||
		typeof parsed !== "object"
	) {
		throw new Error(
			"Invalid ride sample data.",
		);
	}

	return parseStoredRideSamples(parsed).samples;
}

export async function requestRideAnalytics(rideId: string, force = false) {
	const response = await fetch(`/api/rides/${encodeURIComponent(rideId)}/analytics`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ force }),
	});
	if (!response.ok && response.status !== 409) {
		throw new Error("Ride analytics could not be processed.");
	}
	return await response.json() as { outcome: string };
}

function pendingAnalytics(sourceRevision: string) {
	return {
		state: "pending" as const,
		algorithmVersion: RIDE_ANALYTICS_ALGORITHM_VERSION,
		sourceRevision,
		lastAttemptedAt: null,
		lastSuccessfulAt: null,
		leaseToken: null,
		leaseExpiresAt: null,
		error: null,
	};
}

export async function saveRide(
	userId: string,
	file: File,
	ride: RideData,
	activityDate: Date | null,
): Promise<SavedRide> {
	const riderProfile = await getRiderProfile(userId).catch((profileError) => {
		console.error("Unable to load Rider Profile for calorie estimation:", profileError);
		return null;
	});
	const rideDocument = doc(
		ridesCollection(userId),
	);

	const extension = ride.source;

	const originalFilePath =
		`users/${userId}/rides/${rideDocument.id}/original.${extension}`;

	const originalFile = ref(
		storage,
		originalFilePath,
	);

	const sampleFilePath = ride.samples.length
		? `users/${userId}/rides/${rideDocument.id}/samples.v1.json`
		: null;

	const sampleFile = sampleFilePath
		? ref(storage, sampleFilePath)
		: null;
	const sourceRevision = sampleFilePath ?? originalFilePath;
	const powerProvenance = ride.powerProvenance;

	try {
		await uploadBytes(
			originalFile,
			file,
			{
				contentType:
					extension === "gpx"
						? "application/gpx+xml"
						: "application/octet-stream",
				customMetadata: {
					originalFileName: file.name,
				},
			},
		);

		if (sampleFile) {
			const samplePayload: StoredRideSamples = {
				version: 1,
				samples: ride.samples,
			};

			await uploadBytes(
				sampleFile,
				new TextEncoder().encode(
					JSON.stringify(samplePayload),
				),
				{
					contentType: "application/json",
				},
			);
		}

		await setDoc(
			rideDocument,
			{
				userId,
				activityDate: activityDate
					? Timestamp.fromDate(activityDate)
					: null,
				importedAt: serverTimestamp(),
				originalFileName: file.name,
				source: ride.source,
				originalFilePath,
				sampleFilePath,
				sourceRevision,
				powerProvenance,
				analyticsProcessing: pendingAnalytics(sourceRevision),
				...summaryFromRide(ride, riderProfile, activityDate),
			},
		);
	} catch (error) {
		const cleanupResults =
			await Promise.allSettled([
				deleteObject(originalFile),
				...(sampleFile
					? [deleteObject(sampleFile)]
					: []),
			]);

		cleanupResults.forEach((result) => {
			if (result.status === "rejected") {
				console.error(
					"Unable to clean up uploaded ride file:",
					result.reason,
				);
			}
		});

		throw error;
	}

	try {
		await requestRideAnalytics(rideDocument.id);
	} catch (analyticsError) {
		// The ride and source files are durable; discovery/backfill can retry.
		console.error("Ride saved but analytics processing failed:", analyticsError);
	}

	const savedRide = await getRide(
		userId,
		rideDocument.id,
	);

	if (!savedRide) {
		throw new Error(
			"The ride was saved but could not be loaded.",
		);
	}

	return savedRide;
}

export async function replaceRideAnalysis(
	userId: string,
	existingRide: SavedRide,
	ride: RideData,
	activityDate: Date | null,
): Promise<SavedRide> {
	const riderProfile = await getRiderProfile(userId).catch((profileError) => {
		console.error("Unable to load Rider Profile for calorie estimation:", profileError);
		return null;
	});
	const rideDocument = doc(
		ridesCollection(userId),
		existingRide.id,
	);

	const ridePrefix =
		`users/${userId}/rides/${existingRide.id}/`;

	if (
		existingRide.originalFilePath &&
		!existingRide.originalFilePath.startsWith(ridePrefix)
	) {
		throw new Error(
			"Original ride file does not belong to this ride.",
		);
	}

	if (
		existingRide.sampleFilePath &&
		!existingRide.sampleFilePath.startsWith(ridePrefix)
	) {
		throw new Error(
			"Ride sample file does not belong to this ride.",
		);
	}

	/*
	 * Use a new sidecar instead of immediately replacing the
	 * current one.
	 *
	 * That means the existing ride stays usable until the new
	 * analysis has been successfully parsed and persisted.
	 */
	const nextSampleFilePath = ride.samples.length
		? `${ridePrefix}samples.v1.${Date.now()}.json`
		: null;

	const nextSampleFile = nextSampleFilePath
		? ref(storage, nextSampleFilePath)
		: null;
	const nextSourceRevision = nextSampleFilePath ?? existingRide.originalFilePath;
	const powerProvenance = ride.powerProvenance;

	try {
		if (nextSampleFile) {
			const samplePayload: StoredRideSamples = {
				version: 1,
				samples: ride.samples,
			};

			await uploadBytes(
				nextSampleFile,
				new TextEncoder().encode(
					JSON.stringify(samplePayload),
				),
				{
					contentType: "application/json",
				},
			);
		}

		/*
		 * Only parser-derived fields are replaced here.
		 *
		 * We intentionally do NOT overwrite:
		 *
		 * - importedAt
		 * - originalFileName
		 * - originalFilePath
		 * - userId
		 * - future notes/tags/favorites/custom metadata
		 */
		await updateDoc(
			rideDocument,
			{
				activityDate: activityDate
					? Timestamp.fromDate(activityDate)
					: null,
				source: ride.source,
				sampleFilePath: nextSampleFilePath,
				sourceRevision: nextSourceRevision,
				powerProvenance,
				analyticsProcessing: pendingAnalytics(nextSourceRevision),
				...summaryFromRide(ride, riderProfile, activityDate),
			},
		);
	} catch (error) {
		/*
		 * If we uploaded a replacement sidecar but failed to
		 * update Firestore, remove the unused replacement.
		 *
		 * The existing sampleFilePath remains untouched.
		 */
		if (nextSampleFile) {
			try {
				await deleteObject(nextSampleFile);
			} catch (cleanupError) {
				if (!isStorageObjectNotFound(cleanupError)) {
					console.error(
						"Unable to clean up replacement ride samples:",
						cleanupError,
					);
				}
			}
		}

		throw error;
	}

	/*
	 * Firestore now points at the newly generated sidecar,
	 * so the old sample file is no longer needed.
	 *
	 * Cleanup failure here should not undo an otherwise
	 * successful re-analysis.
	 */
	if (
		existingRide.sampleFilePath &&
		existingRide.sampleFilePath !==
			nextSampleFilePath
	) {
		try {
			await deleteRideStorageObject(
				userId,
				existingRide.id,
				existingRide.sampleFilePath,
			);
		} catch (error) {
			console.error(
				"Unable to remove previous ride sample data:",
				error,
			);
		}
	}

	try {
		await requestRideAnalytics(existingRide.id);
	} catch (analyticsError) {
		console.error("Ride updated but analytics processing failed:", analyticsError);
	}

	const updatedRide = await getRide(
		userId,
		existingRide.id,
	);

	if (!updatedRide) {
		throw new Error(
			"The ride was updated but could not be loaded.",
		);
	}

	return updatedRide;
}

export async function ensureRideCalorieAnalysis(
	userId: string,
	ride: SavedRide,
	samples: readonly RideSample[],
	profile: RiderProfile | null,
) {
	if (ride.calorieAnalysis) return ride;

	const calorieAnalysis = estimateCyclingCalories(
		calorieInputFromSummary(ride, samples),
		profile,
	);

	if (!calorieAnalysis) return ride;

	const reference = doc(ridesCollection(userId), ride.id);
	const wroteAnalysis = await runTransaction(db, async (transaction) => {
		const current = await transaction.get(reference);
		if (!current.exists()) throw new Error("Ride not found.");
		if (current.data().calorieAnalysis) return false;
		transaction.update(reference, { calorieAnalysis });
		return true;
	});

	if (wroteAnalysis) return { ...ride, calorieAnalysis };
	return await getRide(userId, ride.id) ?? ride;
}

function rideStoragePrefix(
	userId: string,
	rideId: string,
) {
	return `users/${userId}/rides/${rideId}/`;
}

function assertRideStoragePath(
	userId: string,
	rideId: string,
	path: string,
) {
	const expectedPrefix =
		rideStoragePrefix(userId, rideId);

	if (!path.startsWith(expectedPrefix)) {
		throw new Error(
			"Ride storage path does not belong to this ride.",
		);
	}
}

function isStorageObjectNotFound(
	error: unknown,
) {
	if (!error || typeof error !== "object") {
		return false;
	}

	if (!("code" in error)) {
		return false;
	}

	return (
		(error as { code?: unknown }).code ===
		"storage/object-not-found"
	);
}

async function deleteRideStorageObject(
	userId: string,
	rideId: string,
	path: string | null | undefined,
) {
	if (!path) {
		return;
	}

	assertRideStoragePath(
		userId,
		rideId,
		path,
	);

	try {
		await deleteObject(
			ref(storage, path),
		);
	} catch (error) {
		/*
		 * Older or partially-imported rides may reference an
		 * artifact that no longer exists. Missing files should
		 * not prevent the ride itself from being deleted.
		 */
		if (isStorageObjectNotFound(error)) {
			return;
		}

		throw error;
	}
}

export async function deleteRide(
	userId: string,
	ride: SavedRide,
): Promise<void> {
	if (auth.currentUser?.uid !== userId) throw new Error("You must be signed in to delete this ride.");
	const response = await fetch(`/api/rides/${encodeURIComponent(ride.id)}`, { method: "DELETE" });
	if (!response.ok) throw new Error("Unable to delete this ride.");
}
