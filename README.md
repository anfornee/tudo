# TUDO

TUDO is a personal "everything hub": one cohesive application for useful day-to-day information, tools, tracking, and utilities. It currently includes a dashboard, weather, Sudoku, personal finance, and cycling features, with room to add more independent modules over time.

The app is built with Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, and Firebase. It is designed primarily as an iPhone PWA while remaining useful on desktop and other screen sizes.

## Local development

Install the dependencies:

```sh
npm install
```

Then run the Firebase emulators and Next.js development server in separate terminals:

```sh
# Terminal 1: Auth, Firestore, Storage, and the Emulator Suite UI
npm run emulators

# Terminal 2: Next.js
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The Firebase Emulator Suite UI is available at [http://127.0.0.1:4000](http://127.0.0.1:4000).

Local development automatically connects Firebase to the emulators, so Firebase credentials are not required. Emulator users and data are separate from production. Stop the emulator process with `Ctrl+C` to export its state for the next run.

See [Local development](docs/local-development.md) for details, including the Firestore smoke test and environment-variable behavior.

## Codebase direction

- Treat each major feature as its own domain and keep its components, types, persistence, and business logic reasonably independent.
- Reuse the shared application shell and UI primitives so modules feel like parts of one product.
- Keep parsing, normalization, calculations, and data access outside presentation components where practical.
- Design mobile-first for the installed iPhone PWA, while supporting tablet and desktop layouts.
- Prefer small, incremental changes and the existing project conventions over premature abstractions or broad refactors.
- Let the dashboard aggregate useful domain data; domain logic should remain within the relevant feature.

More detail lives in [`docs/`](docs/), especially the [product vision](docs/PRODUCT.md), [architecture](docs/ARCHITECTURE.md), and module-specific documentation.

## Common commands

```sh
npm run dev        # Start Next.js in development mode
npm run emulators  # Start the Firebase Local Emulator Suite
npm run lint       # Run ESLint
npm run build      # Create a production build
npm start          # Run the production build
```
