import { incomingOrders } from './incoming_orders';
import { incomingPreorders } from './incoming_preorders';
import type { Order } from './my_orders';
import type { Preorder } from './my_preorders';

// What a code typed at the counter turned out to be, and which of the two pools it
// came from. A page branches on `kind` rather than on which table it happened to
// read: an order is a receipt with a time on it, a request is something that was
// asked for earlier and answered, and the counter says a different sentence about
// each.
export type Ticket =
    | { kind: 'order'; order: Order }
    | { kind: 'preorder'; preorder: Preorder };

// When a ticket was cooked, for the one comparison below. A code exists exactly when
// this moment does - both tables mint it in the same statement that sets it - so a
// match always has one; a null is a shape we do not expect, and it loses rather than
// throwing in the middle of a counter's question.
function cookedAt(at: string | null): number {
    return at === null ? 0 : Date.parse(at);
}

// The ticket a code belongs to, or null when it belongs to none.
//
// Both pools are asked, because a code is unique to its restaurant for a day within its
// own table and not across the two: the same four digits can be live on an order and
// on a request at once, and a counter that asked one table would quietly find nothing
// while a student stood there holding the other one. Each lookup is a single indexed
// read, so this is two of them, in one call and in one place - which is the point:
// the collision is known about here rather than rediscovered by every page that
// checks a code.
//
// A code that belongs to neither answers null, and so does one that could not be a
// code at all: the classes answer that without a round trip, so a typo costs two
// short reads rather than two queries.
export async function findTicketByCode(code: string): Promise<Ticket | null> {
    const [order, preorder] = await Promise.all([
        incomingOrders.findByCode(code),
        incomingPreorders.findByCode(code),
    ]);

    // Both live. The one cooked most recently wins, whichever pool it is in: that is
    // the ticket that just came off the pass, and the page says which kind it is
    // either way - so the other one is still on the screen as a live ticket to ask
    // about rather than lost. Equal instants fall to the order, the pool that has
    // always been there, and the two being equal at all is not something to plan for.
    if (order !== null && preorder !== null) {
        return cookedAt(order.readyAt) >= cookedAt(preorder.readyAt)
            ? { kind: 'order', order }
            : { kind: 'preorder', preorder };
    }

    if (order !== null) {
        return { kind: 'order', order };
    }

    if (preorder !== null) {
        return { kind: 'preorder', preorder };
    }

    return null;
}
