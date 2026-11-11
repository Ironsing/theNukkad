import { supabase } from './supabase';
import { currentUserId } from './auth';
import { writeItemPhoto } from './photos';
import {
    type Diet,
    type MenuItem,
    type MenuItemRow,
    isDiet,
    menuItemColumns,
    toMenuItem,
} from './menu_reader';

// What a restaurant may write, as a whole draft: an item the outlet is adding,
// where every field is its own to choose.
export type NewMenuItem = {
    name: string;
    price: number;
    category: string;
    // Not optional, and there is no default to fall back on: the outlet says
    // what it is selling, because a forgotten one that landed on veg would be a
    // claim about someone's dinner.
    diet: Diet;
    // Named rather than defaulted, for the same reason: an outlet saying nothing
    // about ghee or onion is saying neither is left out. Calories are the one
    // thing here that may be unsaid, because nobody may have weighed it.
    vegan: boolean;
    jain: boolean;
    calories: number | null;
};

// An edit names only the fields it changes, so that fixing a price does not
// restate the category - and so that two edits to different fields of one item
// cannot clobber each other the way two whole drafts would.
export type MenuItemEdit = Partial<{
    name: string;
    price: number;
    category: string;
    diet: Diet;
    vegan: boolean;
    jain: boolean;
    // null clears it, undefined leaves it alone: "nobody has weighed this" is a
    // value an edit can mean, and "don't touch it" is not the same thing.
    calories: number | null;
    available: boolean;
}>;

// The columns an outlet may write. The id and the owner are not among them: a
// row's identity is not a field of a form.
type WritableColumns = Pick<
    MenuItemRow,
    'name' | 'price' | 'category' | 'diet' | 'vegan' | 'jain' | 'calories' | 'available'
>;

// The columns' own limits, said in the user's words, so that a form which checks
// them spares the user a constraint name.
const longestName = 80;
const longestCategory = 40;

function toName(name: string): string {
    const trimmed = name.trim();

    if (trimmed.length < 1 || trimmed.length > longestName) {
        throw new Error(`A name has to be 1 to ${longestName} characters.`);
    }

    return trimmed;
}

function toCategory(category: string): string {
    const trimmed = category.trim();

    if (trimmed.length < 1 || trimmed.length > longestCategory) {
        throw new Error(
            `A category has to be 1 to ${longestCategory} characters.`,
        );
    }

    return trimmed;
}

// The price as the column holds it: rupees and paise, with no third decimal for
// the database to round away behind the user's back.
function toPrice(price: number): number {
    if (!Number.isFinite(price) || price <= 0) {
        throw new Error('A price has to be more than zero.');
    }

    return Math.round(price * 100) / 100;
}

// Checked here rather than left to the check constraint: a diet is picked from
// a list, so one that is none of the three is a mistake worth saying in the
// user's words.
function toDiet(diet: Diet): Diet {
    if (!isDiet(diet)) {
        throw new Error('A diet has to be veg, nonveg or egg.');
    }

    return diet;
}

// A flag is a claim about a vegetarian item and nothing else, so the pair is
// refused on anything else in a sentence, rather than as the table's constraint
// name. Checked here because a form can leave the two set while the diet moves
// away from veg - which is exactly the state the column refuses.
function toFlags(diet: Diet, vegan: boolean, jain: boolean): void {
    if (diet !== 'veg' && (vegan || jain)) {
        throw new Error('Only a veg item can be vegan or Jain.');
    }
}

// Calories as the column holds them: a whole number, or nothing at all. Rounded
// rather than refused, because a portion is an estimate however carefully it
// was typed - but not invented: a blank stays null.
function toCalories(calories: number | null): number | null {
    if (calories === null) {
        return null;
    }

    if (!Number.isFinite(calories) || calories <= 0) {
        throw new Error('Calories have to be more than zero, or left blank.');
    }

    const whole = Math.round(calories);

    // The column's own ceiling, said before the constraint says it badly.
    if (whole > 5000) {
        throw new Error('That is more calories than a meal can have.');
    }

    return whole;
}

// A restaurant's own menu: read it, add to it, change it, strike an item off
// it, and nothing else. Every method here means "my items", because the rows it
// works with are the account's own - the owner column defaults to the signed-in
// account, and the policies check it either way.
export class MenuEditor {
    // The caller's menu, by category and then by name, which is the order the
    // students will see it in. Nothing here names the owner: the select policy
    // shows a restaurant its own items and no others.
    async list(): Promise<MenuItem[]> {
        const { data, error } = await supabase
            .from('menu_items')
            .select(menuItemColumns)
            .order('category')
            .order('name')
            .returns<MenuItemRow[]>();

        if (error) {
            throw error;
        }

        return data.map(toMenuItem);
    }

