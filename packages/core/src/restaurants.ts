import { supabase } from './supabase';
import { logoUrl } from './photos';

// The two states an restaurant can be in. 'normal' means it is running to its hours;
// 'closedManually' means someone shut it by hand. Not derivable from the hours:
// a manually closed restaurant keeps them.
export type RestaurantStatus = 'normal' | 'closedManually';

// A row of restaurant_info as anyone consumes it. The times are wall-clock
// ('08:00') with no date and no zone to invent, matching the time columns.
export type Restaurant = {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    opensAt: string | null;
    closesAt: string | null;
    status: RestaurantStatus;
    // Named whether or not a picture is there.
    logo: string;
};

// A change to one restaurant, in the terms a page folds it into what it is showing.
// A delete names a row without describing it: with the default replica identity
// the old record is the primary key and nothing more.
export type RestaurantChange =
    | { kind: 'saved'; restaurant: Restaurant }
    | { kind: 'removed'; id: string };

// The same row in Postgres' own spelling. Shared with my_restaurant.ts, which writes
// rows of the same shape.
export type RestaurantRow = {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    opens_at: string | null;
    closes_at: string | null;
    status: string;
};

export const restaurantColumns = 'id, name, phone, email, address, opens_at, closes_at, status';

// Postgres answers with '08:00:00' and the app shows '08:00'; normalising as
// rows come out keeps one spelling of a time on this side, whichever way it
// arrived.
function toClock(time: string | null) {
    return time === null ? null : time.slice(0, 5);
}

export function toRestaurant(row: RestaurantRow): Restaurant {
    return {
        id: row.id,
        name: row.name,
        phone: row.phone ?? null,
        email: row.email ?? null,
        address: row.address ?? null,
        opensAt: toClock(row.opens_at),
        closesAt: toClock(row.closes_at),
        // A cast because the column's check constraint is the vocabulary, and
        // this is only telling TypeScript what Postgres already guarantees.
        status: row.status as RestaurantStatus,
        // Built, not stored
        logo: logoUrl(row.id),
    };
}

// The API's payload in our terms, read once, here. Every field is optional
// because an insert carries no old record and a delete no new one, and because
// this is wire data: it is checked, not trusted.
type ChangePayload = {
    eventType: string;
    new: Partial<RestaurantRow>;
    old: Partial<RestaurantRow>;
};

function toChange(payload: ChangePayload): RestaurantChange | null {
    if (payload.eventType === 'DELETE') {
        // A delete names its row without describing it.
        const { id } = payload.old;

        return id === undefined ? null : { kind: 'removed', id };
    }

    const { id, name, phone, email, address, opens_at, closes_at, status } =
        payload.new;

    // A row missing the columns we show is not a row we can show.
    if (id === undefined || name === undefined || status === undefined) {
        return null;
    }

    return {
        kind: 'saved',
        restaurant: toRestaurant({
            id,
            name,
            phone: phone ?? null,
            email: email ?? null,
            address: address ?? null,
            opens_at: opens_at ?? null,
            closes_at: closes_at ?? null,
            status,
        }),
    };
}

// Folds one change into a list, keeping the order `list` asks for, so a change
// and a refetch leave the same list behind. localeCompare is the closest thing
// the browser has to the collation Postgres ordered by.
export function fold(rows: Restaurant[], change: RestaurantChange): Restaurant[] {
    const id = change.kind === 'saved' ? change.restaurant.id : change.id;
    const kept = rows.filter((row) => row.id !== id);

    return change.kind === 'saved'
        ? [...kept, change.restaurant].sort((a, b) => a.name.localeCompare(b.name))
        : kept;
}

// What a student can do with restaurants: read them, and nothing else. RLS says the
// same thing - a student account has no insert or update policy - but the split
// is the point: the student app is never handed a way to change an restaurant.
export class Restaurants {
    // Every restaurant, by name. A restaurant account asking gets only its own row,
    // because that is as far as its select policy lets it read.
    async list(): Promise<Restaurant[]> {
        const { data, error } = await supabase
            .from('restaurant_info')
            .select(restaurantColumns)
            .order('name')
            .returns<RestaurantRow[]>();

        if (error) {
            throw error;
        }

        return data.map(toRestaurant);
    }

    // One restaurant, or null when there is no such row. A row the caller may not
    // see is the same answer on purpose: the policies decide, not the class.
    async get(id: string): Promise<Restaurant | null> {
        const { data, error } = await supabase
            .from('restaurant_info')
            .select(restaurantColumns)
            .eq('id', id)
            .maybeSingle()
            .returns<RestaurantRow>();

        if (error) {
            throw error;
        }

        return data === null ? null : toRestaurant(data);
    }

    // Live changes to every restaurant this account may read: all of them for a
    // student, its own row for a restaurant, decided by the policies exactly as
    // `list` decides it - except for deletes, which arrive no matter what the
    // policies say, because a row that is gone cannot be checked against them.
    // Nothing can delete an restaurant today, so a delete reads as an id and no more.
    //
    // Returns the unsubscribe, which a page calls when it goes away, or the
    // channel goes on listening for a page nobody is looking at. Changes made in
    // the moment after subscribing can be missed while the server is still
    // setting the subscription up; the next change, or a refetch, puts it right.
    subscribe(onChange: (change: RestaurantChange) => void): () => void {
        const channel = supabase
            .channel('restaurant-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'restaurant_info' },
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

export const restaurants = new Restaurants();
