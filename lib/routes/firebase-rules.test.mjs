import test from "node:test";
import assert from "node:assert/strict";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc, connectFirestoreEmulator } from "firebase/firestore";
import { connectStorageEmulator, deleteObject, getBytes, getStorage, ref, uploadBytes } from "firebase/storage";

const projectId = "demo-tudo";

async function client(name) {
  const app = initializeApp({ apiKey: "demo-key", authDomain: "localhost", projectId, storageBucket: `${projectId}.appspot.com` }, name);
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const storage = getStorage(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  const credential = await signInAnonymously(auth);
  return { app, firestore, storage, uid: credential.user.uid };
}

test("route summaries and sidecars are owner-only", async () => {
  const owner = await client("route-owner");
  const stranger = await client("route-stranger");
  const routeId = "ownership-test";
  const filePath = `users/${owner.uid}/routes/${routeId}/revisions/revision.json`;
  const summary = {
    userId: owner.uid,
    name: "Ownership test",
    description: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    routeFilePath: filePath,
    distanceMeters: 1000,
    durationSeconds: 300,
    elevationGainMeters: null,
    elevationLossMeters: null,
    waypointCount: 2,
    provider: "openrouteservice",
    profile: "cycling-road",
    startLatitude: 38,
    startLongitude: -77,
  };
  const ownerDocument = doc(owner.firestore, "users", owner.uid, "routes", routeId);
  const strangerDocument = doc(stranger.firestore, "users", owner.uid, "routes", routeId);
  const ownerFile = ref(owner.storage, filePath);
  const strangerFile = ref(stranger.storage, filePath);

  try {
    await setDoc(ownerDocument, summary);
    assert.equal((await getDoc(ownerDocument)).exists(), true);
    await assert.rejects(() => getDoc(strangerDocument), /permission|insufficient/i);

    await uploadBytes(ownerFile, new TextEncoder().encode('{"version":1}'), { contentType: "application/json" });
    assert.equal(new TextDecoder().decode(await getBytes(ownerFile)), '{"version":1}');
    await assert.rejects(() => getBytes(strangerFile), /unauthorized|permission/i);
  } finally {
    await deleteObject(ownerFile).catch(() => {});
    await deleteDoc(ownerDocument).catch(() => {});
    await Promise.all([deleteApp(owner.app), deleteApp(stranger.app)]);
  }
});
