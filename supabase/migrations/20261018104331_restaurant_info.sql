-- The information students see about an outlet. One row per restaurant account:
-- the primary key is the account itself, so an account can have at most one row,
-- a row cannot outlive its account, and an object storage path can key off it.
create table public.restaurant_info (
    -- The account itself, so an insert that forgets the owner lands on the
    -- signed-in account rather than failing on null or, worse, landing on
    -- someone else's. The policies check it either way.
    id uuid primary key default auth.uid()
        references public.profiles(id) on delete cascade,
    name text not null
        check (char_length(btrim(name)) between 1 and 80),
    -- One daily range so far, held as clock values rather than as the string the
    -- app shows ("8:00 AM to 7:00 PM"): the type refuses anything that isn't a
    -- time, and comparing them later needs no parsing. Null together when the
    -- restaurant hasn't said, and closes_at may be earlier than opens_at for a
    -- range that runs past midnight.
    -- Opening hours are mandatory: both times are set together.
    opens_at time not null,
    closes_at time not null,
    -- Contact details and pickup location. Phone is mandatory; email and
    -- address are optional.
    phone text not null,
    email text,
    address text,
    -- Whether the outlet is running to its hours ("normal") or has been shut by
    -- hand ("closedManually"). Not derived from the hours above: a manually
    -- closed outlet keeps whatever hours it has.
    status text not null default 'normal'
        check (status in ('normal', 'closedManually')),
    constraint opening_hours_are_a_pair
        check ((opens_at is null) = (closes_at is null))
);

-- Which account type is asking. Both read the caller's own profile row, the only
-- one profiles' policy shows them, so this can't be spoofed from the API; if that
-- policy ever changes, these fail closed.
create function public.is_restaurant_account()
returns boolean
language sql
stable
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles
        where id = (select auth.uid())
            and role = 'restaurant'
    );
$$;

create function public.is_student_account()
returns boolean
language sql
stable
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles
        where id = (select auth.uid())
            and role = 'student'
    );
$$;

alter table public.restaurant_info enable row level security;

-- Local Supabase hands new tables to anon and authenticated by default, so these
-- grants are not what keeps anyone out - the policies are. They only record what
-- the API is meant to do: read for anyone with a session, and no delete for
-- anyone (an outlet's info goes when its account does).
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

