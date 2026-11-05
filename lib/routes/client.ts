"use client";

import { parsePlannedRoute } from "@/lib/routes/model";
import type { RouteCalculationRequest } from "@/lib/routes/types";

export async function calculateRoadCyclingRoute(request: RouteCalculationRequest, signal: AbortSignal) {
  const response = await fetch("/api/routes/directions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = result && typeof result === "object" && "error" in result && typeof result.error === "string"
      ? result.error
      : "Unable to calculate this route.";
    throw new Error(error);
  }
  const route = parsePlannedRoute(result);
  if (!route) throw new Error("The routing service returned an unsupported response.");
  return route;
}
