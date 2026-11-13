-- Preorders are created by students, beginning in the unknown state.
-- From there, restaurants can transition them to either rejected, which is a dead end,
-- or to accepted, from where they can be marked ready.
-- Preorders can't be created for more than 24 hours ahead.
-- Preorder OTPs use their own rolling 24h window to check for collisions, separate to the orders pool.
create table public.preorders (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null default auth.uid()
        references public.account_types(id) on delete cascade,
    restaurant_id uuid not null
        references public.restaurant_info(id) on delete cascade,
    notes text not null default ''
        check (char_length(notes) <= 200),
    -- When the student wants it: what the restaurant aims at, and nothing more.
    -- Nothing refuses a request cooked early or long after it, which is the late
    -- completions that are not handled yet.
    deadline timestamptz not null,
    status text not null default 'unknown'
        check (status in ('unknown', 'accepted', 'rejected', 'ready')),
    ready_at timestamptz,
    -- Preorder OTPs use their own pool rather than sharing with orders.
    otp text
        check (otp ~ '^[1-9][0-9]{3}$'),
    created_at timestamptz not null default now(),

    constraint preorders_is_for_later
        check (deadline > created_at),
    constraint preorders_is_within_a_day
        check (deadline <= created_at + interval '1 day'),
    constraint preorders_ready_and_status_agree
        check ((status = 'ready') = (ready_at is not null)),
    constraint preorders_ready_has_a_code
        check ((ready_at is null) = (otp is null))
);

create index preorders_student_id_created_at_idx
    on public.preorders (student_id, created_at desc);

create index preorders_restaurant_id_deadline_idx
    on public.preorders (restaurant_id, deadline);

create index preorders_restaurant_id_otp_idx
    on public.preorders (restaurant_id, otp)
    where otp is not null;

create table public.preorder_items (
    id uuid primary key default gen_random_uuid(),
    preorder_id uuid not null
        references public.preorders(id) on delete cascade,
    -- set null because an restaurant removing an item from its menu
    -- must not erase the requests containing it.
    menu_item_id uuid
        references public.menu_items(id) on delete set null,
    -- Copied rather than joined. A later rename or price change must not
    -- rewrite a request already made. This is also what keeps a line readable once
    -- menu_item_id is null.
    name text not null
        check (char_length(btrim(name)) between 1 and 80),
    price numeric(10, 2) not null
        check (price > 0),
    quantity integer not null
        check (quantity between 1 and 20),
    unique (preorder_id, menu_item_id)
);

create index preorder_items_preorder_id_idx
    on public.preorder_items (preorder_id);

create index preorder_items_menu_item_id_idx
    on public.preorder_items (menu_item_id);

alter table public.preorders enable row level security;
alter table public.preorder_items enable row level security;

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
