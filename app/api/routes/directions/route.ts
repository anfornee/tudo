import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  adaptOpenRouteServiceResponse,
  openRouteServiceRequestBody,
  validateRouteCalculationRequest,
} from "@/lib/routes/openrouteservice";

export const runtime = "nodejs";

const OPENROUTESERVICE_DIRECTIONS_URL = "https://api.heigit.org/openrouteservice/v2/directions/cycling-road/geojson";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Route planning is not configured on this deployment." }, { status: 503 });

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 64_000) return NextResponse.json({ error: "The route request is too large." }, { status: 413 });
    const routeRequest = validateRouteCalculationRequest(await request.json());
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    request.signal.addEventListener("abort", () => controller.abort(), { once: true });
    let response: Response;
    try {
      response = await fetch(OPENROUTESERVICE_DIRECTIONS_URL, {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
          Accept: "application/geo+json, application/json",
        },
        body: JSON.stringify(openRouteServiceRequestBody(routeRequest)),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const status = response.status === 429 ? 429 : response.status >= 500 ? 502 : 422;
      const message = response.status === 429
        ? "The routing service rate limit was reached. Please wait and try again."
        : status === 422
          ? "Those points could not be connected by a road-cycling route."
          : "The routing service is temporarily unavailable.";
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(adaptOpenRouteServiceResponse(await response.json(), routeRequest.waypoints, routeRequest.preferences));
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Route calculation timed out." }, { status: 504 });
    }
    const message = error instanceof Error ? error.message : "Unable to calculate this route.";
    console.error("Road route calculation failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
