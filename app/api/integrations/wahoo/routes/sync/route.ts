import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reconcileWahooRoutes } from "@/lib/routes/wahoo";

export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  try {
    return NextResponse.json(await reconcileWahooRoutes(user.uid));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync Wahoo routes.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
