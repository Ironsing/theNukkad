<script lang="ts">
    import { link } from "svelte-spa-router";
    import {
        findTicketByCode,
        incomingPreorders,
        isCode,
        lineTotal,
        preorderTotal,
        rupees,
        signOut,
        type Preorder,
    } from "@thenukkad/core";

    let preorders = $state<Preorder[]>([]);
    let loading = $state(true);
    let error = $state("");

    // Codes minted on this screen, by request id. The board is read again after
    // cooking, and until that reply lands the row would otherwise go back to
    // reading as waiting.
    let codes = $state<Record<string, string>>({});

    // The code being checked at the counter, what it turned out to be, and the
    // request it belongs to.
    let typed = $state("");
    let checking = $state(false);
    let checked = $state("");
    let foundId = $state<string | null>(null);

    // The board, in the four states the column has. `list` hands them over
    // soonest deadline first, which is the order each of these keeps: what is
    // wanted next is what to answer next.
    const waiting = $derived(
        preorders.filter((preorder) => preorder.status === "unknown"),
    );
    const toCook = $derived(
        preorders.filter((preorder) => preorder.status === "accepted"),
    );
    const ready = $derived(
        preorders.filter((preorder) => preorder.status === "ready"),
    );
    const turnedDown = $derived(
        preorders.filter((preorder) => preorder.status === "rejected"),
    );

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
    // request can be: it is asked for up to a day ahead, so tomorrow morning
    // arrives on a board read today.
    function wantedBy(stamp: string) {
        const at = new Date(stamp);
        const time = clock(stamp);

        return at.toDateString() === new Date().toDateString()
            ? `Today, ${time}`
            : `${at.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
              })}, ${time}`;
    }

    function read() {
        return incomingPreorders.list().then((loaded) => (preorders = loaded));
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

        // A change carries nothing - a request's lines are a second table and
        // not in the stream - so the board is read again. This is how a request
        // arriving shows up without anyone pulling to refresh.
        const unsubscribe = incomingPreorders.subscribe(() => {
            void read().catch((e) => (error = message(e)));
        });

        return () => {
            live = false;
            unsubscribe();
        };
    });

    // Answering is one decision with two outcomes and nothing to send back. The
    // first answer is the one the student was told, so a second is refused -
    // which is why the buttons are replaced by the state once it is answered.
    async function answer(preorder: Preorder, what: "accept" | "reject") {
        error = "";

        try {
            if (what === "accept") {
                await incomingPreorders.accept(preorder.id);
            } else {
                await incomingPreorders.reject(preorder.id);
            }

            await read();
        } catch (e) {
            error = message(e);
        }
    }

    // Cooking mints the code, and hands it back: the alternative is reading what
    // is already in hand, with someone standing at the counter.
    async function cook(preorder: Preorder) {
        error = "";

        try {
            const code = await incomingPreorders.markReady(preorder.id);

            codes = { ...codes, [preorder.id]: code };
            await read();
        } catch (e) {
            error = message(e);
        }
    }

    // Check a code through findTicketByCode, which asks both pools: a code is
    // unique to this outlet for a day within its own table and not across the
    // two, so a counter that asked one table would find nothing while someone
    // stood there holding the other. Whichever it is, the page says so.
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
            const ticket = await findTicketByCode(code);

            if (ticket === null) {
                checked = `No ticket here has the code ${code}.`;
                return;
            }

            if (ticket.kind === "order") {
                checked = `Code ${code} is an order, not a preorder - it is on the Orders screen.`;
                return;
            }

            foundId = ticket.preorder.id;
            checked = `Code ${code} is the preorder below.`;

            // It may not be on the board yet: asked for since this screen last
            // read, or answered on another till.
            if (!preorders.some((p) => p.id === ticket.preorder.id)) {
                preorders = [ticket.preorder, ...preorders];
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
            <h1 class="text-2xl font-semibold tracking-[-0.03em]">Preorders</h1>

            <button
                type="button"
                onclick={signOut}
                class="text-sm text-muted hover:text-primary"
            >
                Log out
            </button>
        </header>

        <form class="flex flex-col gap-3" onsubmit={checkCode}>
            <label
                class="flex flex-col gap-1.5 text-sm font-medium text-primary/80"
            >
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

        {#snippet body(preorder: Preorder)}
            <div class="flex items-baseline justify-between gap-4">
                <span class="text-xs font-medium"
                    >Wanted by {wantedBy(preorder.deadline)}</span
                >

                <span class="text-xs text-muted"
                    >asked {clock(preorder.createdAt)}</span
                >
            </div>

            <ul class="flex flex-col gap-1">
                {#each preorder.lines as line (line.id)}
                    <li class="flex items-baseline justify-between gap-4 text-sm">
                        <span>
                            <span class="tabular-nums">{line.quantity}×</span>
                            {line.name}
                        </span>

                        <span class="text-xs text-muted tabular-nums"
                            >{rupees(lineTotal(line))}</span
                        >
                    </li>
                {/each}
            </ul>

            {#if preorder.notes}
                <!-- The one thing on a request the kitchen has to read rather
                     than count. -->
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

                {#if foundId === preorder.id}
                    <span class="text-xs font-medium text-accent">
                        The code checked
                    </span>
                {/if}
            </div>
        {/snippet}

        {#if loading}
            <p class="text-sm text-muted">Loading…</p>
        {:else if preorders.length === 0}
            <p class="text-sm text-muted">
                Nothing asked for yet. Requests show up here as students make
                them.
            </p>
        {:else}
            {#if waiting.length > 0}
                <section class="flex flex-col gap-3">
                    <h2
                        class="text-xs font-medium tracking-wide text-muted uppercase"
                    >
                        Waiting for an answer
                    </h2>

                    <ul class="flex flex-col gap-3">
                        {#each waiting as preorder (preorder.id)}
                            <li
                                class="flex flex-col gap-3 rounded-xl border px-4 py-3 transition duration-200 {preorder.id ===
                                foundId
                                    ? 'border-accent/60 bg-white/80 ring-2 ring-accent/30'
                                    : 'border-primary/[0.07] bg-white/60'}"
                            >
                                {@render body(preorder)}

                                <div class="flex gap-2">
                                    <button
                                        type="button"
                                        onclick={() =>
                                            answer(preorder, "accept")}
                                        class="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-paper transition duration-200 hover:brightness-95 active:scale-[0.99]"
                                    >
                                        Accept
                                    </button>

                                    <button
                                        type="button"
                                        onclick={() =>
                                            answer(preorder, "reject")}
                                        class="rounded-lg border border-primary/15 px-4 py-2 text-sm text-muted transition duration-200 hover:border-primary/25 hover:text-primary active:scale-[0.99]"
                                    >
                                        Turn down
                                    </button>
                                </div>
                            </li>
                        {/each}
                    </ul>
                </section>
            {/if}

            {#if toCook.length > 0}
                <section class="flex flex-col gap-3">
                    <h2
                        class="text-xs font-medium tracking-wide text-muted uppercase"
                    >
                        Accepted, to cook
                    </h2>

                    <ul class="flex flex-col gap-3">
                        {#each toCook as preorder (preorder.id)}
                            <li
                                class="flex flex-col gap-3 rounded-xl border px-4 py-3 transition duration-200 {preorder.id ===
                                foundId
                                    ? 'border-accent/60 bg-white/80 ring-2 ring-accent/30'
                                    : 'border-primary/[0.07] bg-white/60'}"
                            >
                                {@render body(preorder)}

                                <button
                                    type="button"
                                    onclick={() => cook(preorder)}
                                    class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-paper transition duration-200 hover:brightness-95 active:scale-[0.99]"
                                >
                                    Mark ready
                                </button>
                            </li>
                        {/each}
                    </ul>
                </section>
            {/if}

            {#if ready.length > 0}
                <section class="flex flex-col gap-3">
                    <h2
                        class="text-xs font-medium tracking-wide text-muted uppercase"
                    >
                        Ready to collect
                    </h2>

                    <ul class="flex flex-col gap-3">
                        {#each ready as preorder (preorder.id)}
                            <li
                                class="flex flex-col gap-3 rounded-xl border px-4 py-3 transition duration-200 {preorder.id ===
                                foundId
                                    ? 'border-accent/60 bg-white/80 ring-2 ring-accent/30'
                                    : 'border-accent/40 bg-accent/10'}"
                            >
                                {@render body(preorder)}

                                <!-- The code, which is the whole of what is
                                     said at the counter. -->
                                <p
                                    class="text-2xl font-semibold tracking-[0.15em] tabular-nums"
                                >
                                    {codes[preorder.id] ?? preorder.otp}
                                </p>
                            </li>
                        {/each}
                    </ul>
                </section>
            {/if}

            {#if turnedDown.length > 0}
                <section class="flex flex-col gap-3">
                    <h2
                        class="text-xs font-medium tracking-wide text-muted uppercase"
                    >
                        Turned down
                    </h2>

                    <ul class="flex flex-col gap-2">
                        {#each turnedDown as preorder (preorder.id)}
                            <li
                                class="flex items-baseline justify-between gap-4 rounded-xl border border-primary/[0.07] px-4 py-3 text-sm"
                            >
                                <span class="text-muted">
                                    Wanted by {wantedBy(preorder.deadline)}
                                </span>

                                <span class="text-xs text-muted tabular-nums"
                                    >{rupees(preorderTotal(preorder))}</span
                                >
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
