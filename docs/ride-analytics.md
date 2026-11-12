# Ride analytics architecture

## Scope and existing architecture

Ride imports already normalize FIT and GPX files into `RideData` and its aligned
`RideSample[]` timeline. Browser uploads store the original activity and a
versioned sample sidecar in Storage, then write a small summary at
`users/{uid}/rides/{rideId}`. Wahoo webhooks run the same FIT normalization on a
Node.js Route Handler and use Firebase Admin for the same Storage/Firestore
layout. Ride deletion removes the stored paths referenced by the summary.

Phase 1 reuses those parsers, sidecars, documents, authentication, and Firebase
Admin setup. Analytics are embedded in the existing ride document because the
result is small, is read with the ride, and has a one-to-one lifecycle. No large
sample arrays are copied into Firestore. The existing UID-scoped ride and
Storage rules already cover the data, so no new persisted path or relaxed rule
is required.

## Calculation flow

`calculateRideAnalytics` is a deterministic, framework-independent function. It
accepts activity summary values, provenance, and normalized samples. Results
include activity, speed, power, cadence, heart-rate, availability, and the
measured-power duration curve for 5, 15, 30, 60, 120, 180, 300, 480, 600, 900,
1200, 1800, 2700, and 3600 seconds.

Irregular records are modeled as piecewise recorded values only until the next
record. A gap over five seconds, a missing value, or a non-increasing timestamp
breaks continuity. Zero is a valid measured value. Mean maximal power uses
duration-weighted integration and never crosses a break. Normalized power uses
30-second duration-weighted rolling means at a one-second evaluation cadence,
then the established fourth-power mean. Estimated power remains identified but
is excluded from measured power metrics and duration records.

Moving time retains parser semantics: FIT uses timer time and GPX currently uses
elapsed time. Average moving speed is distance divided by that normalized moving
time. No climb detection is added; the schema reserves nullable largest-climb
and longest-climb fields.

## Persisted model and versioning

Each ride may contain:

- `sourceRevision`: the immutable versioned sample-sidecar path (or original
  source path when a sidecar is unavailable).
- `powerProvenance`: `measured`, `estimated`, or `unavailable`.
- `analytics`: schema version, algorithm version, ride/source identity,
  calculation and activity dates, metrics, availability, and power-duration
  efforts. Each effort retains elapsed and optional absolute start/end times.
- `analyticsProcessing`: `pending`, `processing`, `completed`, or `failed`, plus
  version, source revision, attempt/success timestamps, lease fields, and a
  sanitized error.

Version constants live with the analytics model. A result is current only when
both its algorithm version and source revision match. Historical rides without
metadata are therefore discoverable without a migration. Re-analysis writes a
new sidecar path, which invalidates the prior result without changing raw data.

## Processing and failure recovery

Browser saves invoke the authenticated per-ride analytics Route Handler after
the source and ride document are durable. Wahoo imports call the same server
service directly. Analytics failure never rolls back a successfully imported
ride.

The service transactionally claims a five-minute lease. Duplicate requests with
an active matching lease return `busy`; current results return `skipped`; an
expired lease is reclaimable. Completion and failure transactions require the
same lease token and source revision, preventing a stale worker from overwriting
a newer revision. Detailed exceptions are logged server-side while only a
sanitized status is persisted and returned.

## Backfills and future aggregation

Server-only helpers scan ride documents in bounded, cursor-based pages, identify
missing/failed/outdated work, and process explicit batches. Normal mode skips
current rides; forced mode rebuilds them. These helpers use stored sidecars and
never redownload from Wahoo. There is intentionally no bulk public endpoint or
management UI in Phase 1.

Large libraries should run these batch primitives from a future durable,
resumable workflow rather than an unawaited Promise or `after()`. Per-ride
analytics already contains the activity date, totals, sensor availability, and
power-duration origin metadata needed for future annual/lifetime totals and
personal-record reducers without reopening FIT files.

Historical rides lacking a sample sidecar cannot yet be analyzed server-side.
They remain discoverable and receive a recoverable `source_data_unavailable`
state; the existing original-file re-analysis path can create a sidecar first.

## Profile aggregates

