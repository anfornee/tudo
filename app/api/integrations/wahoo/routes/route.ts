import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { publishSavedRouteToWahoo } from "@/lib/routes/wahoo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 2_000) return NextResponse.json({ error: "Invalid route request." }, { status: 413 });
    const body: unknown = await request.json();
    const routeId = body && typeof body === "object" ? (body as Record<string, unknown>).routeId : null;
    if (typeof routeId !== "string") return NextResponse.json({ error: "A saved route is required." }, { status: 400 });
    const result = await publishSavedRouteToWahoo(user.uid, routeId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send this route to Wahoo.";
    console.error("Unable to publish Wahoo route:", message);
    const status = message.includes("could not be found") ? 404 : message.includes("Connect Wahoo") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
