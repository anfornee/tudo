import { randomUUID } from "node:crypto";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { adminAuth } from "@/lib/firebase-admin";
import { isFirebaseEmulatorEnvironment, localFirebaseProjectId } from "@/lib/firebase-environment";
import { summaryFromRide } from "@/lib/rides/summary";
import { getServerRiderProfile } from "@/lib/rider-profile/server";
import type { ProcessedRide, StoredRideSamples } from "@/lib/rides/types";
import { RIDE_ANALYTICS_ALGORITHM_VERSION } from "@/lib/rides/analytics-model";
import { processRideAnalytics } from "@/lib/rides/analytics-server";

function rideDocument(uid: string, rideId: string) {
  return getFirestore(adminAuth.app).collection("users").doc(uid).collection("rides").doc(rideId);
}

export async function hasWahooRide(uid: string, rideId: string) {
  return (await rideDocument(uid, rideId).get()).exists;
}

export async function saveWahooRide(uid: string, rideId: string, processed: ProcessedRide) {
  const riderProfile = await getServerRiderProfile(uid);
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    (isFirebaseEmulatorEnvironment ? `${localFirebaseProjectId}.firebasestorage.app` : undefined);
  const bucket = getStorage(adminAuth.app).bucket(bucketName);
  const document = rideDocument(uid, rideId);
  const { file, ride, activityDate } = processed;
  // Isolate concurrent deliveries so the losing attempt can clean up its files.
  const prefix = `users/${uid}/rides/${rideId}/${randomUUID()}`;
  const original = bucket.file(`${prefix}/original.fit`);
  const samples = ride.samples.length ? bucket.file(`${prefix}/samples.v1.json`) : null;
  const sourceRevision = samples?.name ?? original.name;
  const powerProvenance = ride.powerProvenance;

  async function cleanUp() {
    await Promise.allSettled([
      original.delete({ ignoreNotFound: true }),
      samples?.delete({ ignoreNotFound: true }),
    ]);
  }

  try {
    await original.save(Buffer.from(await file.arrayBuffer()), {
      contentType: "application/octet-stream",
      metadata: { metadata: { originalFileName: file.name } },
      resumable: false,
    });
    if (samples) {
      const payload: StoredRideSamples = { version: 1, samples: ride.samples };
      await samples.save(JSON.stringify(payload), { contentType: "application/json", resumable: false });
    }
  } catch (error) {
    await cleanUp();
    throw error;
  }

  try {
    await document.create({
      userId: uid,
      activityDate: activityDate ? Timestamp.fromDate(activityDate) : null,
      importedAt: FieldValue.serverTimestamp(),
      originalFileName: file.name,
      source: ride.source,
      originalFilePath: original.name,
      sampleFilePath: samples?.name ?? null,
      sourceRevision,
      powerProvenance,
      analyticsProcessing: {
        state: "pending",
        algorithmVersion: RIDE_ANALYTICS_ALGORITHM_VERSION,
        sourceRevision,
        lastAttemptedAt: null,
        lastSuccessfulAt: null,
        leaseToken: null,
        leaseExpiresAt: null,
        error: null,
      },
      ...summaryFromRide(ride, riderProfile, activityDate),
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 6) {
      await cleanUp();
      return;
    }
    // A failed response can still follow a committed create. Preserve its files.
    throw error;
  }

  try {
    await processRideAnalytics(uid, rideId);
  } catch (error) {
    // Import success is independent from derived analytics; a later retry or
    // backfill can recover without downloading the Wahoo activity again.
    console.error("Wahoo ride saved but analytics processing failed", { rideId, error });
  }
}
