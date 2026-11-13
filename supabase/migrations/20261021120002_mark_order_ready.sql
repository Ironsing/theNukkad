create function public.ensure_order_exists(
    p_order_id uuid,
    out ready_at timestamptz,
    out otp text
)
language plpgsql
set search_path = ''
as $$
begin
    select o.ready_at, o.otp
    into ready_at, otp
    from public.orders o
    where o.id = p_order_id
        and o.restaurant_id = (select auth.uid())
    for update;

    if not found then
        raise exception 'no such order at this restaurant'
            using errcode = 'insufficient_privilege';
    end if;
end;
$$;

create function public.generate_order_otp()
returns text
language plpgsql
set search_path = ''
as $$
declare
    -- OTPs must be unique within this window.
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
            from public.orders o
            where o.restaurant_id = (select auth.uid())
                and o.otp = code
                and o.ready_at > now() - code_window
        );
    end loop;

    return code;
end;
$$;

-- Checks:
-- 1. Whether such an order exists
-- 2. Whether the generated OTP collides with another in the past day (and if so, regenerates)
create function public.mark_order_ready(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    existing_ready_at timestamptz;
    existing_otp text;
    new_otp text;
begin
    if not public.is_restaurant_account() then
        raise exception 'only an restaurant can mark an order ready'
            using errcode = 'insufficient_privilege';
    end if;

    select * into existing_ready_at, existing_otp
    from public.ensure_order_exists(p_order_id);

    -- Idempotence.
    if existing_ready_at is not null then
        return existing_otp;
    end if;

    new_otp := public.generate_order_otp();

    update public.orders
    set ready_at = now(), otp = new_otp
    where id = p_order_id;

    return new_otp;
end;
$$;

revoke execute on function public.ensure_order_exists(uuid) from public, anon, authenticated;
revoke execute on function public.generate_order_otp() from public, anon, authenticated;

revoke execute on function public.mark_order_ready(uuid) from public;
revoke execute on function public.mark_order_ready(uuid) from anon;

grant execute on function public.mark_order_ready(uuid) to authenticated;
