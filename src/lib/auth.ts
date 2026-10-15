import { push, replace, router } from 'svelte-spa-router';
import { supabase } from './supabase';

const PROTECTED_ROUTES = ['/welcome', '/reset-password'];

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
        if (router.location !== "/welcome") {
            push("/welcome");
        }
        return;
    }

    // A password reset link produces a recovery session, and emits
    // PASSWORD_RECOVERY rather than SIGNED_IN. The user is not "logged in" yet -
    // they still have to choose a new password - so this must not fall through
    // to /welcome
    if (event === "PASSWORD_RECOVERY" && session) {
        if (router.location !== "/reset-password") {
            push("/reset-password");
        }
        return;
    }

    // The password has been changed. Until then, stay put on /reset-password:
    // INITIAL_SESSION arrives on every page load (including right after the
    // recovery exchange), and bouncing to /welcome on it would pull the user
    // off the form before they could choose a password.
    if (event === "USER_UPDATED" && session && router.location === "/reset-password") {
        push("/welcome");
        return;
    }

    // This also covers
    // INITIAL_SESSION (a load or refresh with no stored session) and
    // sessions that couldn't be refreshed
    if (!session && PROTECTED_ROUTES.includes(router.location)) {
        replace("/login");
    }
});


