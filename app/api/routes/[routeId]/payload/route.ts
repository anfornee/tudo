import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadServerRoutePayload } from "@/lib/routes/server";

export const runtime = "nodejs";

const publicErrors = new Set([
  "Invalid saved route.",
  "This saved route could not be found.",
  "This saved route is invalid.",
  "This saved route could not be loaded.",
  "This saved route is too large to load.",
  "This saved route uses an unsupported format.",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ routeId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  try {
    const { routeId } = await params;
    const payload = await loadServerRoutePayload(user.uid, routeId);
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Saved route payload request failed:", error);
    const message = error instanceof Error && publicErrors.has(error.message)
      ? error.message
      : "Unable to load this saved route.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
