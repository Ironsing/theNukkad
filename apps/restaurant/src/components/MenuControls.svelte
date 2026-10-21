<script lang="ts">
    import {
        dietLabels,
        diets,
        foldMenuItems,
        menuEditor,
        menuSections,
        rupees,
        type Diet,
        type MenuItem,
    } from "@thenukkad/core";

    // An item hangs off the outlet's row, so there is nothing to add to until
    // that row is saved. The page knows whether it is.
    let { outletExists }: { outletExists: boolean } = $props();

    let items = $state<MenuItem[]>([]);
    let loading = $state(true);
    let error = $state("");
    let notice = $state("");

    // The item being changed, or null while adding one.
    let editing = $state<string | null>(null);

    // A whole draft, as the form holds it: every field of a new item, which is
    // also everything an edit restates.
    type Draft = {
        name: string;
        price: string;
        category: string;
        diet: Diet;
    };

    // A diet is picked from the three rather than left blank, so an empty form
    // starts on one - veg, which is what most of this campus's menu is.
    function emptyForm(): Draft {
        return { name: "", price: "", category: "", diet: "veg" };
    }

    let form = $state(emptyForm());

    const sections = $derived(menuSections(items));

    // The categories already in use, offered as suggestions: two items fall in
    // the same section exactly when they are spelled the same way, and a typo
    // is a section of its own.
    const categories = $derived([...new Set(items.map((i) => i.category))]);

    // The marker the three are recognised by: a dot in a square, green for veg,
    // brown-red for non-veg and yellow for egg. The student app wears the same
    // three, and they are deliberately not the accent - a menu's veg marker is
    // not this app's colour.
    const dietMarks: Record<Diet, string> = {
        veg: "border-green-600 text-green-600",
        nonveg: "border-red-600 text-red-600",
        egg: "border-amber-500 text-amber-500",
    };

    const message = (e: unknown) =>
        e instanceof Error ? e.message : String(e);

    $effect(() => {
        if (!outletExists) {
            loading = false;
            return;
        }

        let live = true;

        menuEditor
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

        return () => {
            live = false;
        };
    });

    function clearForm() {
        editing = null;
        form = emptyForm();
    }

    function startEdit(item: MenuItem) {
        error = "";
        notice = "";
        editing = item.id;
        form = {
            name: item.name,
            price: item.price.toFixed(2),
            category: item.category,
            diet: item.diet,
        };
    }

    async function handleSubmit(event: SubmitEvent) {
        event.preventDefault();
        error = "";
        notice = "";

        try {
            const draft = {
                name: form.name,
                // The field is text, so '' and '4o' arrive as the same thing:
                // the editor's own check says which is which.
                price: Number(form.price),
                category: form.category,
                diet: form.diet,
            };

            const saved =
                editing === null
                    ? await menuEditor.add(draft)
                    : await menuEditor.update(editing, draft);

            items = foldMenuItems(items, { kind: "saved", item: saved });
            notice = editing === null ? "Added." : "Saved.";
            clearForm();
        } catch (e) {
            error = message(e);
        }
    }

    async function toggleAvailable(item: MenuItem) {
        error = "";
        notice = "";

        try {
            const saved = await menuEditor.setAvailable(
                item.id,
                !item.available,
            );

            items = foldMenuItems(items, { kind: "saved", item: saved });
        } catch (e) {
            error = message(e);
        }
    }

    // An item that is not coming back, which is the one thing in this form a
    // mistap cannot undo: sold out is the reversible answer, so this asks.
    async function removeItem(item: MenuItem) {
        error = "";
        notice = "";

        if (!window.confirm(`Remove ${item.name} from the menu?`)) {
            return;
        }

        try {
            await menuEditor.remove(item.id);
            items = foldMenuItems(items, { kind: "removed", id: item.id });

            // The item in the form may be the one that just went.
            if (editing === item.id) {
                clearForm();
            }

            notice = "Removed.";
        } catch (e) {
            error = message(e);
        }
    }

    const label = "flex flex-col gap-1.5 text-sm font-medium text-primary/80";
    const field =
        "rounded-lg border border-primary/15 bg-paper/60 px-4 py-3 text-sm text-primary outline-none transition duration-200 placeholder:text-primary/35 hover:border-primary/25 focus:border-accent";
    const quiet =
        "rounded-lg border border-primary/15 px-3 py-1.5 text-xs text-muted transition duration-200 hover:border-primary/25 hover:text-primary active:scale-[0.99] disabled:opacity-40";
    // The one button here that takes something away for good.
    const danger =
        "rounded-lg border border-red-500/25 px-3 py-1.5 text-xs text-red-500 transition duration-200 hover:border-red-500/40 active:scale-[0.99] disabled:opacity-40";

    // One of the three in the form: the picked one wears the app's accent, the
    // others stay quiet, so the row reads as one control.
    function pickClass(diet: Diet): string {
        const chosen = "border-accent bg-accent/10";
        const resting = "border-primary/15 text-muted";

        return `flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm transition duration-200 ${
            form.diet === diet ? chosen : resting
        }`;
    }
