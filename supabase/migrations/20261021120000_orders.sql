-- The state transition is:
-- Unready (created by students) -> Ready (transitioned by restaurants).
-- Marking as ready sets the timestamp and generates an OTP.
-- OTPs are checked for collisions against a rolling 24h window.
-- After ready, our job is done. Whether the student has gone and picked up their food isn't our business.
create table public.orders (
    id uuid primary key default gen_random_uuid(),
    -- Both foreign keys in this table cascade, so deleting an account erases the
    -- orders it took part in: student receipts when an restaurant goes, restaurant tickets
    -- when a student goes. Whether an order outlives the accounts
    -- that made it is still an open decision.
    student_id uuid not null default auth.uid()
        references public.account_types(id) on delete cascade,
    restaurant_id uuid not null
        references public.restaurant_info(id) on delete cascade,
    notes text not null default ''
        check (char_length(notes) <= 200),
    ready_at timestamptz,
    otp text
        check (otp ~ '^[1-9][0-9]{3}$'),
    created_at timestamptz not null default now(),
    -- The two halves of "ready" cannot drift apart.
    check ((ready_at is null) = (otp is null))
);

create index orders_student_id_created_at_idx
    on public.orders (student_id, created_at desc);

create index orders_restaurant_id_created_at_idx
    on public.orders (restaurant_id, created_at desc);

create index orders_restaurant_id_otp_idx
    on public.orders (restaurant_id, otp)
    where otp is not null;

-- The food that was actually ordered.
create table public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null
        references public.orders(id) on delete cascade,
    -- `set null` rather than `cascade` because an restaurant removing an item
    -- must not erase the orders containing it
    menu_item_id uuid
        references public.menu_items(id) on delete set null,
    -- We copy rather than join because if menu items are later deleted or re-priced, the
    -- order in history must not change.
    name text not null
        check (char_length(btrim(name)) between 1 and 80),
    price numeric(10, 2) not null
        check (price > 0),
    quantity integer not null
        check (quantity between 1 and 20),
    unique (order_id, menu_item_id)
);

create index order_items_order_id_idx on public.order_items (order_id);

create index order_items_menu_item_id_idx on public.order_items (menu_item_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

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
