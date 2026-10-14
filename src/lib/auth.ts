import { push, replace, router } from 'svelte-spa-router';
import { supabase } from './supabase';

const PROTECTED_ROUTES = ['/welcome'];

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
        redirectTo: `${window.location.origin}/welcome`,
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

    // This also covers
    // INITIAL_SESSION (a load or refresh with no stored session) and
    // sessions that couldn't be refreshed
    if (!session && PROTECTED_ROUTES.includes(router.location)) {
        replace("/login");
    }
});

