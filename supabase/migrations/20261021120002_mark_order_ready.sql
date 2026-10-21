-- Cooking an order, in one place and in one transaction.
--
-- The outlet's way in, the way public.create_order() is the student's, and a
-- function for the same reason: the code has to be minted, and minting is logic.
-- A trigger could have done it, but a trigger would have needed the lock and the
-- retry loop and the ownership test inside it, and here those read as what they
-- are.
--
-- The code is the student's to say and the outlet's to check, and it is the only
-- thing between a student and someone else's food. Its uniqueness is deliberately
-- not a constraint: no index predicate can say "in the last day", and a plain
-- unique index would exhaust a four-digit space permanently after 9000 orders at
-- one outlet. So it is a check, made exact by the same kind of lock
-- create_order() takes, keyed on the outlet instead of the student.
create function public.mark_order_ready(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    -- How long a minted code is kept out of circulation. Long enough to outlive
    -- anything still on an outlet's screen, short enough that a busy outlet never
    -- fills the space: a day at 300 orders uses 300 of the 9000.
    code_window constant interval := '1 day';
    existing_ready_at timestamptz;
    existing_otp text;
    code text;
begin
    -- The role check the policies would have made. Everything below runs as the
    -- definer and so past row level security, which is why it has to be said
    -- here: without it a student could cook their own order and mint their own
    -- code.
    if not public.is_restaurant_account() then
        raise exception 'only an outlet can mark an order ready'
            using errcode = 'insufficient_privilege';
    end if;

    -- One outlet's codes are minted one at a time, from here to the end of the
    -- transaction, so the loop below cannot miss a code another till minted in
    -- the same instant. The key is the outlet, not the order: the set a new code
    -- has to be new against is the outlet's, so that is what has to be held.
    perform pg_advisory_xact_lock(hashtext((select auth.uid())::text)::bigint);

    -- Its own order, and no other's - the policy would have said
    -- restaurant_id = auth.uid(), and there is no policy here. Held for update so
    -- that a second request waits here rather than reading the row twice.
    select o.ready_at, o.otp into existing_ready_at, existing_otp
    from public.orders o
    where o.id = p_order_id
        and o.restaurant_id = (select auth.uid())
    for update;

    if not found then
        raise exception 'no such order at this outlet'
            using errcode = 'insufficient_privilege';
    end if;

    -- Already cooked. Returning the code it has rather than minting a second one
    -- is the whole of idempotence here: a double tap must not invalidate the code
    -- the student has just been told.
    if existing_ready_at is not null then
        return existing_otp;
    end if;

    loop
        -- Four digits, no leading zero, from pgcrypto rather than random(): the
        -- code is a secret for as long as it is live, and digits predictable from
        -- an earlier one are worth nothing.
        code := (1000 + mod(
            ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint,
            9000
        ))::text;

        exit when not exists (
            select 1
            from public.orders o
            where o.restaurant_id = (select auth.uid())
                and o.otp = code
                and o.ready_at > now() - code_window
        );
    end loop;

    -- Both columns in one statement, because the table refuses one without the
    -- other, and this is the only place either is ever written.
    update public.orders
    set ready_at = now(), otp = code
    where id = p_order_id;

    return code;
end;
$$;

-- Public by default, and local Supabase additionally grants new functions to
-- anon and authenticated by name rather than through PUBLIC, so both have to go:
-- the role check above is what decides which signed-in accounts may call it, and
-- a signed-out caller reaches it with no auth.uid() and is refused.
revoke execute on function public.mark_order_ready(uuid) from public;
revoke execute on function public.mark_order_ready(uuid) from anon;
grant execute on function public.mark_order_ready(uuid) to authenticated;
