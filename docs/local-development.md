# Local development

Firebase Auth, Firestore, and Storage run through the Firebase Local Emulator
Suite during Next.js development. Emulator data and users are separate from
production. Local emulator state is exported to `.firebase-emulator-data` when
the emulators shut down normally and imported again the next time they start.

## Start the application

Install dependencies once:

```sh
npm install
```

In the first terminal, start Firebase:

```sh
npm run emulators
```

In a second terminal, start Next.js:

```sh
npm run dev
```

Open `http://localhost:3000`. Create an account on the login page; it exists
only in the Auth emulator and cannot use your production credentials unless you
create the same email and password locally. The Emulator Suite UI is available at
`http://127.0.0.1:4000`.

Stop the emulators with Ctrl+C so they can export their current state. Forcefully
terminating the process may prevent the latest changes from being saved.

## Verify Firestore

After signing in locally, open `http://localhost:3000/dev/firestore-test` and
select **Run smoke test**. The development-only page uses the existing Firebase
client to write `users/{uid}/dev/firestore-test` with a server timestamp, read it
back, and validate the returned values. It returns a 404 in production.

## Verify ride persistence

After signing in, open `http://localhost:3000/rides` and import a FIT or GPX file.
Saving should create a summary at `users/{uid}/rides/{rideId}` in Firestore and an
original file at `users/{uid}/rides/{rideId}/original.{fit|gpx}` in Storage. Both
are visible in the Emulator Suite UI. Refresh the app and reopen the saved ride to
confirm the summary persists.

## Environment variables

No Firebase or Google Cloud credentials are required in `.env.local` for local
development. The app uses the local project ID `tudo-local` when the public
Firebase variables are absent. Existing production variables may remain in the
file; development still connects all Firebase services to localhost.

Production deployments continue to require the existing Firebase client,
Firebase Admin, and Google Cloud environment variables. Emulator routing is
enabled only when `NODE_ENV` is `development`.

The road route planner additionally requires:

- `OPENROUTESERVICE_API_KEY`, a server-only key used by the Next.js directions
  Route Handler.
- `NEXT_PUBLIC_ROUTE_MAP_STYLE_URL`, a browser-accessible, production-licensed
  MapLibre style URL. Provider tokens embedded in this URL are public and should
  be domain-restricted where possible.

These are required locally as well if you want to interact with the planner map
and calculate routes. The planner shows a configuration state when the style URL
is absent; the directions endpoint returns a configuration error when the private
routing key is absent.

Run the focused Firebase ownership test with:

```sh
npm run test:rules
```

It starts temporary Auth, Firestore, and Storage emulators and verifies that one
user cannot read another user's route summary or sidecar.
