import { push, replace, router } from 'svelte-spa-router';
import { supabase } from './supabase';

export type Role = 'student' | 'restaurant';

// Where a logged-out user is sent for each private route, e.g. both apps map
// /home to their own /login. Every app declares its own before the router
// mounts. Public routes are absent.
let signedOutRedirects: Record<string, string> = {};

// How the confirmation and recovery emails are consumed. The web apps follow
// the link in the email; the native apps can't receive a redirect back into
// their WebView, so they ask the user to type the code the email also carries.
let emailDelivery: 'link' | 'code' = 'link';

export function configureAuth(options: {
    signedOutRedirects: Record<string, string>;
    emailDelivery?: 'link' | 'code';
}) {
    signedOutRedirects = { ...options.signedOutRedirects };
    emailDelivery = options.emailDelivery ?? 'link';
}

// True when the app should tell the user to follow the emailed link rather than
// asking them for the code.
export function usesEmailLinks() {
    return emailDelivery === 'link';
}

function signedOutRedirectFor(path: string) {
    return signedOutRedirects[path];
}

// Guard condition for a private route: go to that route's fallback when there's no session.
export function requireSession(path: string) {
    return async () => {
        if (await isAuthenticated()) {
            return true;
        }

        const fallback = signedOutRedirectFor(path);

        if (!fallback) {
            console.error(
                `No signed-out redirect configured for ${path}; falling back to the root route.`,
            );
        }

        replace(fallback ?? '/');
        return false;
    };
}

export function isAuthCallbackPending() {
    return new URLSearchParams(window.location.search).has('code');
}

export async function startSignup(
    email: string,
    password: string,
) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${window.location.origin}/`,
        },
    });

    if (error) {
        throw error;
    }

    return data;
}

export type EmailCodeType = 'signup' | 'recovery';

// Signup confirmations and password resets reach the user as a link (web) or as
// a code (native); this is the code half. It yields a session the same way the
// link does, so the auth listener routes the user on as usual.
export async function verifyEmailCode(
    email: string,
    token: string,
    type: EmailCodeType,
) {
    const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type,
    });

    if (error) {
        throw error;
    }

    return data;
}

export async function signIn(
    email: string,
    password: string,
) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        throw error;
    }
    return data;
}

// The account type of the logged-in user. Read from our own table rather than
// trusted from anywhere client-side: RLS only lets a user select their own row.
export async function currentRole(): Promise<Role> {
    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .single();

    if (error) {
        throw error;
    }

    return data.role as Role;
}

// Set while a role-gated sign-in is in flight. SIGNED_IN fires as soon as the
// password is accepted, but the account type is only knowable after that (the
// profile row needs the session to be readable), and a mismatch signs the user
// straight back out - so the listener below must not bounce them to /home in
// the meantime.
let roleCheckInFlight = false;

export async function signInWithRole(
    email: string,
    password: string,
    role: Role,
) {
    roleCheckInFlight = true;

    try {
        await signIn(email, password);

        const actual = await currentRole();

        if (actual !== role) {
            await signOut();

            throw new Error(
                role === 'restaurant'
                    ? 'That account is not a restaurant account.'
                    : 'That account is not a student account.',
            );
        }

        // The listener deliberately sat this one out, so navigating is up to us.
        push('/home');
    } finally {
        roleCheckInFlight = false;
    }
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
        throw error;
    }
}

export async function passwordReset(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
    });

    if (error) {
        throw error;
    }

    return data;
}

export async function updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
    });

    if (error) {
        throw error;
    }

    return data;
}

export async function isAuthenticated() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        console.error('Auth getSession error:', error);
        return false;
    }

    return Boolean(data.session);
}

// The single place that moves the user between public and protected pages
supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session) {
        // A role-gated sign-in owns this transition: the account type is checked
        // first, and a wrong-role account is signed back out. See signInWithRole.
        if (roleCheckInFlight) {
            return;
        }

        if (router.location !== "/home") {
            push("/home");
        }
        return;
    }

    // A password reset link produces a recovery session, and emits
    // PASSWORD_RECOVERY rather than SIGNED_IN. The user is not "logged in" yet -
    // they still have to choose a new password - so this must not fall through
    // to /home
    if (event === "PASSWORD_RECOVERY" && session) {
        if (router.location !== "/reset-password") {
            push("/reset-password");
        }
        return;
    }

    // The password has been changed. Until then, stay put on /reset-password:
    // INITIAL_SESSION arrives on every page load (including right after the
    // recovery exchange), and bouncing to /home on it would pull the user
    // off the form before they could choose a password.
    if (event === "USER_UPDATED" && session && router.location === "/reset-password") {
        push("/home");
        return;
    }

    // This also covers
    // INITIAL_SESSION (a load or refresh with no stored session) and
    // sessions that couldn't be refreshed
    const fallback = signedOutRedirectFor(router.location);

    if (!session && fallback) {
        replace(fallback);
    }
});


