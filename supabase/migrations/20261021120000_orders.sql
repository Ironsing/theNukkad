-- An order: one student's advance order at one outlet. What it is, in one row
-- plus its lines - who ordered, from whom, what they wrote, and whether the
-- outlet has cooked it yet.
--
-- There is no state after that. Once the food is ready the order is a receipt
-- with a code on it: each side decides for itself when to stop looking at it,
-- and nothing here records a handover, because nothing follows from one.
create table public.orders (
    id uuid primary key default gen_random_uuid(),
    -- Like restaurant_info.id and menu_items.restaurant_id, so an insert that
    -- forgets the owner lands on the signed-in account rather than failing on
    -- null or, worse, landing on someone else's. The policies check it either
    -- way.
    --
    -- Both foreign keys in this table cascade, so deleting an account erases the
    -- orders it took part in: a student's receipt when an outlet goes, an outlet's
    -- ticket when a student does. Reachable only through the Auth admin API, since
    -- neither app has a delete policy, and left that way deliberately - whether an
    -- order outlives the accounts that made it is still an open decision.
    student_id uuid not null default auth.uid()
        references public.profiles(id) on delete cascade,
    -- Deliberately no default, unlike the column above: auth.uid() here would be
    -- the *student's* own id, which is not a restaurant_info row, so every
    -- forgetful insert would fail on the foreign key. An order is always
    -- addressed to a named outlet.
    restaurant_id uuid not null
        references public.restaurant_info(id) on delete cascade,
    -- What the student wants to say about it - no onions, less spicy. Free
    -- text, and empty is the ordinary case rather than a missing value.
    notes text not null default ''
        check (char_length(notes) <= 200),
    -- When the outlet cooked it, set by public.mark_order_ready() and by nothing
    -- else. A moment rather than a flag, because this moment is what the code
    -- below was minted at and what an outlet's ready list sorts by.
    ready_at timestamptz,
    -- What the student says at the counter: "I'm the one with 5829." Minted in
    -- the same statement that sets ready_at above, and empty until then, which is
    -- the whole of "neither side can read it until it is ready": there is nothing
    -- in the column to read while there is nothing to collect. Four digits with no
    -- leading zero, because it is spoken aloud and typed without one.
    otp text
        check (otp ~ '^[1-9][0-9]{3}$'),
    -- Every read is "mine, newest first" - a student's history and an outlet's
    -- incoming list alike - so the order events happened in has to be recorded,
    -- and the app has nothing else to sort by.
    created_at timestamptz not null default now(),
    -- The two halves of "ready" cannot drift apart: a code with no order to
    -- collect, or an order with no way to collect it, are both refused here.
    check ((ready_at is null) = (otp is null))
);

-- The two reads this table exists for: a student's own orders, an outlet's own
-- orders, each newest first. One index each, in the order they are read.
create index orders_student_id_created_at_idx
    on public.orders (student_id, created_at desc);

create index orders_restaurant_id_created_at_idx
    on public.orders (restaurant_id, created_at desc);

-- Where a new code is checked against the ones already out. mark_order_ready()
-- mints under a lock and retries until it finds a code this outlet has not used
-- in the last day, so the lookup is (outlet, code) and only over rows that have
-- one.
create index orders_restaurant_id_otp_idx
    on public.orders (restaurant_id, otp)
    where otp is not null;

