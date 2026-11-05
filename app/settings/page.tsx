import { redirect } from "next/navigation";
import { RiderProfileForm } from "@/components/settings/RiderProfileForm";
import { getCurrentUser } from "@/lib/auth";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/logout");

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Personalize how Tudo works for you.</p>
      </div>
      <RiderProfileForm userId={user.uid} />
    </main>
  );
}
