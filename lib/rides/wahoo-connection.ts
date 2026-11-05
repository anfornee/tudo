import "server-only";

import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { adminAuth } from "@/lib/firebase-admin";
import type { WahooOAuthTokens } from "@/lib/rides/wahoo-oauth-utils";

const integrationCollection = "privateIntegrations";

export class WahooConnectionConflictError extends Error {
  constructor() {
    super("This Wahoo account is already connected to another Tudo account");
    this.name = "WahooConnectionConflictError";
  }
}

function connectionDocument(uid: string) {
  return getFirestore(adminAuth.app)
    .collection("users")
    .doc(uid)
    .collection(integrationCollection)
    .doc("wahoo");
}

async function connectedTudoUids(wahooUserId: number) {
  const snapshot = await getFirestore(adminAuth.app)
    .collectionGroup(integrationCollection)
    .where("wahooUserId", "==", wahooUserId)
    .limit(2)
    .get();

  return snapshot.docs.flatMap((document) => {
    if (document.id !== "wahoo") return [];
    const uid = document.ref.parent.parent?.id;
    return uid ? [uid] : [];
  });
}

export async function saveWahooConnection(uid: string, wahooUserId: number, tokens: WahooOAuthTokens) {
  const existingUids = await connectedTudoUids(wahooUserId);
  if (existingUids.some((existingUid) => existingUid !== uid)) {
    throw new WahooConnectionConflictError();
  }

  const document = connectionDocument(uid);
  const existing = await document.get();
  const expiresAt = Timestamp.fromMillis(Date.now() + tokens.expiresInSeconds * 1000);
  await document.set({
    ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    provider: "wahoo",
    wahooUserId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenType: tokens.tokenType,
    scopes: tokens.scopes,
    expiresAt,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export async function resolveTudoUidForWahooUser(wahooUserId: number) {
  const uids = await connectedTudoUids(wahooUserId);
  if (uids.length > 1) throw new Error("Wahoo account has multiple Tudo connections");
  if (uids.length === 1) return uids[0];

  // Preserve deployments that used the original manually configured mapping.
  const legacyWahooUserId = process.env.WAHOO_USER_ID;
  const legacyTudoUid = process.env.WAHOO_TUDO_UID;
  if (
    String(wahooUserId) === legacyWahooUserId &&
    legacyTudoUid &&
    !legacyTudoUid.includes("/")
  ) {
    return legacyTudoUid;
  }

  return null;
}
