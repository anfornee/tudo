# Routes Library and Road Cycling Route Planner

## Experience

The Rides page has separate entry points for the route library at `/rides/routes`
and the planner at `/rides/routes/new`. The library is the browsing and management
surface; the planner remains the editing workspace. Saved routes use
`/rides/routes/{routeId}` for details and `/rides/routes/{routeId}/edit` for the
planner. Both surfaces read and write the same route repository.

The library loads summary documents rather than full geometry sidecars. Cards use
a normalized SVG preview path stored with the summary, so a large collection does
not create a MapLibre instance per card. The grid supports name search, newest,
oldest, distance sorting, source filtering, Wahoo-state filtering, and progressive
24-card rendering. Legacy route summaries without preview paths load geometry only
for the first page as a compatibility fallback.

In the planner, click the map to add a start and destination,
then add more waypoints, drag markers, or click the calculated route line to
insert a shaping waypoint. Waypoint-list controls provide a keyboard-accessible
alternative to dragging. Adding or recalculating waypoints preserves the current
map position; fitting the route is an explicit action. Undo, redo, fit, remove,
and confirmed clear actions operate on the same authoritative waypoint history.
The Return to start action can append either a bounded set of reverse shaping
points from the calculated outbound geometry for an out-and-back route or only
the starting point so the provider chooses the best road-cycling route back.
Both are represented as ordinary, undoable waypoint edits.

The editor shows distance, provider-estimated duration, elevation gain/loss,
an elevation profile, and a collapsible maneuver list when the provider supplies
those values. Map and elevation cursors resolve against the same normalized
geometry by geometry index and cumulative distance. Unsaved new-route drafts are
kept in local browser storage, and destructive navigation warns when edits have
not been saved.

Road routing does not guarantee pavement quality, bicycle access, traffic safety,
or current closures. Riders must review local conditions.

## Map and routing architecture

Tudo reuses its existing MapLibre GL JS and shared map component. It does not add
Leaflet or a second map implementation. MapLibre GL Directions was evaluated:
the current 0.10.x line supports MapLibre GL JS 6, but Tudo already has draggable
markers, interactive route layers, and cursor primitives. Keeping React waypoint
state authoritative avoids introducing a second imperative route state and a new
dependency.

The browser sends normalized waypoint IDs/coordinates and preferences to
`POST /api/routes/directions`. The existing Next.js/Vercel backend authenticates
the session, applies input and request-size limits, and calls openrouteservice's
GeoJSON endpoint on `api.heigit.org` with the `cycling-road` profile. The private
key never reaches a client bundle. Requests time out after 20 seconds. Client
calculations are debounced and aborted when superseded, and a monotonic request
ID prevents stale responses from winning a race.

`lib/routes/openrouteservice.ts` is the provider boundary. It converts provider
geometry, waypoint indices, summaries, elevation, and numeric instruction types
into Tudo's provider-neutral `PlannedRoute`. Persisted components do not consume
raw openrouteservice response objects. Current preferences include an optional
avoid-ferries request; the model can add focused road-cycling preferences later
without becoming a general routing framework.

### Required environment variables

- `OPENROUTESERVICE_API_KEY` is required by the server route handler. Configure
  it in Vercel Production and in Preview only where route planning should work.
  Never prefix it with `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_ROUTE_MAP_STYLE_URL` is required by the browser map. It must point
  to a production-licensed MapLibre style whose source URLs and browser-visible
  token are permitted for the deployment. Browser map tokens are necessarily
  public and should be domain-restricted where the provider supports that.

The planner deliberately shows a configuration message instead of silently using
MapLibre demo tiles or an unauthenticated production basemap. Keep the MapLibre
attribution control enabled and follow the selected style/tile provider's required
attribution and traffic terms. The existing CARTO defaults elsewhere in Tudo are
not treated as production configuration for this planner; current CARTO terms
require an issued key and attribution for free basemap service.

## Data model and persistence

