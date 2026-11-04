import { redirect } from "next/navigation";

import { AppNavigation } from "@/components/app-navigation";
import { FeatureOrderProvider } from "@/components/feature-order-provider";
import { PwaRuntime } from "@/components/pwa-runtime";
import { getCurrentUser } from "@/lib/auth";

export async function AuthenticatedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/api/auth/logout");
  }

  return (
    <div className="min-h-dvh pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:pb-0">
      <FeatureOrderProvider userId={user.uid}>
        <PwaRuntime userId={user.uid} />
        <AppNavigation userId={user.uid} />
        {children}
      </FeatureOrderProvider>
    </div>
  );
}