-- What was ordered, one row per item. Separate from the order because an order
-- is a variable number of these, and because a line is not a menu item: it is
-- what was asked for, at a price, and both have to outlive the menu changing.
create table public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null
        references public.orders(id) on delete cascade,
    -- Which item on the menu this line was, kept so the outlet can see what is
    -- being asked for and so a repeat order can point at it - but not depended
    -- on. `set null` rather than `cascade`, because an outlet removing an item
    -- must not erase the orders containing it; `restrict` is the other way to
    -- protect them, and it would make menu_items' delete policy unusable, since
    -- an outlet could never remove anything anyone had ever ordered.
    menu_item_id uuid
        references public.menu_items(id) on delete set null,
    -- Copied from the menu at order time, both of them, rather than joined to
    -- when read: an order is an agreement about a thing at a price, and a later
    -- rename or price change must not rewrite one already placed. This is also
    -- what keeps a line readable once menu_item_id is null.
    name text not null
        check (char_length(btrim(name)) between 1 and 80),
    price numeric(10, 2) not null
        check (price > 0),
    -- How many of it. One is the ordinary case, and the upper bound is there to
    -- keep a mistyped quantity out of a kitchen's day rather than because
    -- anyone orders twenty of anything.
    quantity integer not null
        check (quantity between 1 and 20),
    -- One line per item per order: two of the same thing is the quantity, not a
    -- second line. Null menu_item_ids don't collide, which is harmless - by then
    -- the item is off the menu and there is nothing left for two lines to be
    -- two lines of.
    unique (order_id, menu_item_id)
);

create index order_items_order_id_idx on public.order_items (order_id);

-- Not for a read this schema makes, but for the foreign key above: without it,
-- every removal from a menu scans this table to see whether anything points at
-- the item being removed.
create index order_items_menu_item_id_idx on public.order_items (menu_item_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Same division as the tables before these: local Supabase hands new tables to
-- anon and authenticated by default, so these grants are not what keeps anyone
-- out - the policies are. They only record what the API is meant to do.
--
-- Read only, both of them, and that is the whole of what the API is meant to do
-- here. An order is placed through public.create_order() and cooked through
-- public.mark_order_ready(), and neither it nor its lines are ever removed - so
-- there is no policy below under which either app writes a row by hand, which is
-- what actually refuses one.
--
-- The write privileges the default hands out go with them, so a request the
-- policies would refuse is refused at the table rather than accepted and then
-- turned down. anon goes too: nothing reaches either table signed out, and
-- having no policy rather than no privilege is the weaker way of saying so.
revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;

grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;

create policy "Students can read their own orders"
on public.orders
for select
to authenticated
using (public.is_student_account() and student_id = (select auth.uid()));

create policy "Restaurants can read orders to themselves"
on public.orders
for select
to authenticated
using (public.is_restaurant_account() and restaurant_id = (select auth.uid()));

-- No update policy, for either side. The two writes this table has are
-- public.create_order() and public.mark_order_ready(), both of them definer
-- functions that reach it past these policies, and neither app can write a row
-- directly. A student amending the notes on their own open order used to be the
-- one exception, and it is gone: a ticket is in the kitchen the moment it is
-- placed, so there is nothing left to amend.

-- The lines, read through the order they belong to. The subquery runs as the
-- caller, so orders' own policies decide which of those rows exist for them: a
-- student sees the lines of their orders, an outlet the lines of its own, and
-- nobody sees anyone else's - without either policy restating the other table's
-- rules.
create policy "Students can read their own order's lines"
on public.order_items
for select
to authenticated
using (
    exists (
        select 1
        from public.orders o
        where o.id = order_items.order_id
            and public.is_student_account()
            and o.student_id = (select auth.uid())
    )
);

create policy "Restaurants can read the lines of orders to themselves"
on public.order_items
for select
to authenticated
using (
    exists (
        select 1
        from public.orders o
        where o.id = order_items.order_id
            and public.is_restaurant_account()
            and o.restaurant_id = (select auth.uid())
    )
);

-- A trigger used to live here. It pinned which columns each side could change
-- once the policies had settled which rows, and it existed because row level
-- security sees the row a caller is writing, not the row it was. It closed two
-- holes: a student fulfilling their own order, and an outlet rewriting the notes
-- on one - either of which a future policy could reopen.
--
-- It is gone because both write paths are functions now, and neither app can
-- write this table at all. The holes are not guarded any more; they are
-- unreachable.
