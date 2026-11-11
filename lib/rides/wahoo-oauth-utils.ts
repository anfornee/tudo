import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const WAHOO_AUTHORIZE_URL = "https://api.wahooligan.com/oauth/authorize";
export const WAHOO_TOKEN_URL = "https://api.wahooligan.com/oauth/token";
export const WAHOO_USER_URL = "https://api.wahooligan.com/v1/user";
export const WAHOO_CALLBACK_PATH = "/api/integrations/wahoo/callback";
export const WAHOO_STATE_COOKIE = "wahoo_oauth_state";
export const WAHOO_SCOPES = ["user_read", "offline_data", "routes_read", "routes_write"] as const;

export interface WahooOAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
  scopes: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function secureEqual(left: string, right: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(left), digest(right));
}

export function createWahooOAuthState(uid: string) {
  const state = randomBytes(32).toString("base64url");
  return { state, cookieValue: `${uid}:${state}` };
}

export function validateWahooOAuthState(cookieValue: string | undefined, state: string, uid: string) {
  if (!cookieValue || !state) return false;
  return secureEqual(cookieValue, `${uid}:${state}`);
}

export function createWahooAuthorizationUrl(clientId: string, redirectUri: string, state: string) {
  const url = new URL(WAHOO_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: WAHOO_SCOPES.join(" "),
    response_type: "code",
    state,
  }).toString();
  return url;
}

export function parseWahooOAuthTokens(value: unknown): WahooOAuthTokens {
  if (!isRecord(value)) throw new Error("Invalid Wahoo token response");

  const accessToken = value.access_token;
  const refreshToken = value.refresh_token;
  const tokenType = value.token_type;
  const expiresIn = Number(value.expires_in);
  const scope = value.scope;

  if (
    typeof accessToken !== "string" || !accessToken ||
    typeof refreshToken !== "string" || !refreshToken ||
    !Number.isFinite(expiresIn) || expiresIn <= 0
  ) {
    throw new Error("Invalid Wahoo token response");
  }

  return {
    accessToken,
    refreshToken,
    tokenType: typeof tokenType === "string" && tokenType ? tokenType : "Bearer",
    expiresInSeconds: expiresIn,
    scopes: typeof scope === "string" ? scope.split(/\s+/).filter(Boolean) : [],
  };
}

export function parseWahooUserId(value: unknown) {
  if (!isRecord(value)) throw new Error("Invalid Wahoo user response");
  const id = typeof value.id === "string" ? Number(value.id) : value.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid Wahoo user response");
  }
  return id;
}
