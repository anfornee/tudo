# Ride Logging

## Current experience

Authenticated users can open `/rides`, choose or drop a `.fit` or `.gpx` cycling activity, review its normalized summary, and save it. Processing happens locally in the browser and shows a non-percentage loading state. Unsupported, empty, oversized (over 10 MB), malformed, and unusable activities produce a retryable error.

Saved rides appear newest activity first and open at `/rides/{rideId}`. The detail route displays the persisted summary; it does not reprocess the original file yet.

The dashboard includes a compact latest-ride card with distance, duration, and
elevation. It links to the latest saved summary or to Ride Logging when no ride
has been saved.

## Parsing and normalization

The existing `parseZwiftFit` parser uses the Garmin FIT SDK. The existing `analyzeGpx` parser reads GPX track points and derives distance, duration, speed, and elevation while retaining supported power, cadence, and heart-rate extensions. Both normalize into the shared `RideData` model before UI or persistence.

Missing optional metrics remain `null` and are omitted from the summary. A missing optional sensor stream does not invalidate an otherwise usable ride.

## Persistence

Summary documents live at `users/{uid}/rides/{rideId}`. They contain owner UID, activity/import timestamps, original filename and source, original Storage path, and summary metrics for distance, time, speed, elevation, calories, power, cadence, and heart rate.

The following `RideData` analysis/sample fields are intentionally not stored in Firestore: `timestamps`, `powerSamples`, `cadenceSamples`, `speedSamples`, `heartRateSamples`, `zeroPowerSeconds`, `bestPower`, and `powerPercentiles`. Large time-series data needs a deliberate storage and reprocessing design rather than being placed in the summary document.

The original file is stored at `users/{uid}/rides/{rideId}/original.fit` or `original.gpx`. It uploads before the summary document is created. If the Firestore write fails, the client attempts to remove the uploaded file. Authenticated users can access only ride documents and files beneath their own UID. Local development uses the Firestore and Storage emulators.

## Future direction

The preserved source file can later be reprocessed for detailed samples, charts, power curves, training analysis, comparisons, and personal records. None of those analytics are part of the initial logging milestone.