Profile analytics are stored at `users/{uid}/profileAnalytics/ride`; resumable
rebuild state lives at `users/{uid}/profileAnalytics/rebuild`. Monthly history
checkpoints live at `users/{uid}/profileAnalytics/history`. All three documents
are server-managed and read through authenticated Route Handlers. The profile
summary contains lifetime statistics, a map of calendar-year statistics, data
coverage, personal records, schema/policy versions, source generation,
calculation time, and calendar timezone.

Ride analytics algorithm version 2 adds per-sensor `sampleCount`,
`validDurationSeconds`, and `valueSeconds`. These compact denominators allow
profile aggregates to be rebuilt without sample sidecars:

- moving speed is total qualifying distance divided by total qualifying moving
  time;
- measured and estimated power have separate duration-weighted averages;
- cadence and heart rate are weighted by their valid recorded durations;
- missing sensors contribute neither a value nor a zero;
- the descriptive normalized-power metric is explicitly named
  `durationWeightedRideNormalizedPowerWatts`. It weights each ride-level NP by
  that ride's valid measured-power duration. It is not equivalent to one NP
  calculation over concatenated raw rides.

All units remain the ride domain's canonical miles, seconds, feet, miles per
hour, watts, RPM, and BPM. Every average retains contributing ride counts and
duration denominators.

Annual grouping uses the user's saved notification timezone when available and
UTC otherwise. The timezone is persisted with the aggregate. A timezone change
makes the read result stale and the next rebuild regroups rides. Activity dates,
never import dates, determine the year.

## Coverage semantics

Coverage distinguishes total stored rides from rides with current analytics.
It separately counts pending, failed/unavailable, and outdated rides, plus rides
with measured power, estimated power, cadence, and heart rate. Only analytics
whose schema/algorithm version, source revision, and completed processing state
all match the ride contribute statistics or records. A stale aggregate may be
returned with `fresh: false`; consumers must not present it as complete/current.

## Personal records

The profile stores longest distance, longest moving duration, greatest total
ascent, highest recorded speed, highest measured power, fastest qualifying
average speed, and all Phase 1 power-duration intervals. A fastest-average ride
must cover at least 5 miles and 15 moving minutes. These constants are centralized
with the profile model.

Only measured power establishes measured-power and power-duration records.
Records retain canonical units, ride ID, activity date, analytics algorithm and
source revision, and effort start/end positions when relevant. Ties choose the
earlier activity date, then the lexicographically smaller ride ID. Individual
climb records remain null until a trustworthy climb detector exists.

Records are derived during reconciliation rather than assumed to improve
monotonically. Deleting or correcting a record holder therefore selects the
next qualifying ride from persisted analytics without reading FIT/GPX data.

## Profile synchronization and rebuilding

Tudo uses a coalesced deterministic rebuild, not non-transactional incremental
arithmetic. Ride processing claims invalidate the current profile; successful
analytics commits and server-side deletions atomically increment a per-user
source generation. Ordinary events then run bounded reconciliation batches.

Each batch scans at most 100 ride documents by document-ID cursor and persists a
small accumulator, progress count, target generation, and lease. It is safe to
retry or resume after interruption. Finalization transactionally verifies both
the lease token and source generation, so an older rebuild cannot overwrite
results after a concurrent import, re-analysis, or deletion. The same source
documents, policy version, timezone, and generation produce the same result.

Automatic processing attempts up to three batches, which completes fewer than
300 rides in the common path. Libraries at or above that boundary remain
`pending` until the authenticated Phase 3 resync coordinator continues the
persisted rebuild in later bounded requests. No unawaited background Promise is
treated as a durable queue.

## Profile Stats UI and comparisons

The Rides page reads the authenticated profile contract once and places Profile
Stats directly below Annual Stats. The compact section shows lifetime weighted
averages, key totals and records, and four common measured-power bests; native
expanders reveal secondary accomplishments and the full 14-duration list.
Record cards link to their originating ride. Canonical values are converted at
render time using the Rider Profile unit preference.

Coverage text always identifies how many stored rides have current analytics.
A stale result remains useful as an explicitly last-calculated summary while a
rebuild is pending, but it is not used for ride comparisons. Missing measured
power produces an explanatory power-record empty state. The duration-weighted
ride-NP value is labeled "Avg ride NP" and explained as a weighted descriptive
average rather than continuous lifetime normalized power.

