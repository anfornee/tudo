function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function isFirebaseInfrastructureError(code: string) {
  return code.startsWith("storage/") || [
    "permission-denied",
    "unauthenticated",
    "unavailable",
    "deadline-exceeded",
    "resource-exhausted",
    "failed-precondition",
  ].includes(code);
}

export function routeErrorMessage(error: unknown, fallback: string, context: string) {
  const code = errorCode(error);
  if (!code || !isFirebaseInfrastructureError(code)) {
    return error instanceof Error ? error.message : fallback;
  }

  console.error(`${context}:`, error);

  if (code === "storage/canceled") return "The route upload was canceled.";
  if (code === "storage/retry-limit-exceeded" || code === "unavailable" || code === "deadline-exceeded") {
    return "The route service is temporarily unavailable. Check your connection and try again.";
  }
  if (code === "storage/quota-exceeded" || code === "resource-exhausted") {
    return "Route storage is temporarily full. Please try again later.";
  }
  if (code === "storage/unauthenticated" || code === "unauthenticated") {
    return "Your session expired. Sign in again, then retry the route upload.";
  }
  if (code === "storage/unauthorized" || code === "permission-denied") {
    return "We couldn’t save the route file right now. Please try again later.";
  }
  return fallback;
}
