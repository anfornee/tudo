"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  CornerDownLeft,
  Download,
  Focus,
  Loader2,
  Redo2,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RouteElevationChart } from "@/components/routes/RouteElevationChart";
import { RouteInstructions } from "@/components/routes/RouteInstructions";
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
import { calculateRoadCyclingRoute } from "@/lib/routes/client";
import {
  addReturnToStart,
  commitWaypoints,
  createWaypointHistory,
  insertWaypoint,
  moveWaypoint,
  redoWaypoints,
  removeWaypoint,
  routeReturnsToStart,
  shouldAcceptRoutingResponse,
  undoWaypoints,
  type WaypointHistory,
} from "@/lib/routes/editor";
import { downloadRouteText, routeFilename, routeToGpx, routeToTcx } from "@/lib/routes/export";
import { formatRouteDistance, formatRouteDuration, formatRouteElevation } from "@/lib/routes/formatters";
import { insertShapingWaypoint, isRouteCoordinate, nearestGeometryIndexByDistance } from "@/lib/routes/geometry";
import {
  createSavedRoute,
  deleteSavedRoute,
  duplicateSavedRoute,
  getSavedRoute,
  listSavedRoutes,
  loadRoutePayload,
  updateSavedRoute,
  type SavedRoute,
} from "@/lib/routes/persistence";
import type { PlannedRoute, RouteCoordinate, RouteManeuver, RouteWaypoint } from "@/lib/routes/types";
import { getCachedWeatherLocation } from "@/lib/weather-current-location";

const RoutePlannerMap = dynamic(() => import("@/components/routes/RoutePlannerMap"), {
  ssr: false,
  loading: () => <div className="flex h-[56vh] min-h-[24rem] items-center justify-center rounded-xl border bg-muted"><Loader2 className="size-6 animate-spin text-muted-foreground" /><span className="sr-only">Loading route map</span></div>,
});

const DEFAULT_NAME = "Untitled route";

function waypointKey(waypoints: readonly RouteWaypoint[], avoidFerries: boolean) {
  return `${avoidFerries ? "1" : "0"}|${waypoints.map((point) => `${point.id}:${point.coordinate[0].toFixed(7)},${point.coordinate[1].toFixed(7)}`).join("|")}`;
}

function draftSignature(name: string, description: string, waypoints: readonly RouteWaypoint[], avoidFerries: boolean) {
  return `${name.trim()}\n${description.trim()}\n${waypointKey(waypoints, avoidFerries)}`;
}

function newWaypoint(coordinate: RouteCoordinate): RouteWaypoint {
  return { id: crypto.randomUUID(), coordinate };
}

function waypointName(index: number, count: number) {
  if (index === 0) return "Start";
  if (index === count - 1) return "Destination";
  return `Waypoint ${index + 1}`;
}

function parseLocalDraft(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const rawWaypoints = Array.isArray(parsed.waypoints) ? parsed.waypoints : [];
    const waypoints = rawWaypoints.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const waypoint = item as Record<string, unknown>;
      return typeof waypoint.id === "string" && isRouteCoordinate(waypoint.coordinate)
        ? [{ id: waypoint.id, coordinate: waypoint.coordinate }]
        : [];
    });
    if (waypoints.length !== rawWaypoints.length || waypoints.length > 25) return null;
    return {
      name: typeof parsed.name === "string" ? parsed.name : DEFAULT_NAME,
      description: typeof parsed.description === "string" ? parsed.description : "",
      avoidFerries: parsed.avoidFerries === true,
      waypoints,
    };
  } catch {
    return null;
  }
}

