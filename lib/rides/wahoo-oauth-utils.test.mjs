import test from "node:test";
import assert from "node:assert/strict";

const {
  createWahooAuthorizationUrl,
  createWahooOAuthState,
  parseWahooOAuthTokens,
  parseWahooUserId,
  validateWahooOAuthState,
} = await import("./wahoo-oauth-utils.ts");

test("creates a Wahoo authorization URL with only the required scopes", () => {
  const url = createWahooAuthorizationUrl("client-id", "https://tudo.example/api/integrations/wahoo/callback", "state");
  assert.equal(url.origin, "https://api.wahooligan.com");
  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "user_read offline_data routes_read routes_write");
  assert.equal(url.searchParams.get("state"), "state");
});

test("binds OAuth state to the initiating Tudo user", () => {
  const { state, cookieValue } = createWahooOAuthState("tudo-user");
  assert.equal(validateWahooOAuthState(cookieValue, state, "tudo-user"), true);
  assert.equal(validateWahooOAuthState(cookieValue, state, "another-user"), false);
  assert.equal(validateWahooOAuthState(cookieValue, `${state}x`, "tudo-user"), false);
});

test("normalizes token and user responses without accepting incomplete credentials", () => {
  assert.deepEqual(parseWahooOAuthTokens({
    access_token: "access",
    refresh_token: "refresh",
    expires_in: 7200,
    scope: "user_read offline_data",
    token_type: "Bearer",
  }), {
    accessToken: "access",
    refreshToken: "refresh",
    expiresInSeconds: 7200,
    scopes: ["user_read", "offline_data"],
    tokenType: "Bearer",
  });
  assert.equal(parseWahooUserId({ id: "123" }), 123);
  assert.throws(() => parseWahooOAuthTokens({ access_token: "access" }));
  assert.throws(() => parseWahooUserId({ id: 0 }));
});
