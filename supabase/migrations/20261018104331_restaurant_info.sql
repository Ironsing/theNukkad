create table public.restaurant_info (
    id uuid primary key default auth.uid()
        references public.account_types(id) on delete cascade,
    name text not null
        check (char_length(btrim(name)) between 1 and 80),
    -- Held as clock values rather than user-facing strings ("7:00 AM to 8:00 PM").
    -- Both times are set together.
    opens_at time not null,
    closes_at time not null,
    -- Contact details and pickup location. Phone is mandatory; email and
    -- address are optional.
    phone text not null,
    email text,
    address text,
    -- Whether the restaurant is running to its set hours ("normal") or has been shut by
    -- manually ("closedManually"). This *isn't* derived from the hours above.
    status text not null default 'normal'
        check (status in ('normal', 'closedManually')),
    constraint opening_hours_are_a_pair
        check ((opens_at is null) = (closes_at is null))
);

-- Checks if the connected client is a restaurant account
create function public.is_restaurant_account()
returns boolean
language sql
stable
set search_path = ''
as $$
    select exists (
        select 1
        from public.account_types
        where id = (select auth.uid())
            and type = 'restaurant'
    );
$$;

-- Likewise for student account
create function public.is_student_account()
returns boolean
language sql
stable
set search_path = ''
as $$
    select exists (
        select 1
        from public.account_types
        where id = (select auth.uid())
            and type = 'student'
    );
$$;

alter table public.restaurant_info enable row level security;

grant select, insert, update on public.restaurant_info to authenticated;

create policy "Students can read every restaurant's info"
on public.restaurant_info
for select
to authenticated
using (public.is_student_account());

create policy "Restaurants can read their own info"
on public.restaurant_info
for select
to authenticated
using (public.is_restaurant_account() and id = (select auth.uid()));

create policy "Restaurants can add their own info"
on public.restaurant_info
for insert
to authenticated
with check (public.is_restaurant_account() and id = (select auth.uid()));

create policy "Restaurants can change their own info"
on public.restaurant_info
for update
to authenticated
using (public.is_restaurant_account() and id = (select auth.uid()))
with check (public.is_restaurant_account() and id = (select auth.uid()));
