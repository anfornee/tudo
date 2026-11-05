import "server-only";

import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { adminAuth } from "@/lib/firebase-admin";
import { getWahooClientCredentials, refreshWahooOAuthTokens } from "@/lib/rides/wahoo-oauth";
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

interface StoredWahooConnection {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  scopes: string[];
  expiresAt: Timestamp;
  wahooUserId: number;
}

function parseStoredConnection(value: Record<string, unknown>): StoredWahooConnection | null {
  return typeof value.accessToken === "string" && value.accessToken &&
    typeof value.refreshToken === "string" && value.refreshToken &&
    typeof value.wahooUserId === "number" && Number.isSafeInteger(value.wahooUserId) &&
    value.expiresAt instanceof Timestamp
    ? {
        accessToken: value.accessToken,
        refreshToken: value.refreshToken,
        tokenType: typeof value.tokenType === "string" && value.tokenType ? value.tokenType : "Bearer",
        scopes: Array.isArray(value.scopes) ? value.scopes.filter((scope): scope is string => typeof scope === "string") : [],
        expiresAt: value.expiresAt,
        wahooUserId: value.wahooUserId,
      }
    : null;
}

async function readWahooConnection(uid: string) {
  const snapshot = await connectionDocument(uid).get();
  return snapshot.exists ? parseStoredConnection(snapshot.data() ?? {}) : null;
}

export async function getWahooConnectionStatus(uid: string) {
  return { connected: Boolean(await readWahooConnection(uid)) };
}

export async function getValidWahooAccessToken(uid: string) {
  const connection = await readWahooConnection(uid);
  if (!connection) throw new Error("Connect Wahoo before sending a route.");
  if (connection.expiresAt.toMillis() > Date.now()) return connection.accessToken;

  const refreshed = await refreshWahooOAuthTokens(getWahooClientCredentials(), connection.refreshToken);
  const scopes = refreshed.scopes.length ? refreshed.scopes : connection.scopes;
  await connectionDocument(uid).update({
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    tokenType: refreshed.tokenType,
    scopes,
    expiresAt: Timestamp.fromMillis(Date.now() + refreshed.expiresInSeconds * 1000),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return refreshed.accessToken;
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
