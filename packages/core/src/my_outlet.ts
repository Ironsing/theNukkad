import { supabase } from './supabase';
import { currentUserId } from './auth';
import {
    type Outlet,
    type OutletRow,
    type RestaurantStatus,
    outletColumns,
    toOutlet,
} from './outlets';

// What a restaurant may write, as a whole draft: on a settings form, a field
// left out and a field cleared to null must not mean the same thing.
export type OutletDraft = {
    name: string;
    opensAt: string | null;
    closesAt: string | null;
    status: RestaurantStatus;
};

// A restaurant's own outlet: read it, write it, and nothing else. Every method
// here means "my row", because the id it works with is the account's own.
export class MyOutlet {
    // The caller's outlet, or null before it has saved anything.
    async get(): Promise<Outlet | null> {
        const id = await currentUserId();

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

    // First save and every later edit are this one call: the row is keyed to the
    // account, so the insert becomes an update once the row is there. The name is
    // trimmed to match the column's own idea of its length.
    //
    // Returns the stored row, not the draft: the caller renders what the database
    // actually holds, so a write that matched nothing throws instead of reporting
    // a save that never happened.
    async save(draft: OutletDraft): Promise<Outlet> {
        const id = await currentUserId();

        const { data, error } = await supabase
            .from('restaurant_info')
            .upsert(
                {
                    id,
                    name: draft.name.trim(),
                    opens_at: draft.opensAt,
                    closes_at: draft.closesAt,
                    status: draft.status,
                },
                { onConflict: 'id' },
            )
            .select(outletColumns)
            .single()
            .returns<OutletRow>();

        if (error) {
            throw error;
        }

        return toOutlet(data);
    }
}

export const myOutlet = new MyOutlet();
