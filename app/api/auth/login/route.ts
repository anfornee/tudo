import { adminAuth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const { idToken } = await request.json();

		if (!idToken) {
			return NextResponse.json(
				{ error: "Missing token" },
				{ status: 400 }
			);
		}

		const decodedToken = await adminAuth.verifyIdToken(idToken);

		const cookieStore = await cookies();

		cookieStore.set("session", idToken, {
			maxAge: 60 * 60,
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			path: "/",
			sameSite: "lax",
		});

		console.log("Authenticated user:", decodedToken.uid);

		return NextResponse.json({ status: "success" });
	} catch (error) {
		console.error("Authentication failed:", error);

		return NextResponse.json(
			{ error: "Unauthorized" },
			{ status: 401 }
		);
	}
}
