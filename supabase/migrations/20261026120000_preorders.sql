-- A preorder: one student asking one outlet for something at a time they name,
-- which the outlet may take on or turn down before anything is cooked.
--
-- Deliberately not a row in public.orders with a deadline and a state on it. The
-- two share a shape and nothing else: an order is in the kitchen the moment it is
-- placed and is only ever cooked, while a request sits until the outlet answers
-- it, can be refused, and may never become food at all. Kept apart, neither table
-- carries columns that mean nothing for half its rows, and each flow is read
-- without having to be held in the head alongside the other.
--
-- The one thing they deliberately do not share is the code. mark_order_ready()
-- mints against orders and public.mark_preorder_ready() mints against this table,
-- so an outlet's four digits for a day are drawn from two separate pools and may
-- repeat across them - rare enough to accept, and it costs a counter nothing,
-- since a request and an order are collected the same way but never at once.
create table public.preorders (
    id uuid primary key default gen_random_uuid(),
    -- Like orders.student_id and menu_items.restaurant_id, so an insert that
    -- forgets the owner lands on the signed-in account rather than failing on
    -- null or, worse, landing on someone else's. The policies check it either
    -- way, and the function that is the only door says it as well.
    student_id uuid not null default auth.uid()
        references public.profiles(id) on delete cascade,
    -- No default, for the reason orders.restaurant_id has none: auth.uid() here
    -- would be the *student's* own id, which is not a restaurant_info row, so
    -- every forgetful insert would fail on the foreign key. A request is always
    -- addressed to a named outlet.
    restaurant_id uuid not null
        references public.restaurant_info(id) on delete cascade,
    -- What the student wants to say about it. The same free text and the same
    -- limit as an order's, empty being the ordinary case rather than a missing
    -- value.
    notes text not null default ''
        check (char_length(notes) <= 200),
    -- When the student wants it: what the outlet aims at, and nothing more.
    -- Nothing refuses a request cooked early or long after it, which is the late
    -- completions that are not handled yet. Always set - a request with no time is
    -- an order - and always within a day of being made, so a request is for later
    -- today or tomorrow rather than for a season nobody is planning for.
    deadline timestamptz not null,
    -- Where every row starts, and the one state nobody has chosen. Defaulted
    -- rather than left to the door, unlike `diet`, where a forgotten value would
    -- be a false claim about food: here it is the true one, because a row nobody
    -- has answered is unanswered.
    status text not null default 'unknown'
        check (status in ('unknown', 'accepted', 'rejected', 'ready')),
    -- When the outlet cooked it, set by public.mark_preorder_ready() and by
    -- nothing else. A moment rather than a flag, because this moment is what the
    -- code below was minted at.
    ready_at timestamptz,
    -- What the student says at the counter: "I'm the one with 5829." Minted in the
    -- same statement that sets ready_at above, and empty until then, which is the
    -- whole of "neither side can read it until it is ready". Four digits with no
    -- leading zero, because it is spoken aloud and typed without one.
    otp text
        check (otp ~ '^[1-9][0-9]{3}$'),
    -- Every read is "mine, newest first" - a student's requests and an outlet's
    -- board alike - and the app has nothing else to sort by.
    created_at timestamptz not null default now(),
    -- A request is for after it was made, and no more than a day after. Both are
    -- about this row's own columns, so unlike the cooldown on orders they need no
    -- function to hold them: now() is not immutable and cannot appear in a check,
    -- but created_at already holds the moment this was made.
    constraint preorders_is_for_later
        check (deadline > created_at),
    constraint preorders_is_within_a_day
        check (deadline <= created_at + interval '1 day'),
    -- The state and the moment it names cannot drift apart: a row calling itself
    -- ready with no time it was cooked at, or a time on a row that is not ready,
    -- are both refused here. Same for the code, which exists exactly when
    -- ready_at does.
    constraint preorders_ready_and_status_agree
        check ((status = 'ready') = (ready_at is not null)),
    constraint preorders_ready_has_a_code
        check ((ready_at is null) = (otp is null))
);

-- The reads this table exists for: a student's own requests, and an outlet's own
-- requests soonest deadline first - which is the order a request board is in,
-- since the next one due is the next one to have to answer.
create index preorders_student_id_created_at_idx
    on public.preorders (student_id, created_at desc);

create index preorders_restaurant_id_deadline_idx
    on public.preorders (restaurant_id, deadline);

