import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { processRideAnalytics } from "@/lib/rides/analytics-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ rideId: string }> },
) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
	const { rideId } = await params;
	let force = false;
	try {
		const body = await request.json() as { force?: unknown };
		force = body.force === true;
	} catch {
		// An empty request performs a normal current-version sync.
	}

	try {
		const outcome = await processRideAnalytics(user.uid, rideId, { force });
		return NextResponse.json({ outcome }, { status: outcome === "busy" ? 409 : 200 });
	} catch (error) {
		console.error("Ride analytics processing failed", { rideId, userId: user.uid, error });
		return NextResponse.json({ error: "Ride analytics could not be processed." }, { status: 500 });
	}
}
