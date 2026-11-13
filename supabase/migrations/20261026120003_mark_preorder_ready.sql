-- Reachable only from accepted, of course.
create function public.ensure_preorder_exists(
    p_preorder_id uuid,
    out ready_at timestamptz,
    out otp text,
    out status text
)
language plpgsql
set search_path = ''
as $$
begin
    select p.ready_at, p.otp, p.status
    into ready_at, otp, status
    from public.preorders p
    where p.id = p_preorder_id
        and p.restaurant_id = (select auth.uid())
    for update;

    if not found then
        raise exception 'no such preorder at this restaurant'
            using errcode = 'insufficient_privilege';
    end if;
end;
$$;

create function public.generate_preorder_otp()
returns text
language plpgsql
set search_path = ''
as $$
declare
    code_window constant interval := '1 day';
    code text;
begin
    perform pg_advisory_xact_lock(hashtext((select auth.uid())::text)::bigint);

    loop
        code := (1000 + mod(
            ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint,
            9000
        ))::text;

        exit when not exists (
            select 1
            from public.preorders p
            where p.restaurant_id = (select auth.uid())
                and p.otp = code
                and p.ready_at > now() - code_window
        );
    end loop;

    return code;
end;
$$;

create function public.mark_preorder_ready(p_preorder_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    existing_ready_at timestamptz;
    existing_otp text;
    existing_status text;
    new_otp text;
begin
    if not public.is_restaurant_account() then
        raise exception 'only an restaurant can mark a preorder ready'
            using errcode = 'insufficient_privilege';
    end if;

    select * into existing_ready_at, existing_otp, existing_status
    from public.ensure_preorder_exists(p_preorder_id);

    -- Idempotence.
    if existing_ready_at is not null then
        return existing_otp;
    end if;

    if existing_status <> 'accepted' then
        raise exception 'that preorder has not been accepted'
            using errcode = 'P0001';
    end if;

    new_otp := public.generate_preorder_otp();

    update public.preorders
    set ready_at = now(), otp = new_otp, status = 'ready'
    where id = p_preorder_id;

    return new_otp;
end;
$$;

revoke execute on function public.ensure_preorder_exists(uuid) from public, anon, authenticated;
revoke execute on function public.generate_preorder_otp() from public, anon, authenticated;

revoke execute on function public.mark_preorder_ready(uuid) from public;
revoke execute on function public.mark_preorder_ready(uuid) from anon;
grant execute on function public.mark_preorder_ready(uuid) to authenticated;
