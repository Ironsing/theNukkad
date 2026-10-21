import { supabase } from './supabase';

// The kinds of food a menu is read for, in this country's own three: veg,
// nonveg, and egg, which is neither. Not free text the way a category is -
// these are fixed by how the food is made - so the outlet picks one rather than
// typing one, and there is no fourth to add.
export const diets = ['veg', 'nonveg', 'egg'] as const;

export type Diet = (typeof diets)[number];

// The three as a page says them. Whether that is a word or the marker that
// usually carries it is the page's business; this is the spelling.
export const dietLabels: Record<Diet, string> = {
    veg: 'Veg',
    nonveg: 'Non-veg',
    egg: 'Egg',
};

// Whether a value is one of them. The check constraint is what makes it so in
// the database; this is the same question asked of a payload.
export function isDiet(value: unknown): value is Diet {
    return diets.some((diet) => diet === value);
}

// A row of menu_items as a page consumes it. The price is a number of rupees -
// 49.5 is forty-nine rupees fifty paise - because the app adds it up and shows
// it, and neither is something a string is good at.
export type MenuItem = {
    id: string;
    restaurantId: string;
    name: string;
    price: number;
    category: string;
    // Not optional, and not defaulted anywhere: the column refuses a null, and
    // a row without a diet is one a page cannot show honestly.
    diet: Diet;
    available: boolean;
};

// A change to one item, in the terms a page folds it into what it is showing.
// A delete names a row without describing it: Realtime hands a client the
// primary key and nothing more, whatever the table's replica identity, so
// 'removed' carries an id. Which is all a page needs - the id is what comes out
// of its list.
export type MenuItemChange =
    | { kind: 'saved'; item: MenuItem }
    | { kind: 'removed'; id: string };

// The same row in Postgres' own spelling. Shared with menu_editor.ts, which
// writes rows of the same shape.
export type MenuItemRow = {
    id: string;
    restaurant_id: string;
    name: string;
    // What a numeric looks like on the wire is not worth tying a type to: this
    // stack's replies carry `"price": 49.50` as a JSON number, and a reply that
    // spelled it '49.50' would read the same here. Both become the number of
    // rupees, once.
    price: string | number;
    category: string;
    // One of the three, because the check constraint makes it so in the
    // database. Payloads are still asked (see toChange): a reply that arrived
    // from somewhere else is checked, not trusted.
    diet: Diet;
    available: boolean;
};

export const menuItemColumns =
    'id, restaurant_id, name, price, category, diet, available';

export function toMenuItem(row: MenuItemRow): MenuItem {
    return {
        id: row.id,
        restaurantId: row.restaurant_id,
        name: row.name,
        price: Number(row.price),
        category: row.category,
        diet: row.diet,
        available: row.available,
    };
}

// Money as the app says it: '49.5' is ₹49.50. The paise are always shown so
// that a column of prices lines up, and so that 50 never reads as a different
// kind of number from 49.50. Intl knows the rupee's own conventions - a
// lakh-grouped ₹1,23,456.78 - better than a template string would.
export function rupees(price: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
    }).format(price);
}

// The order a menu is shown in: the categories by their names, and the items
// within each by their own. The table has no position column, so this is the
// one order both sides can agree on without one, and it is the order `list`
// asks Postgres for. localeCompare is the closest thing the browser has to the
// collation Postgres ordered by.
function inOrder(a: MenuItem, b: MenuItem): number {
    return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
}

// The API's payload in our terms, read once, here. Every field is optional
// because an insert carries no old record and a delete no new one, and because
// this is wire data: it is checked, not trusted.
type ChangePayload = {
    eventType: string;
    new: Partial<MenuItemRow>;
    old: Partial<MenuItemRow>;
};

function toChange(payload: ChangePayload): MenuItemChange | null {
    if (payload.eventType === 'DELETE') {
        // A delete names its row without describing it.
        const { id } = payload.old;

        return id === undefined ? null : { kind: 'removed', id };
    }

    const { id, restaurant_id, name, price, category, diet, available } =
        payload.new;

    // A row missing the columns we show is not a row we can show.
    if (
        id === undefined ||
        restaurant_id === undefined ||
        name === undefined ||
        price === undefined ||
        category === undefined ||
        !isDiet(diet) ||
        available === undefined
    ) {
        return null;
    }

    return {
        kind: 'saved',
        item: toMenuItem({
            id,
            restaurant_id,
            name,
            price,
            category,
            diet,
            available,
        }),
    };
}

