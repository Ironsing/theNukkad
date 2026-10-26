import { supabase } from './supabase';
import { isCode } from './otp';
import {
    otpFor,
    preorderColumns,
    refused,
    toPreorder,
    type Preorder,
    type PreorderRow,
} from './my_preorders';

// An outlet's own preorders: read the requests addressed to it, watch for one
// arriving or being answered, answer one, cook one, and read one's code back. Every
// method here means "requests to me", because the policies are what decide it - the
// select policy shows an outlet the requests addressed to it and nobody else's, so
// nothing here names the outlet.
//
// The state machine is the whole of what this class has that MyPreorders does not:
// two answers and a cook, which are the three transitions there are.
export class IncomingPreorders {
    // This outlet's requests, soonest deadline first: the next one due is the next one
    // to answer, and it is the order the (restaurant_id, deadline) index is in. Not
    // newest first, the way an outlet reads its orders - an order is read by when it
    // arrived, a request by when it is wanted.
    //
    // Everything addressed to this outlet comes back, requests already answered and
    // refused included, exactly as an outlet's order list carries everything it has
    // cooked. A board splits them by status rather than asking the database for a
    // slice, which is also what lets it show what it has turned down without a second
    // read. Nothing here names the outlet - the select policy shows it its own rows
    // and no others.
    async list(): Promise<Preorder[]> {
        const { data, error } = await supabase
            .from('preorders')
            .select(preorderColumns)
            .order('deadline', { ascending: true })
            .returns<PreorderRow[]>();

        if (error) {
            throw refused(error);
        }

        return data.map(toPreorder);
    }

    // One request's code, or null until it has been cooked. Null is also the answer
    // for a request that is not this outlet's, and for one that does not exist: a row
    // the caller may not see is the same answer on purpose.
    async getOtpFor(preorderId: string): Promise<string | null> {
        return otpFor(preorderId);
    }

    // Takes one on, after which it can be cooked. Nothing comes back, because there is
    // nothing in hand to return - the code does not exist until the request is cooked -
    // and a page reads its list again, which the change it just made arrives over
    // anyway.
    //
    // A student calling this is refused in words ("only an outlet can answer a
    // preorder"), and so is a request that is not this outlet's, which reads as no such
    // request rather than as no permission. A request already answered - accepted,
    // refused, or cooked - answers "that preorder has already been answered", because
    // the first answer is the one the student was told and a second could only take it
    // back.
    async accept(preorderId: string): Promise<void> {
        const { error } = await supabase.rpc('accept_preorder', {
            p_preorder_id: preorderId,
        });

        if (error) {
            throw refused(error);
        }
    }

    // Turns one down, which is the end of it. Nothing leads out of `rejected`, here or
    // in the database, and no reason is recorded: a refusal is a dead end rather than
    // a conversation. Same refusals as accept, since it is the same decision.
    async reject(preorderId: string): Promise<void> {
        const { error } = await supabase.rpc('reject_preorder', {
            p_preorder_id: preorderId,
        });

        if (error) {
            throw refused(error);
        }
    }

    // Cooks one request and hands back its code. The code is minted here and nowhere
    // else, out of the preorders' own pool rather than the orders' - the two are
    // independent, so a request's four digits may repeat an order's - and minting is
    // idempotent: a request already cooked answers with the code it has rather than a
    // second one, so a double tap cannot invalidate the code the student has just been
    // told.
    //
    // Only an accepted request can be cooked. An unanswered one answers "that preorder
    // has not been accepted", and so does one that was refused.
    //
    // The code is returned because the database hands it back in the statement that
    // mints it - the alternative is reading what is already in hand, with a customer
    // standing at the counter. getOtpFor is there for a page that holds a request and
    // no code at all.
    async markReady(preorderId: string): Promise<string> {
        const { data, error } = await supabase
            .rpc('mark_preorder_ready', { p_preorder_id: preorderId })
            .returns<string>();

        if (error) {
            throw refused(error);
        }

        // The function returns the code it minted or raises, so anything but a string
        // here is a shape we do not expect - checked rather than asserted, as the API's
        // answer rather than ours.
        if (typeof data !== 'string') {
            throw new Error('The preorder is ready, but no code came back.');
        }

        return data;
    }

    // The code as it is said at the counter and typed in: the one request it belongs
    // to, or null when it belongs to no request of this outlet's.
    //
    // A code is unique to its outlet for a day within this table and not across the two
    // pools, so a code typed at a counter should be looked up through
    // findTicketByCode, which asks both - this answers about requests alone, and a page
    // that wants only that can call it directly.
    //
    // Anything that could not be a code is answered without asking, since the column's
    // own check is four digits with no leading zero - asked through the same isCode
    // the orders' side asks, which is the whole reason it has a module of its own.
    async findByCode(code: string): Promise<Preorder | null> {
        const typed = code.trim();

        if (!isCode(typed)) {
            return null;
        }

        const { data, error } = await supabase
            .from('preorders')
            .select(preorderColumns)
            .eq('otp', typed)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
            .returns<PreorderRow>();

        if (error) {
            throw refused(error);
        }

        return data === null ? null : toPreorder(data);
    }

    // Something happened to one of this outlet's requests: one arrived, one was
    // answered, or one was cooked. It carries nothing, for the same reason the
    // student's side does not - a request's lines are a second table and not in the
    // Realtime publication, so a change describes a head and never what is on it. A
    // page reads its list again on each change, which is also what brings the code.
    //
    // No filter: the policy already narrows this channel to the requests addressed to
    // this outlet. Returns the unsubscribe, which a page calls when it goes away, and
    // reading the table on mount as well as subscribing covers the moment before the
    // channel is up.
    subscribe(onChange: () => void): () => void {
        const channel = supabase
            .channel('incoming-preorder-changes')
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

export const incomingPreorders = new IncomingPreorders();
