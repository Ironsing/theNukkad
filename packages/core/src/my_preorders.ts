import { supabase } from './supabase';
import {
    lineTotal,
    toOrderLine as toPreorderLine,
    type OrderLine,
    type OrderLineRow,
} from './my_orders';

// A refusal from the database, as something that can be thrown and read.
//
// The API's refusals are plain objects with a message on them - { code, details,
// hint, message } - and not Errors at all, which matters because every page in this
// codebase turns a thrown value into a sentence the way the order pages do:
// `e instanceof Error ? e.message : String(e)`. Handed straight on, one of those
// objects reaches a user as "[object Object]" instead of "that time has already
// passed", which is the opposite of what raising a sentence in the function was for.
// So what leaves here is always an Error carrying the database's own words.
//
// Typed as anything with a message rather than as the client's error class: what is
// being said is that the sentence is all this needs.
export function refused(error: { message: string }): Error {
    return new Error(error.message);
}

// The four states a request moves through, in the database's own words, because
// they are the column's: unknown, until an outlet answers; accepted, after which
// it can be cooked; rejected, which is the end of it; and ready, which holds the
// code. Written once here the way the three diets are, so a page branches on the
// same four words the table checks.
export const preorderStatuses = [
    'unknown',
    'accepted',
    'rejected',
    'ready',
] as const;

export type PreorderStatus = (typeof preorderStatuses)[number];

// The four as a page says them. Deliberately flat and neutral - "Accepted" says
// the same thing to the student who asked and the outlet that answered - so each
// app can wrap its own sentence around them rather than reading a label written
// for the other side.
export const preorderStatusLabels: Record<PreorderStatus, string> = {
    unknown: 'Waiting for an answer',
    accepted: 'Accepted',
    rejected: 'Turned down',
    ready: 'Ready',
};

// Whether a value is one of them. The check constraint is what makes it so in the
// database; this is the same question asked of a payload.
export function isPreorderStatus(value: unknown): value is PreorderStatus {
    return preorderStatuses.some((status) => status === value);
}

// A request's line is an order's line: the same five fields, and the two tables'
// columns are the same five. Reused rather than restated, so a line cannot come to
// mean two things - and aliased rather than named in every signature, so a preorder
// page still reads its own word for it.
export type PreorderLine = OrderLine;
export type PreorderLineRow = OrderLineRow;

// A whole request as a page consumes it. Who asked is not in here: the policies
// decide which requests a page is given, so neither side has to ask.
export type Preorder = {
    id: string;
    restaurantId: string;
    // The outlet's name, read with the request rather than looked up afterwards: a
    // student's list spans outlets, and an id is not something a list can show.
    restaurantName: string;
    // What the student wanted said. Free text, and empty is the ordinary case
    // rather than a missing value.
    notes: string;
    // When they want it - always set, which is why this is not `string | null` the
    // way `readyAt` below is: a request without a time is an order, and the column
    // refuses a null. Nothing reading this has to ask whether it is there.
    deadline: string;
    // Where it has got to. The four states are the whole of what a page branches
    // on, and the two moments beside it say when.
    status: PreorderStatus;
    // When the outlet cooked it, and the code it minted then - both or neither,
    // because the table refuses one without the other.
    readyAt: string | null;
    // Four digits, as text: it is spoken aloud and typed without a leading zero,
    // and nothing adds one up.
    otp: string | null;
    // Newest first is the order a student's list is in; soonest deadline first is
    // the order an outlet's board is in. The row carries both, and each side sorts
    // by its own.
    createdAt: string;
    // At least one, always: a request without lines is not a state the database
    // will leave behind.
    lines: PreorderLine[];
};

// The same row in Postgres' own spelling, and the shape a read asks for. The two
// embeds are optional because they are the API's own joining rather than columns of
// the row - and the whole of this is wire data, checked rather than trusted.
export type PreorderRow = {
    id: string;
    restaurant_id: string;
    notes: string;
    deadline: string;
    // Checked by toPreorder rather than trusted, for the reason a diet is: a reply
    // that arrived from somewhere else is asked which of the four it is.
    status: PreorderStatus;
    ready_at: string | null;
    otp: string | null;
    created_at: string;
    // An object rather than a list: the foreign key points this way, so there is
    // one outlet at most. The lines are a list because theirs points the other way.
    restaurant_info?: { name: string } | null;
    preorder_items?: PreorderLineRow[] | null;
};

// Read by both preorder classes: a student's own requests and an outlet's incoming
// board alike. The embedded table's name is what the API joins by, which is why it
// reads preorder_items here and order_items in my_orders.
export const preorderColumns =
    'id, restaurant_id, notes, deadline, status, ready_at, otp, created_at, ' +
    'restaurant_info(name), preorder_items(id, menu_item_id, name, price, quantity)';

