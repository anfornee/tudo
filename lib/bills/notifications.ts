"use client";

import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getMessaging, getToken } from "firebase/messaging";
import { db, firebaseApp } from "@/lib/firebase-client";

export async function enableBillNotifications(userId: string) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) throw new Error("Notifications are not supported on this device.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error("Bill notifications are not configured yet.");
  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(firebaseApp), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Unable to register this device for notifications.");
  const tokenId = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)).then((hash) => Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join(""));
  await Promise.all([
    setDoc(doc(db, "users", userId, "notificationTokens", tokenId), { token, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    setDoc(doc(db, "users", userId, "preferences", "notifications"), { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, updatedAt: serverTimestamp() }, { merge: true }),
  ]);
  return tokenId;
}

export async function disableBillNotifications(userId: string, tokenId: string) {
  await deleteDoc(doc(db, "users", userId, "notificationTokens", tokenId));
}
