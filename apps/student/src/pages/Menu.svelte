<script lang="ts">
    import { link } from "svelte-spa-router";
    import {
        MenuReader,
        dietLabels,
        foldMenuItems,
        menuSections,
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

    $effect(() => {
        // Read here so that moving from one menu to another refetches.
        const id = params.id;
        const reader = new MenuReader(id);
        // Set when this effect is torn down, so a reply that lands after the
        // page has moved on cannot write over the next one's.
        let live = true;

        outlet = null;
        items = [];
        error = "";
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
                                class="flex items-baseline justify-between gap-4 rounded-xl border border-primary/[0.07] bg-white/60 px-4 py-3"
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
                            </li>
                        {/each}
                    </ul>
                </section>
            {/each}
        {/if}

        {#if error}
            <p class="text-sm text-red-500">{error}</p>
        {/if}
    </main>
</div>
