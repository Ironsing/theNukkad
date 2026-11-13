create function public.ensure_restaurant_exists(p_restaurant_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
    if not exists (
        select 1
        from public.restaurant_info r
        where r.id = p_restaurant_id
    ) then
        raise exception 'no such restaurant'
            using errcode = 'foreign_key_violation';
    end if;
end;
$$;

create function public.ensure_restaurant_not_shut_by_hand(p_restaurant_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
    if exists (
        select 1
        from public.restaurant_info r
        where r.id = p_restaurant_id
            and r.status = 'closedManually'
    ) then
        raise exception 'that restaurant has closed for now'
            using errcode = 'P0001';
    end if;
end;
$$;

create function public.ensure_items_available(
    p_restaurant_id uuid,
    p_items jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
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
end;
$$;

-- One order per minute.
create function public.ensure_within_rate_limit()
returns void
language plpgsql
set search_path = ''
as $$
begin
    -- One student's requests run one at a time, from here to the end of the transaction.
    perform pg_advisory_xact_lock(hashtext((select auth.uid())::text)::bigint);

    if exists (
        select 1
        from public.orders
        where student_id = (select auth.uid())
            and created_at > now() - interval '1 minute'
    ) then
        raise exception 'only one order a minute'
            using errcode = 'P0001';
    end if;
end;
$$;

-- Nobody has insert permissions on the orders table. This function is the one way to make an order.
-- Because of it, the client can't just make up prices, and it handles other checks:
-- 1. Can't order from a nonexistent restaurant
-- 2. Can't order from an restaurant that's been manually shut
-- 3. Can't place an order containing sold out items
-- 4. A rate limit
-- and so on.
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
    if not public.is_student_account() then
        raise exception 'only a student can place an order'
            using errcode = 'insufficient_privilege';
    end if;

    perform public.ensure_restaurant_exists(p_restaurant_id);
    perform public.ensure_restaurant_not_shut_by_hand(p_restaurant_id);
    perform public.ensure_items_available(p_restaurant_id, p_items);
    perform public.ensure_within_rate_limit();

    insert into public.orders (student_id, restaurant_id, notes)
    values ((select auth.uid()), p_restaurant_id, coalesce(p_notes, ''))
    returning id into new_order_id;

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

    if written = 0 or written <> jsonb_array_length(p_items) then
        raise exception 'every line must be an item on that restaurant''s menu'
            using errcode = 'foreign_key_violation';
    end if;

    return new_order_id;
end;
$$;


revoke execute on function public.ensure_restaurant_exists(uuid) from public, anon, authenticated;
revoke execute on function public.ensure_restaurant_not_shut_by_hand(uuid) from public, anon, authenticated;
revoke execute on function public.ensure_items_available(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.ensure_within_rate_limit() from public, anon, authenticated;
revoke execute on function public.create_order(uuid, text, jsonb) from public;
revoke execute on function public.create_order(uuid, text, jsonb) from anon;

grant execute on function public.create_order(uuid, text, jsonb) to authenticated;
