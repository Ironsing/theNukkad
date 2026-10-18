<script lang="ts">
    import { push } from "svelte-spa-router";
    import {
        passwordReset,
        signIn,
        usesEmailLinks,
        verifyEmailCode,
    } from "@thenukkad/core";

    let email = $state("");
    let password = $state("");
    let error = $state("");
    let resetSent = $state("");
    let resetError = $state("");
    let code = $state("");
    let codeError = $state("");

    async function handleSubmit(event: SubmitEvent) {
        // Without this the browser performs its own GET submission, reloading the
        // page (and cancelling the in-flight sign-in request) before it resolves.
        event.preventDefault();
        error = "";

        try {
            // Refuses to keep a session for anything that isn't a restaurant.
            await signIn(email, password, "restaurant");
            // Signing in doesn't navigate on its own: a gated sign-in owns this
            // transition, so it is the caller that moves the user on.
            push("/home");
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        }
    }

    async function handleForgotPassword() {
        resetError = "";
        resetSent = "";

        try {
            await passwordReset(email);
            resetSent = email;
        } catch (e) {
            resetError = e instanceof Error ? e.message : String(e);
        }
    }

    // The mobile app can't follow the emailed link, so the same email carries a
    // code and the user types it here instead. Verifying it produces the same
    // recovery session the link would, and the auth listener then routes to
    // /reset-password.
    async function handleVerifyCode(event: SubmitEvent) {
        event.preventDefault();
        codeError = "";

        try {
            await verifyEmailCode(resetSent, code, "recovery");
        } catch (e) {
            codeError = e instanceof Error ? e.message : String(e);
        }
    }
</script>

<div
    class="font-google relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-paper px-6 py-12"
>
    <div
        aria-hidden="true"
        class="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
    ></div>

    <div class="relative flex w-full max-w-sm flex-col items-center gap-10">
        <!-- Branding -->
        <div class="text-center">
            <h1 class="text-5xl font-semibold tracking-[-0.065em] text-primary">
                <span>@the</span><span class="text-accent">Nukkad</span>
            </h1>

            <p class="mt-3 text-sm tracking-wide text-muted">
                Advance orders for indie food outlets on campus.
            </p>
        </div>

        {#if resetSent && !usesEmailLinks()}
            <!-- Reset code (mobile) -->
            <form
                class="flex w-full flex-col gap-5 rounded-2xl border border-primary/[0.07] bg-white/60 p-6 shadow-[0_8px_40px_-20px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:p-8"
                onsubmit={handleVerifyCode}
            >
                <p class="text-sm text-primary">
                    We emailed a reset code to
                    <span class="font-medium">{resetSent}</span>.
                </p>

                <div class="flex flex-col gap-2">
                    <label
                        for="code"
                        class="text-sm font-medium text-primary/80"
                    >
                        Code
                    </label>

                    <input
                        id="code"
                        inputmode="numeric"
                        autocomplete="one-time-code"
                        maxlength="6"
                        required
                        placeholder="000000"
                        bind:value={code}
                        class="w-full rounded-lg border border-primary/15 bg-paper/60 px-4 py-3 text-center text-lg tracking-[0.3em] text-primary outline-none transition duration-200 placeholder:text-primary/35 hover:border-primary/25 focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                </div>

                {#if codeError}
                    <p class="text-sm text-red-500">{codeError}</p>
                {/if}

                <button
                    type="submit"
                    class="mt-1 w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-paper transition duration-200 hover:brightness-95 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                    Continue
                </button>
            </form>
        {:else}
            <!-- Login form -->
            <form
                class="flex w-full flex-col gap-5 rounded-2xl border border-primary/[0.07] bg-white/60 p-6 shadow-[0_8px_40px_-20px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:p-8"
                onsubmit={handleSubmit}
            >
                <div class="flex flex-col gap-2">
                    <label
                        for="email"
                        class="text-sm font-medium text-primary/80"
                    >
                        Email address
                    </label>

                    <input
                        id="email"
                        type="email"
                        required
                        placeholder="you@example.com"
                        autocomplete="email"
                        bind:value={email}
                        class="w-full rounded-lg border border-primary/15 bg-paper/60 px-4 py-3 text-sm text-primary outline-none transition duration-200 placeholder:text-primary/35 hover:border-primary/25 focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                </div>

                <div class="flex flex-col gap-2">
                    <label
                        for="password"
                        class="text-sm font-medium text-primary/80"
                    >
                        Password
                    </label>

                    <input
                        id="password"
                        type="password"
                        required
                        placeholder="Enter your password"
                        autocomplete="current-password"
                        bind:value={password}
                        class="w-full rounded-lg border border-primary/15 bg-paper/60 px-4 py-3 text-sm text-primary outline-none transition duration-200 placeholder:text-primary/35 hover:border-primary/25 focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                </div>

                {#if error}
                    <p class="text-sm text-red-500">{error}</p>
                {/if}

                <button
                    type="submit"
                    class="mt-1 w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-paper transition duration-200 hover:brightness-95 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                    Log in
                </button>

                {#if resetSent}
                    <p class="text-sm text-muted" role="status">
                        If an account exists for {resetSent}, we've sent a
                        password reset link to it.
                    </p>
                {:else}
                    <button
                        type="button"
                        onclick={handleForgotPassword}
                        disabled={!email}
                        class="w-full text-center text-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:decoration-accent disabled:text-primary/30 disabled:no-underline"
                    >
                        Forgot your password?
                    </button>
                {/if}

                {#if resetError}
                    <p class="text-sm text-red-500">{resetError}</p>
                {/if}
            </form>
        {/if}
    </div>
</div>
