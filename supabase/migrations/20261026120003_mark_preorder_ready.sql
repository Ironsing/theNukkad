-- Cooking a preorder, in one place and in one transaction.
--
-- The outlet's second door on a request, and reachable only from `accepted`: one
-- nobody has answered is not the outlet's to cook yet, and a rejected one never
-- will be. Which of those a row is, is the row as it *was* - the thing a function
-- can see and a check constraint cannot - so that refusal is here.
--
-- A function because the code has to be minted and minting is logic, exactly as
-- mark_order_ready() is. Its codes come from this table's pool alone, which is the
-- split described at the top of preorders.sql: an order's codes and a request's are
-- minted independently and may repeat across the two, and this is deliberately
-- untouched by the decision.
--
-- Nothing here reads the deadline. A request cooked before its time and one cooked
-- hours late are the same to this function, because handling late completions is
-- not implemented yet - and a function that quietly refused them would be deciding
-- that policy by accident.
create function public.mark_preorder_ready(p_preorder_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    -- How long a minted code is kept out of circulation: the window the orders
    -- use, for the reasons they give - long enough to outlive anything still on an
    -- outlet's screen, short enough that a busy outlet never fills the space.
    code_window constant interval := '1 day';
    existing_ready_at timestamptz;
    existing_otp text;
    existing_status text;
    code text;
begin
    -- The role check the policies would have made: without it a student could cook
    -- their own request and mint their own code.
    if not public.is_restaurant_account() then
        raise exception 'only an outlet can mark a preorder ready'
            using errcode = 'insufficient_privilege';
    end if;

    -- One outlet's codes are minted one at a time, from here to the end of the
    -- transaction, so the loop below cannot miss a code another till minted in the
    -- same instant. The key is the outlet, not the request: the set a new code has
    -- to be new against is the outlet's, so that is what has to be held.
    perform pg_advisory_xact_lock(hashtext((select auth.uid())::text)::bigint);

    -- Its own request, and no other's. Held for update so that a second request
    -- waits here rather than reading the row twice.
    select p.ready_at, p.otp, p.status
    into existing_ready_at, existing_otp, existing_status
    from public.preorders p
    where p.id = p_preorder_id
        and p.restaurant_id = (select auth.uid())
    for update;

    if not found then
        raise exception 'no such preorder at this outlet'
            using errcode = 'insufficient_privilege';
    end if;

    -- Already cooked. Returning the code it has rather than minting a second one is
    -- the whole of idempotence here: a double tap must not invalidate the code the
    -- student has just been told.
    if existing_ready_at is not null then
        return existing_otp;
    end if;

    -- Only a request the outlet has taken on can be cooked. After the return above
    -- rather than before it, and the two do not overlap: a row that is already
    -- ready is answered with its code, because by then the table's own checks have
    -- made `ready` and `ready_at` the same fact.
    if existing_status <> 'accepted' then
        raise exception 'that preorder has not been accepted'
            using errcode = 'P0001';
    end if;

    loop
        -- Four digits, no leading zero, from pgcrypto rather than random(): the
        -- code is a secret for as long as it is live, and digits predictable from
        -- an earlier one are worth nothing.
        code := (1000 + mod(
            ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint,
            9000
        ))::text;

        -- Against this table alone. An order's live code may be the same four
        -- digits, which is the cost of two pools accepted at the top of
        -- preorders.sql.
        exit when not exists (
            select 1
            from public.preorders p
            where p.restaurant_id = (select auth.uid())
                and p.otp = code
                and p.ready_at > now() - code_window
        );
    end loop;

    -- All three columns in one statement, because the table refuses a row that is
    -- ready without a time or a code, and this is the only place any of them is
    -- written.
    update public.preorders
    set ready_at = now(), otp = code, status = 'ready'
    where id = p_preorder_id;

    return code;
end;
$$;

-- Public by default, and local Supabase additionally grants new functions to anon
-- and authenticated by name rather than through PUBLIC, so both have to go: the
-- role check above is what decides which signed-in accounts may call it, and a
-- signed-out caller reaches it with no auth.uid() and is refused.
revoke execute on function public.mark_preorder_ready(uuid) from public;
revoke execute on function public.mark_preorder_ready(uuid) from anon;
grant execute on function public.mark_preorder_ready(uuid) to authenticated;
