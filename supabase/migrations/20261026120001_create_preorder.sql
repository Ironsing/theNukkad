-- Placing a preorder, in one place and in one transaction.
--
-- Students have no insert on public.preorders or public.preorder_items; this
-- function is their way in, and it exists for the reasons create_order() does.
-- Every line's price has to be the menu's price at this moment rather than
-- whatever the request claimed it was, and a request with no lines, or with a
-- line off another outlet's menu, has to be written whole or not written at all -
-- a plain insert from the app gets neither, and leaves half a request behind
-- whenever the second request fails.
--
-- Deliberately not create_order() with a deadline on it. The two doors agree on
-- the role, the outlet, the prices and the cooldown, and differ in the two places
-- that matter, so they are two functions rather than one that branches: which
-- state a new row is born in, and what a request is refused for. A request for
-- later is refused by an outlet that has switched itself closed by hand, exactly
-- as an order is; it is *not* refused for an item that is sold out, because sold
-- out is what an item is today and a request is for tomorrow - the outlet's way
-- to say no to that is to reject it.
create function public.create_preorder(
    p_restaurant_id uuid,
    p_notes text,
    p_deadline timestamptz,
    p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    new_preorder_id uuid;
    written integer;
begin
    -- The role check the policies would have made. Everything below runs as the
    -- definer and so past row level security, which is why it has to be said here:
    -- without it a restaurant could place a request, and the student_id below
    -- would be its own account.
    if not public.is_student_account() then
        raise exception 'only a student can place a preorder'
            using errcode = 'insufficient_privilege';
    end if;

    -- The deadline, before the outlet is looked at at all: it is the one thing a
    -- request has that an order does not, and a time that has already gone is
    -- wrong whichever outlet it names. Two sentences rather than one, because
    -- "that time has passed" and "that is too far ahead" are different mistakes
    -- with different corrections. The table's own two checks say the same thing,
    -- which is what makes them exact rather than aspirational.
    if p_deadline is null then
        raise exception 'a preorder needs a time'
            using errcode = 'not_null_violation';
    end if;

    if p_deadline <= now() then
        raise exception 'that time has already passed'
            using errcode = 'P0001';
    end if;

    if p_deadline > now() + interval '1 day' then
        raise exception 'preorders are taken up to a day ahead'
            using errcode = 'P0001';
    end if;

    -- That there is an outlet at all, before anything else is said about it: an
    -- outlet that was never there, or has since been deleted with its account,
    -- answers no to "is it closed" and no to "does it sell this" - so without this
    -- the insert below is the first statement to ask, and a constraint's way of
    -- answering is to name itself. A null id lands here too, which is why the
    -- insert can assume one resolves, and the errcode is the constraint's own:
    -- what a caller sees changes in what it says, not in what it is.
    if not exists (
        select 1
        from public.restaurant_info r
        where r.id = p_restaurant_id
    ) then
        raise exception 'no such outlet'
            using errcode = 'foreign_key_violation';
    end if;

    -- And shut, if it is. The same refusal create_order() gives, and given for the
    -- same reason: a request is not the outlet's until it answers it, but an
    -- outlet with its own hand on the switch has said, for now, that it is taking
    -- nothing at all. Its hours are read here no more than they are there -
    -- closed is the outlet's own switch, and hours are what it says about itself.
    if exists (
        select 1
        from public.restaurant_info r
        where r.id = p_restaurant_id
            and r.status = 'closedManually'
    ) then
        raise exception 'that outlet has closed for now'
            using errcode = 'P0001';
    end if;

    -- One student's requests run one at a time, from here to the end of the
    -- transaction, for the reason create_order() takes the same lock: the check
    -- below reads a snapshot, so without it two requests arriving in the same
    -- instant would both read the state as it was before the other's insert - the
    -- whole of what "advisory" warns about is that the lock is the server's, but
    -- asking for it is ours. The key is the student, so only their own concurrent
    -- requests ever wait, and it is released for us at commit.
    --
    -- The same key rather than a second one, so an order and a request from one
    -- student also serialise against each other. That buys nothing and costs a
    -- wait of one insert's length, which is cheaper than a second key to keep in
    -- step with the first.
    perform pg_advisory_xact_lock(hashtext((select auth.uid())::text)::bigint);

    -- The cooldown, counted in this table alone: it is about how fast an account
    -- can ask, and asking for later is its own act - so a request does not spend
    -- an order's minute and an order does not spend a request's. It counts requests
    -- placed rather than requests refused, so a refusal does not push the window
    -- along, and one the outlet has already answered still counts. now() is the
    -- database's clock.
    if exists (
        select 1
        from public.preorders
        where student_id = (select auth.uid())
            and created_at > now() - interval '1 minute'
    ) then
        raise exception 'only one preorder a minute'
            using errcode = 'P0001';
    end if;

    -- Born unknown, which is what this whole table is for: nobody has answered it
    -- yet. Said out loud rather than left to the column's default, which is there
    -- as the backstop for anything else that ever writes one.
    insert into public.preorders (student_id, restaurant_id, notes, deadline, status)
    values (
        (select auth.uid()),
        p_restaurant_id,
        coalesce(p_notes, ''),
        p_deadline,
        'unknown'
    )
    returning id into new_preorder_id;

    -- The lines, priced by the menu rather than by the request: the join is what
    -- supplies name and price, and `m.restaurant_id = p_restaurant_id` is what
    -- refuses an item off another outlet's menu. Availability is deliberately not
    -- read here - see the note at the top of this file.
    insert into public.preorder_items (preorder_id, menu_item_id, name, price, quantity)
    select
        new_preorder_id,
        m.id,
        m.name,
        m.price,
        (line ->> 'quantity')::integer
    from jsonb_array_elements(p_items) as line
    join public.menu_items m
        on m.id = (line ->> 'menu_item_id')::uuid
        and m.restaurant_id = p_restaurant_id;

    get diagnostics written = row_count;

    -- Whatever the join didn't match - an item that is not on this outlet's menu,
    -- a line with a malformed id - makes this a request to write something other
    -- than what was asked for, and raising rolls back the insert above with it. So
    -- a request without its lines is not a state this table can be left in. The
    -- first half of the condition is the empty request, which matches everything
    -- and writes nothing: zero lines is what zero lines were asked for, and the
    -- count alone cannot see it.
    if written = 0 or written <> jsonb_array_length(p_items) then
        raise exception 'every line must be an item on that outlet''s menu'
            using errcode = 'foreign_key_violation';
    end if;

    return new_preorder_id;
end;
$$;

-- Public by default, and local Supabase additionally grants new functions to anon
-- and authenticated by name rather than through PUBLIC, so both have to go:
-- nothing but the app's signed-in accounts calls this, and the role check above is
-- what decides which of those may. It fails closed either way - a signed-out
-- caller reaches the check with no auth.uid() and is refused - so this is the
-- error a signed-out caller deserves rather than a hole.
revoke execute on function public.create_preorder(uuid, text, timestamptz, jsonb) from public;
revoke execute on function public.create_preorder(uuid, text, timestamptz, jsonb) from anon;
grant execute on function public.create_preorder(uuid, text, timestamptz, jsonb) to authenticated;
