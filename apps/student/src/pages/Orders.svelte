<script lang="ts">
    import { link } from "svelte-spa-router";
    import { myOrders, orderTotal, rupees, type Order } from "@thenukkad/core";

    let orders = $state<Order[]>([]);
    let loading = $state(true);
    let error = $state("");

    // The order whose code is up fullscreen, if any. Held as an id rather than as
    // the order itself: what the list knows changes under it - an outlet marking
    // one ready is exactly that - and a copy taken when the button was pressed
    // would go on saying "not ready" to the person at the counter.
    let showingId = $state<string | null>(null);
    const showing = $derived(
        orders.find((order) => order.id === showingId) ?? null,
    );

    let checking = $state(false);
    let notice = $state("");

    const message = (e: unknown) =>
        e instanceof Error ? e.message : String(e);

    // 'Today, 2:38 PM', and '21 Oct, 9:04 AM' for anything older: an order is
    // read by when it was placed, and a date on every row is noise on the day it
    // was placed.
    function placedAt(stamp: string) {
        const at = new Date(stamp);
        const time = at.toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
        });

        if (at.toDateString() === new Date().toDateString()) {
            return `Today, ${time}`;
        }

        return `${at.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
        })}, ${time}`;
    }

    function read() {
        return myOrders.list().then((loaded) => (orders = loaded));
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

        // A change carries nothing: an order's lines are a second table and not
        // in the stream, so the list is read again rather than patched. Reading
        // again is also what brings the code, which is minted in the same write
        // that makes an order ready.
        const unsubscribe = myOrders.subscribe(() => {
            void read().catch((e) => (error = message(e)));
        });

        return () => {
            live = false;
            unsubscribe();
        };
    });

    // The code on its own, for the one thing here that holds an id and wants
    // nothing else. The subscription is what keeps the display current; this is
    // for a change that arrived while the tab was asleep, or in the moment
    // before the subscription was set up.
    async function checkAgain() {
        if (!showing) {
            return;
        }

        checking = true;
        notice = "";

        try {
            const code = await myOrders.getOtpFor(showing.id);

            if (code === null) {
                notice = "Still in the kitchen.";
                return;
            }

            orders = orders.map((order) =>
                order.id === showing.id ? { ...order, otp: code } : order,
            );
        } catch (e) {
            error = message(e);
        } finally {
            checking = false;
        }
    }
</script>

<div class="font-google min-h-dvh bg-paper px-6 py-12 text-primary">
    <main class="mx-auto flex w-full max-w-sm flex-col gap-8">
        <a
            href="/home"
            use:link
            class="inline-flex items-center gap-1.5 self-start text-sm text-muted transition hover:text-primary"
        >
            <span aria-hidden="true">←</span> Outlets
        </a>

        <header class="flex items-baseline justify-between">
            <h1 class="text-2xl font-semibold tracking-[-0.03em]">
                Your orders
            </h1>
        </header>

        {#if loading}
            <p class="text-sm text-muted">Loading…</p>
        {:else if orders.length === 0}
            <p class="text-sm text-muted">
                Nothing ordered yet. Pick an outlet and it'll show up here.
            </p>
        {:else}
            <ul class="flex flex-col gap-3">
                {#each orders as order (order.id)}
                    <li
                        class="flex flex-col gap-3 rounded-xl border border-primary/[0.07] bg-white/60 px-4 py-4"
                    >
                        <div class="flex items-baseline justify-between gap-4">
                            <span class="text-sm font-medium"
                                >{order.restaurantName}</span
                            >

                            <span class="text-xs text-muted"
                                >{placedAt(order.createdAt)}</span
                            >
                        </div>

                        <div class="flex items-baseline justify-between gap-4">
                            <ul class="flex flex-col gap-0.5 text-xs text-muted">
                                {#each order.lines as line (line.id)}
                                    <li>
                                        <span class="tabular-nums"
                                            >{line.quantity}×</span
                                        >
                                        {line.name}
                                    </li>
                                {/each}
                            </ul>

                            <span class="text-sm font-medium tabular-nums"
                                >{rupees(orderTotal(order))}</span
                            >
                        </div>

                        {#if order.notes}
                            <p class="text-xs text-muted italic">
                                “{order.notes}”
                            </p>
                        {/if}

                        {#if order.otp}
                            <!-- The whole row is the way into the fullscreen
                                 display: showing the code is the student's
                                 whole job at the counter. -->
                            <button
                                type="button"
                                onclick={() => (showingId = order.id)}
                                class="flex items-baseline justify-between gap-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-left transition duration-200 hover:border-accent/50 active:scale-[0.99]"
                            >
                                <span
                                    class="text-xs font-medium tracking-wide text-accent uppercase"
                                >
                                    Show at the counter
                                </span>

                                <span
                                    class="text-2xl font-semibold tracking-[0.15em] text-accent tabular-nums"
                                >
                                    {order.otp}
                                </span>
                            </button>
                        {:else}
                            <p
                                class="rounded-lg border border-primary/[0.07] bg-paper/60 px-4 py-3 text-xs text-muted"
                            >
                                Being cooked. This page updates itself when it's
                                ready.
                            </p>
                        {/if}
                    </li>
                {/each}
            </ul>
        {/if}

        {#if error}
            <p class="text-sm text-red-500">{error}</p>
        {/if}
    </main>
</div>

{#if showing}
    <!-- Fullscreen, and on paper rather than in a card: this is held up to
         someone across a counter, so it is the only thing on the screen. -->
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
                <div class="flex flex-col items-center gap-4">
                    <p class="text-sm text-muted">Not ready yet.</p>

                    <button
                        type="button"
                        onclick={checkAgain}
                        disabled={checking}
                        class="rounded-lg border border-primary/15 px-4 py-2.5 text-sm text-muted transition duration-200 hover:border-primary/25 hover:text-primary active:scale-[0.99] disabled:opacity-40"
                    >
                        {checking ? "Checking…" : "Check again"}
                    </button>

                    {#if notice}
                        <p class="text-xs text-muted">{notice}</p>
                    {/if}
                </div>
            {/if}

            <p class="text-center text-xs text-muted">
                {placedAt(showing.createdAt)} · show this to collect
            </p>
        </div>
    </div>
{/if}
