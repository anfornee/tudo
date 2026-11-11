import { redirect } from "next/navigation";
import { RoutePlannerContent } from "@/components/routes/RoutePlannerContent";
import { getCurrentUser } from "@/lib/auth";
import { getWahooConnectionStatus } from "@/lib/rides/wahoo-connection";

export default async function NewRoutePlannerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/logout");
  const wahoo = await getWahooConnectionStatus(user.uid);
  const mapStyleUrl = process.env.NEXT_PUBLIC_ROUTE_MAP_STYLE_URL?.trim() || null;
  return <main className="mx-auto w-full max-w-[96rem] p-4 sm:p-6"><RoutePlannerContent userId={user.uid} mapStyleUrl={mapStyleUrl} wahooConnected={wahoo.connected} /></main>;
}