export function RoutePlannerContent({ userId, savedRouteId, mapStyleUrl, wahooConnected }: {
  userId: string;
  savedRouteId?: string;
  mapStyleUrl: string | null;
  wahooConnected: boolean;
}) {
  const router = useRouter();
  const draftStorageKey = `tudo:route-draft:${userId}:${savedRouteId ?? "new"}`;
  const [name, setName] = useState(DEFAULT_NAME);
  const [description, setDescription] = useState("");
  const [history, setHistory] = useState<WaypointHistory>(() => createWaypointHistory());
  const [avoidFerries, setAvoidFerries] = useState(false);
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [savedRoute, setSavedRoute] = useState<SavedRoute | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [savedRoutesLoading, setSavedRoutesLoading] = useState(true);
  const [savedRoutesError, setSavedRoutesError] = useState<string | null>(null);
  const [units, setUnits] = useState<"imperial" | "metric">("imperial");
  const [initialCenter, setInitialCenter] = useState<RouteCoordinate>([-98.5, 39.5]);
  const [loading, setLoading] = useState(Boolean(savedRouteId));
  const [routing, setRouting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cursorIndex, setCursorIndex] = useState<number | null>(null);
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<number | null>(null);
  const [selectedManeuver, setSelectedManeuver] = useState<RouteManeuver | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [clearOpen, setClearOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [baseline, setBaseline] = useState(draftSignature(DEFAULT_NAME, "", [], false));
  const activeRequestRef = useRef(0);
  const lastRoutedKeyRef = useRef("");
  const initializedRef = useRef(false);

  const signature = useMemo(
    () => draftSignature(name, description, history.present, avoidFerries),
    [avoidFerries, description, history.present, name],
  );
  const dirty = signature !== baseline;

  const refreshSavedRoutes = useCallback(async () => {
    try {
      setSavedRoutes(await listSavedRoutes(userId));
      setSavedRoutesError(null);
    } catch (loadError) {
      console.error("Unable to load saved routes:", loadError);
      setSavedRoutesError("Unable to load saved routes.");
    } finally {
      setSavedRoutesLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void listSavedRoutes(userId)
      .then((items) => { setSavedRoutes(items); setSavedRoutesError(null); })
      .catch((loadError) => { console.error("Unable to load saved routes:", loadError); setSavedRoutesError("Unable to load saved routes."); })
      .finally(() => setSavedRoutesLoading(false));
    void getRiderProfile(userId)
      .then((profile) => setUnits(profile?.preferredUnits ?? "imperial"))
      .catch((loadError) => console.error("Unable to load route planner preferences:", loadError));

    async function initialize() {
      try {
        const cached = getCachedWeatherLocation();
        if (cached) setInitialCenter([cached.longitude, cached.latitude]);
        if (savedRouteId) {
          const summary = await getSavedRoute(userId, savedRouteId);
          if (!summary) throw new Error("This saved route could not be found.");
          const payload = await loadRoutePayload(summary);
          setSavedRoute(summary);
          setName(payload.name);
          setDescription(payload.description);
          setHistory(createWaypointHistory(payload.route.waypoints));
          setAvoidFerries(payload.route.preferences.avoidFerries);
          setRoute(payload.route);
          lastRoutedKeyRef.current = waypointKey(payload.route.waypoints, payload.route.preferences.avoidFerries);
          setBaseline(draftSignature(payload.name, payload.description, payload.route.waypoints, payload.route.preferences.avoidFerries));
          setFitToken((value) => value + 1);
        } else {
          const stored = window.localStorage.getItem(draftStorageKey);
          const localDraft = stored ? parseLocalDraft(stored) : null;
          if (localDraft?.waypoints.length) {
            setName(localDraft.name);
            setDescription(localDraft.description);
            setAvoidFerries(localDraft.avoidFerries);
            setHistory(createWaypointHistory(localDraft.waypoints));
            setNotice("Restored your unsaved route draft.");
          }
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load this route.");
      } finally {
        initializedRef.current = true;
        setLoading(false);
      }
    }
    void initialize();
  }, [draftStorageKey, savedRouteId, userId]);

  useEffect(() => {
    if (!initializedRef.current || savedRouteId) return;
    if (!history.present.length && name === DEFAULT_NAME && !description) {
      window.localStorage.removeItem(draftStorageKey);
      return;
    }
    window.localStorage.setItem(draftStorageKey, JSON.stringify({ name, description, avoidFerries, waypoints: history.present }));
  }, [avoidFerries, description, draftStorageKey, history.present, name, savedRouteId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const guardLink = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;
      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      if (!window.confirm("Leave this route and discard unsaved changes?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLink, true);
    };
  }, [dirty]);

  useEffect(() => {
    const key = waypointKey(history.present, avoidFerries);
    if (history.present.length < 2) {
      lastRoutedKeyRef.current = key;
      return;
    }
    if (key === lastRoutedKeyRef.current) return;
    const requestNumber = activeRequestRef.current + 1;
    activeRequestRef.current = requestNumber;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setRouting(true);
      setError(null);
      void calculateRoadCyclingRoute({ waypoints: history.present, preferences: { avoidFerries } }, controller.signal)
        .then((result) => {
          if (!shouldAcceptRoutingResponse(activeRequestRef.current, requestNumber)) return;
          lastRoutedKeyRef.current = key;
          setRoute(result);
        })
        .catch((routeError) => {
          if (controller.signal.aborted || !shouldAcceptRoutingResponse(activeRequestRef.current, requestNumber)) return;
          setError(routeError instanceof Error ? routeError.message : "Unable to calculate this route.");
        })
        .finally(() => {
          if (shouldAcceptRoutingResponse(activeRequestRef.current, requestNumber)) setRouting(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [avoidFerries, history.present]);

  const commit = useCallback((waypoints: RouteWaypoint[]) => {
    setHistory((current) => commitWaypoints(current, waypoints));
    setRoute(null);
    setRouting(false);
    setSelectedManeuver(null);
    setNotice(null);
  }, []);

  function undo() {
    setHistory((current) => undoWaypoints(current));
    setRoute(null);
    setRouting(false);
    setSelectedManeuver(null);
  }

  function redo() {
    setHistory((current) => redoWaypoints(current));
    setRoute(null);
    setRouting(false);
    setSelectedManeuver(null);
  }

  function changeAvoidFerries(value: boolean) {
    setAvoidFerries(value);
    setRoute(null);
    setRouting(false);
    setSelectedManeuver(null);
  }

  const addWaypoint = useCallback((coordinate: RouteCoordinate) => {
    if (history.present.length >= 25) {
      setError("A route can contain at most 25 waypoints.");
      return;
    }
    commit([...history.present, newWaypoint(coordinate)]);
    setSelectedWaypointIndex(history.present.length);
  }, [commit, history.present]);

  function insertRouteWaypoint(geometryIndex: number) {
    if (!route || history.present.length >= 25) return;
    const insertion = insertShapingWaypoint(route, geometryIndex, crypto.randomUUID());
    if (!insertion) return;
    commit(insertWaypoint(history.present, insertion.index, insertion.waypoint));
    setSelectedWaypointIndex(insertion.index);
  }

  function removeSelectedWaypoint() {
    if (selectedWaypointIndex === null) return;
    commit(removeWaypoint(history.present, selectedWaypointIndex));
    setSelectedWaypointIndex(null);
  }

  function reorderWaypoint(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= history.present.length) return;
    const next = [...history.present];
    [next[index], next[destination]] = [next[destination], next[index]];
    commit(next);
    setSelectedWaypointIndex(destination);
  }

  function returnToStart(mode: "out-and-back" | "best-route") {
    try {
      const waypoints = addReturnToStart(history.present, mode, () => crypto.randomUUID(), {
        outboundGeometry: route?.geometry,
      });
      commit(waypoints);
      setSelectedWaypointIndex(waypoints.length - 1);
      setReturnOpen(false);
    } catch (returnError) {
      setError(returnError instanceof Error ? returnError.message : "Unable to return this route to its start.");
      setReturnOpen(false);
    }
  }

  async function save() {
    if (!route || routing) return;
    if (!name.trim()) { setError("Give this route a name before saving."); return; }
    setSaving(true);
    setError(null);
    try {
      const saved = savedRoute
        ? await updateSavedRoute(savedRoute, name, description, route)
        : await createSavedRoute(userId, name, description, route);
      if (!saved) throw new Error("The route was saved but could not be reloaded.");
      setSavedRoute(saved);
      setBaseline(draftSignature(name, description, history.present, avoidFerries));
      window.localStorage.removeItem(draftStorageKey);
      setNotice("Route saved.");
      await refreshSavedRoutes();
      if (!savedRouteId) router.replace(`/rides/routes/${saved.id}/edit`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this route.");
    } finally {
      setSaving(false);
    }
  }

  async function duplicate() {
    if (!savedRoute || !route) return;
    setDuplicating(true);
    setError(null);
    try {
      const duplicate = await duplicateSavedRoute(savedRoute, {
        version: 1,
        name,
        description,
        source: {
          type: savedRoute.source,
          label: savedRoute.sourceLabel,
          originalFileName: savedRoute.originalFileName,
          importedAt: savedRoute.sourceImportedAt,
        },
        route,
      });
      if (!duplicate) throw new Error("The duplicate could not be loaded.");
      router.push(`/rides/routes/${duplicate.id}`);
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Unable to duplicate this route.");
    } finally {
      setDuplicating(false);
    }
  }

  async function removeSaved() {
    if (!savedRoute) return;
    setDeleting(true);
    try {
      await deleteSavedRoute(savedRoute);
      router.push("/rides/routes");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this route.");
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  function exportGpx() {
    if (!route) return;
    downloadRouteText(routeToGpx(route, name, description), routeFilename(name, "gpx"), "application/gpx+xml");
  }

  function exportTcx() {
    if (!route) return;
    try {
      downloadRouteText(routeToTcx(route, name, description), routeFilename(name, "tcx"), "application/vnd.garmin.tcx+xml");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export this route as TCX.");
    }
  }

  async function sendToWahoo() {
    if (!savedRoute || dirty || publishing) return;
    setPublishing(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/integrations/wahoo/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId: savedRoute.id }),
      });
      const body: unknown = await response.json();
      const message = body && typeof body === "object" && typeof (body as Record<string, unknown>).error === "string"
        ? (body as Record<string, string>).error
        : "Unable to send this route to Wahoo.";
      if (!response.ok) throw new Error(message);
      setNotice("Route sent to Wahoo. It should appear after your Wahoo device syncs.");
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to send this route to Wahoo.");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <div className="flex min-h-72 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /><span className="sr-only">Loading saved route</span></div>;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/rides/routes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />My Routes</Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Route Planner</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create road-cycling routes, review elevation and cues, then export for your next ride.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {savedRoute ? <Button variant="outline" onClick={() => void duplicate()} disabled={duplicating || saving}>{duplicating ? <Loader2 className="animate-spin" /> : <Copy />}Duplicate</Button> : null}
          {savedRoute ? <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={deleting || saving}><Trash2 />Delete</Button> : null}
          <Button onClick={() => void save()} disabled={!route || routing || saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />}{saving ? "Saving…" : "Save route"}</Button>
        </div>
      </header>

      {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">{notice}</p> : null}

      <section className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 sm:p-5">
        <div className="space-y-1.5"><Label htmlFor="route-name">Route name</Label><Input id="route-name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="route-description">Description (optional)</Label><textarea id="route-description" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} className="border-input bg-background min-h-9 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
            <Button variant="outline" size="sm" onClick={undo} disabled={!history.past.length}><Undo2 />Undo</Button>
            <Button variant="outline" size="sm" onClick={redo} disabled={!history.future.length}><Redo2 />Redo</Button>
            <Button variant="outline" size="sm" onClick={() => setFitToken((value) => value + 1)} disabled={!history.present.length}><Focus />Fit route</Button>
            <Button variant="outline" size="sm" onClick={() => setReturnOpen(true)} disabled={!route || history.present.length < 2 || routeReturnsToStart(history.present) || history.present.length >= 25}><CornerDownLeft />Return to start</Button>
            <Button variant="outline" size="sm" onClick={removeSelectedWaypoint} disabled={selectedWaypointIndex === null}><X />Remove selected</Button>
            <Button variant="destructive" size="sm" onClick={() => setClearOpen(true)} disabled={!history.present.length}><RotateCcw />Clear</Button>
            <label className="ml-auto flex min-h-8 items-center gap-2 px-1 text-sm"><input type="checkbox" checked={avoidFerries} onChange={(event) => changeAvoidFerries(event.target.checked)} className="size-4 accent-primary" />Avoid ferries</label>
          </div>

          {!mapStyleUrl ? (
            <div role="status" className="flex min-h-[24rem] items-center justify-center rounded-xl border border-dashed bg-card p-6 text-center"><div><p className="font-medium">Map tiles are not configured</p><p className="mt-1 max-w-lg text-sm text-muted-foreground">Set a licensed production map style URL before using the route editor. Existing saved route details and exports remain available.</p></div></div>
          ) : (
            <RoutePlannerMap
              mapStyleUrl={mapStyleUrl}
              waypoints={history.present}
              route={route}
              cursorIndex={cursorIndex}
              selectedWaypointIndex={selectedWaypointIndex}
              selectedManeuver={selectedManeuver}
              fitToken={fitToken}
              initialCenter={initialCenter}
              onMapClick={addWaypoint}
              onWaypointSelect={setSelectedWaypointIndex}
              onWaypointMove={(index, coordinate) => commit(moveWaypoint(history.present, index, coordinate))}
              onRouteInsert={insertRouteWaypoint}
              onCursorChange={setCursorIndex}
            />
          )}
          <p aria-live="polite" className="text-sm text-muted-foreground">{routing ? "Calculating a road-cycling route…" : history.present.length === 0 ? "Click the map to add a start point." : history.present.length === 1 ? "Add a destination to calculate the route." : route ? "Route ready. Drag a waypoint or click the route line to reshape it." : "Adjust the waypoints and try again."}</p>

          {route ? <RouteElevationChart points={route.geometry} units={units} cursorIndex={cursorIndex} onCursorChange={setCursorIndex} /> : null}
          {route ? <RouteInstructions maneuvers={route.maneuvers} units={units} selectedId={selectedManeuver?.id ?? null} onSelect={(maneuver) => { setSelectedManeuver(maneuver); setCursorIndex(nearestGeometryIndexByDistance(route.geometry, maneuver.routeDistanceMeters)); }} /> : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Route details</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Distance</dt><dd className="font-semibold tabular-nums">{route ? formatRouteDistance(route.distanceMeters, units) : "—"}</dd></div>
              <div><dt className="text-muted-foreground">Est. duration</dt><dd className="font-semibold tabular-nums">{route ? formatRouteDuration(route.durationSeconds) : "—"}</dd></div>
              <div><dt className="text-muted-foreground">Elevation gain</dt><dd className="font-semibold tabular-nums">{route ? formatRouteElevation(route.elevationGainMeters, units) : "—"}</dd></div>
              <div><dt className="text-muted-foreground">Elevation loss</dt><dd className="font-semibold tabular-nums">{route ? formatRouteElevation(route.elevationLossMeters, units) : "—"}</dd></div>
              <div><dt className="text-muted-foreground">Waypoints</dt><dd className="font-semibold tabular-nums">{history.present.length}</dd></div>
              <div><dt className="text-muted-foreground">Profile</dt><dd className="font-semibold">Road cycling</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Routing favors road cycling but cannot guarantee pavement quality, bicycle access, or safety. Review local conditions before riding.</p>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Waypoints</h2>
            {history.present.length ? <ol className="mt-3 space-y-2">{history.present.map((waypoint, index) => (
              <li key={waypoint.id} className={`rounded-lg border p-2 ${selectedWaypointIndex === index ? "border-primary bg-primary/5" : ""}`}>
                <div className="flex items-center gap-2"><button type="button" onClick={() => setSelectedWaypointIndex(index)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="block text-sm font-medium">{waypointName(index, history.present.length)}</span><span className="block truncate text-xs tabular-nums text-muted-foreground">{waypoint.coordinate[1].toFixed(5)}, {waypoint.coordinate[0].toFixed(5)}</span></button><Button size="icon-sm" className="size-10" variant="ghost" aria-label={`Move ${waypointName(index, history.present.length)} up`} onClick={() => reorderWaypoint(index, -1)} disabled={index === 0}><ArrowUp /></Button><Button size="icon-sm" className="size-10" variant="ghost" aria-label={`Move ${waypointName(index, history.present.length)} down`} onClick={() => reorderWaypoint(index, 1)} disabled={index === history.present.length - 1}><ArrowDown /></Button><Button size="icon-sm" className="size-10" variant="ghost" aria-label={`Remove ${waypointName(index, history.present.length)}`} onClick={() => { commit(removeWaypoint(history.present, index)); setSelectedWaypointIndex(null); }}><X /></Button></div>
              </li>
            ))}</ol> : <p className="mt-2 text-sm text-muted-foreground">No waypoints yet.</p>}
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Export &amp; sync</h2>
            <div className="mt-3 grid gap-2">
              <Button variant="outline" onClick={exportGpx} disabled={!route}><Download />Export GPX</Button>
              <Button variant="outline" onClick={exportTcx} disabled={!route?.maneuvers.length}><Download />Export TCX with cues</Button>
              {wahooConnected ? (
                <>
                  <Button onClick={() => void sendToWahoo()} disabled={!savedRoute || dirty || routing || publishing}>
                    {publishing ? <Loader2 className="animate-spin" /> : <Send />}
                    {publishing ? "Sending…" : "Send to Wahoo"}
                  </Button>
                  <Link className={buttonVariants({ variant: "outline" })} href="/api/integrations/wahoo/connect">
                    Reconnect Wahoo
                  </Link>
                </>
              ) : (
                <Link className={buttonVariants()} href="/api/integrations/wahoo/connect">Connect Wahoo</Link>
              )}
            </div>
            {wahooConnected && (!savedRoute || dirty) ? <p className="mt-2 text-xs text-muted-foreground">Save this route with a unique name before sending it to Wahoo.</p> : null}
            <p className="mt-2 text-xs text-muted-foreground">TCX cue export is experimental and has not been validated on an original ELEMNT BOLT.</p>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Saved routes</h2>{savedRouteId ? <Link href="/rides/routes/new" className={buttonVariants({ variant: "outline", size: "sm" })}>New route</Link> : null}</div>
            {savedRoutesLoading ? <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading saved routes…</p> : savedRoutesError ? <p role="alert" className="mt-3 text-sm text-destructive">{savedRoutesError}</p> : savedRoutes.length ? <ul className="mt-3 space-y-2">{savedRoutes.map((item) => <li key={item.id}><Link href={`/rides/routes/${item.id}/edit`} aria-current={savedRoute?.id === item.id ? "page" : undefined} className={`block rounded-lg border p-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${savedRoute?.id === item.id ? "border-primary bg-primary/5" : ""}`}><span className="block truncate text-sm font-medium">{item.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{formatRouteDistance(item.distanceMeters, units)} · {item.waypointCount} waypoints</span></Link></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Saved routes will appear here.</p>}
          </section>
        </aside>
      </div>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Clear this route?</AlertDialogTitle><AlertDialogDescription>This removes every waypoint from the editor. You can still undo immediately afterward.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { commit([]); setRoute(null); setSelectedWaypointIndex(null); setClearOpen(false); }}>Clear route</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={returnOpen} onOpenChange={setReturnOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>How should the route return?</AlertDialogTitle><AlertDialogDescription>Both options return to the exact starting point and can be undone afterward.</AlertDialogDescription></AlertDialogHeader><div className="grid gap-2"><AlertDialogAction variant="outline" className="h-auto justify-start px-4 py-3 text-left" onClick={() => returnToStart("out-and-back")}><span><span className="block font-medium">Out and back</span><span className="block text-xs font-normal text-muted-foreground">Use reverse shaping points to follow the outbound route back.</span></span></AlertDialogAction><AlertDialogAction variant="outline" className="h-auto justify-start px-4 py-3 text-left" onClick={() => returnToStart("best-route")}><span><span className="block font-medium">Best route back</span><span className="block text-xs font-normal text-muted-foreground">Let road-cycling routing choose the return from the current destination.</span></span></AlertDialogAction></div><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this saved route?</AlertDialogTitle><AlertDialogDescription>This removes the saved route and its stored geometry. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={deleting} onClick={() => void removeSaved()}>{deleting ? "Deleting…" : "Delete route"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
