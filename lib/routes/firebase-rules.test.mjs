import test from "node:test";
import assert from "node:assert/strict";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc, writeBatch, connectFirestoreEmulator } from "firebase/firestore";
import { connectStorageEmulator, deleteObject, getBytes, getStorage, ref, uploadBytes } from "firebase/storage";

const projectId = "demo-tudo";

function validRouteSummary(uid, routeId, name = "Ownership test") {
  return {
    userId: uid,
    name,
    normalizedName: name.toLowerCase(),
    description: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    routeFilePath: `users/${uid}/routes/${routeId}/revisions/revision.json`,
    originalFilePath: null,
    originalFileName: null,
    sourceFingerprint: null,
    distanceMeters: 1000,
    durationSeconds: 300,
    elevationGainMeters: null,
    elevationLossMeters: null,
    waypointCount: 2,
    segmentCount: 1,
    revision: 1,
    previewPath: "M50,50 L950,950",
    source: "tudo",
    sourceLabel: "Tudo",
    sourceImportedAt: null,
    provider: "openrouteservice",
    profile: "cycling-road",
    startLatitude: 38,
    startLongitude: -77,
  };
}

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
  const summary = validRouteSummary(owner.uid, routeId);
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

test("route name claims and original GPX/TCX files are owner-only", async () => {
  const owner = await client("route-import-owner");
  const stranger = await client("route-import-stranger");
  const claimPath = `users/${owner.uid}/routeNames/river%20loop`;
  const gpxPath = `users/${owner.uid}/routes/import-test/originals/source.gpx`;
  const tcxPath = `users/${owner.uid}/routes/import-test/originals/source.tcx`;
  const claim = doc(owner.firestore, claimPath);
  const strangerClaim = doc(stranger.firestore, claimPath);
  const gpx = ref(owner.storage, gpxPath);
  const tcx = ref(owner.storage, tcxPath);
  const routeDocument = doc(owner.firestore, "users", owner.uid, "routes", "import-test");
  try {
    const batch = writeBatch(owner.firestore);
    batch.set(routeDocument, validRouteSummary(owner.uid, "import-test", "River Loop"));
    batch.set(claim, { routeId: "import-test", normalizedName: "river loop" });
    await batch.commit();
    assert.equal((await getDoc(claim)).exists(), true);
    await assert.rejects(() => getDoc(strangerClaim), /permission|insufficient/i);
    await uploadBytes(gpx, new TextEncoder().encode("<gpx/>") , { contentType: "application/gpx+xml" });
    await uploadBytes(tcx, new TextEncoder().encode("<TrainingCenterDatabase/>") , { contentType: "application/vnd.garmin.tcx+xml" });
    assert.equal(new TextDecoder().decode(await getBytes(gpx)), "<gpx/>");
    await assert.rejects(() => getBytes(ref(stranger.storage, gpxPath)), /unauthorized|permission/i);
    await assert.rejects(() => uploadBytes(ref(owner.storage, `users/${owner.uid}/routes/import-test/originals/bad.exe`), new Uint8Array([1]), { contentType: "application/octet-stream" }), /unauthorized|permission/i);
  } finally {
    await Promise.all([deleteObject(gpx).catch(() => {}), deleteObject(tcx).catch(() => {}), deleteDoc(claim).catch(() => {}), deleteDoc(routeDocument).catch(() => {})]);
    await Promise.all([deleteApp(owner.app), deleteApp(stranger.app)]);
  }
});
