import { supabase } from './supabase';

// One line of an order as a page consumes it: what was asked for, at the price
// the menu had when it was asked for. Copied out of the menu rather than joined
// to it when read, so a later rename or a price change cannot rewrite an order
// that has already been placed.
export type OrderLine = {
    id: string;
    // Null once the outlet has taken the item off its menu. The line stays
    // readable either way, because the name and the price were copied with it:
    // an order outlives the menu it was placed from.
    menuItemId: string | null;
    name: string;
    price: number;
    quantity: number;
};

// A whole order as a page consumes it. Who placed it is not in here: the
// policies decide which orders a page is given, so neither side has to ask.
export type Order = {
    id: string;
    restaurantId: string;
    // The outlet's name, read with the order rather than looked up afterwards: a
    // student's list spans outlets, and an id is not something a list can show.
    restaurantName: string;
    // What the student wanted said - no onions, less spicy. Free text, and empty
    // is the ordinary case rather than a missing value.
    notes: string;
    // When the outlet cooked it, and the code it minted then - both or neither,
    // because the table refuses one without the other. That is what makes `otp`
    // on its own the whole of "this is ready".
    readyAt: string | null;
    // Four digits, as text: it is spoken aloud and typed without a leading zero,
    // and nothing adds one up.
    otp: string | null;
    // Newest first is the order every read of this table is in - a student's
    // history and an outlet's incoming list alike - and the order the index is
    // in as well.
    createdAt: string;
    // At least one, always: an order without lines is not a state the database
    // will leave behind.
    lines: OrderLine[];
};

// The two rows in Postgres' own spelling, and the shape a read asks for. The two
// embeds are optional because they are the API's own joining rather than columns
// of the row - and the whole of this is wire data, checked rather than trusted.
export type OrderLineRow = {
    id: string;
    menu_item_id: string | null;
    name: string;
    // As in menu_reader.ts: what a numeric looks like on the wire is not worth
    // tying a type to, and both spellings become the number of rupees here.
    price: string | number;
    quantity: number;
};

export type OrderRow = {
    id: string;
    restaurant_id: string;
    notes: string;
    ready_at: string | null;
    otp: string | null;
    created_at: string;
    // An object rather than a list: the foreign key points this way, so there is
    // one outlet at most. The lines are a list because theirs points the other
    // way.
    restaurant_info?: { name: string } | null;
    order_items?: OrderLineRow[] | null;
};

// Shared with incoming_orders.ts, which reads rows of the same shape.
export const orderColumns =
    'id, restaurant_id, notes, ready_at, otp, created_at, ' +
    'restaurant_info(name), order_items(id, menu_item_id, name, price, quantity)';

export function toOrderLine(row: OrderLineRow): OrderLine {
    return {
        id: row.id,
        menuItemId: row.menu_item_id,
        name: row.name,
        price: Number(row.price),
        quantity: row.quantity,
    };
}

export function toOrder(row: OrderRow): Order {
    return {
        id: row.id,
        restaurantId: row.restaurant_id,
        // An order cannot outlive its outlet - the foreign key cascades - so a
        // read without the name is a shape we do not expect rather than a state
        // we plan for.
        restaurantName: row.restaurant_info?.name ?? '',
        notes: row.notes,
        readyAt: row.ready_at,
        otp: row.otp,
        createdAt: row.created_at,
        lines: (row.order_items ?? []).map(toOrderLine),
    };
}

// What a line costs: the price as it was copied, times how many of it.
export function lineTotal(line: OrderLine): number {
    return line.price * line.quantity;
}

// What the whole order costs, added up here rather than by Postgres: the lines a
// page holds are the ones the order was written with, and nothing changes them
// afterwards. A page shows it through rupees(), which rounds to paise - a sum of
// rupees and paise in floating point is exact enough to round, and nothing here
// is compared for equality.
export function orderTotal(order: Order): number {
    return order.lines.reduce((total, line) => total + lineTotal(line), 0);
}

// Whether a value could be a code at all: four digits, none of them a leading
// zero. The column's own check is the same one, said here so a counter can be
// told a typo is a typo without a round trip.
export function isCode(value: string): boolean {
    return /^[1-9][0-9]{3}$/.test(value);
}

// The columns' own limits, said in the user's words, so that a form which checks
// them spares the user a constraint name.
const longestNotes = 200;
const mostOfOneItem = 20;

// Notes are free text and empty is ordinary, so there is nothing to require and
// nothing to trim - the column doesn't trim either. The length is the column's
// own, counted in the same characters it counts. (A string's length counts emoji
// as two where the column counts one, so this refuses a note or two that the
// database would take: stricter, and never the other way round.)
function toNotes(notes: string): string {
    if (notes.length > longestNotes) {
        throw new Error(`Keep notes to ${longestNotes} characters.`);
    }

    return notes;
}

// How many of one item, as the column holds it: a whole one, between one and
// twenty. A page offers a stepper, so a fraction or a nought arrives only from a
// request written by hand - and the database's answer to a fraction is a cast
// error, which is no answer for a user to read.
function toQuantity(quantity: number): number {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > mostOfOneItem) {
        throw new Error(`One order can have 1 to ${mostOfOneItem} of an item.`);
    }

    return quantity;
}

