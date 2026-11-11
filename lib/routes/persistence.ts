"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { deleteObject, listAll, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase-client";
import { createRoutePreviewPath } from "@/lib/routes/geometry";
import { parseRouteFilePayload } from "@/lib/routes/model";
import { isUniqueRouteName, nextUniqueRouteName, normalizeRouteName } from "@/lib/routes/names";
import type { PlannedRoute, RouteFilePayload, RouteSourceMetadata, RouteSourceType } from "@/lib/routes/types";

export interface SavedRoute {
  id: string;
  userId: string;
  name: string;
  normalizedName: string;
  description: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  routeFilePath: string;
  originalFilePath: string | null;
  originalFileName: string | null;
  sourceFingerprint: string | null;
  distanceMeters: number;
  durationSeconds: number | null;
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
  waypointCount: number;
  segmentCount: number;
  revision: number;
  previewPath: string;
  source: RouteSourceType;
  sourceLabel: string;
  sourceImportedAt: string | null;
  provider: PlannedRoute["provider"]["provider"];
  profile: PlannedRoute["provider"]["profile"];
  startLatitude: number;
  startLongitude: number;
}

export interface ImportedRouteInput {
  route: PlannedRoute;
  source: RouteSourceMetadata;
  originalFile: File;
  sourceFingerprint: string;
}

const routeCollection = (userId: string) => collection(db, "users", userId, "routes");
const routeNameCollection = (userId: string) => collection(db, "users", userId, "routeNames");

function nameClaimId(name: string) {
  return encodeURIComponent(normalizedRouteName(name));
}

function normalizedRouteName(name: string) {
  return normalizeRouteName(name).slice(0, 120);
}

function defaultSource(route: PlannedRoute): RouteSourceMetadata {
  return route.provider.provider === "openrouteservice"
    ? { type: "tudo", label: "Tudo", originalFileName: null, importedAt: null }
    : {
        type: route.provider.provider,
        label: `${route.provider.provider.toUpperCase()} import`,
        originalFileName: null,
        importedAt: null,
      };
}

function sourceFromSavedRoute(savedRoute: SavedRoute): RouteSourceMetadata {
  return {
    type: savedRoute.source,
    label: savedRoute.sourceLabel,
    originalFileName: savedRoute.originalFileName,
    importedAt: savedRoute.sourceImportedAt,
  };
}

function routeSummary(
  userId: string,
  name: string,
  description: string,
  route: PlannedRoute,
  routeFilePath: string,
  source: RouteSourceMetadata,
  options: { originalFilePath?: string | null; sourceFingerprint?: string | null; revision: number },
) {
  const [startLongitude, startLatitude] = route.geometry[0].coordinate;
  return {
    userId,
    name: name.trim().slice(0, 120),
    normalizedName: normalizedRouteName(name),
    description: description.trim().slice(0, 1000),
    routeFilePath,
    originalFilePath: options.originalFilePath ?? null,
    originalFileName: source.originalFileName,
    sourceFingerprint: options.sourceFingerprint ?? null,
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    elevationGainMeters: route.elevationGainMeters,
    elevationLossMeters: route.elevationLossMeters,
    waypointCount: route.waypoints.length,
    segmentCount: route.segmentStartIndices.length,
    revision: options.revision,
    previewPath: createRoutePreviewPath(route),
    source: source.type,
    sourceLabel: source.label,
    sourceImportedAt: source.importedAt,
    provider: route.provider.provider,
    profile: route.provider.profile,
    startLatitude,
    startLongitude,
  };
}

function normalizedText(name: string, description: string) {
  return {
    name: name.trim().replace(/\s+/g, " ").slice(0, 120),
    description: description.trim().slice(0, 1000),
  };
}

