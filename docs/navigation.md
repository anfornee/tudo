# Navigation

Top-level application features are registered once in `lib/features.ts`. The shared
menu applies active-route behavior to both the feature route and its nested routes.

Registered features currently include Weather, Sudoku, and Rides. Rides appears in primary navigation at `/rides`; saved ride details use `/rides/{rideId}` and remain active under the same feature.

The road-cycling planner uses `/rides/routes` and saved route editors use
`/rides/routes/{routeId}`. These are nested Rides experiences and do not add a
separate top-level feature or ordering preference.

Navigation projects its feature entries from the same per-user `featureOrder`
preference edited by dragging Dashboard features. Home is not part of that
preference and remains pinned separately. The shared mobile/desktop menu is not
draggable in this version.

Registry flags remain authoritative: `showInNav` controls menu visibility and
`showOnDashboard` controls Dashboard visibility. Saved ordering changes relative
order only; stale IDs are ignored and newly registered eligible features append
automatically.

Settings is a pinned utility destination rather than a dashboard feature. It is
therefore rendered by the shared menu after the ordered feature entries and does
not participate in the persisted feature order.
