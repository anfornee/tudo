# TUDO - TUDO

## Product Overview

This application is a personal "everything hub" — a single dashboard for day-to-day tools, information, tracking, and utilities.

The goal is to avoid having many disconnected apps and instead provide one clean, cohesive application containing useful personal tools that can do things the way I want them done and be free.

The application currently includes or is planned to include:

* Home/dashboard
* Weather
* Sudoku
* Personal finance / bills tracking
* Cycling / ride tracking and analysis
* Additional personal utilities over time

The architecture should assume that new modules will continue to be added.

## Product Philosophy

The app should feel like one application, not a collection of unrelated demos.

Modules should:

* Share common UI primitives
* Share navigation patterns
* Follow the same visual language
* Remain relatively independent internally
* Avoid unnecessary coupling between features
* Be easy to add, remove, or evolve

Favor simple, maintainable implementations over abstraction for abstraction's sake.

## Application Architecture

The application is built primarily with:

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui where appropriate

Follow existing project conventions before introducing new patterns.

Before implementing a feature:

1. Inspect the relevant existing files.
2. Look for similar components or routes.
3. Understand the existing domain types.
4. Make the smallest coherent change.
5. Avoid broad refactors unless they are necessary for the requested feature.

The existing repository structure takes precedence over examples in documentation.

## Major Modules

Current and planned major modules include:

* Dashboard
* Weather
* Sudoku
* Finance / Bills
* Ride Tracker

More modules may be introduced later.

Each major feature should be treated as a domain with its own components, logic, and types where practical.

## Shared Design Principles

### Responsive Design

The application is built primarily for iPhones as a PWA but should work well on:

* Desktop
* Tablet
* Other narrow mobile browsers

Do not assume desktop dimensions.

When modifying layouts, specifically consider:

* Narrow viewport widths
* Touch targets
* Mobile Safari
* Text scaling
* Input alignment
* Overflow
* Fixed heights
* Grid behavior

Avoid solving mobile layout issues with brittle device-specific offsets.

### Components

Prefer:

* Small reusable components
* Composition
* Clear domain boundaries
* Shared UI primitives
* Domain-specific utility functions

Avoid giant components that combine:

* Business logic
* Data parsing
* State management
* Networking
* Presentation

Separate concerns when doing so improves clarity.

### TypeScript

Prefer strong typing.

Avoid:

* `any`
* Unnecessary type assertions
* Duplicated interfaces representing the same concept
* Silently weakening types to work around errors

Extend existing domain types where appropriate instead of inventing parallel representations.

When changing a shared type:

1. Search for all consumers.
2. Update parsers, utilities, state, and components as needed.
3. Avoid leaving one feature on an outdated representation.

### Data Handling

Do not fabricate unavailable information.

When external sources, imported files, or APIs do not provide a value:

* Use `null`
* Use an optional field
* Use the existing missing-data convention

Do not invent calculated values unless the calculation is explicit, deterministic, and appropriate.

Keep parsing, normalization, analysis, and presentation separate when practical.

### Firestore Persistence

Keep user-owned Firestore data scoped beneath the authenticated UID and keep
persistence code within the relevant feature domain. Update security rules with
every new persisted path; never weaken rules to unblock development. Consult the
relevant feature documentation before changing a persisted structure.

### Browser Location

Use the shared Weather current-location abstraction. Do not add independent
browser geolocation calls to components or confuse locally cached device
location with Firestore-saved places.

## UX Philosophy

This is a personal application, so usefulness and speed matter more than enterprise complexity.

Prefer:

* Low-friction interactions
* Useful defaults
* Clear information hierarchy
* Minimal unnecessary configuration
* Dense information when helpful without making screens feel cluttered
* Interfaces that feel polished without feeling over-designed

Avoid unnecessary:

* Confirmation dialogs
* Onboarding flows
* Configuration screens
* Enterprise abstractions
* Multi-step workflows for simple actions

## Adding New Features

New modules should remain reasonably self-contained.

A conceptual organization might look like:

```text
app/
	dashboard/
	weather/
	sudoku/
	finance/
	rides/

components/
	ui/
	dashboard/
	weather/
	sudoku/
	finance/
	rides/

lib/
	weather/
	sudoku/
	finance/
	rides/
```

This is only conceptual.

Do not reorganize the repository simply to match this structure if the existing structure is already working well.

## Dashboard Philosophy

The dashboard should eventually act as an aggregation layer for the rest of the application.

It should surface useful information rather than simply linking to modules.

Potential dashboard content includes:

* Current weather
* Upcoming bills
* Financial snapshot
* Recent ride
* Ride trends
* Quick utilities
* Daily Sudoku
* Other personally relevant information

Dashboard widgets should consume domain data rather than owning domain logic.

## Module Documentation

More detailed product and architectural guidance exists under `docs/`.

Relevant files include:

* `docs/PRODUCT.md`
* `docs/ARCHITECTURE.md`
* `docs/weather.md`
* `docs/sudoku.md`
* `docs/finance.md`
* `docs/rides.md`

Consult the relevant documentation before making substantial changes to a module.

## Codex Working Rules

When working on this project:

1. Inspect the code before proposing structural changes.
2. Follow patterns already established in the application.
3. Prefer incremental changes over rewrites.
4. Preserve working functionality outside the requested scope.
5. Consider mobile behavior for every UI change.
6. Avoid introducing dependencies unless they solve a real problem.
7. Reuse existing components before creating duplicates.
8. Keep domain logic outside visual components where practical.
9. Treat documentation as product intent, but treat the current source code as the authority on implementation details.
10. When documentation and implementation disagree, identify the discrepancy before making a large assumption.

## Future Direction

This hub is expected to expand.

Possible future areas include:

* Additional fitness tracking
* Calendar
* Tasks
* Notes
* Home utilities (smart home)
* Meal planning
* Personal analytics
* More games
* Household information

Do not architect prematurely for features that do not exist.

Instead, keep current modules sufficiently decoupled that new modules can be introduced cleanly.
