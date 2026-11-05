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
  payload: NonNullable<ReturnType<typeof parseRouteFilePayload>>;
}

function validRouteId(value: string) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export async function loadServerSavedRoute(userId: string, routeId: string): Promise<ServerSavedRoute> {
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

  const duplicateNames = await routes.get();
  const normalizedName = normalizeRouteName(name);
  if (duplicateNames.docs.some((document) => (
    document.id !== routeId && normalizeRouteName(String(document.data().name ?? "")) === normalizedName
  ))) {
    throw new Error("Route names must be unique before sending a route to Wahoo.");
  }

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    (isFirebaseEmulatorEnvironment ? `${localFirebaseProjectId}.firebasestorage.app` : undefined);
  const [bytes] = await getStorage(adminAuth.app).bucket(bucketName).file(routeFilePath).download();
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("This saved route is too large to publish.");
  const parsed: unknown = JSON.parse(bytes.toString("utf8"));
  const payload = parseRouteFilePayload(parsed);
  if (!payload) throw new Error("This saved route uses an unsupported format.");
  if (normalizeRouteName(payload.name) !== normalizedName) {
    throw new Error("Save the latest route name before sending it to Wahoo.");
  }
  if (!(value.updatedAt instanceof Timestamp)) throw new Error("This saved route is missing its update time.");

  return {
    id: routeId,
    userId,
    name,
    description,
    updatedAt: value.updatedAt.toDate(),
    payload,
  };
}
