import "server-only";

import { getFirestore } from "firebase-admin/firestore";
import { adminAuth } from "@/lib/firebase-admin";
import { parseRiderProfile } from "@/lib/rider-profile/profile";
import type { RiderProfile } from "@/lib/rider-profile/types";

export async function getServerRiderProfile(userId: string): Promise<RiderProfile | null> {
  const snapshot = await getFirestore(adminAuth.app).doc(`users/${userId}/riderProfiles/cycling`).get();
  if (!snapshot.exists) return null;
  return parseRiderProfile(snapshot.data());
}
