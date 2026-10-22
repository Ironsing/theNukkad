<script lang="ts">
    import { link } from "svelte-spa-router";
    import {
        incomingOrders,
        isCode,
        lineTotal,
        orderTotal,
        rupees,
        signOut,
        type Order,
    } from "@thenukkad/core";

    let orders = $state<Order[]>([]);
    let loading = $state(true);
    let error = $state("");

    // Codes minted on this screen, by order id. The list is read again after
    // cooking, and until that reply lands the ticket would otherwise go back to
    // reading as waiting.
    let codes = $state<Record<string, string>>({});

    // The code being checked at the counter, what it turned out to be, and the
    // ticket it belongs to.
    let typed = $state("");
    let checking = $state(false);
    let checked = $state("");
    let foundId = $state<string | null>(null);

    const message = (e: unknown) =>
        e instanceof Error ? e.message : String(e);

    // '2:38 PM' as the app says it.
    function clock(stamp: string) {
        return new Date(stamp).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
        });
    }

    // 'Today, 2:38 PM', and '21 Oct, 9:04 AM' for anything older - which a
    // ticket can be: a code is only unique to this outlet for a day, so an order
    // from yesterday can hold today's digits. Saying when it was placed is what
    // lets the counter see that for itself.
    function placedAt(stamp: string) {
        const at = new Date(stamp);
        const time = clock(stamp);

        if (at.toDateString() === new Date().toDateString()) {
            return `Today, ${time}`;
        }

        return `${at.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
        })}, ${time}`;
    }

    function read() {
        return incomingOrders.list().then((loaded) => (orders = loaded));
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

        // A change carries nothing - an order's lines are a second table and not
        // in the stream - so the list is read again. This is how an order
        // arriving shows up without anyone pulling to refresh.
        const unsubscribe = incomingOrders.subscribe(() => {
            void read().catch((e) => (error = message(e)));
        });

        return () => {
            live = false;
            unsubscribe();
        };
    });

    async function markReady(order: Order) {
        error = "";

        try {
            const code = await incomingOrders.markReady(order.id);

            codes = { ...codes, [order.id]: code };
            await read();
        } catch (e) {
            error = message(e);
        }
    }

    // The code as it is said across the counter. Anything that could not be one
    // is answered here rather than with a round trip - four digits, no leading
    // zero - and the rest is this outlet's own orders, because that is all the
    // policy shows it.
    async function checkCode(event: SubmitEvent) {
        event.preventDefault();
        error = "";
        checked = "";
        foundId = null;

        const code = typed.trim();

        if (!isCode(code)) {
            checked = "A code is four digits, and none of them is a zero.";
            return;
        }

        checking = true;

        try {
            const order = await incomingOrders.findByCode(code);

            if (order === null) {
                checked = `No order here has the code ${code}.`;
                return;
            }

            foundId = order.id;
            checked = `Code ${code} is the order below.`;

            // It may not be in the list yet: an order placed since this screen
            // last read, or one cooked on another till.
            if (!orders.some((o) => o.id === order.id)) {
                orders = [order, ...orders];
            }
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
            <span aria-hidden="true">←</span> Your outlet
        </a>

        <header class="flex items-baseline justify-between">
            <h1 class="text-2xl font-semibold tracking-[-0.03em]">Orders</h1>

            <button
                type="button"
                onclick={signOut}
                class="text-sm text-muted hover:text-primary"
            >
                Log out
            </button>
        </header>

        <form class="flex flex-col gap-3" onsubmit={checkCode}>
            <label class="flex flex-col gap-1.5 text-sm font-medium text-primary/80">
                Check a code

                <span class="flex gap-2">
                    <input
                        class="min-w-0 flex-1 rounded-lg border border-primary/15 bg-paper/60 px-4 py-3 text-lg tracking-[0.3em] tabular-nums text-primary outline-none transition duration-200 hover:border-primary/25 focus:border-accent"
                        type="text"
                        inputmode="numeric"
                        maxlength="4"
                        placeholder="0000"
                        bind:value={typed}
                    />

                    <button
                        type="submit"
                        disabled={checking}
                        class="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-paper transition duration-200 hover:brightness-95 active:scale-[0.99] disabled:opacity-40"
                    >
                        {checking ? "Checking…" : "Check"}
                    </button>
                </span>
            </label>

            {#if checked}
                <p class="text-sm {foundId ? 'text-accent' : 'text-muted'}">
                    {checked}
                </p>
            {/if}
        </form>

        {#if loading}
            <p class="text-sm text-muted">Loading…</p>
        {:else if orders.length === 0}
            <p class="text-sm text-muted">
                Nothing ordered yet. It'll arrive here as students order.
            </p>
        {:else}
            <ul class="flex flex-col gap-3">
                {#each orders as order (order.id)}
                    <li
                        class="flex flex-col gap-3 rounded-xl border bg-white/60 px-4 py-4 transition duration-200 {order.id ===
                        foundId
                            ? 'border-accent/60 ring-2 ring-accent/30'
                            : 'border-primary/[0.07]'}"
                    >
                        <div class="flex items-baseline justify-between gap-4">
                            <span class="text-sm font-medium tabular-nums"
                                >{placedAt(order.createdAt)}</span
                            >

                            {#if order.readyAt}
                                <span class="text-xs font-medium text-accent">
                                    Ready {clock(order.readyAt)}
                                </span>
                            {:else}
                                <span class="text-xs text-muted">Waiting</span>
                            {/if}
                        </div>

                        <ul class="flex flex-col gap-1">
                            {#each order.lines as line (line.id)}
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

                        {#if order.notes}
                            <!-- The one thing on a ticket the kitchen has to
                                 read rather than count. -->
                            <p
                                class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-primary/80"
                            >
                                {order.notes}
                            </p>
                        {/if}

                        <div class="flex items-baseline justify-between gap-4">
                            <span class="text-sm font-medium tabular-nums"
                                >{rupees(orderTotal(order))}</span
                            >

                            {#if order.readyAt}
                                <span
                                    class="text-2xl font-semibold tracking-[0.15em] tabular-nums"
                                >
                                    {codes[order.id] ?? order.otp}
                                </span>
                            {:else}
                                <button
                                    type="button"
                                    onclick={() => markReady(order)}
                                    class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-paper transition duration-200 hover:brightness-95 active:scale-[0.99]"
                                >
                                    Mark ready
                                </button>
                            {/if}
                        </div>
                    </li>
                {/each}
            </ul>
        {/if}

        {#if error}
            <p class="text-sm text-red-500">{error}</p>
        {/if}
    </main>
</div>
