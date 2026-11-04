import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth-session";

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as { idToken?: unknown };

		if (typeof body.idToken !== "string" || !body.idToken) {
			return NextResponse.json(
				{ error: "Missing token" },
				{ status: 400 }
			);
		}

		await createSession(body.idToken, { requireRecentAuthentication: true });

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
