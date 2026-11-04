import type { User } from "firebase/auth";

const LAST_SESSION_REFRESH_KEY = "tudo:auth:last-session-refresh";
const SESSION_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function readLastRefresh() {
  try {
    const value = Number(window.localStorage.getItem(LAST_SESSION_REFRESH_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function sessionRefreshIsDue(now = Date.now()) {
  const lastRefresh = readLastRefresh();
  return lastRefresh === null || now - lastRefresh >= SESSION_REFRESH_INTERVAL_MS;
}

export function markSessionRefreshed(now = Date.now()) {
  try {
    window.localStorage.setItem(LAST_SESSION_REFRESH_KEY, String(now));
  } catch {
    // The server session still works when local storage is unavailable.
  }
}

export async function refreshServerSession(user: User) {
  const idToken = await user.getIdToken();
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    throw new Error("Unable to refresh your session.");
  }

  markSessionRefreshed();
}
