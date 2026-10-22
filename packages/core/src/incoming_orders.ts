import { supabase } from './supabase';
import {
    isCode,
    orderColumns,
    otpFor,
    toOrder,
    type Order,
    type OrderRow,
} from './my_orders';

// An outlet's own orders: read the ones addressed to it, watch for new ones, cook
// one, read a code back, and read one order's code on its own. Every method here
// means "orders to me", because the policies are what decide it - the select
// policy shows an outlet the orders addressed to it and nobody else's, so nothing
// here names the outlet.
export class IncomingOrders {
    // This outlet's orders, newest first: the order the index is in, and the
    // order an incoming list is read in. Nothing here names the outlet - the
    // select policy shows it its own rows and no others.
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

    // One order's code, or null until it has been cooked. Null is also the answer
    // for an order that is not this outlet's, and for one that does not exist: a
    // row the caller may not see is the same answer on purpose.
    async getOtpFor(orderId: string): Promise<string | null> {
        return otpFor(orderId);
    }

    // Cooks one order and hands back its code. The code is minted here and nowhere
    // else, and minting is idempotent: an order already cooked answers with the
    // code it already has rather than a second one, so a double tap cannot
    // invalidate the code the student has just been told.
    //
    // The code is returned because the database hands it back in the statement
    // that mints it - the alternative is reading what is already in hand, with a
    // customer standing at the counter. getOtpFor is there for a page that holds
    // an order and no code at all.
    //
    // A student calling this is refused in words ("only an outlet can mark an
    // order ready"), and so is an order that is not this outlet's, which reads as
    // no such order rather than as no permission.
    async markReady(orderId: string): Promise<string> {
        const { data, error } = await supabase
            .rpc('mark_order_ready', { p_order_id: orderId })
            .returns<string>();

        if (error) {
            throw error;
        }

        // The function returns the code it minted or raises, so anything but a
        // string here is a shape we do not expect - checked rather than asserted,
        // as the API's answer rather than ours.
        if (typeof data !== 'string') {
            throw new Error('The order is ready, but no code came back.');
        }

        return data;
    }

    // The code as it is said at the counter and typed in: the one order it
    // belongs to, or null when it belongs to none.
    //
    // A code is unique to its outlet for a day, not for good - minting refuses a
    // code this outlet has used in the last day, and nothing older is refused - so
    // an order from yesterday can hold today's digits. The newest match is the
    // live one and is what this answers with; a page shows the order's own times,
    // so the counter can see that a ticket is an old one rather than not being
    // told at all. The index on (outlet, code) is what makes this a lookup.
    //
    // Anything that could not be a code is answered without asking, since the
    // column's own check is four digits with no leading zero. A page that would
    // rather say "that is not a code" than "no order with that code" checks the
    // same thing first (isCode), and is free to.
    async findByCode(code: string): Promise<Order | null> {
        const typed = code.trim();

        if (!isCode(typed)) {
            return null;
        }

        const { data, error } = await supabase
            .from('orders')
            .select(orderColumns)
            .eq('otp', typed)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
            .returns<OrderRow>();

        if (error) {
            throw error;
        }

        return data === null ? null : toOrder(data);
    }

    // Something happened to one of this outlet's orders: one arrived, or one was
    // cooked. It carries nothing, for the same reason the student's side does not
    // - an order's lines are a second table and not in the Realtime publication,
    // so a change describes a head and never what is on it. A page reads its list
    // again on each change.
    //
    // No filter: the policy already narrows this channel to the orders addressed
    // to this outlet, so there is nothing to add.
    //
    // Returns the unsubscribe, which a page calls when it goes away, or the
    // channel goes on listening for a page nobody is looking at. Changes made in
    // the moment after subscribing can be missed while the server is still
    // setting the subscription up; reading the table on mount as well as
    // subscribing is what covers it.
    subscribe(onChange: () => void): () => void {
        const channel = supabase
            .channel('incoming-order-changes')
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

export const incomingOrders = new IncomingOrders();
