import { adminAuth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SESSION_DURATION = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function POST(request: Request) {
	try {
		const { idToken } = await request.json();

		if (!idToken) {
			return NextResponse.json(
				{ error: "Missing token" },
				{ status: 400 }
			);
		}

		// Optional but recommended:
		// verify the user authenticated recently before issuing a long-lived session.
		const decodedToken = await adminAuth.verifyIdToken(idToken);

		const now = Math.floor(Date.now() / 1000);

		if (
			decodedToken.auth_time &&
			now - decodedToken.auth_time > 5 * 60
		) {
			return NextResponse.json(
				{ error: "Recent authentication required" },
				{ status: 401 }
			);
		}

		const sessionCookie = await adminAuth.createSessionCookie(idToken, {
			expiresIn: SESSION_DURATION,
		});

		const cookieStore = await cookies();

		cookieStore.set("session", sessionCookie, {
			maxAge: SESSION_DURATION / 1000,
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			path: "/",
			sameSite: "lax",
		});

		return NextResponse.json(
			{ status: "success" },
			{ status: 200 }
		);
	} catch (error) {
		console.error("Session creation failed:", error);

		return NextResponse.json(
			{ error: "Unauthorized" },
			{ status: 401 }
		);
	}
}