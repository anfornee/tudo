# Road Cycling Route Planner

## Experience

The Rides page links to `/rides/routes`, where an authenticated user can create
and manage road-cycling routes. Click the map to add a start and destination,
then add more waypoints, drag markers, or click the calculated route line to
insert a shaping waypoint. Waypoint-list controls provide a keyboard-accessible
alternative to dragging. Undo, redo, fit, remove, and confirmed clear actions
operate on the same authoritative waypoint history.

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
GeoJSON endpoint with the `cycling-road` profile. The private key never reaches a
client bundle. Requests time out after 20 seconds. Client calculations are
debounced and aborted when superseded, and a monotonic request ID prevents stale
responses from winning a race.

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
fields only: ownership, name/description, timestamps, distance, duration,
elevation totals, waypoint count, provider/profile, start coordinate, and the
current Storage sidecar path.

Normalized route payloads live at
`users/{uid}/routes/{routeId}/revisions/{revisionId}.json`. A payload contains:

- ordered stable waypoints and routing preferences;
- geometry points with coordinate, nullable elevation, and cumulative distance;
- waypoint-to-geometry indices;
- normalized route totals;
- structured maneuvers with location, leg distance, duration, and route distance;
- provider/profile attribution metadata.

Revisioned uploads avoid corrupting an existing save if a Firestore update fails.
After the Firestore pointer changes successfully, the client attempts to remove
the preceding revision. This sidecar design keeps long geometry and cue arrays
away from Firestore's document-size limit. Firestore and Storage rules both scope
routes below the authenticated UID. No composite Firestore index or migration is
required.

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

FIT course export is intentionally deferred. A course requires FIT `course`,
`record`, `lap`, and `course_point` semantics and cannot reuse Tudo's FIT activity
encoder as though it were a route.

## Wahoo Cloud future path

Wahoo's Cloud API currently supports `POST /v1/routes` with `routes_write`. It
requires a base64 FIT course plus a stable external ID, provider update timestamp,
route metadata, start coordinate, distance, and ascent. Tudo's route ID,
normalized route model, timestamps, and provider metadata are suitable inputs for
that future adapter.

Publishing is not part of this MVP. The existing OAuth connection requests only
`user_read` and `offline_data`; adding `routes_write` requires an intentional
re-authorization flow, FIT course encoding, create/update reconciliation, and
device testing. Wahoo also notes Cloud API routes sync to the Wahoo app and ELEMNT
computer but not the legacy ELEMNT app.

## Verification and manual checks

Automated tests cover provider adaptation and failures, geometry/distance and
elevation, waypoint editing and history, stale response selection, defensive
payload parsing, GPX output, TCX CoursePoints, missing elevations/cues, and
Firebase owner-versus-stranger access.

Manual deployment checks still required:

1. Configure both environment variables and redeploy Vercel.
2. Deploy Firestore and Storage rules.
3. Create, reshape, save, reopen, duplicate, and delete a route on desktop.
4. Repeat core editing on an iPhone/PWA, including map gestures and marker drag.
5. Import representative GPX and TCX exports into the intended navigation apps.
6. Test experimental TCX cues on an original ELEMNT BOLT before making any
   compatibility claim.

## Primary references

- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [MapLibre GL Directions compatibility](https://github.com/maplibre/maplibre-gl-directions)
- [openrouteservice directions responses](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/requests-and-return-types)
- [openrouteservice instruction types](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/instruction-types)
- [CARTO basemap terms](https://carto.com/legal/basemap-terms/)
- [Wahoo Cloud Routes API](https://cloud-api.wahooligan.com/#routes)
- [Wahoo legacy ELEMNT/BOLT route limitations](https://support.wahoofitness.com/hc/en-us/articles/21692905750290-Routes-for-ELEMNT-computers)
