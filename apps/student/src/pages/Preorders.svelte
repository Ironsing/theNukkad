<script lang="ts">
    import { link } from "svelte-spa-router";
    import {
        lineTotal,
        myPreorders,
        preorderStatusLabels,
        preorderTotal,
        rupees,
        signOut,
        type Preorder,
    } from "@thenukkad/core";

    let preorders = $state<Preorder[]>([]);
    let loading = $state(true);
    let error = $state("");

    // The one whose code is up fullscreen, if any. Held as an id rather than as
    // the request itself: an outlet marking one ready is exactly the sort of
    // thing that happens while the code is on the screen, and a copy taken when
    // the button was pressed would go on saying "waiting".
    let showingId = $state<string | null>(null);
    const showing = $derived(
        preorders.find((preorder) => preorder.id === showingId) ?? null,
    );

    // What still matters, and what does not: an outlet turning one down is the
    // end of it, so refused requests go under a heading of their own rather than
    // disappearing.
    const current = $derived(
        preorders.filter((preorder) => preorder.status !== "rejected"),
    );
    const refused = $derived(
        preorders.filter((preorder) => preorder.status === "rejected"),
    );

    const message = (e: unknown) =>
        e instanceof Error ? e.message : String(e);

    // 'Today, 2:38 PM', and '21 Oct, 9:04 AM' for anything older.
    function when(stamp: string) {
        const at = new Date(stamp);
        const time = at.toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
        });

        return at.toDateString() === new Date().toDateString()
            ? `Today, ${time}`
            : `${at.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
              })}, ${time}`;
    }

    // Two of the four states are worth colouring: the one an outlet has taken on,
    // and the one that is ready to collect. Rejected keeps the red, since it is
    // the only one that is bad news.
    const tone: Record<Preorder["status"], string> = {
        unknown: "text-muted",
        accepted: "text-accent",
        rejected: "text-red-500",
        ready: "text-accent",
    };

    function read() {
        return myPreorders.list().then((loaded) => (preorders = loaded));
    }

    $effect(() => {
        let live = true;

        read()
            .catch((e) => {
                if (live) error = message(e);
            })
            .finally(() => {
                if (live) loading = false;
            });

        // A change carries nothing - a request's lines are a second table and not
        // in the stream - so the list is read again. This is how an outlet
        // accepting one, or cooking one, arrives without a refresh.
        const unsubscribe = myPreorders.subscribe(() => {
            void read().catch((e) => (error = message(e)));
        });

        return () => {
            live = false;
            unsubscribe();
        };
    });
</script>


