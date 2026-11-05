import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { RidesPageContent } from "@/components/rides/RidesPageContent";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getWahooConnectionStatus } from "@/lib/rides/wahoo-connection";

const wahooMessages: Record<string, { text: string; tone: string }> = {
  connected: { text: "Wahoo connected. New cycling activities will import automatically.", tone: "border-green-500/30 bg-green-500/10 text-green-800 dark:text-green-300" },
  authorization_denied: { text: "Wahoo authorization was canceled.", tone: "border-border bg-muted/50 text-muted-foreground" },
  invalid_state: { text: "The Wahoo connection request expired. Please try again.", tone: "border-destructive/30 bg-destructive/10 text-destructive" },
  account_in_use: { text: "That Wahoo account is already connected to another Tudo account.", tone: "border-destructive/30 bg-destructive/10 text-destructive" },
  connection_failed: { text: "Tudo couldn't connect to Wahoo. Please try again.", tone: "border-destructive/30 bg-destructive/10 text-destructive" },
  configuration_error: { text: "Wahoo connection is not configured correctly on the server.", tone: "border-destructive/30 bg-destructive/10 text-destructive" },
};

export default async function RidesPage({ searchParams }: { searchParams: Promise<{ wahoo?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/logout");
  const wahoo = await getWahooConnectionStatus(user.uid);
  const wahooResult = (await searchParams).wahoo;
  const message = typeof wahooResult === "string" ? wahooMessages[wahooResult] : undefined;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rides</h1>
          <p className="mt-1 text-sm text-muted-foreground">Import and keep your cycling activity history.</p>
        </div>
        {wahoo.connected ? (
          <span className={buttonVariants({ variant: "outline" })} aria-label="Wahoo account connected">
            <CheckCircle2 className="text-green-600 dark:text-green-400" />
            Wahoo connected
          </span>
        ) : (
          <Link className={buttonVariants({ variant: "outline" })} href="/api/integrations/wahoo/connect">
            Connect Wahoo
          </Link>
        )}
      </div>
      {message ? <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${message.tone}`}>{message.text}</p> : null}
      <RidesPageContent userId={user.uid} />
    </main>
  );
}
