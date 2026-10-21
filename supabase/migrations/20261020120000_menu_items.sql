-- What an outlet sells: one row per item, and the students group them by the
-- category the outlet typed on each one. An item hangs off the outlet's info
-- row, so it cannot outlive the outlet that sells it, and the student list and
-- the menu are keyed off the same row.
create table public.menu_items (
    id uuid primary key default gen_random_uuid(),
    -- Like restaurant_info.id, so the two behave the same way: an insert that
    -- forgets the owner lands on the signed-in account rather than failing on
    -- null or, worse, landing on someone else's. The policies check it either
    -- way.
    restaurant_id uuid not null default auth.uid()
        references public.restaurant_info(id) on delete cascade,
    name text not null
        check (char_length(btrim(name)) between 1 and 80),
    -- Rupees and paise as one number, not as paise-in-an-integer and not as a
    -- string the app has to parse: 49.5 is 49 rupees 50 paise, and two decimal
    -- places are the whole of what this currency uses. Not zero, either: a
    -- price list has no free items yet, and zero is what a forgotten price
    -- would look like.
    price numeric(10, 2) not null
        check (price > 0),
    -- Free text, chosen by the outlet: starters, mains, whatever it likes.
    -- Nothing here enumerates the categories, and two items fall in the same
    -- section exactly when the outlet spelled it the same way - including
    -- where they didn't mean to, which is why the UI eventually has to offer
    -- the categories already in use rather than a blank box.
    category text not null
        check (char_length(btrim(category)) between 1 and 40),
    -- Sold out, or back on today. This is the day-to-day flag rather than the
    -- way off a menu: an item that is not coming back is removed, which is what
    -- the delete policy at the end of this file lets its outlet do.
    available boolean not null default true
);

-- Every read is "the menu of one outlet" and the foreign key needs it too.
create index menu_items_restaurant_id_idx on public.menu_items (restaurant_id);

alter table public.menu_items enable row level security;

-- Local Supabase hands new tables to anon and authenticated by default, so these
-- grants are not what keeps anyone out - the policies are. They only record what
-- the API is meant to do: read for anyone with a session, and a restaurant's
-- writes on its own items - delete among them, since that is how an item leaves
-- a menu for good.
grant select, insert, update, delete on public.menu_items to authenticated;

create policy "Students can read every outlet's menu"
on public.menu_items
for select
to authenticated
using (public.is_student_account());

create policy "Restaurants can read their own menu"
on public.menu_items
for select
to authenticated
using (public.is_restaurant_account() and restaurant_id = (select auth.uid()));

create policy "Restaurants can add to their own menu"
on public.menu_items
for insert
to authenticated
with check (public.is_restaurant_account() and restaurant_id = (select auth.uid()));

create policy "Restaurants can change their own menu"
on public.menu_items
for update
to authenticated
using (public.is_restaurant_account() and restaurant_id = (select auth.uid()))
with check (public.is_restaurant_account() and restaurant_id = (select auth.uid()));

-- Sold out keeps an item on a menu for the day it is off; this is the one that
-- takes it off for good. An outlet that has stopped selling something had no way
-- to say so, and an item flagged false forever leaves a menu nobody can read. It
-- draws the same boundary the other three do - the outlet's own items - so a
-- stale id, or one on another outlet's menu, matches nothing and removes nothing.
create policy "Restaurants can remove from their own menu"
on public.menu_items
for delete
to authenticated
using (public.is_restaurant_account() and restaurant_id = (select auth.uid()));
