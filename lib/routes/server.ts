import "server-only";

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { adminAuth } from "@/lib/firebase-admin";
import { isFirebaseEmulatorEnvironment, localFirebaseProjectId } from "@/lib/firebase-environment";
import { parseRouteFilePayload } from "@/lib/routes/model";
import { normalizeRouteName } from "@/lib/routes/names";

export interface ServerSavedRoute {
  id: string;
  userId: string;
  name: string;
  description: string;
  updatedAt: Date;
  revision: number;
  payload: NonNullable<ReturnType<typeof parseRouteFilePayload>>;
}

interface ServerRouteRecord {
  id: string;
  name: string;
  description: string;
  updatedAt: unknown;
  revision: number;
  payload: NonNullable<ReturnType<typeof parseRouteFilePayload>>;
}

function validRouteId(value: string) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

async function loadServerRouteRecord(userId: string, routeId: string): Promise<ServerRouteRecord> {
  if (!validRouteId(routeId)) throw new Error("Invalid saved route.");

  const routes = getFirestore(adminAuth.app).collection("users").doc(userId).collection("routes");
  const snapshot = await routes.doc(routeId).get();
  if (!snapshot.exists) throw new Error("This saved route could not be found.");
  const value = snapshot.data() ?? {};
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const description = typeof value.description === "string" ? value.description : "";
  const routeFilePath = typeof value.routeFilePath === "string" ? value.routeFilePath : "";
  const expectedPrefix = `users/${userId}/routes/${routeId}/revisions/`;
  if (!name || !routeFilePath.startsWith(expectedPrefix) || !routeFilePath.endsWith(".json")) {
    throw new Error("This saved route is invalid.");
  }

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    (isFirebaseEmulatorEnvironment ? `${localFirebaseProjectId}.firebasestorage.app` : undefined);
  let bytes: Buffer;
  try {
    [bytes] = await getStorage(adminAuth.app).bucket(bucketName).file(routeFilePath).download();
  } catch (error) {
    console.error("Unable to download saved route payload:", error);
    throw new Error("This saved route could not be loaded.");
  }
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("This saved route is too large to load.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("This saved route uses an unsupported format.");
  }
  const payload = parseRouteFilePayload(parsed);
  if (!payload) throw new Error("This saved route uses an unsupported format.");

  return { id: routeId, name, description, updatedAt: value.updatedAt, revision: typeof value.revision === "number" ? value.revision : 1, payload };
}

export async function loadServerRoutePayload(userId: string, routeId: string) {
  return (await loadServerRouteRecord(userId, routeId)).payload;
}

export async function loadServerSavedRoute(userId: string, routeId: string): Promise<ServerSavedRoute> {
  const record = await loadServerRouteRecord(userId, routeId);
  const routes = getFirestore(adminAuth.app).collection("users").doc(userId).collection("routes");
  const duplicateNames = await routes.get();
  const normalizedName = normalizeRouteName(record.name);
  if (duplicateNames.docs.some((document) => (
    document.id !== routeId && normalizeRouteName(String(document.data().name ?? "")) === normalizedName
  ))) {
    throw new Error("Route names must be unique before sending a route to Wahoo.");
  }
  if (normalizeRouteName(record.payload.name) !== normalizedName) {
    throw new Error("Save the latest route name before sending it to Wahoo.");
  }
  if (!(record.updatedAt instanceof Timestamp)) throw new Error("This saved route is missing its update time.");

  return {
    id: record.id,
    userId,
    name: record.name,
    description: record.description,
    updatedAt: record.updatedAt.toDate(),
    revision: record.revision,
    payload: record.payload,
  };
}
