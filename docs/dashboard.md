# Dashboard

The dashboard aggregates features registered in `lib/features.ts` with
`showOnDashboard: true`. The registry remains the source of truth for feature IDs,
labels, routes, icons, and visibility.

## Feature ordering

Authenticated users can reorder dashboard features using the grip at the far end
of each feature's title bar. Pointer dragging supports mouse and touch. The grip alone disables touch
scrolling while active, so touching cards or scrolling elsewhere on the page keeps
normal behavior. Keyboard users can focus a grip, press Enter or Space to pick it
up, use arrow keys, Home, or End to move it, and press Enter or Space to save.
Escape cancels a keyboard reorder.

The Dashboard is the editing surface for the user's top-level feature order. The
same order controls feature entries in the primary application menu immediately;
navigation entries themselves are not draggable.

The dashboard updates immediately and writes once after a completed reorder. A
save failure leaves the local layout usable and shows a small warning; a later
reload falls back to the last persisted order or the registry default.

## Persistence and resolution

The preference document is stored at:

```text
users/{uid}/preferences/dashboard
```

It contains only `featureOrder`, an array of registry feature IDs, and `updatedAt`.
This single document powers both Dashboard and Navigation ordering.
Saved IDs that are duplicated, unknown, or no longer dashboard-visible are ignored.
Any newly registered dashboard feature missing from the saved order is appended in
registry order. No feature metadata or visibility decision is stored in Firestore.
