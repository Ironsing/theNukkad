<script lang="ts">
    import { link, push } from "svelte-spa-router";
    import {
        MenuReader,
        dietLabels,
        foldMenuItems,
        menuSections,
        myOrders,
        outlets,
        rupees,
        type Diet,
        type MenuItem,
        type Outlet,
    } from "@thenukkad/core";

    // The router hands a page its URL parameters.
    let { params }: { params: { id: string } } = $props();

    let outlet = $state<Outlet | null>(null);
    let items = $state<MenuItem[]>([]);
    let loading = $state(true);
    let error = $state("");

    // One block per category, in the order the list is kept in.
    const sections = $derived(menuSections(items));

    const message = (e: unknown) =>
        e instanceof Error ? e.message : String(e);

    // The marker the three are recognised by: a dot in a square, green for veg,
    // brown-red for non-veg and yellow for egg. Deliberately not the accent -
    // this is the menu's own colour language, not this app's.
    const dietMarks: Record<Diet, string> = {
        veg: "border-green-600 text-green-600",
        nonveg: "border-red-600 text-red-600",
        egg: "border-amber-500 text-amber-500",
    };

    // '19:00' as the app says it.
    function clock(time: string) {
        const hour = Number(time.slice(0, 2));

        return `${hour % 12 || 12}:${time.slice(3, 5)} ${
            hour < 12 ? "AM" : "PM"
        }`;
    }

    // The cart: how many of each item, by the item's id. The menu is what this
    // page shows; the cart is only what has been asked for so far, and it goes
    // when the outlet does.
    let cart = $state<Record<string, number>>({});
    let notes = $state("");
    let placing = $state(false);
    let placeError = $state("");

    // The most of one item the database takes, said here so the stepper stops
    // where a request would be refused rather than a tap later.
    const mostOfOneItem = 20;

    // Roomier than it looks: on a touch screen these are the buttons a thumb
    // actually hits.
    const step =
        "rounded-lg border border-primary/15 px-3 py-1.5 text-sm text-muted transition duration-200 hover:border-primary/25 hover:text-primary active:scale-[0.99]";

    // What the bar at the bottom is about, in the menu's own order rather than
    // in the order things were tapped in.
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

    async function placeOrder() {
        if (outlet === null || cartLines.length === 0) {
            return;
        }

        placing = true;
        placeError = "";

        try {
            // No names and no prices in the request: it says which item and how
            // many, and the database reads the rest off the menu it is ordering
            // from, which is what makes the price on the order the price on the
            // menu.
            await myOrders.place({
                restaurantId: outlet.id,
                notes,
                lines: cartLines.map((line) => ({
                    menuItemId: line.item.id,
                    quantity: line.quantity,
                })),
            });

            // Placed. Where its code will turn up is the orders page, which is
            // also the only thing left to say to someone who has just ordered.
            push("/orders");
        } catch (e) {
            // The refusals are sentences - the outlet has closed for now, one of
            // those items is sold out, only one order a minute - so the bar
            // shows the one it is given.
            placeError = message(e);
        } finally {
            placing = false;
        }
    }

    $effect(() => {
        // Read here so that moving from one menu to another refetches.
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
        placeError = "";
        loading = true;

        outlets
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
            <span aria-hidden="true">←</span> Outlets
        </a>

        <header class="flex flex-col gap-1">
            <h1 class="text-2xl font-semibold tracking-[-0.03em]">
                {outlet?.name ?? "Menu"}
            </h1>

            {#if outlet}
                <p class="text-xs text-muted">
                    <!-- Unset together or set together, so one test covers
                         both. -->
                    {outlet.opensAt && outlet.closesAt
                        ? `${clock(outlet.opensAt)} to ${clock(outlet.closesAt)}`
                        : "Hours not set"}
                </p>
            {/if}
        </header>

        {#if outlet?.status === "closedManually"}
            <p
                class="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500"
            >
                This outlet has closed for now. Its menu is still here to look
                at.
            </p>
        {/if}

        {#if loading}
            <p class="text-sm text-muted">Loading…</p>
        {:else if sections.length === 0}
            <p class="text-sm text-muted">
                Nothing on the menu yet. It'll show up here as the outlet adds
                to it.
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
                                    <span class="flex items-center gap-2">
                                        <span
                                            class="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border {dietMarks[
                                                item.diet
                                            ]}"
                                            aria-hidden="true"
                                        >
                                            <span
                                                class="h-1.5 w-1.5 rounded-full bg-current"
                                            ></span>
                                        </span>

                                        <span class="sr-only">
                                            {dietLabels[item.diet]}
                                        </span>

                                        <span
                                            class="text-sm font-medium"
                                            class:text-muted={!item.available}
                                            class:line-through={!item.available}
                                        >
                                            {item.name}
                                        </span>
                                    </span>

                                    <span class="flex flex-col items-end">
                                        <span
                                            class="text-sm tabular-nums"
                                            class:text-muted={!item.available}
                                        >
                                            {rupees(item.price)}
                                        </span>

                                        {#if !item.available}
                                            <span class="text-xs text-red-500">
                                                Sold out
                                            </span>
                                        {/if}
                                    </span>
                                </div>

                                <!-- Only what is on today can be ordered, and
                                     only up to what one order may hold. -->
                                {#if item.available}
                                    <div
                                        class="flex items-center justify-end gap-2"
                                    >
                                        {#if (cart[item.id] ?? 0) > 0}
                                            <button
                                                type="button"
                                                class={step}
                                                onclick={() =>
                                                    addToCart(item, -1)}
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
                                            {(cart[item.id] ?? 0) > 0
                                                ? "+"
                                                : "Add"}
                                        </button>
                                    </div>
                                {/if}
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
            <div class="h-44"></div>
        {/if}
    </main>

    {#if cartLines.length > 0}
        <!-- Fixed over the page rather than in it, so that what is being
             ordered stays reachable however far down the menu a thumb is. -->
        <div
            class="fixed inset-x-0 bottom-0 z-40 border-t border-primary/10 bg-paper/95 backdrop-blur"
        >
            <div class="mx-auto flex w-full max-w-sm flex-col gap-3 px-6 py-4">
                <div class="flex items-baseline justify-between gap-4">
                    <span class="text-xs text-muted">
                        {cartCount}
                        {cartCount === 1 ? "item" : "items"} from {outlet?.name ??
                            "this outlet"}
                    </span>

                    <span class="text-sm font-medium tabular-nums"
                        >{rupees(cartTotal)}</span
                    >
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
                    onclick={placeOrder}
                    disabled={placing}
                    class="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-paper transition duration-200 hover:brightness-95 active:scale-[0.99] disabled:opacity-40"
                >
                    {placing ? "Placing…" : "Place order"}
                </button>

                {#if placeError}
                    <p class="text-sm text-red-500">{placeError}</p>
                {/if}
            </div>
        </div>
    {/if}
</div>
