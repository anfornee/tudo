import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
	try {
		const cookieStore = await cookies();

		cookieStore.delete("session");

		return NextResponse.json({ status: "success" }, { status: 200 });
	} catch (error) {
		console.error("Logout failed:", error);

		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}