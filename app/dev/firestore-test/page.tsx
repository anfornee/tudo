import { notFound, redirect } from "next/navigation";

import { FirestoreSmokeTest } from "@/components/dev/FirestoreSmokeTest";
import { getCurrentUser } from "@/lib/auth";

export default async function FirestoreTestPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/api/auth/logout");
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-8 sm:px-6">
      <FirestoreSmokeTest />
    </main>
  );
}
