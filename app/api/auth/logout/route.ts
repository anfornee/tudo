import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function clearSessionCookie() {
	const cookieStore = await cookies();
	cookieStore.delete("session");
}

export async function GET(request: Request) {
	await clearSessionCookie();

	return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST() {
	try {
		await clearSessionCookie();

		return NextResponse.json({ status: "success" }, { status: 200 });
	} catch (error) {
		console.error("Logout failed:", error);

		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}
