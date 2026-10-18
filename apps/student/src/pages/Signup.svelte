<script lang="ts">
    import { link } from "svelte-spa-router";
    import {
        startSignup,
        usesEmailLinks,
        verifyEmailCode,
    } from "@thenukkad/core";

    let email = $state("");
    let password = $state("");
    let confirm = $state("");
    let error = $state("");
    let sent = $state(false);
    let code = $state("");
    let codeError = $state("");

    async function handleSubmit(event: SubmitEvent) {
        // Without this the browser performs its own GET submission, reloading the
        // page (and cancelling the in-flight sign-up request) before it resolves.
        event.preventDefault();
        error = "";
        if (password !== confirm) {
            error = "Passwords do not match";
            return;
        }
        try {
            await startSignup(email, password);
            sent = true;
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        }
    }

    // The mobile app can't follow the emailed link, so the same email carries a
    // code and the user types it here instead.
    async function handleVerify(event: SubmitEvent) {
        event.preventDefault();
        codeError = "";

        try {
            await verifyEmailCode(email, code, "signup");
            // The auth listener sees SIGNED_IN and routes to /home.
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

            <p
                class="mt-4 inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium tracking-wide text-accent uppercase"
            >
                Student app
            </p>

            <p class="mt-3 text-sm tracking-wide text-muted">
                Advance orders for indie food outlets on campus.
            </p>
        </div>

        {#if sent && usesEmailLinks()}
            <div
                class="flex w-full flex-col gap-4 rounded-2xl border border-primary/[0.07] bg-white/60 p-6 shadow-[0_8px_40px_-20px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:p-8"
                role="status"
            >
                <p class="text-sm text-primary">
                    We sent a confirmation link to
                    <span class="font-medium">{email}</span>.
                </p>

                <p class="text-sm text-muted">
                    Click it to finish setting up your account. You'll be signed
                    in automatically.
                </p>
            </div>
        {:else if sent}
            <!-- Confirmation code (mobile) -->
            <form
                class="flex w-full flex-col gap-5 rounded-2xl border border-primary/[0.07] bg-white/60 p-6 shadow-[0_8px_40px_-20px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:p-8"
                onsubmit={handleVerify}
            >
                <p class="text-sm text-primary">
                    We emailed a confirmation code to
                    <span class="font-medium">{email}</span>.
                </p>

                <div class="flex flex-col gap-2">
                    <label for="code" class="text-sm font-medium text-primary/80">
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
                    Confirm
                </button>
            </form>
        {:else}
            <!-- Signup form -->
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
                        placeholder="Enter a password"
                        autocomplete="new-password"
                        bind:value={password}
                        class="w-full rounded-lg border border-primary/15 bg-paper/60 px-4 py-3 text-sm text-primary outline-none transition duration-200 placeholder:text-primary/35 hover:border-primary/25 focus:border-accent focus:ring-4 focus:ring-accent/10"
                    />
                </div>

                <div class="flex flex-col gap-2">
                    <label
                        for="confirm"
                        class="text-sm font-medium text-primary/80"
                    >
                        Confirm password
                    </label>

                    <input
                        id="confirm"
                        type="password"
                        required
                        placeholder="Re-enter your password"
                        autocomplete="new-password"
                        bind:value={confirm}
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
                    Sign up
                </button>
            </form>
        {/if}

        <!-- Login link -->
        <p class="text-sm text-muted">
            Already have an account?
            <a
                href="/login"
                use:link
                class="ml-1 font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:decoration-accent"
            >
                Log in
            </a>
        </p>
    </div>
</div>
