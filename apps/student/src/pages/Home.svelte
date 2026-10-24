<script lang="ts">
    import { link } from "svelte-spa-router";
    import { fold, outlets, signOut, type Outlet } from "@thenukkad/core";

    let rows = $state<Outlet[]>([]);
    let loading = $state(true);
    let error = $state("");

    const message = (e: unknown) =>
        e instanceof Error
            ? e.message
            : typeof e === 'object' && e !== null && 'message' in e
            ? String((e as { message: unknown }).message)
            : String(e);

    // '19:00' as the app says it.
    function clock(time: string) {
        const hour = Number(time.slice(0, 2));

        return `${hour % 12 || 12}:${time.slice(3, 5)} ${
            hour < 12 ? "AM" : "PM"
        }`;
    }

    $effect(() => {
        outlets
            .list()
            .then((loaded) => (rows = loaded))
            .catch((e) => (error = message(e)))
            .finally(() => (loading = false));

        return outlets.subscribe((change) => (rows = fold(rows, change)));
    });
</script>

<div class="font-google min-h-dvh bg-paper px-6 py-12 text-primary">
    <main class="mx-auto flex w-full max-w-sm flex-col gap-8">
        <p
            class="inline-flex items-center self-start rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium tracking-wide text-accent uppercase"
        >
            Student app
        </p>

        <header class="flex items-baseline justify-between">
            <h1 class="text-2xl font-semibold tracking-[-0.03em]">Outlets</h1>

            <button
                type="button"
                onclick={signOut}
                class="text-sm text-muted hover:text-primary"
            >
                Log out
            </button>
        </header>

        <a
            href="/orders"
            use:link
            class="flex items-baseline justify-between gap-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent transition duration-200 hover:border-accent/50 active:scale-[0.99]"
        >
            <span>Your orders</span>
            <span aria-hidden="true">→</span>
        </a>

        {#if loading}
            <p class="text-sm text-muted">Loading…</p>
        {:else if rows.length === 0}
            <p class="text-sm text-muted">
                No outlets yet. They'll show up here as they set themselves up.
            </p>
        {:else}
            <ul class="flex flex-col gap-3">
                {#each rows as outlet (outlet.id)}
                    <li>
                        <!-- The whole row is the way into the menu. -->
                        <a
                            href="/menu/{outlet.id}"
                            use:link
                            class="flex items-baseline justify-between gap-4 rounded-xl border border-primary/[0.07] bg-white/60 px-4 py-3 transition duration-200 hover:border-primary/20 hover:bg-white active:scale-[0.99]"
                        >
                            <span class="flex flex-col">
                                <span class="text-sm font-medium"
                                    >{outlet.name}</span
                                >

                                <span class="text-xs text-muted">
                                    <!-- Unset together or set together, so one
                                         test covers both. -->
                                    {outlet.opensAt && outlet.closesAt
                                        ? `${clock(outlet.opensAt)} to ${clock(outlet.closesAt)}`
                                        : "Hours not set"}
                                </span>

                                {#if outlet.phone}
                                    <button
                                        type="button"
                                        onclick={() =>
                                            (window.location.href = `tel:${outlet.phone}`)}
                                        class="text-xs text-accent underline hover:opacity-80"
                                    >{outlet.phone}</button>
                                {:else if outlet.email}
                                    <span class="text-xs text-muted">{outlet.email}</span>
                                {:else if outlet.address}
                                    <span class="text-xs text-muted">{outlet.address}</span>
                                {/if}
                            </span>

                            <!-- Only the exception is marked: everything else is
                                 running to its hours. -->
                            {#if outlet.status === "closedManually"}
                                <span class="text-xs font-medium text-red-500">
                                    Closed
                                </span>
                            {:else}
                                <span aria-hidden="true" class="text-muted"
                                    >→</span
                                >
                            {/if}
                        </a>
                    </li>
                {/each}
            </ul>
        {/if}

        {#if error}
            <p class="text-sm text-red-500">{error}</p>
        {/if}
    </main>
</div>