</script>

{#if !outletExists}
    <p class="text-sm text-muted">
        You can't create a menu till you save outlet details.
    </p>
{:else if loading}
    <p class="text-sm text-muted">Loading…</p>
{:else}
    <form class="flex flex-col gap-4" onsubmit={handleSubmit}>
        <label class={label}>
            Item
            <input
                class={field}
                type="text"
                required
                maxlength="80"
                placeholder="Masala dosa"
                bind:value={form.name}
            />
        </label>

        <div class="grid grid-cols-2 gap-4">
            <label class={label}>
                Price (₹)
                <input
                    class={field}
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    inputmode="decimal"
                    placeholder="49.50"
                    bind:value={form.price}
                />
            </label>

            <label class={label}>
                Category
                <input
                    class={field}
                    type="text"
                    required
                    maxlength="40"
                    list="menu-categories"
                    placeholder="Mains"
                    bind:value={form.category}
                />
            </label>
        </div>

        <!-- Picked from the three rather than typed: unlike the category, there
             is nothing here for the outlet to spell, and a fourth answer would
             be a check constraint. The marker travels with the word, since the
             marker is what a student reads. -->
        <fieldset class="flex flex-col gap-1.5 text-sm font-medium text-primary/80">
            <legend>Diet</legend>

            <div class="grid grid-cols-3 gap-2">
                {#each diets as diet (diet)}
                    <label class={pickClass(diet)}>
                        <input
                            class="sr-only"
                            type="radio"
                            name="diet"
                            value={diet}
                            bind:group={form.diet}
                        />

                        <span
                            class="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border {dietMarks[
                                diet
                            ]}"
                            aria-hidden="true"
                        >
                            <span class="h-1.5 w-1.5 rounded-full bg-current"
                            ></span>
                        </span>

                        {dietLabels[diet]}
                    </label>
                {/each}
            </div>
        </fieldset>

        <!-- The categories already on the menu, so the next item lands in one
             of them instead of in a section of its own. -->
        <datalist id="menu-categories">
            {#each categories as category (category)}
                <option value={category}></option>
            {/each}
        </datalist>

        <div class="flex gap-2">
            <button
                type="submit"
                class="flex-1 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-paper transition duration-200 hover:brightness-95 active:scale-[0.99]"
            >
                {editing === null ? "Add item" : "Save changes"}
            </button>

            {#if editing !== null}
                <button type="button" class={quiet} onclick={clearForm}>
                    Cancel
                </button>
            {/if}
        </div>
    </form>

    {#if sections.length === 0}
        <p class="text-sm text-muted">
            Nothing on the menu yet. Students see items here as you add them.
        </p>
    {:else}
        {#each sections as section (section.category)}
            <section class="flex flex-col gap-2">
                <h2
                    class="text-xs font-medium tracking-wide text-muted uppercase"
                >
                    {section.category}
                </h2>

                <ul class="flex flex-col gap-2">
                    {#each section.items as item (item.id)}
                        <li
                            class="flex items-center justify-between gap-3 rounded-xl border border-primary/[0.07] bg-white/60 px-4 py-3"
                        >
                            <span class="flex flex-col">
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
                                    >
                                        {item.name}
                                    </span>
                                </span>

                                <span class="text-xs text-muted">
                                    {rupees(item.price)}
                                    {#if !item.available}· sold out{/if}
                                </span>
                            </span>

                            <span class="flex gap-2">
                                <button
                                    type="button"
                                    class={quiet}
                                    onclick={() => startEdit(item)}
                                >
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    class={quiet}
                                    onclick={() => toggleAvailable(item)}
                                >
                                    {item.available ? "Sold out" : "Back on"}
                                </button>

                                <!-- The other two are undoable; this one is
                                     what an item that is not coming back
                                     gets. -->
                                <button
                                    type="button"
                                    class={danger}
                                    onclick={() => removeItem(item)}
                                >
                                    Remove
                                </button>
                            </span>
                        </li>
                    {/each}
                </ul>
            </section>
        {/each}
    {/if}
{/if}

{#if error}
    <p class="text-sm text-red-500">{error}</p>
{/if}

{#if notice}
    <p class="text-sm text-accent">{notice}</p>
{/if}

