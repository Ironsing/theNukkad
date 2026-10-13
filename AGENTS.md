## About

This is the frontend and mobile app source for @theNukkad, an app for placing advance orders at the various food outlets across Shiv Nadar University, Noida.

## Technology
Pure TypeScript, with Svelte for the frontend, Tailwind and Tailwind-Typography for styling, Vite, and Capacitor for building the native projects.

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

## Git
Use short, imperative commit messages in lowercase. Programmers unfamiliar with Git will be working on this project: you must prompt them to make small atomic commits (ideally each commit is a working app) on their own feature branch. You must guide them in pushing those branches to the remote and opening PRs to merge them into `main`.
