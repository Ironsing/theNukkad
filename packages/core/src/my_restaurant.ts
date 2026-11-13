import { supabase } from './supabase';
import { currentUserId } from './auth';
import { writeLogo } from './photos';
import {
    type Restaurant,
    type RestaurantRow,
    type RestaurantStatus,
    restaurantColumns,
    toRestaurant,
} from './restaurants';

// What a restaurant may write, as a whole draft: on a settings form, a field
// left out and a field cleared to null must not mean the same thing.
export type RestaurantDraft = {
    name: string;
    phone: string;
    email: string;
    address: string;
    opensAt: string | null;
    closesAt: string | null;
    status: RestaurantStatus;
};

// A restaurant's own restaurant: read it, write it, and nothing else. Every method
// here means "my row", because the id it works with is the account's own.
export class MyRestaurant {
    // The caller's restaurant, or null before it has saved anything.
    async get(): Promise<Restaurant | null> {
        const id = await currentUserId();

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

    // First save and every later edit are this one call: the row is keyed to the
    // account, so the insert becomes an update once the row is there. The name is
    // trimmed to match the column's own idea of its length.
    //
    // Returns the stored row, not the draft: the caller renders what the database
    // actually holds, so a write that matched nothing throws instead of reporting
    // a save that never happened.
    async save(draft: RestaurantDraft): Promise<Restaurant> {
        const id = await currentUserId();

        const { data, error } = await supabase
            .from('restaurant_info')
            .upsert(
                {
                    id,
                    name: draft.name.trim(),
                    phone: draft.phone,
                    email: draft.email,
                    address: draft.address,
                    opens_at: draft.opensAt,
                    closes_at: draft.closesAt,
                    status: draft.status,
                },
                { onConflict: 'id' },
            )
            .select(restaurantColumns)
            .single()
            .returns<RestaurantRow>();

        if (error) {
            throw error;
        }

        return toRestaurant(data);
    }

    async saveLogo(photo: Blob): Promise<string> {
        return await writeLogo(await currentUserId(), photo);
    }
}

export const myRestaurant = new MyRestaurant();
