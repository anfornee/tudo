"use client";

import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
} from "firebase/messaging";
import { db, firebaseApp } from "@/lib/firebase-client";

const TOKEN_STORAGE_KEY = "tudo-bill-notification-token";
const LAST_REFRESH_STORAGE_KEY = "tudo:notifications:last-registration-refresh";
const REGISTRATION_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

function isIosBrowserTab() {
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone =
    navigatorWithStandalone.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  return isIos && !isStandalone;
}

function readStoredTokenId() {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeRegistration(tokenId: string) {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, tokenId);
    window.localStorage.setItem(LAST_REFRESH_STORAGE_KEY, String(Date.now()));
  } catch {
    // The Firestore registration remains valid when local storage is unavailable.
  }
}

async function tokenHash(token: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function registerDevice(userId: string) {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

  if (!vapidKey) {
    throw new Error("Bill notifications are not configured yet.");
  }

  if (!(await isSupported())) {
    throw new Error("Notifications are not supported on this device.");
  }

  const registration = await navigator.serviceWorker.ready;
  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error("Unable to register this device for notifications.");
  }

  const tokenId = await tokenHash(token);
  const tokenRef = doc(db, "users", userId, "notificationTokens", tokenId);
  const existingToken = await getDoc(tokenRef);

  await Promise.all([
    setDoc(tokenRef, {
      token,
      createdAt: existingToken.data()?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    setDoc(
      doc(db, "users", userId, "preferences", "notifications"),
      {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  ]);

  const previousTokenId = readStoredTokenId();
  storeRegistration(tokenId);

  if (previousTokenId && previousTokenId !== tokenId) {
    await deleteDoc(
      doc(db, "users", userId, "notificationTokens", previousTokenId),
    ).catch(() => undefined);
  }

  return tokenId;
}

export async function enableBillNotifications(userId: string) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Notifications are not supported on this device.");
  }

  if (isIosBrowserTab()) {
    throw new Error(
      "Install Tudo on your Home Screen before enabling notifications.",
    );
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  return registerDevice(userId);
}

export function notificationRegistrationRefreshIsDue(now = Date.now()) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted" ||
    !process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  ) {
    return false;
  }

  try {
    const lastRefresh = Number(
      window.localStorage.getItem(LAST_REFRESH_STORAGE_KEY),
    );
    return !Number.isFinite(lastRefresh) ||
      lastRefresh <= 0 ||
      now - lastRefresh >= REGISTRATION_REFRESH_INTERVAL_MS;
  } catch {
    return true;
  }
}

export async function refreshBillNotificationRegistration(userId: string) {
  if (
    !("Notification" in window) ||
    Notification.permission !== "granted" ||
    !("serviceWorker" in navigator)
  ) {
    return null;
  }

  return registerDevice(userId);
}

export async function disableBillNotifications(userId: string) {
  const tokenId = readStoredTokenId();

  try {
    if (await isSupported()) {
      await deleteToken(getMessaging(firebaseApp));
    }
  } finally {
    if (tokenId) {
      await deleteDoc(doc(db, "users", userId, "notificationTokens", tokenId));
    }

    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(LAST_REFRESH_STORAGE_KEY);
    } catch {
      // Nothing else to clean up locally.
    }
  }
}
