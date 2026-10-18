<script lang="ts">
    import { myOutlet, signOut, type RestaurantStatus } from "@thenukkad/core";

    let form = $state({
        name: "",
        opensAt: "",
        closesAt: "",
        status: "normal" as RestaurantStatus,
    });

    let loading = $state(true);
    let exists = $state(false); // has this outlet ever been saved?
    let error = $state("");
    let saved = $state("");

    const message = (e: unknown) =>
        e instanceof Error ? e.message : String(e);

    $effect(() => {
        myOutlet
            .get()
            .then((outlet) => {
                if (!outlet) return;

                exists = true;
                form.name = outlet.name;
                form.opensAt = outlet.opensAt ?? "";
                form.closesAt = outlet.closesAt ?? "";
                form.status = outlet.status;
            })
            .catch((e) => (error = message(e)))
            .finally(() => (loading = false));
    });

    async function handleSubmit(event: SubmitEvent) {
        event.preventDefault();
        error = "";
        saved = "";

        // The database keeps the two times together and knows nothing else about
        // them; saying so here spares the user a constraint name.
        if ((form.opensAt === "") !== (form.closesAt === "")) {
            error = "Set both times, or neither.";
            return;
        }

        try {
            const outlet = await myOutlet.save({
                name: form.name,
                opensAt: form.opensAt === "" ? null : form.opensAt,
                closesAt: form.closesAt === "" ? null : form.closesAt,
                status: form.status,
            });

            exists = true;
            // What the database actually holds - a trimmed name, say - rather
            // than what was typed.
            form.name = outlet.name;
            saved = "Saved.";
        } catch (e) {
            error = message(e);
        }
    }

    const label = "flex flex-col gap-1.5 text-sm font-medium text-primary/80";
    const field =
        "rounded-lg border border-primary/15 bg-paper/60 px-4 py-3 text-sm text-primary outline-none transition duration-200 hover:border-primary/25 focus:border-acc-green";
</script>

<div class="font-google min-h-dvh bg-paper px-6 py-12 text-primary">
    <main class="mx-auto flex w-full max-w-sm flex-col gap-8">
        <header class="flex items-baseline justify-between">
            <h1 class="text-2xl font-semibold tracking-[-0.03em]">
                Your outlet
            </h1>

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
        {:else}
            <p class="text-sm text-muted">
                {exists
                    ? "Students can see this outlet."
                    : "Not set up yet. Saving puts you on the student list."}
            </p>

            <form class="flex flex-col gap-5" onsubmit={handleSubmit}>
                <label class={label}>
                    Name
                    <input
                        class={field}
                        type="text"
                        required
                        maxlength="80"
                        placeholder="A Chaat"
                        bind:value={form.name}
                    />
                </label>

                <div class="grid grid-cols-2 gap-4">
                    <label class={label}>
                        Opens at
                        <input
                            class={field}
                            type="time"
                            bind:value={form.opensAt}
                        />
                    </label>

                    <label class={label}>
                        Closes at
                        <input
                            class={field}
                            type="time"
                            bind:value={form.closesAt}
                        />
                    </label>
                </div>

                <label class={label}>
                    Status
                    <select class={field} bind:value={form.status}>
                        <option value="normal">Normal hours</option>
                        <option value="closedManually">Closed manually</option>
                    </select>
                </label>

                <button
                    type="submit"
                    class="rounded-lg bg-acc-green px-4 py-3 text-sm font-medium text-paper transition duration-200 hover:brightness-95 active:scale-[0.99]"
                >
                    Save
                </button>
            </form>
        {/if}

        {#if error}
            <p class="text-sm text-red-500">{error}</p>
        {/if}

        {#if saved}
            <p class="text-sm text-acc-green">{saved}</p>
        {/if}
    </main>
</div>
