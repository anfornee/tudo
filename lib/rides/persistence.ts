import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { deleteObject, ref, uploadBytes } from "firebase/storage";

import { db, storage } from "@/lib/firebase-client";
import type { RideData } from "@/lib/ride.types";
import type { SavedRide } from "@/lib/rides/types";

function ridesCollection(userId: string) {
  return collection(db, "users", userId, "rides");
}

function rideFromDocument(
  id: string,
  data: Omit<SavedRide, "id">,
): SavedRide {
  return { id, ...data };
}

export async function getRides(userId: string): Promise<SavedRide[]> {
  const snapshot = await getDocs(ridesCollection(userId));
  const rides = snapshot.docs.map((rideDocument) =>
    rideFromDocument(
      rideDocument.id,
      rideDocument.data() as Omit<SavedRide, "id">,
    ),
  );

  return rides.sort((first, second) => {
    const firstDate = first.activityDate ?? first.importedAt;
    const secondDate = second.activityDate ?? second.importedAt;
    return (secondDate?.toMillis() ?? 0) - (firstDate?.toMillis() ?? 0);
  });
}

export async function getRide(
  userId: string,
  rideId: string,
): Promise<SavedRide | null> {
  const snapshot = await getDoc(doc(ridesCollection(userId), rideId));
  if (!snapshot.exists()) {
    return null;
  }

  return rideFromDocument(
    snapshot.id,
    snapshot.data() as Omit<SavedRide, "id">,
  );
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
  const rideDocument = doc(ridesCollection(userId));
  const extension = ride.source;
  const originalFilePath = `users/${userId}/rides/${rideDocument.id}/original.${extension}`;
  const originalFile = ref(storage, originalFilePath);

  await uploadBytes(originalFile, file, {
    contentType:
      extension === "gpx" ? "application/gpx+xml" : "application/octet-stream",
    customMetadata: { originalFileName: file.name },
  });

  try {
    await setDoc(rideDocument, {
      userId,
      activityDate: activityDate ? Timestamp.fromDate(activityDate) : null,
      importedAt: serverTimestamp(),
      originalFileName: file.name,
      source: ride.source,
      originalFilePath,
      ...summaryFromRide(ride),
    });
  } catch (error) {
    try {
      await deleteObject(originalFile);
    } catch (cleanupError) {
      console.error("Unable to clean up uploaded ride file:", cleanupError);
    }
    throw error;
  }

  const savedRide = await getRide(userId, rideDocument.id);
  if (!savedRide) {
    throw new Error("The ride was saved but could not be loaded.");
  }
  return savedRide;
}