    // Adding an item. The insert deliberately does not name an owner: the
    // column's default is the signed-in account and the policy checks it either
    // way, so an item cannot be put on another outlet's menu by asking.
    //
    // Returns the stored row rather than the draft: the caller renders what the
    // database holds.
    async add(draft: NewMenuItem): Promise<MenuItem> {
        const diet = toDiet(draft.diet);

        toFlags(diet, draft.vegan, draft.jain);

        const { data, error } = await supabase
            .from('menu_items')
            .insert({
                name: toName(draft.name),
                price: toPrice(draft.price),
                category: toCategory(draft.category),
                diet,
                vegan: draft.vegan,
                jain: draft.jain,
                calories: toCalories(draft.calories),
            })
            .select(menuItemColumns)
            .single()
            .returns<MenuItemRow>();

        if (error) {
            throw error;
        }

        return toMenuItem(data);
    }

    // An edit carries only the fields it names; the rest of the row is left as
    // it was.
    async update(id: string, edit: MenuItemEdit): Promise<MenuItem> {
        const changes: Partial<WritableColumns> = {};

        if (edit.name !== undefined) {
            changes.name = toName(edit.name);
        }

        if (edit.price !== undefined) {
            changes.price = toPrice(edit.price);
        }

        if (edit.category !== undefined) {
            changes.category = toCategory(edit.category);
        }

        if (edit.diet !== undefined) {
            changes.diet = toDiet(edit.diet);
        }

        if (edit.vegan !== undefined) {
            changes.vegan = edit.vegan;
        }

        if (edit.jain !== undefined) {
            changes.jain = edit.jain;
        }

        if (edit.calories !== undefined) {
            changes.calories = toCalories(edit.calories);
        }

        // An item that stops being veg cannot keep a claim about what a veg item
        // leaves out, and clearing is the only consistent answer: an edit that
        // names the diet need not name the flags, and the row must not be left
        // in a state the table refuses.
        if (changes.diet !== undefined && changes.diet !== 'veg') {
            changes.vegan ??= false;
            changes.jain ??= false;
        }

        // Only checkable when this edit is the one naming the diet; a diet the
        // row already has is the row's business, and the column's check covers
        // it. Passing veg says nothing either way.
        toFlags(
            changes.diet ?? 'veg',
            changes.vegan ?? false,
            changes.jain ?? false,
        );

        if (edit.available !== undefined) {
            changes.available = edit.available;
        }

        // An edit of nothing is a caller's mistake, not a row's state, and
        // PostgREST is happier being told so here than being sent an empty one.
        if (Object.keys(changes).length === 0) {
            throw new Error('Nothing to change.');
        }

        return this.write(id, changes);
    }

    // Sold out, or back on today. Today's dosa is off, tomorrow's is on: the
    // item stays on the menu.
    async setAvailable(id: string, available: boolean): Promise<MenuItem> {
        return this.update(id, { available });
    }

    async savePhoto(id: string, photo: Blob): Promise<string> {
        return await writeItemPhoto(await currentUserId(), id, photo);
    }

    // An item that is not coming back - the supplier stopped, or the outlet
    // doesn't sell it any more. Each of those is a row an outlet would otherwise
    // have to flag false forever, which is what leaves a menu nobody can read.
    //
    // A delete hands no row back, so this asks for the id the way `write` asks
    // for the row: a delete that matched nothing - a stale id, or an item on
    // another outlet's menu, which the policies will not match - throws rather
    // than reporting a removal that never happened.
    async remove(id: string): Promise<void> {
        const { data, error } = await supabase
            .from('menu_items')
            .delete()
            .eq('id', id)
            .select('id')
            .returns<{ id: string }[]>();

        if (error) {
            throw error;
        }

        if (data.length === 0) {
            throw new Error('That item is not on your menu.');
        }
    }

    // One update, one stored row back. A write that matched nothing - a stale
    // id, or an item on another outlet's menu, which the policies will not match
    // - throws rather than reporting a save that never happened.
    private async write(
        id: string,
        changes: Partial<WritableColumns>,
    ): Promise<MenuItem> {
        const { data, error } = await supabase
            .from('menu_items')
            .update(changes)
            .eq('id', id)
            .select(menuItemColumns)
            .maybeSingle()
            .returns<MenuItemRow>();

        if (error) {
            throw error;
        }

        if (data === null) {
            throw new Error('That item is not on your menu.');
        }

        return toMenuItem(data);
    }
}

export const menuEditor = new MenuEditor();
