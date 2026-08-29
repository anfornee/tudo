"use client";

import { CheckCircle2, Database, Loader2, XCircle } from "lucide-react";
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase-client";
import { auth } from "@/lib/firebase-client";

const TEST_MESSAGE = "Firestore emulator connected";

type TestResult =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; message: string; updatedAt: string }
  | { status: "error"; message: string };

export function FirestoreSmokeTest() {
  const [result, setResult] = useState<TestResult>({ status: "idle" });

  async function runSmokeTest() {
    setResult({ status: "running" });

    try {
      const userId = auth.currentUser?.uid;

      if (!userId) {
        throw new Error("Sign in with the local Auth emulator first.");
      }

      const testDocument = doc(db, "users", userId, "dev", "firestore-test");

      await setDoc(testDocument, {
        message: TEST_MESSAGE,
        updatedAt: serverTimestamp(),
      });

      const snapshot = await getDoc(testDocument);
      const data = snapshot.data();

      if (
        !snapshot.exists() ||
        data?.message !== TEST_MESSAGE ||
        !(data.updatedAt instanceof Timestamp)
      ) {
        throw new Error("The document read-back did not match the written data.");
      }

      setResult({
        status: "success",
        message: data.message,
        updatedAt: data.updatedAt.toDate().toLocaleString(),
      });
    } catch (error) {
      setResult({
        status: "error",
        message:
          error instanceof Error ? error.message : "Unknown Firestore error",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="size-5" />
          Firestore smoke test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Writes a temporary document beneath your user ID, then
          reads it back and validates its message and server timestamp.
        </p>

        <Button
          type="button"
          onClick={runSmokeTest}
          disabled={result.status === "running"}
        >
          {result.status === "running" && <Loader2 className="animate-spin" />}
          Run smoke test
        </Button>

        {result.status === "success" && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4" />
              Read and write confirmed
            </div>
            <p className="mt-2">{result.message}</p>
            <p className="text-muted-foreground">Updated: {result.updatedAt}</p>
          </div>
        )}

        {result.status === "error" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="flex items-center gap-2 font-medium">
              <XCircle className="size-4" />
              Smoke test failed
            </div>
            <p className="mt-2">{result.message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
