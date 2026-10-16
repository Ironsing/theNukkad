<script lang="ts">
    import { currentRole, signOut, type Role } from "@thenukkad/core";

    let role = $state<Role | null>(null);
    let error = $state("");

    async function handleLogout() {
        await signOut();
    }

    // Runs once on mount. The route guard has already established that there is a
    // session, and RLS limits this to the logged-in user's own profile row.
    $effect(() => {
        currentRole()
            .then((loaded) => (role = loaded))
            .catch((e) => (error = e instanceof Error ? e.message : String(e)));
    });
</script>

<div
    class="font-google relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-paper px-6 py-12"
>
    <div
        aria-hidden="true"
        class="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-acc-green/10 blur-3xl"
    ></div>

    <div class="relative flex w-full max-w-sm flex-col items-center gap-10">
        <h1 class="text-5xl font-semibold text-primary">
            hello{role ? ` ${role}` : ""}
        </h1>

        <p class="text-sm text-muted">
            {#if role}
                You're logged in as a {role}.
            {:else}
                You're logged in.
            {/if}
        </p>

        {#if error}
            <p class="text-sm text-red-500">{error}</p>
        {/if}

        <button
            type="button"
            onclick={handleLogout}
            class="mt-2 rounded-lg bg-red-500 px-4 py-3 text-sm font-medium text-paper transition duration-200 hover:brightness-95 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500"
        >
            Log out
        </button>
    </div>
</div>
