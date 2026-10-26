-- Answering a preorder, in one place and in one transaction.
--
-- The outlet's way in, the way public.create_preorder() is the student's, and the
-- only two transitions out of `unknown`: accept, after which the request can be
-- cooked, or reject, which is the end of the row. Nothing leads out of `rejected`,
-- here or in any other function, and that is a fact about the whole set of doors
-- rather than about this file.
--
-- Neither of them reads the clock. A request can be answered before its deadline or
-- after it, and an outlet that let one go by can still take it on: handling late
-- answers is not implemented, and nothing here pretends otherwise.
--
-- Both refusals are sentences a page can show, and both are states the app may
-- already be wrong about by the time a request lands: a request that is not this
-- outlet's, and one that has already been answered.
create function public.accept_preorder(p_preorder_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    answered text;
begin
    -- The role check the policies would have made. Everything below runs as the
    -- definer and so past row level security, which is why it has to be said here:
    -- without it a student could accept their own request.
    if not public.is_restaurant_account() then
        raise exception 'only an outlet can answer a preorder'
            using errcode = 'insufficient_privilege';
    end if;

    -- Its own request, and no other's - the policy would have said
    -- restaurant_id = auth.uid(), and there is no policy here. Held for update so
    -- that a second request waits here rather than reading the row twice.
    select p.status into answered
    from public.preorders p
    where p.id = p_preorder_id
        and p.restaurant_id = (select auth.uid())
    for update;

    if not found then
        raise exception 'no such preorder at this outlet'
            using errcode = 'insufficient_privilege';
    end if;

    -- Answered once, and only once. A request already accepted, already refused, or
    -- already cooked is not answerable again: the first answer is the one the
    -- student was told, and a second could only take it back. This is about the row
    -- as it was rather than as it is, which is what a function can see and a check
    -- constraint cannot - so the table states which states exist, and this states
    -- which moves are possible.
    if answered <> 'unknown' then
        raise exception 'that preorder has already been answered'
            using errcode = 'P0001';
    end if;

    update public.preorders
    set status = 'accepted'
    where id = p_preorder_id;
end;
$$;

-- Its twin, and the one that ends a row. Same gate, same ownership, same single
-- write, and deliberately nothing else: there is no reason recorded for a refusal,
-- because `rejected` is a dead end and a reason is something somebody would read.
-- Nothing anywhere reads it back out again.
create function public.reject_preorder(p_preorder_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    answered text;
begin
    if not public.is_restaurant_account() then
        raise exception 'only an outlet can answer a preorder'
            using errcode = 'insufficient_privilege';
    end if;

    select p.status into answered
    from public.preorders p
    where p.id = p_preorder_id
        and p.restaurant_id = (select auth.uid())
    for update;

    if not found then
        raise exception 'no such preorder at this outlet'
            using errcode = 'insufficient_privilege';
    end if;

    if answered <> 'unknown' then
        raise exception 'that preorder has already been answered'
            using errcode = 'P0001';
    end if;

    update public.preorders
    set status = 'rejected'
    where id = p_preorder_id;
end;
$$;

-- Both doors granted the same way, and both revoked the same way: public by
-- default, and local Supabase additionally grants new functions to anon and
-- authenticated by name rather than through PUBLIC. The role check inside each is
-- what decides which signed-in accounts may answer a request, and a signed-out
-- caller reaches it with no auth.uid() and is refused.
revoke execute on function public.accept_preorder(uuid) from public;
revoke execute on function public.accept_preorder(uuid) from anon;
grant execute on function public.accept_preorder(uuid) to authenticated;

revoke execute on function public.reject_preorder(uuid) from public;
revoke execute on function public.reject_preorder(uuid) from anon;
grant execute on function public.reject_preorder(uuid) to authenticated;
