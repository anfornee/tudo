import { redirect } from "next/navigation";

import { SavedRideContent } from "@/components/rides/SavedRideContent";
import { getCurrentUser } from "@/lib/auth";

export default async function SavedRidePage({ params }: { params: Promise<{ rideId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/logout");
  const { rideId } = await params;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ride summary</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your saved activity details.</p>
      </div>
      <SavedRideContent userId={user.uid} rideId={rideId} />
    </main>
  );
}