// Folds one change into a list, keeping the order above, so that a change and a
// refetch leave the same list behind.
export function foldMenuItems(
    items: MenuItem[],
    change: MenuItemChange,
): MenuItem[] {
    const id = change.kind === 'saved' ? change.item.id : change.id;
    const kept = items.filter((item) => item.id !== id);

    return change.kind === 'saved'
        ? [...kept, change.item].sort(inOrder)
        : kept;
}

export type MenuSection = {
    category: string;
    // Everything the outlet filed under that name, in the order above.
    items: MenuItem[];
};

// A menu as the page shows it: one block per category, the categories in name
// order. Which categories exist is the outlet's own text and nothing enumerates
// them, so there is nothing to look up here - two items fall in the same
// section exactly when the outlet spelled the category the same way.
//
// The list is sorted here rather than trusted to arrive sorted, so that a page
// whose list has only ever seen live changes reads the same as one that was
// fetched.
export function menuSections(items: MenuItem[]): MenuSection[] {
    const sections: MenuSection[] = [];

    for (const item of [...items].sort(inOrder)) {
        const last = sections.at(-1);

        if (last !== undefined && last.category === item.category) {
            last.items.push(item);
        } else {
            sections.push({ category: item.category, items: [item] });
        }
    }

    return sections;
}

// What a student can do with one outlet's menu: read it, and watch it. RLS says
// the same thing - a student account has no insert or update policy - but the
// split is the point: the student app is never handed a way to change a menu.
export class MenuReader {
    // Which outlet's menu this is. It belongs to the object rather than to each
    // call because a page shows one outlet's menu, and because the subscription
    // below has to name the outlet in its filter.
    private readonly restaurantId: string;

    constructor(restaurantId: string) {
        this.restaurantId = restaurantId;
    }

    // That outlet's menu, by category and then by name: the order the page shows
    // it in, and the order folding keeps.
    async list(): Promise<MenuItem[]> {
        const { data, error } = await supabase
            .from('menu_items')
            .select(menuItemColumns)
            .eq('restaurant_id', this.restaurantId)
            .order('category')
            .order('name')
            .returns<MenuItemRow[]>();

        if (error) {
            throw error;
        }

        return data.map(toMenuItem);
    }

    // Live changes to this outlet's menu, and only this outlet's: the filter is
    // applied by the server, so an item put on another outlet's menu never
    // arrives, and neither does a change to it. RLS decides who may be sent a
    // row, exactly as it decides for `list` - except for deletes, which the
    // policies cannot cover, because a row that is gone cannot be checked
    // against them. An outlet is told the id of an item on a menu it may not
    // read. Nothing but the id travels, and an id the list never held folds
    // away to nothing, so where a delete came from does not matter.
    //
    // A delete is filtered against the table's whole old record, which is why
    // that table carries `replica identity full`: with the default identity a
    // delete's record is a primary key with no restaurant_id in it, and this
    // filter drops it on the floor.
    //
    // A sold-out item arrives like any other change: whether the page greys it
    // or drops it is the page's decision, not the database's.
    //
    // Measured against the local stack: a subscription is sent the changes made
    // just before it joined as well as the ones after it, so a page can be told
    // about the same write twice. Folding a repeat is idempotent - a saved item
    // replaces the row with its own id - and that is what makes it harmless.
    //
    // Returns the unsubscribe, which a page calls when it goes away, or the
    // channel goes on listening for a page nobody is looking at. The topic names
    // the outlet because this client hands back a channel it already has when it
    // is asked for the same topic again: two readers of two menus sharing one
    // topic would share one filter, and only one of them would be right. Changes
    // made in the moment after subscribing can be missed while the server is
    // still setting the subscription up; the next change, or a refetch, puts it
    // right.
    subscribe(onChange: (change: MenuItemChange) => void): () => void {
        const channel = supabase
            .channel(`menu-changes:${this.restaurantId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'menu_items',
                    filter: `restaurant_id=eq.${this.restaurantId}`,
                },
                (payload) => {
                    const change = toChange(payload);

                    // A payload we cannot make sense of is dropped rather than
                    // thrown: it is a stream, and the next event is still good.
                    if (change !== null) {
                        onChange(change);
                    }
                },
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }
}
