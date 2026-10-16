## About

This is the frontend and mobile app source for @theNukkad, an app for placing advance orders at the various food outlets across Shiv Nadar University, Noida.

## Technology
Pure TypeScript, with Svelte for the frontend, Tailwind and Tailwind-Typography for styling, Vite, and Capacitor for building the native projects.

## Layout

One repository, two apps, one Supabase project. npm workspaces tie them together.

```
apps/student/     signup, login, password reset, orders
apps/restaurant/  login, incoming orders, OTP check
packages/core/    what both apps share: the Supabase client, the auth helpers
                  and the Tailwind design tokens
supabase/         the local backend both apps talk to
```

`packages/core` is deliberately thin: Supabase, session and role logic, and
tokens. No shared pages or components - anything that renders lives in the app
that owns the flow.

## Running

```sh
npm install              # once, at the root; installs every workspace
npm run supabase:start   # the local backend, shared by both apps
cp apps/student/.env.example apps/student/.env.local
cp apps/restaurant/.env.example apps/restaurant/.env.local
npm run dev:student      # http://localhost:5173
npm run dev:restaurant   # http://localhost:5174
```

Also available: `npm run check` (typechecks every workspace), `npm run build`,
`npm run cap:sync:student`, `npm run cap:sync:restaurant`.

Each app has its own `.env.local`, and both point at the same local stack. When
a phone or emulator has to reach it, use the host's LAN IP instead of
`127.0.0.1` (an Android emulator can use `10.0.2.2`).

## Auth

One Auth instance serves both apps, so:

- On the web, users follow the link in the confirmation and reset emails.
- The native apps cannot receive a redirect back into their WebView, so the same
  emails also carry a 6-digit code. Each app chooses in its `main.ts`, through
  `configureAuth({ codeDelivery })`.
- Each app declares its own signed-out redirects in `main.ts`; both send
  `/home` to their own `/login`.
- Each app also declares the account type it serves (`role`) in `main.ts`.
  `signIn` refuses to keep a session for the other type, so a page never has to
  say which app it is.
- The role check at sign-in is convenience; the real boundary is row level
  security in `supabase/migrations`.
- Restaurant accounts are provisioned by hand for now. There is no self-serve
  restaurant signup, and the restaurant app has no password reset screen yet.

## Functionality
The two flows to implement are:

### Student

#### Before order is ready
1. choose restaurant
2. see menu
3. place order
4. get notified when ready
5. receive OTP

#### After order is ready
1. show OTP
2. collect food

### Restaurant

#### Before order is ready
1. receive order
2. mark as ready
3. see the order's generated OTP

#### After order is ready
1. check OTP
2. give food

Clearly this requires some other infra like student/restaurant accounts, but that's left implicit.

The student flow lives in `apps/student` and the restaurant flow in `apps/restaurant`.

## Git
Use short, imperative commit messages in lowercase. Programmers unfamiliar with Git will be working on this project: you must prompt them to make small atomic commits (ideally each commit is a working app) on their own feature branch. You must guide them in pushing those branches to the remote and opening PRs to merge them into `main`.