Route summaries live at `users/{uid}/routes/{routeId}`. They contain list-friendly
fields only: ownership, name/description, timestamps, revision, source/provider,
distance, duration, elevation totals, point/segment counts, start coordinate,
static preview path, original-import references, and the current Storage sidecar
path. Provider IDs remain separate in the server-only Wahoo integration record.

Normalized route payloads live at
`users/{uid}/routes/{routeId}/revisions/{revisionId}.json`. A payload contains:

- ordered stable waypoints and routing preferences;
- geometry points with coordinate, nullable elevation, and cumulative distance;
- ordered segment start indices, preserving discontinuous tracks;
- waypoint-to-geometry indices;
- normalized route totals;
- structured maneuvers with location, leg distance, duration, and route distance;
- provider/profile attribution metadata;
- source attribution and original filename.

Revisioned uploads avoid corrupting an existing save if a Firestore update fails.
After the Firestore pointer changes successfully, the client attempts to remove
the preceding revision. This sidecar design keeps long geometry and cue arrays
away from Firestore's document-size limit. Firestore and Storage rules both scope
routes below the authenticated UID. Saved payload reads use an authenticated
same-origin API route, which validates the Firestore pointer and downloads the
Storage object server-side instead of requiring browser CORS access to the bucket.
Original GPX and TCX files are retained at
`users/{uid}/routes/{routeId}/originals/{fileId}.{gpx|tcx}`. Storage rules restrict
these paths to the owning UID, the supported XML content types, and 10 MB. Deleting
a Tudo route removes its sidecars but deliberately does not delete a Wahoo copy.

Saved route names are unique per Tudo user after Unicode normalization,
whitespace folding, and case folding. A Firestore transaction claims the
normalized name at `users/{uid}/routeNames/{encodedNormalizedName}` while writing
the route, preventing concurrent creates or renames from claiming the same name.
Legacy summaries are also checked before the transaction. Wahoo publishing repeats
the check against Firestore and reloads the saved Storage sidecar, so unsaved
editor state or client-supplied geometry cannot be published.

## GPX and TCX import

The library accepts drag-and-drop or file-picker imports up to 10 MB. XML parsing
uses `fast-xml-parser` in the browser with DTD/entity declarations disabled. The
importer validates XML, coordinate ranges, and minimum geometry before creating a
canonical `PlannedRoute`.

GPX 1.0 and 1.1 track points and route points are supported. Multiple tracks and
routes are surfaced as separate candidates rather than silently discarded, and
multiple track segments remain separate in normalized geometry. Elevation is
preserved when present and deterministic distance/elevation totals are calculated.
Named GPX route points become cues.

TCX course tracks, laps containing tracks, multiple courses, elevation, notes, and
CoursePoints are supported. CoursePoint direction types are normalized into Tudo
maneuvers. A preview, editable name/description, statistics, source attribution,
and duplicate-file warning are shown before save. File SHA-256 fingerprints support
the warning; users can explicitly continue when the file intentionally contains
another route. Route-name uniqueness is still enforced independently.

## Exports

GPX export emits a GPX 1.1 track with ordered coordinates, available elevations,
name, description, road-cycling type, escaped XML, and a readable filename. It is
intended for ordinary breadcrumb navigation.

TCX export emits a Training Center Database v2 course with metric geometry,
synthetic monotonic course times, a course lap, trackpoints, and CoursePoints made
only from provider maneuvers. TCX v2 supports generic/left/right/straight cue
types, so slight and sharp turns map to their valid left/right parent while the
full provider instruction remains in `Notes`. TCX export is disabled when there
are no maneuvers and is labeled experimental.

The original ELEMNT and BOLT v1 do not generate arbitrary third-party turn alerts.
Wahoo documents reliable v1 turn-by-turn around its Take Me To flow and embedded
cues from RideWithGPS or Komoot. Tudo therefore does not claim BOLT v1 cue
compatibility until a generated file is tested on real hardware.

