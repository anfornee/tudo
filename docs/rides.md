# Ride Logging

## Current experience

Authenticated users can open `/rides`, choose or drop a `.fit` or `.gpx` cycling activity, review its normalized summary, and save it. Processing happens locally in the browser and shows a non-percentage loading state. Unsupported, empty, oversized (over 10 MB), malformed, and unusable activities produce a retryable error.

Saved rides appear newest activity first and open at `/rides/{rideId}`. The previous-rides list initially shows five rides and expands five at a time. New rides retain an aligned detail timeline and the detail route displays responsive power, speed, cadence, and elevation charts. Power, speed, and cadence use elapsed time on the horizontal axis; elevation uses cumulative distance. Older rides continue to display their summary with a detailed-data unavailable state.

The rides overview derives a recent weekly-distance chart, ride calendar, and weekly streaks from saved summary documents. It does not download detailed samples for historical rides.

The dashboard includes a compact latest-ride card with distance, duration, and
elevation. It links to the latest saved summary or to Ride Logging when no ride
has been saved.

The Rides page also includes an understated Route Planner entry. The planner at
`/rides/routes` creates, saves, edits, and exports road-cycling courses without
mixing planned routes into recorded-ride history. See [`routes.md`](./routes.md)
for routing, persistence, export, setup, and device-compatibility details.

## Parsing and normalization

The existing `parseZwiftFit` parser uses the Garmin FIT SDK. The existing `analyzeGpx` parser reads GPX track points and derives distance, duration, speed, and elevation while retaining supported power, cadence, and heart-rate extensions. Both normalize into the shared `RideData` model before UI or persistence. `RideData.samples` is the canonical aligned timeline: elapsed seconds plus nullable power, speed in mph, cadence, elevation in feet, and cumulative distance in miles. Unit conversion happens during normalization.

Missing optional metrics remain `null` and are omitted from the summary. A missing optional sensor stream does not invalidate an otherwise usable ride.

## Persistence

Summary documents live at `users/{uid}/rides/{rideId}`. They contain owner UID, activity/import timestamps, original filename and source, original Storage path, and summary metrics for distance, time, speed, elevation, calories, power, cadence, and heart rate.

Large `RideData` analysis/sample arrays are intentionally not stored in Firestore. A new ride with timeline data stores a versioned `samples.v1.json` sidecar in Storage beside its original file and adds the optional sidecar path to its summary document. This keeps list, calendar, dashboard, and weekly-history reads small while allowing a detail page to fetch one ride's samples. The version wrapper allows the representation to evolve without guessing its shape.

The original file is stored at `users/{uid}/rides/{rideId}/original.fit` or `original.gpx`; detailed samples use `users/{uid}/rides/{rideId}/samples.v1.json`. Both upload before the summary document is created. If any save step fails, the client attempts to remove uploaded artifacts. Authenticated users can access only ride documents and files beneath their own UID. Local development uses the Firestore and Storage emulators.

Ride summaries preserve source-reported `calories` and store computed provenance
separately in `calorieAnalysis`. Manual FIT/GPX uploads, Wahoo imports, and
explicit re-analysis all use the same pure estimator. Older summaries receive
missing metadata once when opened, without rewriting an existing estimate. See
[`rider-profile.md`](./rider-profile.md) for profile versioning, formulas,
confidence, and fallback policies.

## Synchronized cursor and FIT export

Ride detail charts and the route map share one transient `RideCursor`. Charts
resolve pointer positions against the canonical sample array (with cached
timestamp/distance lookup tables), while the map spatially indexes the original
route geometry. A user interaction updates the cursor once; charts and the map
only render the resulting position, which avoids feedback loops. Older sample
sidecars remain synchronized through cumulative-distance alignment with the
retained source route; re-analysis is not required. New sidecars use their
exact recorded GPS sample for the marker when it is available.

New normalized samples retain optional timestamp, latitude, longitude, heart
rate, and temperature fields. Null or unavailable sensor fields stay absent or
null and are not invented during export.

`Export FIT` downloads the retained original bytes for imported FIT rides. For
GPX rides it uses the already-installed `@garmin/fitsdk` encoder to create a
FIT file containing file, session, lap, activity, and record messages. Values
are converted to FIT units (semicircles, meters, meters/second, feet/meters)
and optional record fields are emitted only when present. Export is entirely
local; no activity data is uploaded to a conversion service.

Known limitations: generated FIT activity names are currently not represented
by the FIT profile's standard activity messages, and rides without detailed
samples cannot generate a new FIT file. Original FIT downloads retain all
source fields exactly.

## History conventions

Calendar grouping uses local calendar dates rather than UTC date strings. Weeks start on Monday throughout aggregation, charts, and streak calculations. A successful week has at least one ride. If the current week has a ride it extends the current streak; if it does not yet, the streak is measured backward from the previous week so an unfinished week does not prematurely break it. The longest streak is the longest sequence of occupied Monday-based weeks.

