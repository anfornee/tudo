"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  FileUp,
  Loader2,
  MapPinned,
  Plus,
  RefreshCw,
  Route as RouteIcon,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RoutePreview } from "@/components/routes/RoutePreview";
import {
  AlertDialog,
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
import { routeErrorMessage } from "@/lib/routes/errors";
import { formatRouteDistance, formatRouteElevation } from "@/lib/routes/formatters";
import { createRoutePreviewPath } from "@/lib/routes/geometry";
import { parseRouteFile, routeImportFingerprint, type ParsedRouteImport } from "@/lib/routes/import";
import { filterAndSortRoutes, type RouteLibrarySort, type RouteSyncFilter } from "@/lib/routes/library";
import { isUniqueRouteName } from "@/lib/routes/names";
import { createImportedRoute, listSavedRoutes, loadRoutePayload, type SavedRoute } from "@/lib/routes/persistence";

type SourceOption = "all" | "tudo" | "gpx" | "tcx" | "wahoo";
type SyncState = "not_synced" | "synced" | "pending" | "failed" | "conflict";

interface WahooStatus {
  status: SyncState;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
}

const PAGE_SIZE = 24;

function routeDate(route: SavedRoute) {
  return route.updatedAt?.toDate() ?? route.createdAt?.toDate() ?? null;
}

function sourceName(route: SavedRoute) {
  if (route.sourceLabel) return route.sourceLabel;
  return route.source === "tudo" ? "Tudo" : route.source.toUpperCase();
}

function SyncBadge({ status }: { status: SyncState }) {
  const content = status === "synced" ? ["Synced", "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300"]
    : status === "pending" ? ["Local changes", "text-amber-700 bg-amber-500/10 dark:text-amber-300"]
    : status === "failed" ? ["Sync failed", "text-destructive bg-destructive/10"]
    : status === "conflict" ? ["Conflict", "text-destructive bg-destructive/10"]
    : ["Not synced", "text-muted-foreground bg-muted"];
  return <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${content[1]}`}>{content[0]}</span>;
}

export function RoutesLibraryContent({ userId, wahooConnected }: { userId: string; wahooConnected: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [statuses, setStatuses] = useState<Record<string, WahooStatus>>({});
  const [units, setUnits] = useState<"imperial" | "metric">("imperial");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<RouteLibrarySort>("newest");
  const [source, setSource] = useState<SourceOption>("all");
  const [syncFilter, setSyncFilter] = useState<RouteSyncFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFingerprint, setImportFingerprint] = useState("");
  const [parsedImport, setParsedImport] = useState<ParsedRouteImport | null>(null);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [candidateName, setCandidateName] = useState("");
  const [candidateDescription, setCandidateDescription] = useState("");
  const [savedCandidateIds, setSavedCandidateIds] = useState<Set<string>>(new Set());
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const items = await listSavedRoutes(userId);
    setRoutes(items);
    return items;
  }

  async function refreshWahooStatuses() {
    if (!wahooConnected) return;
    const response = await fetch("/api/integrations/wahoo/routes", { cache: "no-store" });
    if (!response.ok) return;
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "routes" in body) {
      setStatuses((body as { routes: Record<string, WahooStatus> }).routes);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const [items, profile, statusResponse] = await Promise.all([
          listSavedRoutes(userId),
          getRiderProfile(userId),
          wahooConnected ? fetch("/api/integrations/wahoo/routes", { cache: "no-store" }) : Promise.resolve(null),
        ]);
        setRoutes(items);
        setUnits(profile?.preferredUnits ?? "imperial");
        if (statusResponse?.ok) {
          const body: unknown = await statusResponse.json();
          if (body && typeof body === "object" && "routes" in body) setStatuses((body as { routes: Record<string, WahooStatus> }).routes);
        }
        const legacyPreviews = await Promise.all(items.filter((route) => !route.previewPath).slice(0, PAGE_SIZE).map(async (route) => {
          try {
            const payload = await loadRoutePayload(route);
            return [route.id, createRoutePreviewPath(payload.route)] as const;
          } catch {
            return [route.id, ""] as const;
          }
        }));
        if (legacyPreviews.some(([, path]) => path)) {
          const previewMap = new Map(legacyPreviews);
          setRoutes((current) => current.map((route) => ({ ...route, previewPath: previewMap.get(route.id) || route.previewPath })));
        }
      } catch (loadError) {
        setError(routeErrorMessage(loadError, "Unable to load routes.", "Unable to load route library"));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [userId, wahooConnected]);

  const filteredRoutes = useMemo(() => {
    return filterAndSortRoutes(routes, { search, source, sync: syncFilter, sort, syncStatuses: statuses });
  }, [routes, search, sort, source, statuses, syncFilter]);

  const candidate = parsedImport?.candidates[candidateIndex] ?? null;
  const duplicateFile = Boolean(importFingerprint && routes.some((route) => route.sourceFingerprint === importFingerprint));
  const uniqueName = isUniqueRouteName(candidateName, routes);

  function selectCandidate(index: number, parsed = parsedImport) {
    const next = parsed?.candidates[index];
    if (!next) return;
    setCandidateIndex(index);
    setCandidateName(next.name);
    setCandidateDescription(next.description);
    setAllowDuplicate(false);
    setImportError(null);
  }

  async function processFile(file?: File) {
    if (!file) return;
    setImportOpen(true);
    setImporting(true);
    setImportError(null);
    setParsedImport(null);
    setSavedCandidateIds(new Set());
    try {
      const [parsed, fingerprint] = await Promise.all([parseRouteFile(file), routeImportFingerprint(file)]);
      setImportFile(file);
      setImportFingerprint(fingerprint);
      setParsedImport(parsed);
      selectCandidate(0, parsed);
    } catch (parseError) {
      setImportError(parseError instanceof Error ? parseError.message : "Unable to read this route file.");
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function saveCandidate() {
    if (!candidate || !importFile || importing) return;
    if (!uniqueName) {
      setImportError("Route names must be unique. Choose a different name before saving.");
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      await createImportedRoute(userId, candidateName, candidateDescription, {
        route: candidate.route,
        source: candidate.source,
        originalFile: importFile,
        sourceFingerprint: importFingerprint,
      });
      const nextSaved = new Set(savedCandidateIds).add(candidate.id);
      setSavedCandidateIds(nextSaved);
      const nextIndex = parsedImport?.candidates.findIndex((item) => !nextSaved.has(item.id)) ?? -1;
      await refresh();
      if (nextIndex >= 0) {
        selectCandidate(nextIndex);
        setNotice(`${candidateName} imported. ${parsedImport!.candidates.length - nextSaved.size} route${parsedImport!.candidates.length - nextSaved.size === 1 ? "" : "s"} remain in this file.`);
      } else {
        setImportOpen(false);
        setNotice(`${candidateName} imported.`);
      }
    } catch (saveError) {
      setImportError(routeErrorMessage(saveError, "Unable to import this route.", "Unable to import route"));
    } finally {
      setImporting(false);
    }
  }

  async function syncWahoo() {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/wahoo/routes/sync", { method: "POST" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body && typeof body === "object" && "error" in body ? String(body.error) : "Unable to sync Wahoo routes.");
      }
      await refreshWahooStatuses();
      setNotice("Wahoo route status refreshed.");
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Unable to sync Wahoo routes.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/rides" className="text-sm text-muted-foreground hover:text-foreground">Rides</Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">My Routes</h1>
          <p className="mt-1 text-sm text-muted-foreground">{loading ? "Loading routes…" : `${routes.length} saved route${routes.length === 1 ? "" : "s"}`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {wahooConnected ? <Button variant="outline" onClick={() => void syncWahoo()} disabled={syncing}>{syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}Sync Wahoo</Button> : null}
          <Button variant="outline" onClick={() => setImportOpen(true)}><FileUp />Import GPX / TCX</Button>
          <Link href="/rides/routes/new" className={buttonVariants()}><Plus />Create Route</Link>
        </div>
      </header>

      {wahooConnected ? <p className="-mt-3 text-xs text-muted-foreground">Wahoo sync reconciles routes previously sent by Tudo. Import a GPX or TCX file for routes created by other apps. <Link href="/api/integrations/wahoo/connect" className="font-medium text-foreground underline underline-offset-2">Reconnect Wahoo</Link> to grant updated route scopes.</p> : null}

      {notice ? <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"><CheckCircle2 className="size-4" />{notice}</div> : null}
      {error ? <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"><AlertTriangle className="size-4" />{error}</div> : null}

      <section aria-label="Route filters" className="grid gap-2 rounded-2xl border bg-card p-3 sm:grid-cols-[minmax(14rem,1fr)_auto_auto_auto]">
        <label className="relative">
          <span className="sr-only">Search routes</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Search routes" className="pl-9" />
        </label>
        <select aria-label="Sort routes" className="h-9 rounded-3xl bg-input/50 px-3 text-sm" value={sort} onChange={(event) => setSort(event.target.value as RouteLibrarySort)}>
          <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="distance-desc">Longest</option><option value="distance-asc">Shortest</option>
        </select>
        <select aria-label="Filter route source" className="h-9 rounded-3xl bg-input/50 px-3 text-sm" value={source} onChange={(event) => setSource(event.target.value as SourceOption)}>
          <option value="all">All sources</option><option value="tudo">Tudo</option><option value="gpx">GPX</option><option value="tcx">TCX</option><option value="wahoo">Wahoo</option>
        </select>
        {wahooConnected ? <select aria-label="Filter Wahoo sync status" className="h-9 rounded-3xl bg-input/50 px-3 text-sm" value={syncFilter} onChange={(event) => setSyncFilter(event.target.value as typeof syncFilter)}>
          <option value="all">All sync states</option><option value="synced">Synced</option><option value="not_synced">Not synced</option><option value="pending">Local changes</option><option value="failed">Failed</option><option value="conflict">Conflict</option>
        </select> : null}
      </section>

      {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /><span className="sr-only">Loading routes</span></div> : null}

      {!loading && !routes.length ? (
        <section className="rounded-3xl border border-dashed bg-card px-5 py-14 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted"><RouteIcon className="size-6" /></span>
          <h2 className="mt-4 text-lg font-semibold">Build your route library</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Create a route in Tudo or import GPX and TCX files from Strava, Komoot, Ride with GPS, Wahoo, and other cycling apps.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/rides/routes/new" className={buttonVariants()}><Plus />Create Route</Link>
            <Button variant="outline" onClick={() => setImportOpen(true)}><FileUp />Import GPX / TCX</Button>
            {!wahooConnected ? <Link href="/api/integrations/wahoo/connect" className={buttonVariants({ variant: "outline" })}><Cloud />Connect Wahoo</Link> : null}
          </div>
        </section>
      ) : null}

      {!loading && routes.length && !filteredRoutes.length ? <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">No routes match these filters.</div> : null}

      <section aria-label="Saved routes" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredRoutes.slice(0, visibleCount).map((route) => {
          const updated = routeDate(route);
          return (
            <Link key={route.id} href={`/rides/routes/${route.id}`} className="group overflow-hidden rounded-3xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
              <RoutePreview path={route.previewPath} className="aspect-[16/9] border-b" label={`Map preview for ${route.name}`} />
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h2 className="truncate font-semibold group-hover:text-primary">{route.name}</h2><p className="mt-1 truncate text-xs text-muted-foreground">{sourceName(route)}{updated ? ` · ${updated.toLocaleDateString()}` : ""}</p></div>
                  {wahooConnected ? <SyncBadge status={statuses[route.id]?.status ?? "not_synced"} /> : null}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="block text-xs text-muted-foreground">Distance</span><strong className="font-medium">{formatRouteDistance(route.distanceMeters, units)}</strong></div>
                  <div><span className="block text-xs text-muted-foreground">Elevation</span><strong className="font-medium">{formatRouteElevation(route.elevationGainMeters, units)}</strong></div>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPinned className="size-3.5" />Starts at {route.startLatitude.toFixed(3)}, {route.startLongitude.toFixed(3)}</p>
              </div>
            </Link>
          );
        })}
      </section>
      {filteredRoutes.length > visibleCount ? <div className="text-center"><Button variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Load more</Button></div> : null}

      <input ref={fileInput} type="file" accept=".gpx,.tcx,application/gpx+xml,application/vnd.garmin.tcx+xml" className="sr-only" onChange={(event) => void processFile(event.target.files?.[0])} />
      <AlertDialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) setImportError(null); }}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <AlertDialogHeader><AlertDialogTitle>Import GPX or TCX</AlertDialogTitle><AlertDialogDescription>Preview the route, confirm its details, and save it to your library.</AlertDialogDescription></AlertDialogHeader>
          {!parsedImport ? (
            <button type="button" className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-muted/30 p-6 text-center hover:bg-muted/60" onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void processFile(event.dataTransfer.files[0]); }}>
              {importing ? <Loader2 className="size-7 animate-spin" /> : <FileUp className="size-7" />}
              <span className="font-medium">{importing ? "Reading route file…" : "Drop a file here or choose a file"}</span>
              <span className="text-xs text-muted-foreground">GPX 1.0/1.1 or TCX, up to 10 MB</span>
            </button>
          ) : candidate ? (
            <div className="space-y-4">
              {parsedImport.candidates.length > 1 ? <div className="space-y-2"><Label htmlFor="route-candidate">Route in file</Label><select id="route-candidate" className="h-10 w-full rounded-xl border bg-background px-3 text-sm" value={candidateIndex} onChange={(event) => selectCandidate(Number(event.target.value))}>{parsedImport.candidates.map((item, index) => <option key={item.id} value={index} disabled={savedCandidateIds.has(item.id)}>{item.name}{savedCandidateIds.has(item.id) ? " (saved)" : ""}</option>)}</select><p className="text-xs text-muted-foreground">This file contains {parsedImport.candidates.length} routes or tracks. Each one is shown separately.</p></div> : null}
              <RoutePreview path={createRoutePreviewPath(candidate.route)} className="aspect-[16/7] rounded-2xl border" />
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="import-name">Route name</Label><Input id="import-name" value={candidateName} maxLength={120} onChange={(event) => setCandidateName(event.target.value)} aria-invalid={!uniqueName} />{!uniqueName ? <p className="text-xs text-destructive">Route names must be unique.</p> : null}</div><div className="space-y-2"><Label htmlFor="import-description">Description</Label><Input id="import-description" value={candidateDescription} maxLength={1000} onChange={(event) => setCandidateDescription(event.target.value)} /></div></div>
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-3 text-sm"><div><span className="block text-xs text-muted-foreground">Distance</span>{formatRouteDistance(candidate.route.distanceMeters, units)}</div><div><span className="block text-xs text-muted-foreground">Elevation</span>{formatRouteElevation(candidate.route.elevationGainMeters, units)}</div><div><span className="block text-xs text-muted-foreground">Segments</span>{candidate.route.segmentStartIndices.length}</div></div>
              {duplicateFile ? <label className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm"><input type="checkbox" className="mt-0.5" checked={allowDuplicate} onChange={(event) => setAllowDuplicate(event.target.checked)} /><span><strong className="block">This file was imported before</strong><span className="text-muted-foreground">Save another route from it only if that is intentional.</span></span></label> : null}
            </div>
          ) : null}
          {importError ? <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{importError}</p> : null}
          <AlertDialogFooter><AlertDialogCancel>Close</AlertDialogCancel>{parsedImport ? <Button variant="outline" onClick={() => fileInput.current?.click()}>Choose another file</Button> : null}{candidate ? <Button onClick={() => void saveCandidate()} disabled={importing || !uniqueName || (duplicateFile && !allowDuplicate)}>{importing ? <Loader2 className="animate-spin" /> : <FileUp />}Save route</Button> : !importing ? <Button onClick={() => fileInput.current?.click()}>Choose file</Button> : null}</AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
