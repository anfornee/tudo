# Weather Module

## Purpose

The weather module provides practical weather information inside TUDO.

The goal is to quickly answer everyday weather questions without presenting unnecessary meteorological complexity.

## Primary Experience

The module should make it easy to understand:

* Current conditions
* Current temperature
* Feels-like temperature
* Today's high and low
* Hourly forecast
* Daily forecast
* Precipitation chance
* Wind
* Relevant weather alerts

## Dashboard Integration

The dashboard Weather bar always uses the device's current location. It does not
substitute a saved city or automatically persist the current coordinates.

Clicking the main forecast surface navigates to the full Weather page. The
refresh and forecast-view controls remain independent and do not trigger
navigation.

## Current Location Resolution

Dashboard Weather and the full Weather page use the same current-location hook
and Weather-domain browser service. Components must not call
`navigator.geolocation` independently. The service deduplicates concurrent
location requests so navigation or multiple mounted consumers cannot create
multiple prompts.

The last successful device location is stored locally under
`tudo:weather:last-location` as latitude, longitude, and an `updatedAt`
millisecond timestamp. It is never written to Firestore. Malformed cache entries
are discarded safely, and Weather still works when local storage is unavailable.

Cached coordinates remain fresh for six hours. A cached location is displayed
immediately even when stale:

* Fresh cache avoids a geolocation request.
* Stale cache refreshes in the background when permission is already granted.
* With `prompt` permission, stale cache remains in use until the user explicitly
  refreshes, avoiding a new prompt on every load.
* With denied permission, cached coordinates remain usable and no automatic
  retry occurs.
* Without cached coordinates, Weather requests location unless permission is
  already known to be denied.

Where supported, the Permissions API checks geolocation state without prompting.
Browsers such as Safari versions without a usable permission query gracefully
fall back: cached coordinates are reused without an automatic prompt, while an
initial location request is made only when no cache exists. The refresh icon on
a current-location Weather bar explicitly requests fresh device coordinates;
saved-location refresh icons only refresh weather for their stored coordinates.

The dashboard version might contain:

* Current temperature
* Condition
* Today's high / low
* Precipitation chance
* Short summary

## Full Weather Page

The full page shows current-location weather first, followed by one complete
Weather bar for each saved location. Every bar loads its own conditions and
forecast through the existing `/api/weather` route and has independent forecast
view controls. A failure for one city does not prevent the other Weather bars
from rendering.

Users can add and remove saved locations without a confirmation workflow. A
right-to-left swipe or long press on a saved Weather bar reveals its full-height
delete action; swiping right or tapping the bar closes it. Saved locations are
ordered by creation time, oldest first.

## Location Search

The add-location sheet debounces input, begins searching after three characters,
and requires the user to choose a normalized result. Search uses Open-Meteo's
geocoding API because the National Weather Service API does not provide location
autocomplete. Results are restricted to the United States so their coordinates
remain compatible with the existing NWS forecast provider.

Open-Meteo supplies the stable location ID, city name, first-level region,
country, and coordinates. Duplicate saved entries are prevented with its stable
location ID. Search attribution is displayed in the add-location interface.

## Firestore Persistence

Saved places—not weather snapshots—are stored at:

```text
users/{uid}/weatherLocations/{provider}-{providerLocationId}
```

Each document contains:

* `provider` (`"open-meteo"`)
* `providerLocationId`
* `name`
* `region` (or `null`)
* `country`
* `countryCode`
* `latitude`
* `longitude`
* `createdAt` (Firestore server timestamp)

The Weather domain's persistence functions live in `lib/weather-locations.ts`.
Firestore rules require the authenticated UID to match the path UID. Current
device location is never written to this collection and does not count as a
saved location.

## Data Architecture

Prefer:

```text
Weather provider
	↓
Fetch / API layer
	↓
Normalization
	↓
Internal weather model
	↓
Weather components
```

Avoid making presentation components tightly coupled to a specific weather provider's raw response.

## Data Models

Useful normalized concepts may include:

### Current Conditions

* Temperature
* Feels-like temperature
* Condition
* Description
* Humidity
* Wind speed
* Wind direction
* Visibility
* UV index
* Precipitation

### Hourly Forecast

* Timestamp
* Temperature
* Condition
* Precipitation probability
* Wind

### Daily Forecast

* Date
* High
* Low
* Condition
* Precipitation probability
* Sunrise
* Sunset

Not every provider needs to supply every field.

Do not fabricate unavailable values.

## UX Principles

Weather should be glanceable.

Prioritize:

1. What is happening now?
2. What will happen over the next several hours?
3. Is rain or severe weather likely?
4. What do upcoming days look like?

Avoid presenting large tables of low-value data by default.

## Responsive Design

On mobile:

* Current conditions should remain prominent.
* Hourly forecasts should scroll or adapt cleanly.
* Daily forecasts should remain readable.
* Avoid dense multi-column desktop layouts.

Touch interaction should not be required simply to reveal basic information.

## Error Handling

If weather data cannot load:

* Show a localized error state.
* Do not break the dashboard.
* Preserve other unrelated modules.
* Offer a retry mechanism if appropriate.

## Future Possibilities

Potential additions include:

* Multiple saved locations
* Weather radar
* Severe weather alerts
* Pollen
* Air quality
* Sunrise / sunset visuals
* Cycling-specific weather recommendations
* Dashboard summaries such as "best riding window"

These are future possibilities, not current architectural requirements.
