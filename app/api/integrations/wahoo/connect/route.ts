import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWahooOAuthConfig } from "@/lib/rides/wahoo-oauth";
import {
  createWahooAuthorizationUrl,
  createWahooOAuthState,
  WAHOO_CALLBACK_PATH,
  WAHOO_STATE_COOKIE,
} from "@/lib/rides/wahoo-oauth-utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const config = getWahooOAuthConfig(request.url);
    const { state, cookieValue } = createWahooOAuthState(user.uid);
    const response = NextResponse.redirect(createWahooAuthorizationUrl(config.clientId, config.redirectUri, state));
    response.cookies.set(WAHOO_STATE_COOKIE, cookieValue, {
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "lax",
      maxAge: 10 * 60,
      path: WAHOO_CALLBACK_PATH,
    });
    return response;
  } catch (error) {
    console.error("Unable to start Wahoo authorization:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.redirect(new URL("/rides?wahoo=configuration_error", request.url));
  }
}
