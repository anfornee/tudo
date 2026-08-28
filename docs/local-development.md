# Local development

Firebase Auth, Firestore, and Storage run through the Firebase Local Emulator
Suite during Next.js development. Emulator data and users are separate from
production and are cleared when the emulators stop.

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
only in the Auth emulator. The Emulator Suite UI is available at
`http://127.0.0.1:4000`.

## Environment variables

No Firebase or Google Cloud credentials are required in `.env.local` for local
development. The app uses the local project ID `tudo-local` when the public
Firebase variables are absent. Existing production variables may remain in the
file; development still connects all Firebase services to localhost.

Production deployments continue to require the existing Firebase client,
Firebase Admin, and Google Cloud environment variables. Emulator routing is
enabled only when `NODE_ENV` is `development`.