## Future direction

The preserved source files for older rides can be reprocessed later to create sample sidecars without changing their summary documents. The aligned timeline and history utilities also provide a base for power-zone distribution, power-duration curves, training analysis, comparisons, and personal records.

## Wahoo ride imports

Tudo's Wahoo integration runs in the existing Next.js deployment. The OAuth
start/callback Route Handlers and `POST /api/webhooks/wahoo` are Node.js Vercel
Functions in production; Firebase remains the data and authentication layer, so
this integration does not require Firebase Cloud Functions or a second backend.

An authenticated user starts OAuth from the Rides page. Tudo requests
`user_read`, `offline_data`, and `routes_write`, exchanges the returned code on
the server, and
uses Wahoo's authenticated-user endpoint to associate the numeric Wahoo user ID
with the current Firebase UID. New `workout_summary` events then resolve that
private mapping, download cycling FIT files from Wahoo's CDN, normalize them
through the same FIT import path as manual uploads, and save them beneath the
associated Tudo user.

### Deployment configuration

Set these server environment variables in the Vercel project. Assign them to
Production and to Preview only if preview deployments need to test Wahoo, then
redeploy so the Functions receive the updated environment:

- `WAHOO_CLIENT_ID` is the Wahoo developer application's client ID.
- `WAHOO_CLIENT_SECRET` is the confidential Wahoo application secret.
- `WAHOO_WEBHOOK_TOKEN` is a random shared secret. Enter the same value in
  Wahoo's `webhook_token` setting.
- `WAHOO_REDIRECT_URI` is recommended in production and must exactly match the
  redirect registered with Wahoo:
  `https://<tudo-domain>/api/integrations/wahoo/callback`. If omitted, Tudo
  derives it from the incoming request origin, which is useful locally but can
  be ambiguous across Vercel preview domains.
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` must identify the Firebase Storage
  bucket used by the rest of the Rides module. The existing Firebase Admin
  project and credential variables must also be configured.

Deploy the checked-in Firestore rule and collection-group index once with
`firebase deploy --only firestore:rules,firestore:indexes`. This makes the
private Wahoo-user lookup available to the Vercel webhook; it does not deploy a
Firebase Function. The index configuration also prevents OAuth token fields
from receiving unnecessary automatic indexes.

Do not prefix the Wahoo variables with `NEXT_PUBLIC_`; the client secret,
webhook token, access token, and refresh token must remain server-only. After
deploying, set `webhook_enabled` in the Wahoo developer portal, set
`webhook_url` to `https://<tudo-domain>/api/webhooks/wahoo`, configure the
matching `webhook_token`, and use **Connect Wahoo** on the Rides page. Use a new
cycling activity to verify delivery. Wahoo retries non-200 responses after 30
minutes, 4 hours, 24 hours, and 72 hours, and may send duplicate events. See the
[Wahoo Cloud API reference](https://cloud-api.wahooligan.com/#webhooks).

`WAHOO_USER_ID` and `WAHOO_TUDO_UID` are no longer required for a newly
authorized account. The receiver still accepts that pair as a legacy fallback
so an existing manually configured deployment can migrate without an import
interruption.

### Import and security behavior

OAuth uses a short-lived HttpOnly, SameSite state cookie bound to the initiating
Firebase user. The Wahoo user ID and OAuth tokens are stored at
`users/{uid}/privateIntegrations/wahoo`; Firestore client rules explicitly deny
all reads and writes to this path. Only Firebase Admin in the Vercel Functions
can access it. The Rides page derives only a boolean connection status on the
server; OAuth credentials are never passed to a client component. Tudo refreshes
an expired access token only immediately before a Wahoo API request and stores
the rotated access and refresh tokens server-side.

The webhook rejects an unconfigured receiver, invalid shared token, non-cycling
activity, oversized request or FIT file, and download URLs outside
`https://cdn.wahooligan.com`. Events for Wahoo users without a Tudo mapping are
acknowledged and ignored. Wahoo workout IDs produce stable `wahoo-{workoutId}`
ride IDs. Firestore's create operation provides the final duplicate guard when
concurrent webhook deliveries race.

Wahoo imports store their original FIT and optional sample sidecar below
`users/{uid}/rides/wahoo-{workoutId}/{deliveryId}/`; the summary document retains
the exact paths. The random delivery directory lets a losing concurrent import
remove only its own files. Firebase Admin performs these server-side writes;
client Firestore and Storage rules remain UID-scoped for subsequent reads and
user-initiated deletion.

Automatic import begins with webhook events received after authorization; it
does not backfill workout history. Wahoo also does not expose completed workout
data originating from third-party applications. Previously completed rides can
still be imported through Tudo's manual upload flow.