function fromDocument(id: string, value: Record<string, unknown>): SavedRoute {
  const provider = value.provider === "gpx" || value.provider === "tcx" || value.provider === "wahoo"
    ? value.provider
    : "openrouteservice";
  const source = value.source === "gpx" || value.source === "tcx" || value.source === "wahoo"
    ? value.source
    : "tudo";
  return {
    ...(value as Omit<SavedRoute, "id">),
    id,
    normalizedName: typeof value.normalizedName === "string" ? value.normalizedName : normalizeRouteName(String(value.name ?? "")),
    originalFilePath: typeof value.originalFilePath === "string" ? value.originalFilePath : null,
    originalFileName: typeof value.originalFileName === "string" ? value.originalFileName : null,
    sourceFingerprint: typeof value.sourceFingerprint === "string" ? value.sourceFingerprint : null,
    segmentCount: typeof value.segmentCount === "number" ? value.segmentCount : 1,
    revision: typeof value.revision === "number" ? value.revision : 1,
    previewPath: typeof value.previewPath === "string" ? value.previewPath : "",
    source,
    sourceLabel: typeof value.sourceLabel === "string" ? value.sourceLabel : source === "tudo" ? "Tudo" : source.toUpperCase(),
    sourceImportedAt: typeof value.sourceImportedAt === "string" ? value.sourceImportedAt : null,
    provider,
    profile: value.profile === "imported" ? "imported" : "cycling-road",
  };
}

function revisionPath(userId: string, routeId: string) {
  return `users/${userId}/routes/${routeId}/revisions/${crypto.randomUUID()}.json`;
}

function originalPath(userId: string, routeId: string, source: RouteSourceMetadata) {
  const extension = source.type === "tcx" ? "tcx" : "gpx";
  return `users/${userId}/routes/${routeId}/originals/${crypto.randomUUID()}.${extension}`;
}

async function uploadPayload(path: string, payload: RouteFilePayload) {
  await uploadBytes(ref(storage, path), new TextEncoder().encode(JSON.stringify(payload)), {
    contentType: "application/json",
    customMetadata: { format: "tudo-route-v1" },
  });
}

async function requireUniqueName(userId: string, name: string, excludingId?: string) {
  const routes = await listSavedRoutes(userId);
  if (!isUniqueRouteName(name, routes, excludingId)) {
    throw new Error("Route names must be unique. Choose a different name before saving.");
  }
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
  const response = await fetch(`/api/routes/${encodeURIComponent(savedRoute.id)}/payload`, { cache: "no-store" });
  const parsed: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>).error === "string"
      ? (parsed as Record<string, string>).error
      : "Unable to load this saved route.";
    throw new Error(message);
  }
  const payload = parseRouteFilePayload(parsed);
  if (!payload) throw new Error("This saved route uses an unsupported format.");
  return payload;
}

