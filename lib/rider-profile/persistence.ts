"use client";

import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { normalizeWeightHistory, parseRiderProfile, validateRiderProfile } from "@/lib/rider-profile/profile";
import type { RiderProfile } from "@/lib/rider-profile/types";

function profileDocument(userId: string) {
  return doc(db, "users", userId, "riderProfiles", "cycling");
}

export async function getRiderProfile(userId: string) {
  const snapshot = await getDoc(profileDocument(userId));
  return snapshot.exists() ? parseRiderProfile(snapshot.data()) : null;
}

export async function saveRiderProfile(userId: string, input: RiderProfile) {
  const normalized = { ...input, weightHistory: normalizeWeightHistory(input.weightHistory) };
  const errors = validateRiderProfile(normalized);
  if (errors.length) throw new Error(errors[0]);

  const saved = await runTransaction(db, async (transaction) => {
    const reference = profileDocument(userId);
    const existing = await transaction.get(reference);
    const current = existing.exists() ? parseRiderProfile(existing.data()) : null;
    const profile = { ...normalized, version: (current?.version ?? 0) + 1 };
    transaction.set(reference, { ...profile, updatedAt: serverTimestamp() });
    return profile;
  });
  return saved;
}
