"use client";

import { onAuthStateChanged } from "firebase/auth";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { RideCharts } from "@/components/rides/RideCharts";
import { RideSummary } from "@/components/rides/RideSummary";
import { auth } from "@/lib/firebase-client";
import type { RideSample } from "@/lib/ride.types";
import { getRide, getRideSamples } from "@/lib/rides/persistence";
import type { SavedRide } from "@/lib/rides/types";

export function SavedRideContent({ userId, rideId }: { userId: string; rideId: string }) {
  const [ride, setRide] = useState<SavedRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [samples, setSamples] = useState<RideSample[] | null>(null);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    if (!user || user.uid !== userId) {
      window.location.assign("/api/auth/logout");
      return;
    }
    void getRide(userId, rideId)
      .then((savedRide) => {
        if (!savedRide) setError("This saved ride could not be found.");
        setRide(savedRide);
        if (savedRide?.sampleFilePath) {
          setSamplesLoading(true);
          void getRideSamples(savedRide)
            .then(setSamples)
            .catch((error) => console.error("Unable to load ride samples:", error))
            .finally(() => setSamplesLoading(false));
        }
      })
      .catch((error) => {
        console.error("Unable to load ride:", error);
        setError("Unable to load this saved ride.");
      })
      .finally(() => setLoading(false));
  }), [rideId, userId]);

  if (loading) return <div className="flex min-h-48 items-center justify-center rounded-xl border bg-card"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (!ride) return <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">{error}</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <Link href="/rides" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back to rides</Link>
        <RideSummary
          ride={ride}
          source={ride.source}
          activityDate={(ride.activityDate ?? ride.importedAt)?.toDate() ?? null}
          fileName={ride.originalFileName}
        />
      </section>
      {samplesLoading ? (
        <div className="flex min-h-40 items-center justify-center rounded-xl border bg-card"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : <RideCharts samples={samples} />}
    </div>
  );
}