Wahoo publishing uses the existing `@garmin/fitsdk` dependency to generate a FIT
course containing file ID, course, lap, timer event, record, and course-point
messages. Geometry records preserve route distance, position, and available
elevation. Provider maneuvers become FIT course points; missing elevation is not
invented. This encoder remains separate from Tudo's FIT activity encoder because
activity and course files have different required semantics.

## Wahoo Cloud synchronization

The editor enables **Send to Wahoo** only for a saved route with no unsaved
changes. `POST /api/integrations/wahoo/routes` authenticates the Tudo session,
reloads the UID-owned summary and sidecar, generates the FIT course, and calls
Wahoo's Cloud Routes API entirely from the existing Vercel backend. A stable
`tudo-route-{routeId}` external ID is used for creation. The returned Wahoo ID is
kept in a server-only `users/{uid}/privateRouteIntegrations/{routeId}` document,
allowing later sends to update the same route without exposing integration state.

OAuth requests `user_read`, `offline_data`, `routes_read`, and `routes_write`.
Existing connections without `routes_read` must reconnect before manual
reconciliation. Access tokens are refreshed only when expired and immediately
before an API operation. Secrets and generated FIT bytes never enter the browser.
Wahoo notes Cloud API routes sync to the Wahoo app and ELEMNT computer but not the
legacy ELEMNT app.

Manual **Sync Wahoo** calls the documented route listing endpoint and reconciles
only routes visible to Tudo's Wahoo application. Wahoo restricts that response to
routes uploaded by the same application, so Tudo does not imply account-wide
Strava, Komoot, Wahoo, or other-app route import. GPX/TCX import is the supported
path for those routes.

Server-only sync records track Wahoo ID, stable external ID, last synced local
revision, last successful time, direction, remote provider update time, state, and
last error. Library and detail views expose not-synced, synced, local-pending,
failed, and conflict states. Reconciliation can recover an integration link from
the stable external ID. It never fabricates geometry from metadata. When Wahoo's
provider timestamp is newer than the last observed value, the state becomes a
conflict because Tudo cannot safely reconstruct the remote geometry; publishing
is blocked and duplicating the Tudo route is the safe-copy resolution.
No automatic destructive merge or Wahoo deletion occurs.

Remote FIT/route-file retrieval is deferred because it has not been validated
against the production API response and is unnecessary for reconciling routes Tudo
already owns. Automatic background sync and remote delete are also deferred.

## Verification and manual checks

Automated tests cover provider adaptation and failures, geometry/distance and
elevation, waypoint editing and history, stale response selection, defensive
payload parsing, GPX/TCX import and export, multiple segments/candidates, unsafe
XML, missing elevations/cues, atomic name helpers, mocked Wahoo response parsing
and conflict states, and Firebase owner-versus-stranger access.

Manual deployment checks still required:

1. Configure both environment variables and redeploy Vercel.
2. Deploy Firestore and Storage rules.
3. Create, reshape, save, reopen, duplicate, and delete a route on desktop.
4. Repeat core editing on an iPhone/PWA, including map gestures and marker drag.
5. Import representative GPX and TCX files from Strava, Komoot, Ride with GPS,
   and Wahoo, including a multi-track file.
6. Export imported routes into the intended navigation apps and test experimental
   TCX cues on an original ELEMNT BOLT before making any
   compatibility claim.
7. Reauthorize Wahoo with `routes_read routes_write`, send a saved route to a
   sandbox Wahoo account, sync a physical ELEMNT, then
   edit, save, and resend it to verify create/update reconciliation.

## Primary references

- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [MapLibre GL Directions compatibility](https://github.com/maplibre/maplibre-gl-directions)
- [openrouteservice directions responses](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/requests-and-return-types)
- [openrouteservice instruction types](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/instruction-types)
- [CARTO basemap terms](https://carto.com/legal/basemap-terms/)
- [Wahoo Cloud Routes API](https://cloud-api.wahooligan.com/#routes)
- [Wahoo legacy ELEMNT/BOLT route limitations](https://support.wahoofitness.com/hc/en-us/articles/21692905750290-Routes-for-ELEMNT-computers)
