import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
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

function isRideSample(
	value: unknown,
): value is RideSample {
	if (!value || typeof value !== "object") {
		return false;
	}

	const sample = value as Record<string, unknown>;

	return (
		typeof sample.elapsedSeconds === "number" &&
		Number.isFinite(sample.elapsedSeconds) &&
		[
			"power",
			"speedMph",
			"cadence",
			"elevationFeet",
			"distanceMiles",
		].every(
			(key) =>
				sample[key] === null ||
				(
					typeof sample[key] === "number" &&
					Number.isFinite(sample[key])
				),
		)
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

	const stored =
		parsed as Partial<StoredRideSamples>;

	if (
		stored.version !== 1 ||
		!Array.isArray(
			stored.samples,
		) ||
		!stored.samples.every(
			isRideSample,
		)
	) {
		throw new Error(
			"Unsupported ride sample data.",
		);
	}

	return stored.samples;
}

function summaryFromRide(ride: RideData) {
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

export async function saveRide(
	userId: string,
	file: File,
	ride: RideData,
	activityDate: Date | null,
): Promise<SavedRide> {
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
				...summaryFromRide(ride),
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
				...summaryFromRide(ride),
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
	/*
	 * The paths are stored on the ride document rather than
	 * reconstructed here. This allows the storage layout to
	 * evolve without breaking deletion of existing rides.
	 *
	 * Validate them before deleting so a malformed Firestore
	 * document cannot point deletion outside this ride's own
	 * storage directory.
	 */
	if (ride.originalFilePath) {
		assertRideStoragePath(
			userId,
			ride.id,
			ride.originalFilePath,
		);
	}

	if (ride.sampleFilePath) {
		assertRideStoragePath(
			userId,
			ride.id,
			ride.sampleFilePath,
		);
	}

	/*
	 * Delete Storage artifacts before deleting the Firestore
	 * summary.
	 *
	 * If Storage deletion fails for a real reason, the ride
	 * document remains available and the operation can safely
	 * be retried.
	 *
	 * Missing Storage objects are intentionally ignored so
	 * older or partially-cleaned rides can still be removed.
	 */
	await Promise.all([
		deleteRideStorageObject(
			userId,
			ride.id,
			ride.originalFilePath,
		),
		deleteRideStorageObject(
			userId,
			ride.id,
			ride.sampleFilePath,
		),
	]);

	await deleteDoc(
		doc(
			ridesCollection(userId),
			ride.id,
		),
	);
}