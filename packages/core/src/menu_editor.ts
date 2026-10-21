import { supabase } from './supabase';
import {
    type MenuItem,
    type MenuItemRow,
    menuItemColumns,
    toMenuItem,
} from './menu_reader';

// What a restaurant may write, as a whole draft: an item the outlet is adding,
// where every field is its own to choose.
export type NewMenuItem = {
    name: string;
    price: number;
    category: string;
};

// An edit names only the fields it changes, so that fixing a price does not
// restate the category - and so that two edits to different fields of one item
// cannot clobber each other the way two whole drafts would.
export type MenuItemEdit = Partial<{
    name: string;
    price: number;
    category: string;
    available: boolean;
}>;

// The columns an outlet may write. The id and the owner are not among them: a
// row's identity is not a field of a form.
type WritableColumns = Pick<
    MenuItemRow,
    'name' | 'price' | 'category' | 'available'
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
        const { data, error } = await supabase
            .from('menu_items')
            .insert({
                name: toName(draft.name),
                price: toPrice(draft.price),
                category: toCategory(draft.category),
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
