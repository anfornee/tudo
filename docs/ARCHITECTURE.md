# Architecture

## Overview

TUDO is a modular Next.js application containing several personal tools under a shared application shell.

The architecture should support continued expansion while avoiding unnecessary complexity.

## Core Technologies

Primary technologies include:

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui where appropriate

Other libraries may exist for individual domains.

Before adding a new dependency, verify whether the problem can be solved cleanly using the existing stack.

## Architectural Principles

### Domain Separation

Major features should remain reasonably independent.

Examples:

* Weather
* Sudoku
* Finance
* Rides

Each domain may contain:

* Components
* Types
* Utilities
* Parsing
* Data access
* Business logic

Shared functionality should live outside a feature domain only when it is genuinely shared.

### Shared UI

Common interface elements should use shared components when possible.

Examples include:

* Cards
* Buttons
* Inputs
* Dialogs
* Navigation
* Tabs
* Loading states
* Empty states
* Typography patterns

Avoid duplicating visually identical components inside individual domains.

### Business Logic vs Presentation

UI components should primarily handle presentation and interaction.

Domain calculations should generally live in:

* Utilities
* Services
* Hooks
* Parsers
* Domain-specific functions

For example:

```text
Bad:

FinanceCard
	-> calculates loan amortization
	-> formats dates
	-> determines bill status
	-> renders UI

Better:

finance utilities
	-> calculate amortization
	-> determine bill status

FinanceCard
	-> receives processed values
	-> renders UI
```

Not every calculation requires a separate abstraction. Use judgment.

## Data Flow

Prefer predictable data flow.

A common pattern is:

```text
External data / file
	↓
Parsing
	↓
Normalization
	↓
Domain model
	↓
Analysis / calculations
	↓
UI
```

Avoid letting UI components directly depend on raw third-party response structures when normalization is reasonable.

## Domain Models

Use shared canonical types within each domain.

For example, rides should normalize multiple activity formats into a common ride representation rather than creating UI specifically for each file format.

Similarly, finance UI should ideally consume normalized bill or account representations rather than provider-specific objects.

## External APIs

External APIs should be treated as replaceable data providers.

Keep API-specific behavior close to the integration layer.

Avoid spreading third-party response shapes throughout the component tree.

Where practical:

```text
API response
	↓
Adapter / normalization
	↓
Internal type
	↓
Application
```

## Error Handling

Errors should be useful and localized.

Prefer:

* Friendly UI messages
* Logged technical context when useful
* Graceful missing-data handling
* Partial rendering when some data is unavailable

Avoid allowing one unavailable widget or API to break the entire dashboard.

## Loading States

Each independent dashboard module should ideally be able to load independently.

A slow weather request should not unnecessarily prevent unrelated content from appearing.

Prefer feature-local:

* Skeletons
* Loading states
* Errors
* Empty states

## Responsive Architecture

Responsive behavior is part of component design, not an afterthought.

Components should be tested conceptually at:

* Narrow mobile widths
* Tablet widths
* Standard desktop widths
* Wide desktop widths

Avoid relying on fixed pixel sizes when flexible layouts are more appropriate.

## PWA and iPhone Architecture

The primary deployment target is an installable PWA used from an iPhone Home Screen.
Desktop, tablet, and other mobile browsers remain supported, but architectural and
interface decisions should treat the iPhone standalone experience as the default.

The application should account for:

* A valid web app manifest with appropriate names, icons, colors, and display mode
* Standalone display mode as well as ordinary Mobile Safari tabs
* iOS safe-area insets around notches, rounded corners, and the Home indicator
* Correct viewport sizing when browser controls or the on-screen keyboard appear
* Touch-friendly controls and interaction patterns that do not depend on hover
* Expected behavior during weak connectivity, loss of connectivity, and recovery
* A deliberate service-worker caching and update strategy
* Durable client-side persistence where a domain requires local data or progress

Offline support should be defined per feature rather than assumed globally. Static
application UI and locally stored data may remain available offline, while modules
that depend on live APIs should clearly communicate stale or unavailable data.

Service-worker updates should not leave the installed application on an inconsistent
mix of old and new assets. Update behavior should be predictable and should avoid
discarding unsaved user state.

PWA behavior should be verified on an actual supported iPhone in addition to desktop
responsive emulation. Testing should include installation, launch from the Home
Screen, navigation, scrolling, forms and keyboards, safe areas, persistence, and
relaunch after an application update.

## State Management

Prefer the simplest state mechanism that works.

Use local React state for local interactions.

Introduce broader state management only when information genuinely needs to be shared across distant parts of the application.

Avoid global state for convenience alone.

## Persistence

Data persistence should be considered per domain.

Examples:

* Sudoku may persist active games and statistics.
* Finance may persist recurring bills and financial settings.
* Ride tracking may persist imported activities and calculated metrics.

Persistence models should reflect actual domain requirements rather than forcing every feature into one generic schema.

### Firestore Convention

User-owned Firestore data lives beneath `users/{uid}` and security rules enforce
that the authenticated UID owns the path. Each feature domain owns its small,
typed persistence layer; React components should not scatter raw Firestore path
construction. This is a domain data-access convention, not a generic repository
framework. New persisted paths and their security rules must evolve together.

### Ride Persistence

The Rides domain owns activity import and persistence. FIT and GPX source files are
parsed and normalized into `RideData`; a summary is stored beneath
`users/{uid}/rides/{rideId}`, while the original activity is retained in Firebase
Storage beneath the matching user and ride path. Raw source files, normalized
summary data, and future derived analytics are separate concerns.

Large timestamp and sensor-sample arrays are not stored in the Firestore summary.
They can exceed practical document sizes and need a deliberate reprocessing or
time-series storage strategy when detailed analytics are introduced.

### Feature-Order Personalization

The feature registry remains authoritative for feature availability and metadata.
One per-user preference stores ordered feature IDs beneath the user's UID. The
authenticated application shell resolves that order once and projects it through
`showOnDashboard` for Dashboard and `showInNav` for Navigation. Dashboard is the
editing surface; both projections update from the same shared state.

Saved IDs are sanitized against the current registry. Stale IDs are ignored and
newly registered features append automatically. Dashboard and Navigation must not
introduce separate ordering preferences.

## Utility Functions

Utility functions should:

* Be deterministic when possible
* Have clear inputs and outputs
* Avoid hidden dependencies
* Remain easy to test

Financial calculations and ride analytics are especially good candidates for pure functions.

### Browser Location

Weather consumers share the Weather-domain current-location service and hook.
They must not call browser geolocation independently. The service owns local
last-known-location caching, permission checks, and concurrent-request
deduplication; Firestore-saved places remain a separate concept.

## Performance

Optimize when there is evidence of a meaningful problem.

Reasonable defaults include:

* Avoid unnecessary rerenders
* Avoid repeatedly parsing large activity files
* Cache expensive calculations when appropriate
* Avoid shipping huge dependencies for small functionality

Do not sacrifice clarity for premature micro-optimization.

## Project Evolution

When adding features:

1. Determine whether the feature belongs to an existing domain.
2. Reuse existing UI patterns.
3. Introduce domain types where appropriate.
4. Keep external integrations isolated.
5. Avoid coupling unrelated features.

The goal is a modular application, not a framework.
