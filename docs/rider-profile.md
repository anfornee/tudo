# Rider Profile and Cycling Calories

## Rider profile

The optional Rider Profile is available at `/settings`. It is stored at
`users/{uid}/riderProfiles/cycling`, protected by the same UID ownership rules as
the rest of the user's data. Height and weight are normalized to centimetres and
kilograms; the selected display unit system is retained only for presentation.
Date of birth, physiological sex, resting heart rate, and maximum heart rate are
all optional.

Weight is a dated history rather than a single mutable value. Calorie analysis
selects the latest weight whose effective date is on or before the activity date.
Each profile save increments its version. An estimate stores the exact profile
fields and version used, so editing the current profile does not silently change
an existing ride's result. Opening a legacy ride without calorie metadata creates
that metadata once; explicit ride re-analysis uses the profile that applies at
that time.

## Calorie data model

`RideData.calories` and the persisted summary `calories` field remain the value
reported by the source FIT file. They are never overwritten by an estimate.
`calorieAnalysis` contains the selected display result and its provenance:

- source (`recorded` or `estimated`)
- estimation method and formula version
- rounded calories and, where appropriate, an uncertainty range
- confidence classification
- usable input and coverage metadata
- energy-basis classification
- the rider-profile snapshot used by the calculation

A recorded value is identified as source-reported because imported formats do
not consistently say whether that value is gross or active energy. Tudo's
estimates represent gross energy during the cycling activity period. The engine
does not add resting calories again, which avoids double counting.

## Estimation priority and methods

The estimator is a pure module in `lib/rides/calories.ts`. It applies the first
eligible method in this order:

1. Preserve a positive source-recorded calorie value.
2. Integrate measured power over valid sample timestamps.
3. Integrate a validated heart-rate equation when the required profile fields
   are present.
4. Apply a speed-category cycling MET when moving speed and a dated weight are
   available.
5. Apply the general cycling MET using duration and a dated weight.

No weight is assumed. If no recorded value or sufficient sensor data is present,
the ride UI links to Rider Profile instead of manufacturing a result.

### Measured power

Power is trapezoidally integrated between samples. Non-increasing timestamps and
gaps over 10 seconds are excluded, and at least 95% coverage is required. Up to
the remaining 5% may be scaled to the known activity duration; sparse streams are
not extrapolated. Mechanical work is converted to metabolic energy using 24%
gross cycling efficiency. A 20–25% efficiency interval produces the displayed
range. This is an assumption, not estimated or recorded power.

The 24% midpoint and uncertainty interval are consistent with the range commonly
reported in cycling-efficiency research. Individual efficiency varies with rider,
cadence, intensity, and protocol.

### Heart rate

Heart-rate analysis uses the sex-specific Keytel et al. energy-expenditure
equations. It requires physiological sex, age from date of birth, a dated weight,
plausible heart-rate samples, and at least 90% valid timestamp coverage. Samples
outside the supported age and heart-rate bounds are rejected. A 20% interval is
shown because an individual prediction equation is materially less certain than
directly integrated power.

### Speed and duration METs

The fallback uses the 2024 Adult Compendium cycling categories: 4.0 MET below
10 mph, 6.8 at 10–11.9 mph, 8.0 at 12–13.9 mph, 10.0 at 14–15.9 mph, 12.0 at
16–20 mph, and 16.8 above 20 mph. The general duration-only fallback uses
7.0 MET and exposes a broad 4.0–12.0 MET range. The formula is
`MET × 3.5 × weight kg ÷ 200 × minutes`.

Moving time is preferred. When sample quality is adequate, zero/near-zero speed
or unchanged distance is excluded from the MET motion summary. Cadence or power
still marks a segment as active, which supports stationary trainers. FIT pause
semantics and incomplete GPS streams vary, so speed-based results remain low
confidence and duration-only results very low confidence.

## Deliberate limitations

- GPS speed and elevation are retained as availability metadata but are not
  converted into synthetic power. A defensible terrain model would also require
  bike mass, rolling resistance, surface, wind, aerodynamic position, and reliable
  grade data.
- No estimate is produced for activities shorter than one minute.
- Sensor gaps longer than 10 seconds are not bridged.
- Heart-rate equations are population estimates and can be inaccurate for an
  individual, medication use, unusual physiology, or bad optical-sensor data.
- Speed-category MET estimates are coarse by design. They do not model drafting,
  indoor resistance, terrain, wind, or coasting.
- Existing estimates are snapshots. Updating a profile intentionally does not
  rewrite ride history automatically.
- If an imported activity has no usable activity date, the estimator selects the
  latest applicable profile values as of analysis time. The resulting snapshot is
  persisted, but it may not represent the rider's weight or age when the ride
  actually occurred.

## Sources

- [2024 Adult Compendium of Physical Activities](https://pacompendium.com/wp-content/uploads/2024/01/2024-adult-compendium_1_2024.pdf)
- [2024 Compendium methods paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC10818145/)
- [Keytel et al., heart-rate energy expenditure equations](https://pubmed.ncbi.nlm.nih.gov/15966347/)
- [Cycling efficiency review](https://pubmed.ncbi.nlm.nih.gov/19229554/)
- [Cadence and cycling efficiency study](https://pubmed.ncbi.nlm.nih.gov/1521959/)

## Operational verification

Firestore rules should be deployed with the application changes. The profile UI
and calorie labels should also be checked on a narrow iPhone viewport. Formula and
fallback behavior are covered by unit tests; Firestore rule behavior requires the
Firebase emulator or deployment-environment verification.
