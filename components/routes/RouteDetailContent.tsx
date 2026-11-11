"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Download, Edit3, FileDown, Loader2, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { RouteElevationChart } from "@/components/routes/RouteElevationChart";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRiderProfile } from "@/lib/rider-profile/persistence";
import { downloadRouteText, routeFilename, routeToGpx, routeToTcx } from "@/lib/routes/export";
import { formatRouteDistance, formatRouteElevation } from "@/lib/routes/formatters";
import {
  deleteSavedRoute,
  duplicateSavedRoute,
  getSavedRoute,
  loadRoutePayload,
  updateSavedRoute,
  type SavedRoute,
} from "@/lib/routes/persistence";
import type { RouteFilePayload } from "@/lib/routes/types";

const RouteDetailMap = dynamic(() => import("@/components/routes/RouteDetailMap"), {
  ssr: false,
  loading: () => <div className="flex min-h-80 items-center justify-center rounded-2xl border bg-muted"><Loader2 className="size-6 animate-spin" /><span className="sr-only">Loading map</span></div>,
});

function formatDate(value: SavedRoute["updatedAt"]) {
  return value?.toDate().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) ?? "Unavailable";
}

export function RouteDetailContent({ userId, routeId, mapStyleUrl, wahooConnected }: {
  userId: string;
  routeId: string;
  mapStyleUrl: string | null;
  wahooConnected: boolean;
}) {
  const router = useRouter();
  const [savedRoute, setSavedRoute] = useState<SavedRoute | null>(null);
  const [payload, setPayload] = useState<RouteFilePayload | null>(null);
  const [units, setUnits] = useState<"imperial" | "metric">("imperial");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cursorIndex, setCursorIndex] = useState<number | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [syncStatus, setSyncStatus] = useState("Not synced");

  useEffect(() => {
    async function load() {
      try {
        const [summary, profile, syncResponse] = await Promise.all([
          getSavedRoute(userId, routeId),
          getRiderProfile(userId),
          wahooConnected ? fetch("/api/integrations/wahoo/routes", { cache: "no-store" }) : Promise.resolve(null),
        ]);
        if (!summary) throw new Error("This saved route could not be found.");
        const loadedPayload = await loadRoutePayload(summary);
        setSavedRoute(summary);
        setPayload(loadedPayload);
        setEditName(loadedPayload.name);
        setEditDescription(loadedPayload.description);
        setUnits(profile?.preferredUnits ?? "imperial");
        if (syncResponse?.ok) {
          const body = await syncResponse.json() as { routes?: Record<string, { status?: string }> };
          const status = body.routes?.[routeId]?.status;
          setSyncStatus(status === "synced" ? "Synced" : status === "pending" ? "Local changes pending" : status === "failed" ? "Sync failed" : status === "conflict" ? "Conflict" : "Not synced");
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load this route.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [routeId, userId, wahooConnected]);

  async function rename() {
    if (!savedRoute || !payload) return;
    setWorking(true);
    setError(null);
    try {
      const updated = await updateSavedRoute(savedRoute, editName, editDescription, payload.route);
      if (!updated) throw new Error("The route was updated but could not be reloaded.");
      setSavedRoute(updated);
      setPayload({ ...payload, name: updated.name, description: updated.description });
      setRenameOpen(false);
      setNotice("Route details updated.");
      if (syncStatus === "Synced") setSyncStatus("Local changes pending");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update this route.");
    } finally {
      setWorking(false);
    }
  }

  async function duplicate() {
    if (!savedRoute || !payload) return;
    setWorking(true);
    setError(null);
    try {
      const duplicateRoute = await duplicateSavedRoute(savedRoute, payload);
      if (!duplicateRoute) throw new Error("The duplicate could not be loaded.");
      router.push(`/rides/routes/${duplicateRoute.id}`);
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Unable to duplicate this route.");
    } finally {
      setWorking(false);
    }
  }

  async function remove() {
    if (!savedRoute) return;
    setWorking(true);
    try {
      await deleteSavedRoute(savedRoute);
      router.push("/rides/routes");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this route.");
      setDeleteOpen(false);
    } finally {
      setWorking(false);
    }
  }

  async function sendToWahoo() {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/wahoo/routes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ routeId }) });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body && typeof body === "object" && "error" in body ? String(body.error) : "Unable to send this route to Wahoo.");
      setSyncStatus("Synced");
      setNotice("Route sent to Wahoo. It will appear on a compatible ELEMNT device after sync.");
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to send this route to Wahoo.");
      setSyncStatus("Sync failed");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <div className="flex min-h-72 items-center justify-center"><Loader2 className="size-6 animate-spin" /><span className="sr-only">Loading route</span></div>;
  if (!savedRoute || !payload) return <div className="space-y-4"><Link href="/rides/routes" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft />Routes</Link><p role="alert" className="rounded-xl bg-destructive/10 p-4 text-destructive">{error ?? "This route is unavailable."}</p></div>;

  const route = payload.route;
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link href="/rides/routes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />My Routes</Link>
          <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight">{payload.name}</h1>
          {payload.description ? <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{payload.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/rides/routes/${routeId}/edit`} className={buttonVariants()}><Edit3 />Open in Planner</Link>
          <Button variant="outline" onClick={() => downloadRouteText(routeToGpx(route, payload.name, payload.description), routeFilename(payload.name, "gpx"), "application/gpx+xml")}><Download />GPX</Button>
          {route.maneuvers.length ? <Button variant="outline" onClick={() => downloadRouteText(routeToTcx(route, payload.name, payload.description), routeFilename(payload.name, "tcx"), "application/vnd.garmin.tcx+xml")}><FileDown />TCX</Button> : null}
          {wahooConnected ? <Button variant="outline" disabled={working} onClick={() => void sendToWahoo()}><Send />Send to Wahoo</Button> : <Link href="/api/integrations/wahoo/connect" className={buttonVariants({ variant: "outline" })}>Connect Wahoo</Link>}
        </div>
      </header>

      {notice ? <p role="status" className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}

      {mapStyleUrl ? <RouteDetailMap route={route} mapStyleUrl={mapStyleUrl} cursorIndex={cursorIndex} onCursorChange={setCursorIndex} /> : <div role="status" className="flex min-h-80 items-center justify-center rounded-2xl border border-dashed bg-card p-6 text-center"><div><p className="font-medium">Map tiles are not configured</p><p className="mt-1 text-sm text-muted-foreground">Route details and exports remain available.</p></div></div>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4"><span className="text-xs text-muted-foreground">Distance</span><strong className="mt-1 block text-lg">{formatRouteDistance(route.distanceMeters, units)}</strong></div>
        <div className="rounded-2xl border bg-card p-4"><span className="text-xs text-muted-foreground">Elevation gain</span><strong className="mt-1 block text-lg">{formatRouteElevation(route.elevationGainMeters, units)}</strong></div>
        <div className="rounded-2xl border bg-card p-4"><span className="text-xs text-muted-foreground">Elevation loss</span><strong className="mt-1 block text-lg">{formatRouteElevation(route.elevationLossMeters, units)}</strong></div>
        <div className="rounded-2xl border bg-card p-4"><span className="text-xs text-muted-foreground">Wahoo</span><strong className="mt-1 block text-lg">{wahooConnected ? syncStatus : "Not connected"}</strong></div>
      </section>

      <section className="space-y-3"><div><h2 className="font-semibold">Elevation profile</h2><p className="text-sm text-muted-foreground">Move across the map or profile to follow the route. Use the arrow keys while the profile is focused.</p></div><RouteElevationChart points={route.geometry} units={units} cursorIndex={cursorIndex} onCursorChange={setCursorIndex} /></section>

      <section className="grid gap-4 rounded-2xl border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><span className="block text-xs text-muted-foreground">Source</span><strong>{payload.source.label}</strong>{payload.source.originalFileName ? <span className="mt-1 block truncate text-xs text-muted-foreground">{payload.source.originalFileName}</span> : null}</div>
        <div><span className="block text-xs text-muted-foreground">Created</span><strong>{formatDate(savedRoute.createdAt)}</strong></div>
        <div><span className="block text-xs text-muted-foreground">Modified</span><strong>{formatDate(savedRoute.updatedAt)}</strong></div>
        <div><span className="block text-xs text-muted-foreground">Geometry</span><strong>{route.geometry.length.toLocaleString()} points · {route.segmentStartIndices.length} segment{route.segmentStartIndices.length === 1 ? "" : "s"}</strong></div>
      </section>

      <section className="flex flex-wrap gap-2 border-t pt-5"><Button variant="outline" onClick={() => setRenameOpen(true)}><Edit3 />Rename</Button><Button variant="outline" disabled={working} onClick={() => void duplicate()}><Copy />Duplicate</Button><Button variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 />Delete</Button></section>

      <AlertDialog open={renameOpen} onOpenChange={setRenameOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Edit route details</AlertDialogTitle><AlertDialogDescription>Names must be unique in your route library.</AlertDialogDescription></AlertDialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="route-name">Name</Label><Input id="route-name" value={editName} maxLength={120} onChange={(event) => setEditName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="route-description">Description</Label><Input id="route-description" value={editDescription} maxLength={1000} onChange={(event) => setEditDescription(event.target.value)} /></div></div><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><Button disabled={working || !editName.trim()} onClick={() => void rename()}>{working ? <Loader2 className="animate-spin" /> : null}Save</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {payload.name}?</AlertDialogTitle><AlertDialogDescription>This removes the route from Tudo. It will not automatically delete a route already sent to Wahoo.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={() => void remove()}>Delete route</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
