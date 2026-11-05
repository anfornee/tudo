export function formatRouteDistance(meters: number, units: "imperial" | "metric") {
  return units === "imperial"
    ? `${(meters / 1609.344).toFixed(meters < 16_093 ? 1 : 0)} mi`
    : `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

export function formatRouteElevation(meters: number | null, units: "imperial" | "metric") {
  if (meters === null) return "Unavailable";
  return units === "imperial" ? `${Math.round(meters * 3.28084)} ft` : `${Math.round(meters)} m`;
}

export function formatRouteDuration(seconds: number | null) {
  if (seconds === null) return "Unavailable";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.max(1, Math.round((seconds % 3600) / 60));
  return hours ? `${hours} hr ${minutes} min` : `${minutes} min`;
}
