import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getHistoricalRideComparison } from "@/lib/rides/historical-analytics-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ rideId: string }> },
) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
	const { rideId } = await params;
	return NextResponse.json(await getHistoricalRideComparison(user.uid, rideId));
}
