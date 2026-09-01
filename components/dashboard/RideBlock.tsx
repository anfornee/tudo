"use client";

import { onAuthStateChanged } from "firebase/auth";
import { ArrowRight, Bike, Clock3, Gauge, Loader2, Mountain } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/firebase-client";
import { formatElevationGain, formatRideDistance } from "@/lib/rides/formatters";
import { getRides } from "@/lib/rides/persistence";
import type { SavedRide } from "@/lib/rides/types";

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function activityDate(ride: SavedRide) {
  return (ride.activityDate ?? ride.importedAt)?.toDate() ?? null;
}

export function RideBlock({ dragHandle }: { dragHandle?: React.ReactNode }) {
  const [ride, setRide] = useState<SavedRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        if (!user) {
          setLoading(false);
          return;
        }

        void getRides(user.uid)
          .then((rides) => setRide(rides[0] ?? null))
          .catch((error) => {
            console.error("Unable to load latest ride:", error);
            setError(true);
          })
          .finally(() => setLoading(false));
      }),
    [],
  );

  const date = ride ? activityDate(ride) : null;

  return (
    <section className="flex min-h-[260px] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-2.5">
        <div className="flex items-center gap-2">
          <Bike className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">
            <Link
              href="/rides"
              className="rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Rides
            </Link>
          </h2>
        </div>

        {dragHandle}
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : ride ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">Latest ride</h3>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {date?.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }) ?? "Date unavailable"}
                {` · ${ride.source.toUpperCase()}`}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/60 p-2.5">
                <Gauge className="size-4 text-muted-foreground" />
                <p className="mt-1 font-semibold tabular-nums">
                  {formatRideDistance(ride.distanceMiles)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/60 p-2.5">
                <Clock3 className="size-4 text-muted-foreground" />
                <p className="mt-1 font-semibold tabular-nums">
                  {formatDuration(ride.durationSeconds)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/60 p-2.5">
                <Mountain className="size-4 text-muted-foreground" />
                <p className="mt-1 font-semibold tabular-nums">
                  {formatElevationGain(ride.elevationGainFeet)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Bike className="size-7 text-muted-foreground" />
            <h3 className="mt-2 font-semibold">
              {error ? "Rides unavailable" : "Log your first ride"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {error
                ? "Your ride history could not be loaded."
                : "Import a FIT or GPX activity to get started."}
            </p>
          </div>
        )}

        <div className={ride ? "mt-auto grid grid-cols-2 gap-2" : "mt-auto"}>
          {ride && (
            <Link
              href="/rides"
              className={buttonVariants({ variant: "outline", className: "w-full" })}
            >
              All Rides
            </Link>
          )}
          <Link
            href={ride ? `/rides/${ride.id}` : "/rides"}
            className={buttonVariants({ variant: "default", className: "w-full" })}
          >
            {ride ? "View Ride" : "Add Ride"}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
