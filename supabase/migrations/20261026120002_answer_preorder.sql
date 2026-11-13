create function public.ensure_preorder_is_unanswered(p_preorder_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
    answered text;
begin
    select p.status into answered
    from public.preorders p
    where p.id = p_preorder_id
        and p.restaurant_id = (select auth.uid())
    for update;

    if not found then
        raise exception 'no such preorder at this restaurant'
            using errcode = 'insufficient_privilege';
    end if;

    if answered <> 'unknown' then
        raise exception 'that preorder has already been answered'
            using errcode = 'P0001';
    end if;
end;
$$;

create function public.accept_preorder(p_preorder_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.is_restaurant_account() then
        raise exception 'only an restaurant can answer a preorder'
            using errcode = 'insufficient_privilege';
    end if;

    perform public.ensure_preorder_is_unanswered(p_preorder_id);

    update public.preorders
    set status = 'accepted'
    where id = p_preorder_id;
end;
$$;

create function public.reject_preorder(p_preorder_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.is_restaurant_account() then
        raise exception 'only an restaurant can answer a preorder'
            using errcode = 'insufficient_privilege';
    end if;

    perform public.ensure_preorder_is_unanswered(p_preorder_id);

    update public.preorders
    set status = 'rejected'
    where id = p_preorder_id;
end;
$$;

revoke execute on function public.ensure_preorder_is_unanswered(uuid) from public, anon, authenticated;

revoke execute on function public.accept_preorder(uuid) from public;
revoke execute on function public.accept_preorder(uuid) from anon;
grant execute on function public.accept_preorder(uuid) to authenticated;

revoke execute on function public.reject_preorder(uuid) from public;
revoke execute on function public.reject_preorder(uuid) from anon;
grant execute on function public.reject_preorder(uuid) to authenticated;
