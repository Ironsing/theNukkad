create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role text not null default 'student'
        check (role in ('student', 'restaurant'))
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, role)
    values (new.id, 'student');

    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);
