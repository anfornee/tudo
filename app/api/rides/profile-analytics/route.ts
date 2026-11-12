import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
	getProfileAnalytics,
	runProfileAnalyticsRebuild,
} from "@/lib/rides/profile-analytics-server";
import { calendarYearForDate } from "@/lib/rides/profile-analytics";

export const runtime = "nodejs";
export const maxDuration = 60;

function isoTimestamp(value: unknown) {
	return value && typeof value === "object" && "toDate" in value
		&& typeof value.toDate === "function"
		? (value.toDate as () => Date)().toISOString()
		: null;
}

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
	const result = await getProfileAnalytics(user.uid);
	const timeZone = result.profile?.calendarTimeZone ?? "UTC";
	const currentYear = calendarYearForDate(new Date().toISOString(), timeZone);
	return NextResponse.json({
		...result,
		profile: result.profile ? {
			...result.profile,
			calculatedAt: isoTimestamp(result.profile.calculatedAt),
		} : null,
		rebuild: {
			...result.rebuild,
			lastAttemptedAt: isoTimestamp(result.rebuild.lastAttemptedAt),
			lastCompletedAt: isoTimestamp(result.rebuild.lastCompletedAt),
		},
		currentYear: currentYear ? {
			year: currentYear,
			statistics: result.profile?.annual[currentYear] ?? null,
		} : null,
	});
}

export async function POST(request: Request) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
	let force = false;
	let maximumBatches = 3;
	try {
		const body = await request.json() as { force?: unknown; maximumBatches?: unknown };
		force = body.force === true;
		if (typeof body.maximumBatches === "number" && Number.isInteger(body.maximumBatches)) {
			maximumBatches = body.maximumBatches;
		}
	} catch {
		// Defaults perform a normal bounded reconciliation.
	}
	try {
		return NextResponse.json(await runProfileAnalyticsRebuild(user.uid, { force, maximumBatches }));
	} catch (error) {
		console.error("Profile analytics rebuild failed", { userId: user.uid, error });
		return NextResponse.json({ error: "Profile analytics could not be rebuilt." }, { status: 500 });
	}
}
