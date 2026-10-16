<script lang="ts">
    import { signInWithRole } from "../lib/auth";

    let email = $state("");
    let password = $state("");
    let error = $state("");

    async function handleSubmit(event: SubmitEvent) {
        // Without this the browser performs its own GET submission, reloading the
        // page (and cancelling the in-flight sign-in request) before it resolves.
        event.preventDefault();
        error = "";

        try {
            // Refuses to keep a session for anything that isn't a restaurant.
            await signInWithRole(email, password, "restaurant");
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        }
    }
</script>

<div
    class="font-google relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-paper px-6 py-12"
>
    <div
        aria-hidden="true"
        class="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-acc-green/10 blur-3xl"
    ></div>

    <div class="relative flex w-full max-w-sm flex-col items-center gap-10">
        <!-- Branding -->
        <div class="text-center">
            <h1 class="text-5xl font-semibold tracking-[-0.065em] text-primary">
                <span>@the</span><span class="text-acc-green">Nukkad</span>
            </h1>

            <p class="mt-3 text-sm tracking-wide text-muted">
                Advance orders for indie food outlets on campus.
            </p>
        </div>

        <!-- Login form -->
        <form
            class="flex w-full flex-col gap-5 rounded-2xl border border-primary/[0.07] bg-white/60 p-6 shadow-[0_8px_40px_-20px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:p-8"
            onsubmit={handleSubmit}
        >
            <div class="flex flex-col gap-2">
                <label for="email" class="text-sm font-medium text-primary/80">
                    Restaurant email
                </label>

                <input
                    id="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    autocomplete="email"
                    bind:value={email}
                    class="w-full rounded-lg border border-primary/15 bg-paper/60 px-4 py-3 text-sm text-primary outline-none transition duration-200 placeholder:text-primary/35 hover:border-primary/25 focus:border-acc-green focus:ring-4 focus:ring-acc-green/10"
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
                    class="w-full rounded-lg border border-primary/15 bg-paper/60 px-4 py-3 text-sm text-primary outline-none transition duration-200 placeholder:text-primary/35 hover:border-primary/25 focus:border-acc-green focus:ring-4 focus:ring-acc-green/10"
                />
            </div>

            <button
                type="submit"
                class="mt-1 w-full rounded-lg bg-acc-green px-4 py-3 text-sm font-medium text-paper transition duration-200 hover:brightness-95 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc-green"
            >
                Log in
            </button>

            {#if error}
                <p class="text-sm text-red-500">{error}</p>
            {/if}
        </form>
    </div>
</div>
