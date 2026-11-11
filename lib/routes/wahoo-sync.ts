export interface WahooRemoteRoute {
  id: number;
  externalId: string | null;
  providerUpdatedAt: string | null;
  name: string | null;
}

export function parseWahooRoutesResponse(value: unknown): WahooRemoteRoute[] {
  const root = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const items = Array.isArray(value) ? value : Array.isArray(root.routes) ? root.routes : [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const route = item as Record<string, unknown>;
    const id = Number(route.id);
    if (!Number.isSafeInteger(id) || id <= 0) return [];
    return [{
      id,
      externalId: typeof route.external_id === "string" ? route.external_id : null,
      providerUpdatedAt: typeof route.provider_updated_at === "string" ? route.provider_updated_at : null,
      name: typeof route.name === "string" ? route.name : null,
    }];
  });
}

export function resolveWahooSyncState(input: {
  localRevision: number;
  lastSyncedRevision: number;
  previousRemoteUpdate: string | null;
  currentRemoteUpdate: string | null;
}) {
  const previousRemoteTime = input.previousRemoteUpdate ? Date.parse(input.previousRemoteUpdate) : NaN;
  const currentRemoteTime = input.currentRemoteUpdate ? Date.parse(input.currentRemoteUpdate) : NaN;
  const remoteChanged = Number.isFinite(previousRemoteTime) && Number.isFinite(currentRemoteTime) && currentRemoteTime > previousRemoteTime;
  const localChanged = input.localRevision !== input.lastSyncedRevision;
  return remoteChanged ? "conflict" : localChanged ? "pending" : "synced";
}

export async function fetchWahooVisibleRoutes(
  accessToken: string,
  request: typeof fetch = fetch,
) {
  const response = await request("https://api.wahooligan.com/v1/routes?per_page=200", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    if (response.status === 403) throw new Error("Wahoo did not grant route reading access. Reconnect Wahoo and retry.");
    if (response.status === 401) throw new Error("Your Wahoo connection expired. Reconnect Wahoo and retry.");
    throw new Error("Wahoo is temporarily unable to list Tudo routes.");
  }
  return parseWahooRoutesResponse(await response.json());
}