<div class="font-google min-h-dvh bg-paper px-6 py-12 text-primary">
    <main class="mx-auto flex w-full max-w-sm flex-col gap-8">
        <a
            href="/home"
            use:link
            class="inline-flex items-center gap-1.5 self-start text-sm text-muted transition hover:text-primary"
        >
            <span aria-hidden="true">←</span> Restaurants
        </a>

        <header class="flex items-baseline justify-between">
            <h1 class="text-2xl font-semibold tracking-[-0.03em]">Preorders</h1>

            <button
                type="button"
                onclick={signOut}
                class="text-sm text-muted hover:text-primary"
            >
                Log out
            </button>
        </header>

        {#if loading}
            <p class="text-sm text-muted">Loading…</p>
        {:else if preorders.length === 0}
            <p class="text-sm text-muted">
                Nothing asked for yet. Pick a restaurant and ask for something for
                later.
            </p>
        {:else}
            <ul class="flex flex-col gap-3">
                {#each current as preorder (preorder.id)}
                    <li
                        class="flex flex-col gap-3 rounded-xl border px-4 py-4 transition duration-200 {preorder.status ===
                        'ready'
                            ? 'border-accent/40 bg-accent/10'
                            : 'border-primary/[0.07] bg-white/60'}"
                    >
                        <div class="flex items-baseline justify-between gap-4">
                            <span class="text-sm font-medium"
                                >{preorder.restaurantName}</span
                            >

                            <span
                                class="text-xs font-medium {tone[
                                    preorder.status
                                ]}"
                            >
                                {preorderStatusLabels[preorder.status]}
                            </span>
                        </div>

                        <p class="-mt-2 text-xs text-muted">
                            Wanted by {when(preorder.deadline)}
                        </p>

                        <ul class="flex flex-col gap-1">
                            {#each preorder.lines as line (line.id)}
                                <li
                                    class="flex items-baseline justify-between gap-4 text-sm"
                                >
                                    <span>
                                        <span class="tabular-nums"
                                            >{line.quantity}×</span
                                        >
                                        {line.name}
                                    </span>

                                    <span class="text-xs text-muted tabular-nums"
                                        >{rupees(lineTotal(line))}</span
                                    >
                                </li>
                            {/each}
                        </ul>

                        {#if preorder.notes}
                            <p
                                class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-primary/80"
                            >
                                {preorder.notes}
                            </p>
                        {/if}

                        <div class="flex items-baseline justify-between gap-4">
                            <span class="text-sm font-medium tabular-nums"
                                >{rupees(preorderTotal(preorder))}</span
                            >

                            {#if preorder.otp}
                                <button
                                    type="button"
                                    onclick={() => (showingId = preorder.id)}
                                    class="flex items-baseline gap-3 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 transition duration-200 hover:border-accent/50 active:scale-[0.99]"
                                >
                                    <span
                                        class="text-xs font-medium tracking-wide text-accent uppercase"
                                    >
                                        Show at the counter
                                    </span>

                                    <span
                                        class="text-xl font-semibold tracking-[0.15em] text-accent tabular-nums"
                                    >
                                        {preorder.otp}
                                    </span>
                                </button>
                            {:else}
                                <span class="text-xs text-muted">
                                    {preorder.status === "accepted"
                                        ? "Being cooked"
                                        : "No code yet"}
                                </span>
                            {/if}
                        </div>
                    </li>
                {/each}
            </ul>

            {#if refused.length > 0}
                <section class="flex flex-col gap-3">
                    <h2
                        class="text-xs font-medium tracking-wide text-muted uppercase"
                    >
                        Turned down
                    </h2>

                    <ul class="flex flex-col gap-2">
                        {#each refused as preorder (preorder.id)}
                            <li
                                class="flex items-baseline justify-between gap-4 rounded-xl border border-primary/[0.07] px-4 py-3 text-sm"
                            >
                                <span class="flex flex-col">
                                    <span class="text-muted"
                                        >{preorder.restaurantName}</span
                                    >

                                    <span class="text-xs text-muted">
                                        for {when(preorder.deadline)}
                                    </span>
                                </span>

                                <span class="text-xs text-red-500">
                                    {preorderStatusLabels[preorder.status]}
                                </span>
                            </li>
                        {/each}
                    </ul>
                </section>
            {/if}
        {/if}

        {#if error}
            <p class="text-sm text-red-500">{error}</p>
        {/if}
    </main>
</div>

{#if showing}
    <!-- Fullscreen, on paper rather than in a card: this is held up to someone
         across a counter, so it is the only thing on the screen. -->
    <div
        class="font-google fixed inset-0 z-50 flex flex-col bg-paper px-6 py-12 text-primary"
    >
        <div
            class="mx-auto flex w-full max-w-sm flex-1 flex-col justify-between gap-8"
        >
            <header class="flex items-baseline justify-between gap-4">
                <span class="text-sm font-medium">{showing.restaurantName}</span>

                <button
                    type="button"
                    onclick={() => (showingId = null)}
                    class="text-sm text-muted hover:text-primary"
                >
                    Close
                </button>
            </header>

            {#if showing.otp}
                <p
                    class="text-center text-[5.5rem] leading-none font-semibold tracking-[0.12em] tabular-nums"
                >
                    {showing.otp}
                </p>
            {:else}
                <p class="text-center text-sm text-muted">
                    Not ready yet. This page updates itself when it is.
                </p>
            {/if}

            <p class="text-center text-xs text-muted">
                for {when(showing.deadline)} · show this to collect
            </p>
        </div>
    </div>
{/if}
