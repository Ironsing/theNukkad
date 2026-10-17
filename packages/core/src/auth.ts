import { supabase } from './supabase';

export type Role = 'student' | 'restaurant';
export type EmailCodeType = 'signup' | 'recovery';

// How the confirmation and recovery emails are consumed. The web apps follow
// the link in the email; the native apps can't receive a redirect back into
// their WebView, so the user enters the code the email also carries by hand.
export type CodeDelivery = 'link' | 'manual';

let codeDelivery: CodeDelivery = 'link';

export function configureCodeDelivery(delivery: CodeDelivery) {
    codeDelivery = delivery;
}

// True when the app should tell the user to follow the emailed link rather than
// asking them for the code.
export function usesEmailLinks() {
    return codeDelivery === 'link';
}

// Set while a role-gated sign-in is in flight. SIGNED_IN fires as soon as the
// password is accepted, but the account type is only knowable after that (the
// profile row needs the session to be readable), and a mismatch signs the user
// straight back out - so whoever watches for session changes must not move them
// on in the meantime. See auth_routing.ts.
let signInInFlight = false;

export function isSignInInFlight() {
    return signInInFlight;
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

// Signup confirmations and password resets reach the user as a link (web) or as
// a code (native); this is the code half. It yields a session the same way the
// link does.
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

// The password sign-in itself, with no opinion about who should be allowed to
// stay signed in. Use signIn below.
async function signInWithPassword(
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

// Signs in, then refuses to keep the session unless the account's role is the
// one this app serves.
//
// Moving the user on is not this module's business: whoever calls this has to
// navigate once it resolves, because the session watcher deliberately sits out
// the SIGNED_IN this produces (see isSignInInFlight).
export async function signIn(
    email: string,
    password: string,
    role: Role,
) {
    signInInFlight = true;

    try {
        await signInWithPassword(email, password);

        const actual = await currentRole();

        if (actual !== role) {
            await signOut();

            throw new Error(
                role === 'restaurant'
                    ? 'That account is not a restaurant account.'
                    : 'That account is not a student account.',
            );
        }
    } finally {
        signInInFlight = false;
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
