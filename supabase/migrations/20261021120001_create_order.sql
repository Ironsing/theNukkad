-- Placing an order, in one place and in one transaction.
--
-- Students have no insert on public.orders or public.order_items; this function
-- is their way in. It exists because two things have to be true that a request
-- cannot be trusted with. One: every line's price is the menu's price at this
-- moment, not whatever the request said it was. Two: an order with no lines, or
-- with a line from another outlet's menu, is never written at all - a plain
-- insert from the app gets neither, and leaves a half-written order behind
-- whenever the second request fails.
--
-- Three more refusals live here, all of them states the app has already seen and
-- may already be wrong about by the time a request lands: an outlet that is no
-- longer there at all, an outlet that has switched itself closed, and a line the
-- outlet has taken off its menu. The outlet's hours are not read - closed is the
-- outlet's own hand on the switch, and its hours are what it says about itself.
--
-- It is also where the one limit lives, and it is a check rather than a
-- constraint because no expression means "within the last minute" in an index a
-- later row could be compared against. Being the only door is what makes that
-- safe, and the lock below is what makes it exact.
create function public.create_order(
    p_restaurant_id uuid,
    p_notes text,
    p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    new_order_id uuid;
    written integer;
begin
    -- The role check the policies would have made. Everything below runs as the
    -- definer and so past row level security, which is why it has to be said
    -- here: without it a restaurant could order from a restaurant, and the
    -- student_id below would be its own account.
    if not public.is_student_account() then
        raise exception 'only a student can place an order'
            using errcode = 'insufficient_privilege';
    end if;

    -- The next three refusals sit above the lock and the cooldown on purpose: they
    -- are about the target of the request rather than about this student's own
    -- requests, so they need no serialising, and "that outlet has closed" is a
    -- truer complaint than a rate limit the caller may also be under. All are
    -- read here rather than by the app, and as the definer, so it is the row's
    -- real state and not whatever the app's last render saw.
    --
    -- First of them, that there is an outlet at all. Neither refusal below can see
    -- this: an outlet that was never there, or has since been deleted with its
    -- account, answers no to "is it closed" and no to "does it sell this". Without
    -- it the insert below is the first statement to ask, and a constraint's way of
    -- answering is to name itself. A null id lands here too, which is why the
    -- insert can assume one resolves, and the errcode is the constraint's own -
    -- what a caller sees changes in what it says, not in what it is.
    if not exists (
        select 1
        from public.restaurant_info r
        where r.id = p_restaurant_id
    ) then
        raise exception 'no such outlet'
            using errcode = 'foreign_key_violation';
    end if;

    if exists (
        select 1
        from public.restaurant_info r
        where r.id = p_restaurant_id
            and r.status = 'closedManually'
    ) then
        raise exception 'that outlet has closed for now'
            using errcode = 'P0001';
    end if;

    -- Separate from the join below because the two refusals are different
    -- sentences: an item off this outlet's menu entirely, or another outlet's, is
    -- the join's complaint, and this one is an item that is on the menu but taken
    -- off it for now. An unavailable item from another outlet is not caught here,
    -- and should not be: the accurate complaint is that it is not on this menu.
    if exists (
        select 1
        from jsonb_array_elements(p_items) as line
        join public.menu_items m
            on m.id = (line ->> 'menu_item_id')::uuid
            and m.restaurant_id = p_restaurant_id
        where not m.available
    ) then
        raise exception 'one of those items is sold out'
            using errcode = 'P0001';
    end if;

    -- One student's requests run one at a time, from here to the end of the
    -- transaction. The check below reads a snapshot, so without this two requests
    -- arriving in the same instant would both read the state as it was before the
    -- other's insert - which is the whole of what "advisory" warns about: the
    -- lock is the server's, but asking for it is ours. The key is the student, so
    -- only their own concurrent requests ever wait, and the key is a 32-bit hash,
    -- so two students will occasionally collide and wait on each other for the
    -- length of a single insert. That is a wait, never a wrong answer, and it is
    -- released for us at commit, so no request can leave it behind.
    perform pg_advisory_xact_lock(hashtext((select auth.uid())::text)::bigint);

    -- The cooldown, across every outlet rather than one. It counts orders placed,
    -- not requests refused, so a refusal does not push the window along, and an
    -- order the outlet has already cooked still counts - the minute is about how
    -- fast an account can order, not about how much it has outstanding. now() is
    -- the database's clock.
    if exists (
        select 1
        from public.orders
        where student_id = (select auth.uid())
            and created_at > now() - interval '1 minute'
    ) then
        raise exception 'only one order a minute'
            using errcode = 'P0001';
    end if;

    insert into public.orders (student_id, restaurant_id, notes)
    values ((select auth.uid()), p_restaurant_id, coalesce(p_notes, ''))
    returning id into new_order_id;

    -- The lines, priced by the menu rather than by the request: the join is what
    -- supplies name and price, and `m.restaurant_id = p_restaurant_id` is what
    -- refuses an item off another outlet's menu.
    insert into public.order_items (order_id, menu_item_id, name, price, quantity)
    select
        new_order_id,
        m.id,
        m.name,
        m.price,
        (line ->> 'quantity')::integer
    from jsonb_array_elements(p_items) as line
    join public.menu_items m
        on m.id = (line ->> 'menu_item_id')::uuid
        and m.restaurant_id = p_restaurant_id;

    get diagnostics written = row_count;

    -- Whatever the join didn't match - an item that isn't on this outlet's menu,
    -- a line with a malformed id - makes this a request to write an order other
    -- than the one that was asked for. Raising rolls back the insert above with
    -- it, so an order without its lines is not a state this table can be left
    -- in. The first half of the condition is the empty order, which matches
    -- everything and writes nothing: it is the one case the count alone can't
    -- see, since zero lines is what zero lines were asked for.
    if written = 0 or written <> jsonb_array_length(p_items) then
        raise exception 'every line must be an item on that outlet''s menu'
            using errcode = 'foreign_key_violation';
    end if;

    return new_order_id;
end;
$$;

-- Public by default, and local Supabase additionally grants new functions to
-- anon and authenticated by name rather than through PUBLIC, so both have to go:
-- nothing but the app's signed-in accounts calls this, and the role check above
-- is what decides which of those may. It fails closed either way - a signed-out
-- caller reaches the check with no auth.uid() and is refused - so this is the
-- error a signed-out caller deserves rather than a hole.
revoke execute on function public.create_order(uuid, text, jsonb) from public;
revoke execute on function public.create_order(uuid, text, jsonb) from anon;
grant execute on function public.create_order(uuid, text, jsonb) to authenticated;

