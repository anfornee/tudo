import { redirect } from "next/navigation";
import { RoutePlannerContent } from "@/components/routes/RoutePlannerContent";
import { getCurrentUser } from "@/lib/auth";

export default async function SavedRoutePlannerPage({ params }: { params: Promise<{ routeId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/logout");
  const { routeId } = await params;
  const mapStyleUrl = process.env.NEXT_PUBLIC_ROUTE_MAP_STYLE_URL?.trim() || null;
  return <main className="mx-auto w-full max-w-[96rem] p-4 sm:p-6"><RoutePlannerContent userId={user.uid} savedRouteId={routeId} mapStyleUrl={mapStyleUrl} /></main>;
}
