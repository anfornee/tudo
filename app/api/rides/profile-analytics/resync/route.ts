import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
	getAnalyticsResyncStatus,
	runAnalyticsResyncStep,
} from "@/lib/rides/analytics-resync-server";
import type { AnalyticsResyncMode } from "@/lib/rides/analytics-resync-model";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
	return NextResponse.json({ status: await getAnalyticsResyncStatus(user.uid) });
}

export async function POST(request: Request) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
	let startMode: AnalyticsResyncMode | undefined;
	try {
		const body = await request.json() as { mode?: unknown };
		if (body.mode === "update" || body.mode === "recalculate") startMode = body.mode;
	} catch {
		// An empty body resumes the persisted operation.
	}
	try {
		return NextResponse.json({
			status: await runAnalyticsResyncStep(user.uid, { startMode }),
		});
	} catch (error) {
		console.error("Analytics resync step failed", { userId: user.uid, error });
		return NextResponse.json({ error: "Analytics could not be updated." }, { status: 500 });
	}
}
