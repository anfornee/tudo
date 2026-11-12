import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { adminAuth } from "@/lib/firebase-admin";
import { isFirebaseEmulatorEnvironment, localFirebaseProjectId } from "@/lib/firebase-environment";
import {
	markProfileAnalyticsDirty,
	runProfileAnalyticsRebuild,
} from "@/lib/rides/profile-analytics-server";

function rideReference(userId: string, rideId: string) {
	return getFirestore(adminAuth.app).doc(`users/${userId}/rides/${rideId}`);
}

function validRidePath(userId: string, rideId: string, value: unknown): value is string {
	return typeof value === "string" && value.startsWith(`users/${userId}/rides/${rideId}/`);
}

export async function deleteRideOnServer(userId: string, rideId: string) {
	const database = getFirestore(adminAuth.app);
	const reference = rideReference(userId, rideId);
	let storagePaths: string[] = [];
	const deleted = await database.runTransaction(async (transaction) => {
		const snapshot = await transaction.get(reference);
		if (!snapshot.exists) return false;
		const data = snapshot.data()!;
		storagePaths = [data.originalFilePath, data.sampleFilePath]
			.filter((path): path is string => validRidePath(userId, rideId, path));
		transaction.delete(reference);
		markProfileAnalyticsDirty(transaction, userId, "ride_deleted");
		return true;
	});
	if (!deleted) return false;

	const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
		?? (isFirebaseEmulatorEnvironment ? `${localFirebaseProjectId}.firebasestorage.app` : undefined);
	const bucket = getStorage(adminAuth.app).bucket(bucketName);
	const cleanup = await Promise.allSettled(storagePaths.map((path) =>
		bucket.file(path).delete({ ignoreNotFound: true })));
	for (const result of cleanup) {
		if (result.status === "rejected") {
			console.error("Ride was deleted but a Storage artifact could not be removed", {
				userId,
				rideId,
				error: result.reason,
			});
		}
	}

	try {
		await runProfileAnalyticsRebuild(userId);
	} catch (error) {
		console.error("Ride was deleted but profile aggregation failed", { userId, rideId, error });
	}
	return true;
}
