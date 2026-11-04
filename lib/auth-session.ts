import "server-only";

import { cookies } from "next/headers";

import { adminAuth } from "@/lib/firebase-admin";

export const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

export async function createSession(
  idToken: string,
  options: { requireRecentAuthentication: boolean },
) {
  const decodedToken = await adminAuth.verifyIdToken(idToken);

  if (
    options.requireRecentAuthentication &&
    decodedToken.auth_time &&
    Math.floor(Date.now() / 1000) - decodedToken.auth_time > 5 * 60
  ) {
    throw new Error("Recent authentication required");
  }

  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION_MS,
  });
  const cookieStore = await cookies();

  cookieStore.set("session", sessionCookie, {
    maxAge: SESSION_DURATION_MS / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
  });
}
