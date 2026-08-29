import { redirect } from "next/navigation";

import { AppNavigation } from "@/components/app-navigation";
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
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <AppNavigation />
      {children}
    </div>
  );
}
