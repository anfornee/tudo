import "server-only";

import {
  parseWahooOAuthTokens,
  parseWahooUserId,
  WAHOO_CALLBACK_PATH,
  WAHOO_TOKEN_URL,
  WAHOO_USER_URL,
} from "@/lib/rides/wahoo-oauth-utils";

export interface WahooOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface WahooClientCredentials {
  clientId: string;
  clientSecret: string;
}

export function getWahooClientCredentials(): WahooClientCredentials {
  const clientId = process.env.WAHOO_CLIENT_ID?.trim();
  const clientSecret = process.env.WAHOO_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Wahoo OAuth is not configured");
  return { clientId, clientSecret };
}

function validRedirectUri(value: string) {
  const url = URL.canParse(value) ? new URL(value) : null;
  if (!url || url.username || url.password || url.search || url.hash) return false;
  if (url.pathname !== WAHOO_CALLBACK_PATH) return false;
  return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
}

export function getWahooOAuthConfig(requestUrl: string): WahooOAuthConfig {
  const { clientId, clientSecret } = getWahooClientCredentials();
  const redirectUri = process.env.WAHOO_REDIRECT_URI?.trim() || new URL(WAHOO_CALLBACK_PATH, requestUrl).toString();

  if (!validRedirectUri(redirectUri)) {
    throw new Error("Wahoo OAuth is not configured");
  }

  return { clientId, clientSecret, redirectUri };
}

export async function refreshWahooOAuthTokens(credentials: WahooClientCredentials, refreshToken: string) {
  const response = await fetch(WAHOO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`Wahoo token refresh failed (${response.status})`);
  return parseWahooOAuthTokens(await response.json());
}

export async function exchangeWahooAuthorizationCode(config: WahooOAuthConfig, code: string) {
  const response = await fetch(WAHOO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`Wahoo token exchange failed (${response.status})`);
  return parseWahooOAuthTokens(await response.json());
}

export async function fetchWahooUserId(accessToken: string) {
  const response = await fetch(WAHOO_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`Wahoo user request failed (${response.status})`);
  return parseWahooUserId(await response.json());
}