async function createRoute(
  userId: string,
  name: string,
  description: string,
  route: PlannedRoute,
  source: RouteSourceMetadata,
  imported?: { file: File; fingerprint: string },
) {
  await requireUniqueName(userId, name);
  const reference = doc(routeCollection(userId));
  const routeFilePath = revisionPath(userId, reference.id);
  const originalFilePath = imported ? originalPath(userId, reference.id, source) : null;
  const text = normalizedText(name, description);
  if (!text.name) throw new Error("Give this route a name before saving.");
  const payload: RouteFilePayload = { version: 1, ...text, source, route };
  await uploadPayload(routeFilePath, payload);
  if (imported && originalFilePath) {
    await uploadBytes(ref(storage, originalFilePath), imported.file, {
      contentType: source.type === "tcx" ? "application/vnd.garmin.tcx+xml" : "application/gpx+xml",
      customMetadata: { format: source.type, originalFileName: imported.file.name },
    }).catch(async (error) => {
      await deleteObject(ref(storage, routeFilePath)).catch(() => {});
      throw error;
    });
  }
  try {
    await runTransaction(db, async (transaction) => {
      const claimReference = doc(routeNameCollection(userId), nameClaimId(text.name));
      const claim = await transaction.get(claimReference);
      if (claim.exists()) throw new Error("Route names must be unique. Choose a different name before saving.");
      transaction.set(claimReference, { routeId: reference.id, normalizedName: normalizedRouteName(text.name) });
      transaction.set(reference, {
        ...routeSummary(userId, text.name, text.description, route, routeFilePath, source, {
          originalFilePath,
          sourceFingerprint: imported?.fingerprint ?? null,
          revision: 1,
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    await Promise.all([
      deleteObject(ref(storage, routeFilePath)).catch(() => {}),
      originalFilePath ? deleteObject(ref(storage, originalFilePath)).catch(() => {}) : Promise.resolve(),
    ]);
    throw error;
  }
  return await getSavedRoute(userId, reference.id);
}

export function createSavedRoute(userId: string, name: string, description: string, route: PlannedRoute) {
  return createRoute(userId, name, description, route, defaultSource(route));
}

export function createImportedRoute(userId: string, name: string, description: string, input: ImportedRouteInput) {
  return createRoute(userId, name, description, input.route, input.source, {
    file: input.originalFile,
    fingerprint: input.sourceFingerprint,
  });
}

export async function updateSavedRoute(savedRoute: SavedRoute, name: string, description: string, route: PlannedRoute) {
  await requireUniqueName(savedRoute.userId, name, savedRoute.id);
  const routeFilePath = revisionPath(savedRoute.userId, savedRoute.id);
  const text = normalizedText(name, description);
  if (!text.name) throw new Error("Give this route a name before saving.");
  const source = sourceFromSavedRoute(savedRoute);
  const payload: RouteFilePayload = { version: 1, ...text, source, route };
  await uploadPayload(routeFilePath, payload);
  try {
    await runTransaction(db, async (transaction) => {
      const nextClaimReference = doc(routeNameCollection(savedRoute.userId), nameClaimId(text.name));
      const previousClaimReference = doc(routeNameCollection(savedRoute.userId), nameClaimId(savedRoute.name));
      const nextClaim = await transaction.get(nextClaimReference);
      const previousClaim = nextClaimReference.path === previousClaimReference.path
        ? null
        : await transaction.get(previousClaimReference);
      if (nextClaim.exists() && nextClaim.data().routeId !== savedRoute.id) {
        throw new Error("Route names must be unique. Choose a different name before saving.");
      }
      transaction.set(nextClaimReference, { routeId: savedRoute.id, normalizedName: normalizedRouteName(text.name) });
      if (previousClaim?.exists() && previousClaim.data().routeId === savedRoute.id) transaction.delete(previousClaimReference);
      transaction.update(doc(routeCollection(savedRoute.userId), savedRoute.id), {
        ...routeSummary(savedRoute.userId, text.name, text.description, route, routeFilePath, source, {
          originalFilePath: savedRoute.originalFilePath,
          sourceFingerprint: savedRoute.sourceFingerprint,
          revision: savedRoute.revision + 1,
        }),
        updatedAt: serverTimestamp(),
      });
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
  const routes = await listSavedRoutes(savedRoute.userId);
  return createSavedRoute(savedRoute.userId, nextUniqueRouteName(payload.name, routes), payload.description, payload.route);
}

export async function deleteSavedRoute(savedRoute: SavedRoute) {
  await runTransaction(db, async (transaction) => {
    const claimReference = doc(routeNameCollection(savedRoute.userId), nameClaimId(savedRoute.name));
    const claim = await transaction.get(claimReference);
    transaction.delete(doc(routeCollection(savedRoute.userId), savedRoute.id));
    if (claim.exists() && claim.data().routeId === savedRoute.id) transaction.delete(claimReference);
  });
  const files = await listAll(ref(storage, `users/${savedRoute.userId}/routes/${savedRoute.id}`));
  await Promise.all([
    ...files.items.map((item) => deleteObject(item)),
    ...files.prefixes.map(async (prefix) => {
      const nested = await listAll(prefix);
      await Promise.all(nested.items.map((item) => deleteObject(item)));
    }),
  ]).catch((error) => console.error("Unable to remove every saved route file:", error));
}
