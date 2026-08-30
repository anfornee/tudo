import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase-client";
import type { FeatureId } from "@/lib/feature-order";

function featurePreferenceDocument(userId: string) {
  return doc(db, "users", userId, "preferences", "dashboard");
}

export async function getFeatureOrder(
  userId: string,
): Promise<unknown[] | null> {
  const snapshot = await getDoc(featurePreferenceDocument(userId));

  if (!snapshot.exists()) {
    return null;
  }

  const featureOrder = snapshot.data().featureOrder;
  return Array.isArray(featureOrder) ? featureOrder : null;
}

export async function saveFeatureOrder(
  userId: string,
  featureOrder: readonly FeatureId[],
): Promise<void> {
  await setDoc(featurePreferenceDocument(userId), {
    featureOrder: [...featureOrder],
    updatedAt: serverTimestamp(),
  });
}
