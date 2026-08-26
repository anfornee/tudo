import { adminAuth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

export async function getCurrentUser() {
	const cookieStore = await cookies();
	const session = cookieStore.get("session")?.value;

	if (!session) {
		return null;
	}

	try {
		return await adminAuth.verifySessionCookie(session);
	} catch {
		return null;
	}
}