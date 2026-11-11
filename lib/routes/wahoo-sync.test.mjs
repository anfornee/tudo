import test from "node:test";
import assert from "node:assert/strict";

const { fetchWahooVisibleRoutes, parseWahooRoutesResponse, resolveWahooSyncState } = await import("./wahoo-sync.ts");

test("normalizes only valid Wahoo route records", () => {
  assert.deepEqual(parseWahooRoutesResponse({ routes: [
    { id: 12, external_id: "tudo-route-a", provider_updated_at: "2026-01-01T00:00:00Z", name: "A" },
    { id: 0, name: "invalid" },
  ] }), [{ id: 12, externalId: "tudo-route-a", providerUpdatedAt: "2026-01-01T00:00:00Z", name: "A" }]);
});

test("fetches Wahoo routes through a mocked official API request", async () => {
  let authorization = "";
  const routes = await fetchWahooVisibleRoutes("token", async (_url, init) => {
    authorization = new Headers(init?.headers).get("Authorization") ?? "";
    return Response.json([{ id: 45, external_id: "tudo-route-b" }]);
  });
  assert.equal(authorization, "Bearer token");
  assert.equal(routes[0].id, 45);
  assert.equal(routes[0].externalId, "tudo-route-b");
});

test("surfaces missing read scope and detects safe conflict states", async () => {
  await assert.rejects(() => fetchWahooVisibleRoutes("token", async () => new Response("", { status: 403 })), /route reading access/);
  assert.equal(resolveWahooSyncState({ localRevision: 2, lastSyncedRevision: 1, previousRemoteUpdate: "2026-01-01T00:00:00Z", currentRemoteUpdate: "2026-01-02T00:00:00Z" }), "conflict");
  assert.equal(resolveWahooSyncState({ localRevision: 2, lastSyncedRevision: 1, previousRemoteUpdate: null, currentRemoteUpdate: null }), "pending");
  assert.equal(resolveWahooSyncState({ localRevision: 1, lastSyncedRevision: 1, previousRemoteUpdate: "2026-01-01T00:00:00Z", currentRemoteUpdate: "2026-01-02T00:00:00Z" }), "conflict");
});