Ride details, rather than compact history cards, show neutral signed deltas for
speed, measured power, ride NP, cadence, and heart rate. Phase 3 intentionally
uses the **current lifetime average**, which can include the displayed ride, and
labels every delta accordingly. Deltas are presentation-only. Estimated power
never compares with the measured-power baseline, and neither stale profile data
nor outdated ride analytics produces a comparison.

## Analytics management and continuation

Profile Stats offers **Update missing/outdated stats** and a confirmed
**Recalculate all stats** action. Both call a server-only authenticated resync
route. Recalculation reads stored sidecars and never downloads Wahoo history.

The operation is persisted at `users/{uid}/profileAnalytics/resync`. Each HTTP
request claims a two-minute lease and performs one bounded step: scan at most 5
ride documents and process the eligible rides, or run one 100-ride aggregate
rebuild batch. It then saves its document-ID cursor, phase, counters, and a
sanitized error before returning. The client coordinates successive requests,
continues active work after a reload, and refreshes the shared profile response
only after the persisted operation reaches `completed`. Duplicate clicks/tabs
coalesce on the active operation; expired leases are recoverable. This closes
the prior 300-ride automatic-rebuild gap without an unbounded request, an
unawaited server Promise, or new queue infrastructure.

## Monthly history checkpoints

Monthly history is built inside the existing profile accumulator, not by a
second lifecycle. Each valid ride contributes to lifetime, annual, and
calendar-month buckets in the configured timezone during the same bounded scan.
Finalization writes the profile and history documents in one transaction after
the existing lease-token and source-generation guard succeeds. A stale worker
therefore cannot publish history that disagrees with lifetime totals.

Each month stores additive contributions rather than only displayed averages:
distance and moving-time denominators for speed, and value-seconds,
valid-duration seconds, and ride counts for measured power, estimated power,
ride-level NP, cadence, and heart rate. Larger periods can merge these values
before division, so monthly averages are never averaged together. Estimated
and measured power remain separate. Missing sensors add neither a numerator nor
a denominator.

Out-of-order imports, deletion, re-analysis, analytics-version changes, and
timezone changes invalidate the shared generation or history compatibility
check. Reconciliation deterministically rebuilds every checkpoint from current
persisted ride analytics without opening sample sidecars. The authenticated
history API returns a compact month sequence, including explicit zero-ride
months, current-month status, coverage, generation, and freshness.

## Performance Trends and power-duration visualization

The expandable Performance Trends card below Profile Stats lazily loads the
history API once. It offers 3-, 6-, 12-month, and all-time views for distance,
moving time, elevation, weighted speed, measured power, cadence, heart rate,
and descriptive duration-weighted ride NP. Totals use bars and averages use
lines with gaps for unavailable sensor data. The current partial month is
marked, stale or incomplete coverage is explained, and chart values convert
from canonical units using the Rider Profile preference. Controls and points
are keyboard accessible; long ranges scroll within the card on narrow screens.

Power Bests now plots the 14 persisted lifetime mean-maximal measured-power
records as discrete points. Duration uses true logarithmic spacing. No line is
drawn between points, so the UI does not imply an observed continuous curve.
Each available point exposes duration, watts, record date, and a link to the
originating ride. Missing durations are omitted and estimated power is never
substituted.

## Historical ride comparisons

The authenticated ride-comparison API requires current target analytics and a
history checkpoint matching the current generation, algorithm, policy, and
timezone. It merges additive checkpoints strictly before the target calendar
month with current ride analytics from only the partial target month. The
partial query is bounded at 200 rides. Candidate activity timestamps must be
strictly earlier than the target timestamp, so the target, same-timestamp
rides, and future rides are excluded regardless of import order.

The result uses the same weighting and provenance rules as profile aggregates.
Ride details label the original Phase 3 comparison as "current lifetime avg"
and the chronological baseline as "previous rides". Missing prior contributors,
stale generations, unavailable targets, or an unusually large target month
produce an unavailable explanation instead of a delta. Historical comparison
values are not persisted on ride documents.

Future overlays can reuse the additive month contributions for annual or recent
power curves. A graph-effort deep link should extend the existing shared ride
cursor with a URL contract before record links attempt to select chart ranges.
