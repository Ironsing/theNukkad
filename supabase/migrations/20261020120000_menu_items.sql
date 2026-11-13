create table public.menu_items (
    id uuid primary key default gen_random_uuid(),
    restaurant_id uuid not null default auth.uid()
        references public.restaurant_info(id) on delete cascade,
    name text not null
        check (char_length(btrim(name)) between 1 and 80),
    -- No free items yet
    price numeric(10, 2) not null
        check (price > 0),
    -- This is free restaurant-chosen text.
    category text not null
        check (char_length(btrim(category)) between 1 and 40),
    diet text not null
        check (diet in ('veg', 'nonveg', 'egg')),
    -- Two *orthogonal subsets* of vegetarian, not diets of their own
    vegan boolean not null default false,
    jain boolean not null default false,
    calories integer
        check (calories between 1 and 5000),
    available boolean not null default true,
    constraint menu_items_vegan_is_veg check (diet = 'veg' or not vegan),
    constraint menu_items_jain_is_veg check (diet = 'veg' or not jain)
);

create index menu_items_restaurant_id_idx on public.menu_items (restaurant_id);

alter table public.menu_items enable row level security;

grant select, insert, update, delete on public.menu_items to authenticated;

create policy "Students can read every restaurant's menu"
on public.menu_items
for select
to authenticated
using (public.is_student_account());

create policy "Restaurants can read their own menu"
on public.menu_items
for select
to authenticated
using (public.is_restaurant_account() and restaurant_id = (select auth.uid()));

create policy "Restaurants can add to their own menu"
on public.menu_items
for insert
to authenticated
with check (public.is_restaurant_account() and restaurant_id = (select auth.uid()));

create policy "Restaurants can change their own menu"
on public.menu_items
for update
to authenticated
using (public.is_restaurant_account() and restaurant_id = (select auth.uid()))
with check (public.is_restaurant_account() and restaurant_id = (select auth.uid()));

-- Different to simply marking an item as unavailable for the day; this takes it off the menu.
create policy "Restaurants can remove from their own menu"
on public.menu_items
for delete
to authenticated
using (public.is_restaurant_account() and restaurant_id = (select auth.uid()));
