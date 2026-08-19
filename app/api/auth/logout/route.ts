import { adminAuth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (sessionCookie) {
      // 1. Decode the cookie to find the user's Firebase UID
      const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
      
      // 2. Tell Firebase to invalidate all active sessions for this user
      await adminAuth.revokeRefreshTokens(decodedClaims.sub);
    }
  } catch (error) {
    // If the cookie was already expired or invalid, fail silently and proceed to delete it
    console.error("Failed to revoke Firebase session:", error);
  }

  // 3. Clear the cookie from the browser regardless
  const cookieStore = await cookies();
  cookieStore.delete("session");
  
  return NextResponse.json({ status: "success" }, { status: 200 });
}
