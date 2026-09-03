# Bills

Bills are recurring monthly expenses stored at `users/{uid}/bills/{billId}`. A due day beyond the length of a month resolves to that month's final calendar day. Active bills alone contribute to UI totals, ordering, and reminders.

## Reminders

Reminder delivery uses Firebase Cloud Messaging and the authenticated user's IANA timezone in `users/{uid}/preferences/notifications`. Browser tokens live at `users/{uid}/notificationTokens/{tokenHash}`. The scheduled endpoint aggregates matching bills and writes idempotency records to `users/{uid}/billNotificationDeliveries/{date-kind}`.

Configure these environment variables in the deployed Next.js service:

- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (Firebase Console > Cloud Messaging > Web Push certificates)
- `BILLS_CRON_SECRET` (a strong random value shared only with the scheduler)

Schedule an authenticated HTTP `POST` to `/api/bills/reminders` every 15 minutes with `Authorization: Bearer <BILLS_CRON_SECRET>`. The endpoint sends only during each user's 8:00–8:14 PM autopay window or 9:30–9:44 AM due window. Keep the schedule at 15 minutes or more frequent so neither window is skipped. Firebase Admin credentials use the repository's existing server environment configuration.

Deploy `firestore.rules` with the application. Users opt in from the Bills page, so the browser permission prompt is never shown on page load. iOS web push requires the app to be installed to the Home Screen.
