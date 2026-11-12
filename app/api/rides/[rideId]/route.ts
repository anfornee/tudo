import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { deleteRideOnServer } from "@/lib/rides/ride-server-persistence";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ rideId: string }> },
) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
	const { rideId } = await params;
	try {
		const deleted = await deleteRideOnServer(user.uid, rideId);
		return NextResponse.json({ deleted });
	} catch (error) {
		console.error("Unable to delete ride", { userId: user.uid, rideId, error });
		return NextResponse.json({ error: "Unable to delete this ride." }, { status: 500 });
	}
}
