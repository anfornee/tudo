"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, getBytes, listAll, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase-client";
import { parseRouteFilePayload } from "@/lib/routes/model";
import type { PlannedRoute, RouteFilePayload } from "@/lib/routes/types";

export interface SavedRoute {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  routeFilePath: string;
  distanceMeters: number;
  durationSeconds: number | null;
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
  waypointCount: number;
  provider: "openrouteservice";
  profile: "cycling-road";
  startLatitude: number;
  startLongitude: number;
}

const routeCollection = (userId: string) => collection(db, "users", userId, "routes");

function routeSummary(userId: string, name: string, description: string, route: PlannedRoute, routeFilePath: string) {
  const [startLongitude, startLatitude] = route.waypoints[0].coordinate;
  return {
    userId,
    name: name.trim().slice(0, 120),
    description: description.trim().slice(0, 1000),
    routeFilePath,
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    elevationGainMeters: route.elevationGainMeters,
    elevationLossMeters: route.elevationLossMeters,
    waypointCount: route.waypoints.length,
    provider: route.provider.provider,
    profile: route.provider.profile,
    startLatitude,
    startLongitude,
  };
}

function normalizedText(name: string, description: string) {
  return { name: name.trim().slice(0, 120), description: description.trim().slice(0, 1000) };
}

function fromDocument(id: string, value: Record<string, unknown>): SavedRoute {
  return { id, ...value } as SavedRoute;
}

function revisionPath(userId: string, routeId: string) {
  return `users/${userId}/routes/${routeId}/revisions/${crypto.randomUUID()}.json`;
}

async function uploadPayload(path: string, payload: RouteFilePayload) {
  await uploadBytes(ref(storage, path), new TextEncoder().encode(JSON.stringify(payload)), {
    contentType: "application/json",
    customMetadata: { format: "tudo-route-v1" },
  });
}

export async function listSavedRoutes(userId: string) {
  const snapshot = await getDocs(routeCollection(userId));
  return snapshot.docs
    .map((item) => fromDocument(item.id, item.data()))
    .sort((left, right) => (right.updatedAt?.toMillis() ?? 0) - (left.updatedAt?.toMillis() ?? 0));
}

export async function getSavedRoute(userId: string, routeId: string) {
  const snapshot = await getDoc(doc(routeCollection(userId), routeId));
  return snapshot.exists() ? fromDocument(snapshot.id, snapshot.data()) : null;
}

export async function loadRoutePayload(savedRoute: SavedRoute) {
  const expectedPrefix = `users/${savedRoute.userId}/routes/${savedRoute.id}/revisions/`;
  if (!savedRoute.routeFilePath.startsWith(expectedPrefix)) throw new Error("Invalid saved route path.");
  const bytes = await getBytes(ref(storage, savedRoute.routeFilePath), 20 * 1024 * 1024);
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
  const payload = parseRouteFilePayload(parsed);
  if (!payload) throw new Error("This saved route uses an unsupported format.");
  return payload;
}

export async function createSavedRoute(userId: string, name: string, description: string, route: PlannedRoute) {
  const reference = doc(routeCollection(userId));
  const routeFilePath = revisionPath(userId, reference.id);
  const text = normalizedText(name, description);
  const payload: RouteFilePayload = { version: 1, ...text, route };
  await uploadPayload(routeFilePath, payload);
  try {
    await setDoc(reference, {
      ...routeSummary(userId, text.name, text.description, route, routeFilePath),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    await deleteObject(ref(storage, routeFilePath)).catch(() => {});
    throw error;
  }
  return await getSavedRoute(userId, reference.id);
}

export async function updateSavedRoute(savedRoute: SavedRoute, name: string, description: string, route: PlannedRoute) {
  const routeFilePath = revisionPath(savedRoute.userId, savedRoute.id);
  const text = normalizedText(name, description);
  const payload: RouteFilePayload = { version: 1, ...text, route };
  await uploadPayload(routeFilePath, payload);
  try {
    await updateDoc(doc(routeCollection(savedRoute.userId), savedRoute.id), {
      ...routeSummary(savedRoute.userId, text.name, text.description, route, routeFilePath),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    await deleteObject(ref(storage, routeFilePath)).catch(() => {});
    throw error;
  }
  if (savedRoute.routeFilePath !== routeFilePath) {
    await deleteObject(ref(storage, savedRoute.routeFilePath)).catch((error) => {
      console.error("Unable to remove previous route revision:", error);
    });
  }
  return await getSavedRoute(savedRoute.userId, savedRoute.id);
}

export async function duplicateSavedRoute(savedRoute: SavedRoute, payload: RouteFilePayload) {
  return createSavedRoute(savedRoute.userId, `${payload.name} copy`.slice(0, 120), payload.description, payload.route);
}

export async function deleteSavedRoute(savedRoute: SavedRoute) {
  const revisions = await listAll(ref(storage, `users/${savedRoute.userId}/routes/${savedRoute.id}/revisions`));
  await Promise.all(revisions.items.map((item) => deleteObject(item)));
  await deleteDoc(doc(routeCollection(savedRoute.userId), savedRoute.id));
}
