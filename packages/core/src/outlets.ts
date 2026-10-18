import { supabase } from './supabase';

// The two states an outlet can be in. 'normal' means it is running to its hours;
// 'closedManually' means someone shut it by hand. Not derivable from the hours:
// a manually closed outlet keeps them.
export type RestaurantStatus = 'normal' | 'closedManually';

// A row of restaurant_info as anyone consumes it. The times are wall-clock
// ('08:00') with no date and no zone to invent, matching the time columns.
export type Outlet = {
    id: string;
    name: string;
    opensAt: string | null;
    closesAt: string | null;
    status: RestaurantStatus;
};

// The same row in Postgres' own spelling. Shared with my_outlet.ts, which writes
// rows of the same shape.
export type OutletRow = {
    id: string;
    name: string;
    opens_at: string | null;
    closes_at: string | null;
    status: string;
};

export const outletColumns = 'id, name, opens_at, closes_at, status';

// Postgres answers with '08:00:00' and the app shows '08:00'; normalising as
// rows come out keeps one spelling of a time on this side, whichever way it
// arrived.
function toClock(time: string | null) {
    return time === null ? null : time.slice(0, 5);
}

export function toOutlet(row: OutletRow): Outlet {
    return {
        id: row.id,
        name: row.name,
        opensAt: toClock(row.opens_at),
        closesAt: toClock(row.closes_at),
        // A cast because the column's check constraint is the vocabulary, and
        // this is only telling TypeScript what Postgres already guarantees.
        status: row.status as RestaurantStatus,
    };
}

// What a student can do with outlets: read them, and nothing else. RLS says the
// same thing - a student account has no insert or update policy - but the split
// is the point: the student app is never handed a way to change an outlet.
export class Outlets {
    // Every outlet, by name. A restaurant account asking gets only its own row,
    // because that is as far as its select policy lets it read.
    async list(): Promise<Outlet[]> {
        const { data, error } = await supabase
            .from('restaurant_info')
            .select(outletColumns)
            .order('name')
            .returns<OutletRow[]>();

        if (error) {
            throw error;
        }

        return data.map(toOutlet);
    }

    // One outlet, or null when there is no such row. A row the caller may not
    // see is the same answer on purpose: the policies decide, not the class.
    async get(id: string): Promise<Outlet | null> {
        const { data, error } = await supabase
            .from('restaurant_info')
            .select(outletColumns)
            .eq('id', id)
            .maybeSingle()
            .returns<OutletRow>();

        if (error) {
            throw error;
        }

        return data === null ? null : toOutlet(data);
    }
}

export const outlets = new Outlets();
