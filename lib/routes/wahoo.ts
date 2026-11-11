import "server-only";

import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { adminAuth } from "@/lib/firebase-admin";
import { getValidWahooAccessToken } from "@/lib/rides/wahoo-connection";
import { encodeRouteAsFitCourse } from "@/lib/routes/fit-course";
import { loadServerSavedRoute } from "@/lib/routes/server";
import { fetchWahooVisibleRoutes, resolveWahooSyncState } from "@/lib/routes/wahoo-sync";

const WAHOO_ROUTES_URL = "https://api.wahooligan.com/v1/routes";

interface WahooRouteResponse {
  id: number;
}

export interface WahooRouteStatus {
  status: "not_synced" | "synced" | "pending" | "failed" | "conflict";
  wahooRouteId: number | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
}

function routeIntegrationDocument(userId: string, routeId: string) {
  return getFirestore(adminAuth.app)
    .collection("users")
    .doc(userId)
    .collection("privateRouteIntegrations")
    .doc(routeId);
}

function readableFitFilename(name: string) {
  const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return `${normalized || "tudo-route"}.fit`;
}

function parseWahooRoute(value: unknown): WahooRouteResponse {
  if (!value || typeof value !== "object") throw new Error("Wahoo returned an invalid route response.");
  const id = Number((value as Record<string, unknown>).id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Wahoo returned an invalid route response.");
  return { id };
}

async function sendRouteRequest(url: string, method: "POST" | "PUT", accessToken: string, body: URLSearchParams) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    console.error(`Wahoo route ${method} failed (${response.status}):`, detail);
    if (response.status === 401) throw new Error("Your Wahoo connection expired. Connect Wahoo again and retry.");
    if (response.status === 403) throw new Error("Wahoo did not grant route publishing access. Reconnect Wahoo and retry.");
    if (response.status === 422) throw new Error("Wahoo could not accept this route. Check its name and route data, then retry.");
    if (response.status === 429) throw new Error("Wahoo's rate limit was reached. Wait a moment and retry.");
    throw new Error("Wahoo is temporarily unable to accept this route.");
  }
  return parseWahooRoute(await response.json());
}

