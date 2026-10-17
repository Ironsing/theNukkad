import { push, replace, router, type RoutePrecondition } from 'svelte-spa-router';
import { supabase } from './supabase';
import { isAuthenticated, isSignInInFlight } from './auth';

// Every route this app guards, and where a signed-out visitor is sent from it.
// The root route belongs here too, even though it only forwards: without a
// session it forwards to the same place as everything else. The redirects below
// read the map again when a session dies under someone already on a guarded
// route.
export type AuthRedirects = {
    home: string;
    resetPassword: string;
    signedOutRedirects: Record<string, string>;
};

let redirects: AuthRedirects | null = null;

// Every redirect this app performs in response to an auth change. Called once
// from main.ts, explicitly: importing a module must not start navigating, so
// the app opts in.
export function enableRedirectsOnAuthChanges(options: AuthRedirects) {
    const { home, resetPassword, signedOutRedirects } = options;

    redirects = { home, resetPassword, signedOutRedirects };

    // The single place that moves the user between public and protected pages
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            // A role-gated sign-in owns this transition: the account type is
            // checked first, and a wrong-role account is signed straight back
            // out. Its caller moves the user on once that check has passed.
            if (isSignInInFlight()) {
                return;
            }

            if (router.location !== home) {
                push(home);
            }

            return;
        }

        // A reset link produces a recovery session, and emits PASSWORD_RECOVERY
        // rather than SIGNED_IN. The user is not logged in yet - they still have
        // to choose a new password - so this must not fall through to home.
        if (event === 'PASSWORD_RECOVERY' && session) {
            if (router.location !== resetPassword) {
                push(resetPassword);
            }

            return;
        }

        // The password has been changed. Until then, stay put on the reset
        // password route: INITIAL_SESSION arrives on every page load (including
        // right after the recovery exchange), and bouncing to home on it would
        // pull the user off the form before they could choose a password.
        if (
            event === 'USER_UPDATED' &&
            session &&
            router.location === resetPassword
        ) {
            push(home);

            return;
        }

        // This also covers INITIAL_SESSION (a load or refresh with no stored
        // session) and sessions that couldn't be refreshed.
        const fallback = signedOutRedirects[router.location];

        if (!session && fallback) {
            replace(fallback);
        }
    });
}

// Where a signed-out visitor is sent from a route. Every guarded route has an
// entry, so a miss here is a bug in the app's declaration.
function signedOutRedirectFor(path: string) {
    const fallback = redirects?.signedOutRedirects[path];

    if (!fallback) {
        console.error(
            `No signed-out redirect configured for ${path}; falling back to the root route.`,
        );
    }

    return fallback ?? '/';
}

// Guard condition for a private route: a signed-in user gets to see it, everyone
// else is sent to that route's signed-out redirect.
export function requireSignedIn(path: string): RoutePrecondition {
    return async () => {
        if (await isAuthenticated()) {
            return true;
        }

        replace(signedOutRedirectFor(path));
        return false;
    };
}

// Guard condition for a route that only picks a destination - the root route in
// both apps. It always redirects and never renders: a signed-in user lands on
// `path`, a signed-out one on this route's own signed-out redirect.
export function redirectSignedInTo(path: string): RoutePrecondition {
    return async (detail) => {
        if (!(await isAuthenticated())) {
            replace(signedOutRedirectFor(detail.location));
            return false;
        }

        replace(path);
        return false;
    };
}