export function toPreorder(row: PreorderRow): Preorder {
    // One of the four or none of ours. The alternative - defaulting - would call an
    // unanswered request accepted, or one that was refused ready, which is the kind
    // of lie a page cannot tell from the truth afterwards.
    if (!isPreorderStatus(row.status)) {
        throw new Error('A preorder came back in a state this app does not know.');
    }

    return {
        id: row.id,
        restaurantId: row.restaurant_id,
        // A request cannot outlive its outlet - the foreign key cascades - so a read
        // without the name is a shape we do not expect rather than a state we plan
        // for.
        restaurantName: row.restaurant_info?.name ?? '',
        notes: row.notes,
        deadline: row.deadline,
        status: row.status,
        readyAt: row.ready_at,
        otp: row.otp,
        createdAt: row.created_at,
        lines: (row.preorder_items ?? []).map(toPreorderLine),
    };
}

// What the whole request costs, added up here rather than by Postgres: the lines a
// page holds are the ones the request was written with, and an accepted price is the
// price. Summed through the orders' own lineTotal - a line is a line, and the alias
// above is what lets one function serve both.
export function preorderTotal(preorder: Preorder): number {
    return preorder.lines.reduce((total, line) => total + lineTotal(line), 0);
}

// The columns' own limits, said in the user's words, so that a form which checks
// them spares the user a constraint name. The same three an order has, said again
// rather than reached across for: these are sentences about this draft, and the
// orders' copies are private to theirs.
const longestNotes = 200;
const mostOfOneItem = 20;

// A request is for later, and no more than a day later. Both bounds are the table's
// own checks said in the user's words, so a page left open overnight cannot offer a
// time that is refused a round trip afterwards. The database's clock stays the
// authority either way: this is the same question asked first, and a request it lets
// through is still refused there.
const aDayInMilliseconds = 24 * 60 * 60 * 1000;

// Notes are free text and empty is ordinary, so there is nothing to require and
// nothing to trim - the column doesn't trim either. The length is the column's own,
// counted in the same characters it counts. (A string's length counts emoji as two
// where the column counts one, so this refuses a note or two that the database would
// take: stricter, and never the other way round.)
function toNotes(notes: string): string {
    if (notes.length > longestNotes) {
        throw new Error(`Keep notes to ${longestNotes} characters.`);
    }

    return notes;
}

// How many of one item, as the column holds it: a whole one, between one and twenty.
// A page offers a stepper, so a fraction or a nought arrives only from a request
// written by hand - and the database's answer to a fraction is a cast error, which is
// no answer for a user to read.
function toQuantity(quantity: number): number {
    if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > mostOfOneItem
    ) {
        throw new Error(`One preorder can have 1 to ${mostOfOneItem} of an item.`);
    }

    return quantity;
}

// The deadline as the function reads it: an instant, in the one spelling Postgres is
// given. An unusable picker value has to be said rather than sent, since a Date that
// is not a time reaches the wire as "Invalid Date" and comes back as a cast error.
function toDeadline(deadline: Date): string {
    if (Number.isNaN(deadline.getTime())) {
        throw new Error('Pick a time for this preorder.');
    }

    if (deadline.getTime() <= Date.now()) {
        throw new Error('That time has already passed.');
    }

    if (deadline.getTime() > Date.now() + aDayInMilliseconds) {
        throw new Error('Preorders are taken up to a day ahead.');
    }

    return deadline.toISOString();
}

// A line as the function reads it: it looks each one up by these two keys, and this
// is the only shape written to the wire by hand besides an order's.
type WireLine = { menu_item_id: string; quantity: number };

// One line per item, which is what the table's unique constraint asks for: two of the
// same thing is the quantity, not a second line. Merging two lines here would be this
// class deciding which of two quantities the student meant.
function toWireLines(lines: NewPreorderLine[]): WireLine[] {
    if (lines.length === 0) {
        throw new Error('A preorder needs at least one item.');
    }

    const seen = new Set<string>();

    return lines.map((line) => {
        if (seen.has(line.menuItemId)) {
            throw new Error(
                'That item is on the preorder twice - change how many instead.',
            );
        }

        seen.add(line.menuItemId);

        return {
            menu_item_id: line.menuItemId,
            quantity: toQuantity(line.quantity),
        };
    });
}

// One line of a request: which item on the menu, and how many of it. No name and no
// price, because a request that gets to say what something costs is a request that
// can lie about it - the menu supplies both.
export type NewPreorderLine = { menuItemId: string; quantity: number };

