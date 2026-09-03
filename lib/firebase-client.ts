import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import {
  isFirebaseEmulatorEnvironment,
  localFirebaseProjectId,
} from "@/lib/firebase-environment";

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    (isFirebaseEmulatorEnvironment ? "local-emulator-key" : undefined),
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    (isFirebaseEmulatorEnvironment
      ? `${localFirebaseProjectId}.firebaseapp.com`
      : undefined),
  projectId: isFirebaseEmulatorEnvironment
    ? localFirebaseProjectId
    : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    (isFirebaseEmulatorEnvironment
      ? `${localFirebaseProjectId}.firebasestorage.app`
      : undefined),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const globalFirebase = globalThis as typeof globalThis & {
  __tudoFirebaseEmulatorsConnected?: boolean;
};

if (
  isFirebaseEmulatorEnvironment &&
  !globalFirebase.__tudoFirebaseEmulatorsConnected
) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  globalFirebase.__tudoFirebaseEmulatorsConnected = true;
}

export { app as firebaseApp, auth, db, storage };
