import "server-only";

import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { adminAuth } from "@/lib/firebase-admin";
import { getValidWahooAccessToken } from "@/lib/rides/wahoo-connection";
import { encodeRouteAsFitCourse } from "@/lib/routes/fit-course";
import { loadServerSavedRoute } from "@/lib/routes/server";

const WAHOO_ROUTES_URL = "https://api.wahooligan.com/v1/routes";

interface WahooRouteResponse {
  id: number;
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
  if (route.elevationGainMeters === null) {
    throw new Error("Wahoo requires an elevation gain value. Recalculate and save this route before sending it.");
  }

  const integration = routeIntegrationDocument(userId, routeId);
  const existing = await integration.get();
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

  const accessToken = await getValidWahooAccessToken(userId);
  const url = update ? `${WAHOO_ROUTES_URL}/${existingWahooRouteId}` : WAHOO_ROUTES_URL;
  const result = await sendRouteRequest(url, update ? "PUT" : "POST", accessToken, body);
  await integration.set({
    provider: "wahoo",
    routeId,
    externalId,
    wahooRouteId: result.id,
    publishedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { wahooRouteId: result.id, updated: update };
}
