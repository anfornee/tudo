import { redirect } from "next/navigation";

import { RidesPageContent } from "@/components/rides/RidesPageContent";
import { getCurrentUser } from "@/lib/auth";

export default async function RidesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/logout");

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rides</h1>
        <p className="mt-1 text-sm text-muted-foreground">Import and keep your cycling activity history.</p>
      </div>
      <RidesPageContent userId={user.uid} />
    </main>
  );
}
