import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getHistoricalAnalytics } from "@/lib/rides/historical-analytics-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
	return NextResponse.json(await getHistoricalAnalytics(user.uid));
}
