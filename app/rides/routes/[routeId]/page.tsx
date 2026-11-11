import { redirect } from "next/navigation";
import { RouteDetailContent } from "@/components/routes/RouteDetailContent";
import { getCurrentUser } from "@/lib/auth";
import { getWahooConnectionStatus } from "@/lib/rides/wahoo-connection";

export default async function RouteDetailPage({ params }: { params: Promise<{ routeId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/logout");
  const wahoo = await getWahooConnectionStatus(user.uid);
  const { routeId } = await params;
  const mapStyleUrl = process.env.NEXT_PUBLIC_ROUTE_MAP_STYLE_URL?.trim() || null;
  return <main className="mx-auto w-full max-w-[96rem] p-4 sm:p-6"><RouteDetailContent userId={user.uid} routeId={routeId} mapStyleUrl={mapStyleUrl} wahooConnected={wahoo.connected} /></main>;
}