// A line as the function reads it: it looks each one up by these two keys, and
// this is the only shape in the package written to the wire by hand.
type WireLine = { menu_item_id: string; quantity: number };

// One line per item, which is what the table's unique constraint asks for: two
// of the same thing is the quantity, not a second line. Merging two lines here
// would be this class deciding which of two quantities the student meant.
function toWireLines(lines: NewOrderLine[]): WireLine[] {
    if (lines.length === 0) {
        throw new Error('An order needs at least one item.');
    }

    const seen = new Set<string>();

    return lines.map((line) => {
        if (seen.has(line.menuItemId)) {
            throw new Error(
                'That item is on the order twice - change how many instead.',
            );
        }

        seen.add(line.menuItemId);

        return {
            menu_item_id: line.menuItemId,
            quantity: toQuantity(line.quantity),
        };
    });
}

// One line of a request: which item on the menu, and how many of it. No name and
// no price, because a request that gets to say what something costs is a request
// that can lie about it - the menu supplies both.
export type NewOrderLine = { menuItemId: string; quantity: number };

// What a student sends to place an order: the outlet, anything they want to say,
// and what they want.
export type NewOrder = {
    restaurantId: string;
    notes: string;
    lines: NewOrderLine[];
};

// One order's code, or null. Shared by both doors, because it is one column of
// one row and whose rows it may be read from is the policies' business rather
// than this function's: a student asking for an outlet's order gets exactly what
// an outlet asking for another outlet's does, which is nothing.
//
// Null is also the answer while an order is still in the kitchen, and there is no
// third answer to tell those apart: a page that needs to know the order is there
// reads the order.
export async function otpFor(orderId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('orders')
        .select('otp')
        .eq('id', orderId)
        .maybeSingle()
        .returns<{ otp: string | null }>();

    if (error) {
        throw error;
    }

    return data === null ? null : data.otp;
}

// What a student can do with orders: place one, read their own, ask for one's
// code, and watch for it changing. RLS says the same thing - a student has no
// insert or update on the table, and its policy shows it its own rows and no
// others - but the split is the point: the student app is never handed a way to
// write an order, and never a way to read anyone else's.
export class MyOrders {
    // Places an order in one transaction on the database's side, so an order
    // without its lines is not a state this can leave behind whichever part of
    // the request fails.
    //
    // Every refusal arrives as a sentence - that outlet has closed for now, one
    // of those items is sold out, only one order a minute - so nothing is
    // translated here and a page shows the message it is given. What is checked
    // below is what the database would otherwise answer with a constraint's name
    // or a cast error: an order with no lines, a quantity that is not a whole
    // number between one and twenty, the same item twice on one order, or notes
    // longer than the column takes.
    //
    // Returns the new order's id. The order itself is not read back: a page that
    // placed one goes to the list, which reads on mount.
    async place(draft: NewOrder): Promise<string> {
        const { data, error } = await supabase
            .rpc('create_order', {
                p_restaurant_id: draft.restaurantId,
                p_notes: toNotes(draft.notes),
                p_items: toWireLines(draft.lines),
            })
            .returns<string>();

        if (error) {
            throw error;
        }

        // The function returns one uuid or raises, so anything but a string here
        // is a shape we do not expect. It is checked rather than asserted because
        // it is the API's answer, not ours, and because there are no generated
        // types to say what a function hands back.
        if (typeof data !== 'string') {
            throw new Error('The order was placed, but no id came back.');
        }

        return data;
    }

    // This student's own orders, newest first: the order the index is in, and the
    // order a page shows them in. Nothing here names the student - the select
    // policy shows an account its own rows and no others.
    async list(): Promise<Order[]> {
        const { data, error } = await supabase
            .from('orders')
            .select(orderColumns)
            .order('created_at', { ascending: false })
            .returns<OrderRow[]>();

        if (error) {
            throw error;
        }

        return data.map(toOrder);
    }

    // One order's code, or null while the kitchen still has it. Null is also the
    // answer for an order that is not this student's and for one that does not
    // exist: a row the caller may not see is the same answer on purpose, the way
    // Outlets.get answers it.
    async getOtpFor(orderId: string): Promise<string | null> {
        return otpFor(orderId);
    }

    // Something happened to one of this student's orders - most of all, an outlet
    // marking one ready, which is the whole of being notified: the code is minted
    // in the same update that sets ready_at, so it arrives with it.
    //
    // It carries nothing, on purpose. An order's lines are a second table, and
    // that table is not in the Realtime publication: a change here describes an
    // order's head and never its lines, so folding one into a list would leave an
    // order with nothing on it. A page reads its list again on each change
    // instead - one small read, on a table a student writes at most once a
    // minute.
    //
    // No filter, either: unlike a menu, where a student may read every outlet's
    // and so has to name the one being looked at, the policy here already narrows
    // this channel to their own orders, and there is nothing left to add.
    //
    // Returns the unsubscribe, which a page calls when it goes away, or the
    // channel goes on listening for a page nobody is looking at. Changes made in
    // the moment after subscribing can be missed while the server is still
    // setting the subscription up; reading the table on mount as well as
    // subscribing is what covers it.
    subscribe(onChange: () => void): () => void {
        const channel = supabase
            .channel('my-order-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                () => onChange(),
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }
}

export const myOrders = new MyOrders();