// What a student sends to ask for something later: the outlet, anything they want to
// say, when they want it, and what they want.
export type NewPreorder = {
    restaurantId: string;
    notes: string;
    // A Date rather than a string. The picker gives wall-clock local time and the
    // column wants an instant, so the conversion happens in one place - here - rather
    // than in a page that might hand Postgres a local string it would read as UTC.
    deadline: Date;
    lines: NewPreorderLine[];
};

// One request's code, or null. Shared by both doors, because it is one column of one
// row and whose rows it may be read from is the policies' business rather than this
// function's: a student asking for an outlet's request gets exactly what an outlet
// asking for another outlet's does, which is nothing.
//
// Null is also the answer while a request is waiting or accepted, and there is no
// third answer to tell those apart: a page that needs to know reads the request,
// which is where the status is.
export async function otpFor(preorderId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('preorders')
        .select('otp')
        .eq('id', preorderId)
        .maybeSingle()
        .returns<{ otp: string | null }>();

    if (error) {
        throw refused(error);
    }

    return data === null ? null : data.otp;
}

// What a student can do with preorders: ask for one, read their own, ask for one's
// code, and watch for it changing. RLS says the same thing and more - a student has
// no insert and no update on the table at all - so there is no method here for
// answering a request, taking one back, or moving it along: the whole state machine
// belongs to the outlet, and what a student holds is a request they can read and
// watch.
export class MyPreorders {
    // Places a request in one transaction on the database's side, so a request
    // without its lines is not a state this can leave behind whichever part of the
    // request fails.
    //
    // Every refusal arrives as a sentence - that outlet has closed for now, only one
    // preorder a minute, that time has already passed - so nothing is translated here
    // and a page shows the message it is given. What is checked below is what the
    // database would otherwise answer with a constraint's name or a cast error: an
    // empty request, a quantity that is not a whole number between one and twenty,
    // the same item twice, notes longer than the column takes, and a deadline that is
    // not one.
    //
    // Note what is not checked, here or there: whether an item is sold out. Sold out
    // is what an item is today and a request is for tomorrow.
    //
    // Returns the new request's id. The request itself is not read back: a page that
    // placed one goes to its list, which reads on mount.
    async place(draft: NewPreorder): Promise<string> {
        const { data, error } = await supabase
            .rpc('create_preorder', {
                p_restaurant_id: draft.restaurantId,
                p_notes: toNotes(draft.notes),
                p_deadline: toDeadline(draft.deadline),
                p_items: toWireLines(draft.lines),
            })
            .returns<string>();

        if (error) {
            throw refused(error);
        }

        // The function returns one uuid or raises, so anything but a string here is a
        // shape we do not expect. It is checked rather than asserted because it is the
        // API's answer, not ours, and because there are no generated types to say what
        // a function hands back.
        if (typeof data !== 'string') {
            throw new Error('The preorder was placed, but no id came back.');
        }

        return data;
    }

    // This student's own requests, newest first: the order the index is in, and the
    // order a page shows them in. Nothing here names the student - the select policy
    // shows an account its own rows and no others.
    async list(): Promise<Preorder[]> {
        const { data, error } = await supabase
            .from('preorders')
            .select(preorderColumns)
            .order('created_at', { ascending: false })
            .returns<PreorderRow[]>();

        if (error) {
            throw refused(error);
        }

        return data.map(toPreorder);
    }

    // One request's code, or null while there is nothing to collect. Null is also the
    // answer for a request that is not this student's and for one that does not
    // exist: a row the caller may not see is the same answer on purpose, the way
    // Outlets.get answers it.
    async getOtpFor(preorderId: string): Promise<string | null> {
        return otpFor(preorderId);
    }

    // Something happened to one of this student's requests - most of all, an outlet
    // taking one on, which is the whole of being told, or marking one ready, which
    // brings the code with it.
    //
    // It carries nothing, on purpose: a request's lines are a second table and that
    // table is not in the Realtime publication, so a change here describes a request's
    // head and never its lines. A page reads its list again on each change instead.
    //
    // No filter, either: unlike a menu, where a student may read every outlet's and so
    // has to name the one being looked at, the policy here already narrows this channel
    // to their own requests, and there is nothing left to add.
    //
    // Returns the unsubscribe, which a page calls when it goes away, or the channel
    // goes on listening for a page nobody is looking at. Changes made in the moment
    // after subscribing can be missed while the server is still setting the
    // subscription up; reading the table on mount as well as subscribing is what covers
    // it.
    subscribe(onChange: () => void): () => void {
        const channel = supabase
            .channel('my-preorder-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'preorders' },
                () => onChange(),
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }
}

export const myPreorders = new MyPreorders();
