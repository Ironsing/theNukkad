<script lang="ts">
    import { updatePassword } from "@thenukkad/core";

    let password = $state("");
    let confirm = $state("");
    let error = $state("");
    let done = $state(false);

    async function handleSubmit(event: SubmitEvent) {
        // Without this the browser performs its own GET submission, reloading the
        // page (and cancelling the in-flight updateUser request) before the
        // password change is saved.
        event.preventDefault();
        error = "";

        if (password !== confirm) {
            error = "Passwords do not match";
            return;
        }

        try {
            await updatePassword(password);
            // The auth listener sees USER_UPDATED and routes to /home.
            done = true;
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
        class="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 blur-3xl bg-accent/10"
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

        {#if done}
            <div
                class="flex w-full flex-col gap-2 rounded-2xl border border-primary/[0.07] bg-white/60 p-6 shadow-[0_8px_40px_-20px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:p-8"
                role="status"
            >
                <p class="text-sm text-primary">
                    Your password has been changed.
                </p>
            </div>
        {:else}
            <form
                class="flex w-full flex-col gap-5 rounded-2xl border border-primary/[0.07] bg-white/60 p-6 shadow-[0_8px_40px_-20px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:p-8"
                onsubmit={handleSubmit}
            >
                <div class="flex flex-col gap-2">
                    <label
                        for="password"
                        class="text-sm font-medium text-primary/80"
                    >
                        New password
                    </label>

                    <input
                        id="password"
                        type="password"
                        required
                        placeholder="Enter a new password"
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
                        placeholder="Re-enter the new password"
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
                    Change password
                </button>
            </form>
        {/if}
    </div>
</div>
