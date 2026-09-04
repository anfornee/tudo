# Tasks

Tasks is a lightweight personal todo list available at `/tasks`. Data is scoped to the signed-in user at `users/{uid}/tasks/{taskId}`.

## Data model

Each document contains `title` (trimmed text, at most 500 characters), `completed` (boolean), `order` (number), `createdAt` (timestamp), and `completedAt` (timestamp or null). The user ID is represented by the parent path and is not duplicated in the document.

## Behavior

The Tasks page adds tasks inline with Enter or the add button. Incomplete tasks appear in their manual order and can be completed, renamed, deleted, or reordered with the drag handle. The reorder handle supports pointer/touch movement and keyboard arrow, Home, and End keys. New and restored tasks append to the active list.

Completed tasks move to a secondary, collapsible section. They are ordered by most recent completion and can be restored or deleted.

The dashboard card shows the first four incomplete tasks in manual order, supports direct completion and compact quick-add, displays the remaining count, and links to the full Tasks page. Firestore realtime listeners include locally pending writes so interactions update without waiting for a server round trip.

## V1 scope

Tasks intentionally has one personal list only. It does not include due dates, reminders, priorities, categories, subtasks, recurrence, calendar integration, AI generation, or sharing.
