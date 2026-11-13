create function public.ensure_deadline_is_for_later(p_deadline timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
begin
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
end;
$$;

-- The preorders and orders ratelimits are separate.
create function public.ensure_within_preorder_rate_limit()
returns void
language plpgsql
set search_path = ''
as $$
begin
    perform pg_advisory_xact_lock(hashtext((select auth.uid())::text)::bigint);

    if exists (
        select 1
        from public.preorders
        where student_id = (select auth.uid())
            and created_at > now() - interval '1 minute'
    ) then
        raise exception 'only one preorder a minute'
            using errcode = 'P0001';
    end if;
end;
$$;

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
    if not public.is_student_account() then
        raise exception 'only a student can place a preorder'
            using errcode = 'insufficient_privilege';
    end if;

    perform public.ensure_deadline_is_for_later(p_deadline);
    perform public.ensure_restaurant_exists(p_restaurant_id);
    perform public.ensure_restaurant_not_shut_by_hand(p_restaurant_id);
    perform public.ensure_within_preorder_rate_limit();

    -- Unknown: nobody has answered it yet.
    insert into public.preorders (student_id, restaurant_id, notes, deadline, status)
    values (
        (select auth.uid()),
        p_restaurant_id,
        coalesce(p_notes, ''),
        p_deadline,
        'unknown'
    )
    returning id into new_preorder_id;

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

    if written = 0 or written <> jsonb_array_length(p_items) then
        raise exception 'every line must be an item on that restaurant''s menu'
            using errcode = 'foreign_key_violation';
    end if;

    return new_preorder_id;
end;
$$;

revoke execute on function public.ensure_deadline_is_for_later(timestamptz) from public, anon, authenticated;
revoke execute on function public.ensure_within_preorder_rate_limit() from public, anon, authenticated;
revoke execute on function public.create_preorder(uuid, text, timestamptz, jsonb) from public;
revoke execute on function public.create_preorder(uuid, text, timestamptz, jsonb) from anon;

grant execute on function public.create_preorder(uuid, text, timestamptz, jsonb) to authenticated;
