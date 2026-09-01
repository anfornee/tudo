import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";

import { db, storage } from "@/lib/firebase-client";
import type { RideData } from "@/lib/ride.types";
import type { RideSample } from "@/lib/ride.types";
import type { SavedRide, StoredRideSamples } from "@/lib/rides/types";

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

function isRideSample(value: unknown): value is RideSample {
  if (!value || typeof value !== "object") return false;
  const sample = value as Record<string, unknown>;
  return typeof sample.elapsedSeconds === "number" && Number.isFinite(sample.elapsedSeconds) &&
    ["power", "speedMph", "cadence", "elevationFeet", "distanceMiles"].every(
      (key) => sample[key] === null || (typeof sample[key] === "number" && Number.isFinite(sample[key])),
    );
}

export async function getRideSamples(ride: SavedRide): Promise<RideSample[] | null> {
  if (!ride.sampleFilePath) return null;
  const bytes = await getBytes(ref(storage, ride.sampleFilePath));
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid ride sample data.");
  const stored = parsed as Partial<StoredRideSamples>;
  if (stored.version !== 1 || !Array.isArray(stored.samples) || !stored.samples.every(isRideSample)) {
    throw new Error("Unsupported ride sample data.");
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
  const rideDocument = doc(ridesCollection(userId));
  const extension = ride.source;
  const originalFilePath = `users/${userId}/rides/${rideDocument.id}/original.${extension}`;
  const originalFile = ref(storage, originalFilePath);
  const sampleFilePath = ride.samples.length
    ? `users/${userId}/rides/${rideDocument.id}/samples.v1.json`
    : null;
  const sampleFile = sampleFilePath ? ref(storage, sampleFilePath) : null;

  try {
    await uploadBytes(originalFile, file, {
      contentType:
        extension === "gpx" ? "application/gpx+xml" : "application/octet-stream",
      customMetadata: { originalFileName: file.name },
    });

    if (sampleFile) {
      const samplePayload: StoredRideSamples = { version: 1, samples: ride.samples };
      await uploadBytes(sampleFile, new TextEncoder().encode(JSON.stringify(samplePayload)), {
        contentType: "application/json",
      });
    }

    await setDoc(rideDocument, {
      userId,
      activityDate: activityDate ? Timestamp.fromDate(activityDate) : null,
      importedAt: serverTimestamp(),
      originalFileName: file.name,
      source: ride.source,
      originalFilePath,
      sampleFilePath,
      ...summaryFromRide(ride),
    });
  } catch (error) {
    const cleanupResults = await Promise.allSettled([
      deleteObject(originalFile),
      ...(sampleFile ? [deleteObject(sampleFile)] : []),
    ]);
    cleanupResults.forEach((result) => {
      if (result.status === "rejected") {
        console.error("Unable to clean up uploaded ride file:", result.reason);
      }
    });
    throw error;
  }

  const savedRide = await getRide(userId, rideDocument.id);
  if (!savedRide) {
    throw new Error("The ride was saved but could not be loaded.");
  }
  return savedRide;
}
