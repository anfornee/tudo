# Ride Logging

## Current experience

Authenticated users can open `/rides`, choose or drop a `.fit` or `.gpx` cycling activity, review its normalized summary, and save it. Processing happens locally in the browser and shows a non-percentage loading state. Unsupported, empty, oversized (over 10 MB), malformed, and unusable activities produce a retryable error.

Saved rides appear newest activity first and open at `/rides/{rideId}`. New rides retain an aligned detail timeline and the detail route displays responsive power, speed, cadence, and elevation charts. Power, speed, and cadence use elapsed time on the horizontal axis; elevation uses cumulative distance. Older rides continue to display their summary with a detailed-data unavailable state.

The rides overview derives a recent weekly-distance chart, ride calendar, and weekly streaks from saved summary documents. It does not download detailed samples for historical rides.

The dashboard includes a compact latest-ride card with distance, duration, and
elevation. It links to the latest saved summary or to Ride Logging when no ride
has been saved.

## Parsing and normalization

The existing `parseZwiftFit` parser uses the Garmin FIT SDK. The existing `analyzeGpx` parser reads GPX track points and derives distance, duration, speed, and elevation while retaining supported power, cadence, and heart-rate extensions. Both normalize into the shared `RideData` model before UI or persistence. `RideData.samples` is the canonical aligned timeline: elapsed seconds plus nullable power, speed in mph, cadence, elevation in feet, and cumulative distance in miles. Unit conversion happens during normalization.

Missing optional metrics remain `null` and are omitted from the summary. A missing optional sensor stream does not invalidate an otherwise usable ride.

## Persistence

Summary documents live at `users/{uid}/rides/{rideId}`. They contain owner UID, activity/import timestamps, original filename and source, original Storage path, and summary metrics for distance, time, speed, elevation, calories, power, cadence, and heart rate.

Large `RideData` analysis/sample arrays are intentionally not stored in Firestore. A new ride with timeline data stores a versioned `samples.v1.json` sidecar in Storage beside its original file and adds the optional sidecar path to its summary document. This keeps list, calendar, dashboard, and weekly-history reads small while allowing a detail page to fetch one ride's samples. The version wrapper allows the representation to evolve without guessing its shape.

The original file is stored at `users/{uid}/rides/{rideId}/original.fit` or `original.gpx`; detailed samples use `users/{uid}/rides/{rideId}/samples.v1.json`. Both upload before the summary document is created. If any save step fails, the client attempts to remove uploaded artifacts. Authenticated users can access only ride documents and files beneath their own UID. Local development uses the Firestore and Storage emulators.

## History conventions

Calendar grouping uses local calendar dates rather than UTC date strings. Weeks start on Monday throughout aggregation, charts, and streak calculations. A successful week has at least one ride. If the current week has a ride it extends the current streak; if it does not yet, the streak is measured backward from the previous week so an unfinished week does not prematurely break it. The longest streak is the longest sequence of occupied Monday-based weeks.

## Future direction

The preserved source files for older rides can be reprocessed later to create sample sidecars without changing their summary documents. The aligned timeline and history utilities also provide a base for power-zone distribution, power-duration curves, training analysis, comparisons, and personal records.

## Wahoo ride imports

The personal Wahoo webhook maps one Wahoo account to one Tudo account. It accepts
new `workout_summary` events at `POST /api/webhooks/wahoo`, downloads cycling FIT
files from Wahoo's CDN, normalizes them through the same FIT import path as manual
uploads, and saves them beneath the configured Tudo user.

### Deployment configuration

Set these server environment variables on the deployed Tudo app:

- `WAHOO_WEBHOOK_TOKEN` is a random shared secret. Enter the same value in the
  Wahoo developer portal's `webhook_token` setting.
- `WAHOO_USER_ID` is the numeric Wahoo account ID. Use Wahoo's authenticated
  user endpoint with the `user_read` scope to look it up.
- `WAHOO_TUDO_UID` is the receiving account's Firebase Authentication UID.
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` must identify the Firebase Storage
  bucket used by the rest of the Rides module. The existing Firebase Admin
  project and credential variables must also be configured.

Authorize the approved Wahoo developer app through Wahoo OAuth with
`offline_data`; add `user_read` while looking up the account ID. Account
authorization is done separately from this receiver. Once the receiver is
deployed, set `webhook_enabled`, set `webhook_url` to
`https://<tudo-domain>/api/webhooks/wahoo`, and configure the matching
`webhook_token`. Use a new cycling activity to verify delivery. Wahoo retries
non-200 responses after 30 minutes, 4 hours, 24 hours, and 72 hours, and may
send duplicate events. See the [Wahoo Cloud API reference](https://cloud-api.wahooligan.com/#webhooks).

### Import and security behavior

The route rejects an unconfigured receiver, invalid shared token, unexpected
Wahoo user, non-cycling activity, oversized request or FIT file, and download
URLs outside `https://cdn.wahooligan.com`. Wahoo workout IDs produce stable
`wahoo-{workoutId}` ride IDs. Firestore's create operation provides the final
duplicate guard when concurrent webhook deliveries race.

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
