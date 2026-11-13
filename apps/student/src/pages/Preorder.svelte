<script lang="ts">
    import { link, push } from "svelte-spa-router";
    import {
        MenuReader,
        dietLabels,
        foldMenuItems,
        menuSections,
        myPreorders,
        restaurants,
        rupees,
        type MenuItem,
        type Restaurant,
    } from "@thenukkad/core";

    // The router hands a page its URL parameters.
    let { params }: { params: { id: string } } = $props();

    let outlet = $state<Restaurant | null>(null);
    let items = $state<MenuItem[]>([]);
    let loading = $state(true);
    let error = $state("");

    // One block per category, in the order the list is kept in.
    const sections = $derived(menuSections(items));

    const message = (e: unknown) =>
        e instanceof Error ? e.message : String(e);

    // Roomier than it looks: on a touch screen these are the buttons a thumb
    // actually hits.
    const step =
        "rounded-lg border border-primary/15 px-3 py-1.5 text-sm text-muted transition duration-200 hover:border-primary/25 hover:text-primary active:scale-[0.99]";

    // The most of one item the database takes, said here so the stepper stops
    // where a request would be refused rather than a tap later.
    const mostOfOneItem = 20;

    let cart = $state<Record<string, number>>({});
    let notes = $state("");

    // What the bar at the bottom is about, in the menu's own order.
    const cartLines = $derived(
        items
            .filter((item) => (cart[item.id] ?? 0) > 0)
            .map((item) => ({ item, quantity: cart[item.id] })),
    );

    const cartCount = $derived(
        cartLines.reduce((count, line) => count + line.quantity, 0),
    );

    const cartTotal = $derived(
        cartLines.reduce(
            (total, line) => total + line.item.price * line.quantity,
            0,
        ),
    );

    function addToCart(item: MenuItem, by: number) {
        cart = {
            ...cart,
            [item.id]: Math.min(
                mostOfOneItem,
                Math.max(0, (cart[item.id] ?? 0) + by),
            ),
        };
    }

    // The picker's own spelling of an instant: 'YYYY-MM-DDTHH:mm', local, which
    // is what a datetime-local input speaks and what a Date reads back as local
    // time.
    function pickerValue(at: Date) {
        const pad = (n: number) => String(n).padStart(2, "0");

        return (
            `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
            `T${pad(at.getHours())}:${pad(at.getMinutes())}`
        );
    }

    const hour = 60 * 60 * 1000;

    // A request is wanted later and no more than a day later. Both of those are
    // the column's own checks, said here as what the picker will offer, rather
    // than as a refusal to read afterwards.
    let wantedBy = $state(pickerValue(new Date(Date.now() + hour)));
    const soonest = $derived(pickerValue(new Date()));
    const latest = $derived(pickerValue(new Date(Date.now() + 24 * hour)));

    // Quick fills, because a picker is a lot of taps for "in an hour".
    function wantIn(hours: number) {
        wantedBy = pickerValue(new Date(Date.now() + hours * hour));
    }

    let asking = $state(false);
    let askError = $state("");

    async function askForIt() {
        if (outlet === null || cartLines.length === 0) {
            return;
        }

        asking = true;
        askError = "";

        try {
            // The deadline goes over as a Date; the core turns it into the
            // instant Postgres wants, in one place, rather than here where a
            // local string would be read as UTC.
            await myPreorders.place({
                restaurantId: outlet.id,
                notes,
                deadline: new Date(wantedBy),
                lines: cartLines.map((line) => ({
                    menuItemId: line.item.id,
                    quantity: line.quantity,
                })),
            });

            // Placed. Where it goes next is the preorders list, which is also
            // the only place its answer and its code will turn up.
            push("/preorders");
        } catch (e) {
            // The refusals are sentences - that restaurant has closed for now, that
            // time has already passed, only one preorder a minute - so the bar
            // shows the one it is given.
            askError = message(e);
        } finally {
            asking = false;
        }
    }

    $effect(() => {
        // Read here so that moving from one outlet to another refetches.
        const id = params.id;
        const reader = new MenuReader(id);
        // Set when this effect is torn down, so a reply that lands after the
        // page has moved on cannot write over the next one's.
        let live = true;

        outlet = null;
        items = [];
        cart = {};
        notes = "";
        error = "";
        askError = "";
        loading = true;

        restaurants
            .get(id)
            .then((found) => {
                if (live) outlet = found;
            })
            .catch((e) => {
                if (live) error = message(e);
            });

        reader
            .list()
            .then((loaded) => {
                if (live) items = loaded;
            })
            .catch((e) => {
                if (live) error = message(e);
            })
            .finally(() => {
                if (live) loading = false;
            });

        const unsubscribe = reader.subscribe(
            (change) => (items = foldMenuItems(items, change)),
        );

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

        <header class="flex flex-col gap-1">
            <h1 class="text-2xl font-semibold tracking-[-0.03em]">
                {outlet?.name ?? "Preorder"}
            </h1>

            <p class="text-xs text-muted">
                Order it now, collect it later. Pick a time up to a day ahead and
                the restaurant will say yes or no.
            </p>
        </header>

        {#if outlet?.status === "closedManually"}
            <p
                class="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500"
            >
                This restaurant has closed for now, so a preorder would be refused.
            </p>
        {/if}

        {#if loading}
            <p class="text-sm text-muted">Loading…</p>
        {:else if sections.length === 0}
            <p class="text-sm text-muted">
                Nothing on the menu yet, so there is nothing to ask for.
            </p>
        {:else}
            {#each sections as section (section.category)}
                <section class="flex flex-col gap-3">
                    <h2
                        class="text-xs font-medium tracking-wide text-muted uppercase"
                    >
                        {section.category}
                    </h2>

                    <ul class="flex flex-col gap-2">
                        {#each section.items as item (item.id)}
                            <li
                                class="flex flex-col gap-3 rounded-xl border border-primary/[0.07] bg-white/60 px-4 py-3"
                            >
                                <div
                                    class="flex items-baseline justify-between gap-4"
                                >
                                    <span class="flex flex-col">
                                        <span class="text-sm font-medium"
                                            >{item.name}</span
                                        >

                                        <span class="text-xs text-muted">
                                            {dietLabels[item.diet]}
                                        </span>
                                    </span>

                                    <span class="flex flex-col items-end">
                                        <span class="text-sm tabular-nums"
                                            >{rupees(item.price)}</span
                                        >

                                        {#if !item.available}
                                            <!-- Sold out today is not sold out for
                                                 later, and the database takes a
                                                 request for one: the kitchen can
                                                 say no when it reads it. -->
                                            <span class="text-xs text-red-500">
                                                Sold out — ask anyway
                                            </span>
                                        {/if}
                                    </span>
                                </div>

                                <div class="flex items-center justify-end gap-3">
                                    {#if (cart[item.id] ?? 0) > 0}
                                        <button
                                            type="button"
                                            class={step}
                                            onclick={() => addToCart(item, -1)}
                                            aria-label="One {item.name} fewer"
                                        >
                                            −
                                        </button>

                                        <span
                                            class="w-6 text-center text-sm tabular-nums"
                                        >
                                            {cart[item.id]}
                                        </span>
                                    {/if}

                                    <button
                                        type="button"
                                        class={step}
                                        onclick={() => addToCart(item, 1)}
                                        aria-label="One {item.name} more"
                                    >
                                        {(cart[item.id] ?? 0) > 0 ? "+" : "Add"}
                                    </button>
                                </div>
                            </li>
                        {/each}
                    </ul>
                </section>
            {/each}
        {/if}

        {#if error}
            <p class="text-sm text-red-500">{error}</p>
        {/if}

        {#if cartLines.length > 0}
            <div class="h-72"></div>
        {/if}
    </main>
</div>

{#if cartLines.length > 0}
    <!-- Fixed over the page rather than in it, so the time being picked stays
         reachable however far down the menu a thumb is. -->
    <div
        class="fixed inset-x-0 bottom-0 z-40 border-t border-primary/10 bg-paper/95 backdrop-blur"
    >
        <div class="mx-auto flex w-full max-w-sm flex-col gap-3 px-6 py-4">
            <div class="flex items-baseline justify-between gap-4">
                <span class="text-xs text-muted">
                    {cartCount}
                    {cartCount === 1 ? "item" : "items"} from {outlet?.name ??
                        "this restaurant"}
                </span>

                <span class="text-sm font-medium tabular-nums"
                    >{rupees(cartTotal)}</span
                >
            </div>

            <label class="flex flex-col gap-1.5 text-xs text-muted">
                Wanted by
                <input
                    class="rounded-lg border border-primary/15 bg-paper/60 px-4 py-2.5 text-sm text-primary outline-none transition duration-200 hover:border-primary/25 focus:border-accent"
                    type="datetime-local"
                    min={soonest}
                    max={latest}
                    bind:value={wantedBy}
                />
            </label>

            <div class="flex flex-wrap gap-2">
                <button type="button" class={step} onclick={() => wantIn(0.5)}>
                    In 30 min
                </button>

                <button type="button" class={step} onclick={() => wantIn(1)}>
                    In an hour
                </button>

                <button type="button" class={step} onclick={() => wantIn(2)}>
                    In two hours
                </button>
            </div>

            <input
                class="rounded-lg border border-primary/15 bg-paper/60 px-4 py-2.5 text-sm text-primary outline-none transition duration-200 hover:border-primary/25 focus:border-accent"
                type="text"
                maxlength="200"
                placeholder="Anything to say? (optional)"
                bind:value={notes}
            />

            <button
                type="button"
                onclick={askForIt}
                disabled={asking}
                class="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-paper transition duration-200 hover:brightness-95 active:scale-[0.99] disabled:opacity-40"
            >
                {asking ? "Asking…" : "Ask for it"}
            </button>

            {#if askError}
                <p class="text-sm text-red-500">{askError}</p>
            {/if}
        </div>
    </div>
{/if}
