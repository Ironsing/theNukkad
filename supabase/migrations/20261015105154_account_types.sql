create table public.account_types (
    id uuid primary key references auth.users(id) on delete cascade,
    type text not null default 'student'
        check (type in ('student', 'restaurant'))
);

-- Automatically give new GoTrue accounts a 'student' account type.
-- Restaurant accounts are created manually right now.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.account_types (id, type)
    values (new.id, 'student');

    return new;
end;
$$;

create trigger on_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

alter table public.account_types enable row level security;

grant select on public.account_types to authenticated;

create policy "Users can read their own account type"
on public.account_types
for select
to authenticated
using ((select auth.uid()) = id);