-- Where a new code is checked against the ones already out. mark_preorder_ready()
-- mints under a lock and retries until it finds a code this outlet has not used
-- in the last day, so the lookup is (outlet, code) and only over rows that have
-- one. This table's codes are its own - see the note at the top of the file.
create index preorders_restaurant_id_otp_idx
    on public.preorders (restaurant_id, otp)
    where otp is not null;

-- What was asked for, one row per item: the same shape as order_items, because a
-- request for later is still a set of things at prices.
create table public.preorder_items (
    id uuid primary key default gen_random_uuid(),
    preorder_id uuid not null
        references public.preorders(id) on delete cascade,
    -- Which item on the menu this line was, kept so the outlet can see what is
    -- being asked for - but not depended on. `set null` rather than `cascade`,
    -- for the reason order_items gives: an outlet removing an item from its menu
    -- must not erase the requests containing it, and `restrict` is the other way
    -- to protect them, which would make menu_items' delete policy unusable.
    menu_item_id uuid
        references public.menu_items(id) on delete set null,
    -- Copied from the menu when the request was made, both of them, rather than
    -- joined to when read: the price a student asked at is the price an outlet
    -- agrees to when it accepts, and a later rename or price change must not
    -- rewrite a request already made. This is also what keeps a line readable once
    -- menu_item_id is null.
    name text not null
        check (char_length(btrim(name)) between 1 and 80),
    price numeric(10, 2) not null
        check (price > 0),
    -- How many of it, to the same limits an order's lines have.
    quantity integer not null
        check (quantity between 1 and 20),
    -- One line per item per request: two of the same thing is the quantity, not a
    -- second line.
    unique (preorder_id, menu_item_id)
);

create index preorder_items_preorder_id_idx
    on public.preorder_items (preorder_id);

-- Not for a read this schema makes, but for the foreign key above: without it,
-- every removal from a menu scans this table to see whether anything points at
-- the item being removed.
create index preorder_items_menu_item_id_idx
    on public.preorder_items (menu_item_id);

alter table public.preorders enable row level security;
alter table public.preorder_items enable row level security;

-- The same division as every table before these: local Supabase hands new tables
-- to anon and authenticated by default, so these grants are not what keeps anyone
-- out - the policies are. Read only, both of them, and that is the whole of what
-- the API is meant to do here: a request is placed through
-- public.create_preorder(), answered through public.accept_preorder() and
-- public.reject_preorder(), and cooked through public.mark_preorder_ready(),
-- none of which a client can reach around. What actually refuses a hand-written
-- insert or update is the absence of any policy that would allow one.
--
-- The write privileges the default hands out go with them, so a request the
-- policies would refuse is refused at the table rather than accepted and then
-- turned down. anon goes too: nothing reaches either table signed out, and having
-- no policy rather than no privilege is the weaker way of saying so.
revoke insert, update, delete on public.preorders from anon, authenticated;
revoke insert, update, delete on public.preorder_items from anon, authenticated;

grant select on public.preorders to authenticated;
grant select on public.preorder_items to authenticated;

create policy "Students can read their own preorders"
on public.preorders
for select
to authenticated
using (public.is_student_account() and student_id = (select auth.uid()));

create policy "Restaurants can read preorders to themselves"
on public.preorders
for select
to authenticated
using (public.is_restaurant_account() and restaurant_id = (select auth.uid()));

-- No update policy, for either side, and here that is the state machine's whole
-- defence: a student cannot accept their own request, refuse it, or cook it, and
-- an outlet cannot move one by hand either - it answers it through a function
-- that re-states the role check these policies would have made. `rejected` being
-- a dead end is the same fact from the other side: no function leads out of it,
-- and there is no policy through which one could be written.
--
-- Which of the four states a row may be in at all is the table's business, and
-- the table says it in its checks: ready without a time or a code is refused, and
-- so is a time or a code on a row that is not ready.

-- The lines, read through the request they belong to. The subquery runs as the
-- caller, so preorders' own policies decide which of those rows exist for them: a
-- student sees the lines of their requests, an outlet the lines of its own, and
-- nobody sees anyone else's - without either policy restating the other table's
-- rules.
create policy "Students can read their own preorder's lines"
on public.preorder_items
for select
to authenticated
using (
    exists (
        select 1
        from public.preorders p
        where p.id = preorder_items.preorder_id
            and public.is_student_account()
            and p.student_id = (select auth.uid())
    )
);

create policy "Restaurants can read the lines of preorders to themselves"
on public.preorder_items
for select
to authenticated
using (
    exists (
        select 1
        from public.preorders p
        where p.id = preorder_items.preorder_id
            and public.is_restaurant_account()
            and p.restaurant_id = (select auth.uid())
    )
);
