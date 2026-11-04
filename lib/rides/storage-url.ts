import { isFirebaseEmulatorEnvironment, localFirebaseProjectId } from "@/lib/firebase-environment";

export function getRideStorageUrl(path: string) {
  const origin = isFirebaseEmulatorEnvironment
    ? "http://127.0.0.1:9199"
    : "https://firebasestorage.googleapis.com";
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    (isFirebaseEmulatorEnvironment ? `${localFirebaseProjectId}.firebasestorage.app` : undefined);

  return `${origin}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}
