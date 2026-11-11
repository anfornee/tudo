import { redirect } from "next/navigation";
import { RoutesLibraryContent } from "@/components/routes/RoutesLibraryContent";
import { getCurrentUser } from "@/lib/auth";
import { getWahooConnectionStatus } from "@/lib/rides/wahoo-connection";

export default async function RoutesLibraryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/logout");
  const wahoo = await getWahooConnectionStatus(user.uid);
  return <main className="mx-auto w-full max-w-[96rem] p-4 sm:p-6"><RoutesLibraryContent userId={user.uid} wahooConnected={wahoo.connected} /></main>;
}
