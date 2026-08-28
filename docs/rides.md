# Ride Tracker

## Purpose

The ride tracker imports, normalizes, displays, and analyzes cycling activities.

The primary current use case is indoor cycling through Zwift, though the architecture should remain capable of supporting other cycling activities.

The goal is not merely to reproduce Strava-style summary statistics.

The application should help explain the ride.

## Supported Activity Sources

Current or intended file support includes:

* FIT
* GPX

Other activity formats may be added later if useful.

## Architecture

Ride data should flow conceptually as:

```text
FIT / GPX
	↓
Format-specific parser
	↓
Normalization
	↓
RideData
	↓
Analysis
	↓
UI
```

Format-specific behavior should generally stop at the parser / normalization layer.

UI components should not need to know whether a ride originated from FIT or GPX unless the source itself is relevant to display.

## RideData

Imported rides normalize into the shared `RideData` domain model.

Important fields may include:

* `source`
* `distanceMiles`
* `durationSeconds`
* `movingTimeSeconds`
* `averageSpeedMph`
* `averagePower`
* `maxPower`
* `normalizedPower`
* `averageCadence`
* `maxCadence`
* `elevationGainFeet`
* `calories`
* `powerSamples`
* `heartRateSamples`

The actual TypeScript interface in the repository is the implementation authority.

Update this documentation if the model changes substantially.

## Source

Ride data should retain its source.

Examples might include:

* FIT
* GPX
* Future API sources

Source metadata may influence which metrics are available, but should not cause unnecessary branching throughout the UI.

## Missing Metrics

Not every activity source provides every metric.

Do not fabricate values.

Examples:

* GPX may not contain power.
* Some rides may not contain heart rate.
* Normalized power may not be available directly.
* Cadence may be absent.

Use the established missing-data pattern, such as:

* `null`
* Optional properties

UI should gracefully handle missing metrics.

## FIT Parsing

FIT files may provide rich activity information including:

* Distance
* Duration
* Speed
* Power
* Cadence
* Heart rate
* Elevation
* Calories

Parsing should use the Garmin FIT SDK or the project's current FIT parsing implementation.

FIT parsing should remain isolated from React components.

## GPX Parsing

GPX data may contain:

* GPS coordinates
* Time
* Elevation
* Extensions containing power
* Extensions containing cadence
* Extensions containing heart rate

GPX parsing should normalize into `RideData`.

Do not assume every GPX producer uses identical extension structures.

Implement additional extension handling only when needed.

## Sample Data

Time-series samples are important for analysis.

Potential sample streams include:

* Power
* Heart rate
* Cadence
* Speed
* Elevation

Preserve enough temporal information to support future analysis where practical.

Avoid reducing an activity entirely to averages if raw samples are available.

## Ride Analysis Philosophy

Ride analysis should answer questions such as:

* How hard was this ride?
* Was the effort sustainable?
* Was pacing consistent?
* Did the rider start too hard?
* Did power fade?
* How strong was the finish?
* How were climbs paced?
* Where were the hardest efforts?
* How does this compare with prior rides?

The goal is actionable interpretation.

## Power

Power is one of the most useful cycling metrics.

Important concepts may include:

* Average power
* Maximum power
* Normalized power
* Sustained power
* Power zones
* FTP-relative intensity
* Personal records

Raw maximum power alone should not dominate analysis because very short spikes may not represent meaningful performance.

Sustained efforts are often more useful.

## Sustained Power

Useful future best-effort durations might include:

* 5 seconds
* 15 seconds
* 30 seconds
* 1 minute
* 5 minutes
* 10 minutes
* 20 minutes
* 30 minutes
* 45 minutes
* 60 minutes

These can help track improvements over time.

Effort calculations should use actual time-series data rather than deriving results from ride averages.

## FTP

FTP may eventually be:

* User-entered
* Estimated
* Derived from testing

When FTP exists, it enables:

* Power zones
* Relative intensity
* Training interpretation
* Threshold comparisons

Do not pretend FTP is known when it has not been supplied or estimated using an explicit method.

## Power Zones

Typical future power-zone analysis may categorize effort relative to FTP.

The exact zone model should be documented once implemented.

Do not hardcode assumptions about FTP zones in unrelated UI components.

## Climb Detection

Climbs are particularly useful for ride analysis.

Future climb analysis may include:

* Climb start
* Climb end
* Duration
* Elevation gain
* Average power
* Maximum power
* Cadence
* Heart rate
* Previous-best comparison

Climb detection should be derived from elevation / route data rather than arbitrary power spikes.

## Pacing Analysis

Potential pacing indicators include:

* First-half vs second-half power
* Power variability
* Fade
* Negative split
* Climb pacing
* Recovery periods
* Finish strength

Avoid making strong conclusions from one metric alone.

## Heart Rate

When available, heart rate can add context to power.

Potential uses include:

* Cardiovascular effort
* Recovery between efforts
* Heart-rate drift
* Power-to-heart-rate relationship
* Zone distribution

Heart rate should not be required for ride analysis.

## Cadence

Cadence may provide useful context such as:

* Average cadence
* Climbing cadence
* High-power cadence
* Fatigue-related cadence changes

Avoid treating cadence as universally better when higher or lower.

Context matters.

## Ride Comparison

Historical comparisons should eventually support:

* Previous ride
* Same route
* Same climb
* Recent average
* Personal record
* Year-to-date best effort

Useful comparisons should account for the metric being compared.

For example, a 45-minute power PR is more meaningful when compared against prior 45-minute efforts than against maximum ride power.

## Personal Records

Potential personal records include:

* Best sustained power
* Fastest route
* Fastest climb
* Highest average power
* Longest ride
* Highest elevation gain

Personal records should be calculated consistently and based on comparable data.

## Ride UI

The ride detail experience may include:

* Summary metrics
* Power timeline
* Heart-rate timeline
* Elevation profile
* Cadence information
* Climbs
* Sustained efforts
* Analysis summary
* Historical comparison

Do not overwhelm the user with every metric simultaneously.

Prioritize useful interpretation.

## Import Behavior

Importing a ride should:

1. Identify the supported format.
2. Parse the file.
3. Normalize data.
4. Validate required information.
5. Produce a `RideData` object.
6. Store or display the activity as appropriate.

Malformed files should produce understandable errors.

A single missing optional metric should not invalidate an otherwise usable ride.

## Data Accuracy

Imported activity values should be treated carefully.

When values differ between sources such as:

* FIT
* GPX
* Zwift
* Strava

Do not silently adjust values merely to match another platform.

Differences may result from:

* Moving-time algorithms
* Elevation correction
* Smoothing
* Sampling
* Proprietary calculations

Document known differences when they become important.

## Future Features

Potential additions include:

* FTP tracking
* Power curve
* Power zones
* Heart-rate zones
* Training load
* Fitness trends
* Ride calendar
* Route detection
* Climb comparison
* Personal records
* Training recommendations
* Year-to-date statistics
* Weekly training summaries
* Ride tags
* Automated analysis

These should evolve from actual needs rather than being implemented all at once.
