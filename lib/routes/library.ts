import type { RouteSourceType } from "./types.ts";

export type RouteLibrarySort = "newest" | "oldest" | "distance-desc" | "distance-asc";
export type RouteSyncFilter = "all" | "not_synced" | "synced" | "pending" | "failed" | "conflict";

export interface RouteLibrarySummary {
  id: string;
  name: string;
  source: RouteSourceType;
  distanceMeters: number;
  updatedAt: { toMillis(): number } | null;
  createdAt: { toMillis(): number } | null;
}

export function filterAndSortRoutes<T extends RouteLibrarySummary>(
  routes: readonly T[],
  options: {
    search: string;
    source: "all" | RouteSourceType;
    sync: RouteSyncFilter;
    sort: RouteLibrarySort;
    syncStatuses: Readonly<Record<string, { status: Exclude<RouteSyncFilter, "all"> } | undefined>>;
  },
) {
  const query = options.search.trim().toLocaleLowerCase();
  return routes.filter((route) => (
    (!query || route.name.toLocaleLowerCase().includes(query)) &&
    (options.source === "all" || route.source === options.source) &&
    (options.sync === "all" || (options.syncStatuses[route.id]?.status ?? "not_synced") === options.sync)
  )).sort((left, right) => {
    if (options.sort === "distance-asc") return left.distanceMeters - right.distanceMeters;
    if (options.sort === "distance-desc") return right.distanceMeters - left.distanceMeters;
    const leftTime = left.updatedAt?.toMillis() ?? left.createdAt?.toMillis() ?? 0;
    const rightTime = right.updatedAt?.toMillis() ?? right.createdAt?.toMillis() ?? 0;
    return options.sort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });
}
