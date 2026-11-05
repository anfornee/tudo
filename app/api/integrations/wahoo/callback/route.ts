import type { DecodedIdToken } from "firebase-admin/auth";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  saveWahooConnection,
  WahooConnectionConflictError,
} from "@/lib/rides/wahoo-connection";
import {
  exchangeWahooAuthorizationCode,
  fetchWahooUserId,
  getWahooOAuthConfig,
} from "@/lib/rides/wahoo-oauth";
import {
  validateWahooOAuthState,
  WAHOO_CALLBACK_PATH,
  WAHOO_STATE_COOKIE,
} from "@/lib/rides/wahoo-oauth-utils";

export const runtime = "nodejs";

type WahooResult = "connected" | "authorization_denied" | "invalid_state" | "account_in_use" | "connection_failed";

function clearStateCookie(request: NextRequest, response: NextResponse) {
  response.cookies.set(WAHOO_STATE_COOKIE, "", {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    maxAge: 0,
    path: WAHOO_CALLBACK_PATH,
  });
  return response;
}

function ridesRedirect(request: NextRequest, result: WahooResult) {
  return clearStateCookie(request, NextResponse.redirect(new URL(`/rides?wahoo=${result}`, request.url)));
}

function loginRedirect(request: NextRequest) {
  return clearStateCookie(request, NextResponse.redirect(new URL("/login", request.url)));
}

function validCallback(request: NextRequest, user: DecodedIdToken) {
  const state = request.nextUrl.searchParams.get("state") ?? "";
  return validateWahooOAuthState(request.cookies.get(WAHOO_STATE_COOKIE)?.value, state, user.uid);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return loginRedirect(request);
  if (!validCallback(request, user)) return ridesRedirect(request, "invalid_state");
  if (request.nextUrl.searchParams.has("error")) return ridesRedirect(request, "authorization_denied");

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return ridesRedirect(request, "connection_failed");

  try {
    const config = getWahooOAuthConfig(request.url);
    const tokens = await exchangeWahooAuthorizationCode(config, code);
    const wahooUserId = await fetchWahooUserId(tokens.accessToken);
    await saveWahooConnection(user.uid, wahooUserId, tokens);
    return ridesRedirect(request, "connected");
  } catch (error) {
    if (error instanceof WahooConnectionConflictError) {
      return ridesRedirect(request, "account_in_use");
    }
    console.error("Wahoo authorization failed:", error instanceof Error ? error.message : "Unknown error");
    return ridesRedirect(request, "connection_failed");
  }
}
