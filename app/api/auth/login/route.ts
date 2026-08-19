import { adminAuth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    
    // Set session expiration to 5 days (in milliseconds for Firebase)
    const expiresIn = 60 * 60 * 24 * 5 * 1000; 
    
    // Create the session cookie using Firebase Admin
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    
    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      maxAge: expiresIn / 1000, // FIXED: Next.js expects seconds here
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error) {
    console.error("Firebase Auth Error:", error); 
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