export async function publishSavedRouteToWahoo(userId: string, routeId: string) {
  const saved = await loadServerSavedRoute(userId, routeId);
  const { route } = saved.payload;
  if (route.segmentStartIndices.length > 1) {
    throw new Error("Wahoo publishing requires one continuous route. Open this imported route in the planner and save a continuous version first.");
  }
  if (route.elevationGainMeters === null) {
    throw new Error("Wahoo requires an elevation gain value. Recalculate and save this route before sending it.");
  }

  const integration = routeIntegrationDocument(userId, routeId);
  const existing = await integration.get();
  if (existing.data()?.syncStatus === "conflict") {
    throw new Error("This route has a Wahoo conflict. Duplicate the Tudo route to publish a safe copy without overwriting either version.");
  }
  const existingWahooRouteId = Number(existing.data()?.wahooRouteId);
  const update = Number.isSafeInteger(existingWahooRouteId) && existingWahooRouteId > 0;
  const fit = encodeRouteAsFitCourse(route, saved.name, saved.updatedAt);
  const start = route.geometry[0].coordinate;
  const externalId = `tudo-route-${routeId}`;
  const body = new URLSearchParams({
    "route[file]": `data:application/vnd.fit;base64,${Buffer.from(fit).toString("base64")}`,
    "route[filename]": readableFitFilename(saved.name),
    "route[provider_updated_at]": saved.updatedAt.toISOString(),
    "route[name]": saved.name,
    "route[description]": saved.description,
    "route[workout_type_family_id]": "0",
    "route[start_lat]": String(start[1]),
    "route[start_lng]": String(start[0]),
    "route[distance]": String(route.distanceMeters),
    "route[ascent]": String(route.elevationGainMeters),
  });
  if (!update) body.set("route[external_id]", externalId);
  if (route.elevationLossMeters !== null) body.set("route[descent]", String(route.elevationLossMeters));

  try {
    const accessToken = await getValidWahooAccessToken(userId);
    const url = update ? `${WAHOO_ROUTES_URL}/${existingWahooRouteId}` : WAHOO_ROUTES_URL;
    const result = await sendRouteRequest(url, update ? "PUT" : "POST", accessToken, body);
    await integration.set({
      provider: "wahoo",
      routeId,
      externalId,
      wahooRouteId: result.id,
      lastSyncedRevision: saved.revision,
      syncDirection: "outbound",
      syncStatus: "synced",
      lastError: null,
      lastSuccessfulSyncAt: FieldValue.serverTimestamp(),
      remoteProviderUpdatedAt: saved.updatedAt.toISOString(),
      publishedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { wahooRouteId: result.id, updated: update };
  } catch (error) {
    await integration.set({
      provider: "wahoo",
      routeId,
      externalId,
      syncStatus: "failed",
      lastError: error instanceof Error ? error.message : "Unable to send this route to Wahoo.",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    throw error;
  }
}

function timestampIso(value: unknown) {
  return value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function"
    ? value.toDate().toISOString()
    : null;
}

export async function getWahooRouteStatuses(userId: string): Promise<Record<string, WahooRouteStatus>> {
  const database = getFirestore(adminAuth.app);
  const [routes, integrations] = await Promise.all([
    database.collection("users").doc(userId).collection("routes").get(),
    database.collection("users").doc(userId).collection("privateRouteIntegrations").get(),
  ]);
  const revisions = new Map(routes.docs.map((document) => [document.id, Number(document.data().revision) || 1]));
  return Object.fromEntries(integrations.docs.flatMap((document) => {
    const value = document.data();
    if (value.provider !== "wahoo" || !revisions.has(document.id)) return [];
    const stored = String(value.syncStatus ?? "synced");
    const status: WahooRouteStatus["status"] = stored === "failed" || stored === "conflict"
      ? stored
      : Number(value.lastSyncedRevision) === revisions.get(document.id) ? "synced" : "pending";
    const remoteId = Number(value.wahooRouteId);
    return [[document.id, {
      status,
      wahooRouteId: Number.isSafeInteger(remoteId) && remoteId > 0 ? remoteId : null,
      lastSuccessfulSyncAt: timestampIso(value.lastSuccessfulSyncAt),
      lastError: typeof value.lastError === "string" ? value.lastError : null,
    } satisfies WahooRouteStatus]];
  }));
}

export async function reconcileWahooRoutes(userId: string) {
  const accessToken = await getValidWahooAccessToken(userId);
  const remoteRoutes = await fetchWahooVisibleRoutes(accessToken);
  const remoteById = new Map(remoteRoutes.map((route) => [route.id, route]));
  const remoteByExternalId = new Map(remoteRoutes.flatMap((route) => route.externalId ? [[route.externalId, route] as const] : []));
  const database = getFirestore(adminAuth.app);
  const [routes, integrations] = await Promise.all([
    database.collection("users").doc(userId).collection("routes").get(),
    database.collection("users").doc(userId).collection("privateRouteIntegrations").get(),
  ]);
  const batch = database.batch();
  let reconciled = 0;
  let conflicts = 0;

  for (const routeDocument of routes.docs) {
    const integration = integrations.docs.find((document) => document.id === routeDocument.id);
    const value = integration?.data() ?? {};
    const remoteId = Number(value.wahooRouteId);
    const remote = (Number.isSafeInteger(remoteId) ? remoteById.get(remoteId) : undefined) ?? remoteByExternalId.get(`tudo-route-${routeDocument.id}`);
    if (!integration && !remote) continue;
    const reference = routeIntegrationDocument(userId, routeDocument.id);
    if (!remote) {
      batch.set(reference, { syncStatus: "conflict", lastError: "The Wahoo route is no longer available. Duplicate the Tudo route to publish a safe copy.", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      conflicts += 1;
      continue;
    }
    const localRevision = Number(routeDocument.data().revision) || 1;
    const lastSyncedRevision = Number(value.lastSyncedRevision) || 0;
    const syncStatus = resolveWahooSyncState({
      localRevision,
      lastSyncedRevision,
      previousRemoteUpdate: typeof value.remoteProviderUpdatedAt === "string" ? value.remoteProviderUpdatedAt : null,
      currentRemoteUpdate: remote.providerUpdatedAt,
    });
    if (syncStatus === "conflict") conflicts += 1;
    batch.set(reference, {
      provider: "wahoo",
      routeId: routeDocument.id,
      externalId: `tudo-route-${routeDocument.id}`,
      wahooRouteId: remote.id,
      remoteName: remote.name,
      syncDirection: integration ? value.syncDirection ?? "outbound" : "reconcile",
      syncStatus,
      lastError: syncStatus === "conflict" ? "This route changed in both Tudo and Wahoo. Choose which copy to keep before syncing again." : null,
      remoteProviderUpdatedAt: remote.providerUpdatedAt ?? value.remoteProviderUpdatedAt ?? null,
      lastReconciledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    reconciled += 1;
  }
  await batch.commit();
  return { reconciled, conflicts, visibleRemoteRoutes: remoteRoutes.length };
}
