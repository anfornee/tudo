# Product Vision

## Overview

TUDO is a private, personal application designed to consolidate frequently used information, tools, trackers, and utilities into one cohesive interface.

It is intentionally broad.

Rather than building separate applications for weather, budgeting, cycling analytics, games, and future utilities, the goal is to create one application that can gradually become a personalized operating system for everyday life.

## Core Product Idea

The application should answer questions like:

* What do I need to know today?
* What bills are coming up?
* How are my finances looking?
* What is the weather doing?
* How did my latest ride go?
* Am I improving over time?
* What useful tool do I need right now?

The dashboard should increasingly answer these questions without requiring navigation into every individual module.

## Product Principles

### One Product, Many Capabilities

Features should feel connected through:

* Shared navigation
* Shared visual language
* Consistent typography
* Consistent spacing
* Reusable cards and controls
* Similar interaction patterns

Avoid making each feature feel like an isolated mini-app.

### Personal Before Generic

This application is built for personal use.

That means product decisions can optimize for:

* Known workflows
* Low friction
* Useful defaults
* Quick access
* Relevant information density

There is no need to build generalized enterprise systems unless a real future requirement appears.

### Progressive Complexity

Start simple.

A feature should begin with the smallest version that is genuinely useful, then expand as actual needs become apparent.

Do not prematurely build:

* Highly generalized schemas
* Plugin frameworks
* Complex permissions systems
* Multi-user abstractions
* Generic workflow engines

### Data Should Become More Useful Over Time

Where historical data exists, features should increasingly provide:

* Trends
* Comparisons
* Personal records
* Predictions
* Summaries
* Useful context

The value of the application should increase as more personal data accumulates.

## Primary Modules

### Dashboard

The central overview of the application.

The dashboard should surface important information from other modules.

Examples:

* Weather conditions
* Weather alerts
* Upcoming bills
* Monthly financial summary
* Latest cycling activity
* Fitness trends
* Sudoku or other daily utilities

The dashboard should prioritize information that is timely or actionable.

### Weather

A practical weather experience intended to answer everyday questions quickly.

It should emphasize:

* Current conditions
* Today's forecast
* Hourly changes
* Rain chances
* Upcoming days
* Important weather alerts

Weather data should also be reusable by the dashboard.

The dashboard always emphasizes weather for the user's current device location.
The full Weather page additionally supports per-user saved cities, displaying a
forecast bar for each and allowing the user to search for, add, and remove
locations that remain available across sessions.

### Sudoku

A polished lightweight game available directly within the hub.

It should be enjoyable on both desktop and mobile and eventually support persistent progress and statistics.

### Finance

A personal finance and bill-tracking system.

The emphasis is financial visibility rather than accounting.

Useful questions include:

* What is due soon?
* What are monthly recurring expenses?
* How much money is committed each month?
* What does cash flow look like?
* How much debt remains?
* How quickly could a balance be paid off?
* How much disposable income remains?

### Ride Tracker

A cycling activity importer and analysis system focused heavily on Zwift and power-based training.

It should make activity files understandable rather than merely displaying raw metrics.

Useful questions include:

* How hard was the ride?
* How consistent was pacing?
* What were the strongest efforts?
* How did climbs go?
* How does this compare with previous rides?
* Is fitness improving?

## Long-Term Vision

The application may eventually become a broader personal dashboard containing areas such as:

* Fitness
* Cycling Route Planning
* Calendar
* Tasks
* Household information
* Notes
* Meal planning
* Travel planning
* Games
* Personal statistics
* Goal tracking

These are possibilities, not requirements.

New capabilities should be added because they provide real usefulness, not because the architecture makes them possible.

## Experience Goal

The primary experience is an installed PWA launched from an iPhone Home Screen. It
should feel app-like, load quickly, fit naturally within iOS safe areas, and make
common actions comfortable to complete with one hand. The same application should
remain useful and polished in desktop, tablet, and standard browser contexts.

The ideal experience is:

1. Open the application.
2. Immediately see the most useful information.
3. Dive deeper only when necessary.
4. Complete common tasks with minimal interaction.

The application should feel calm, modern, responsive, and information-rich without becoming overwhelming.
