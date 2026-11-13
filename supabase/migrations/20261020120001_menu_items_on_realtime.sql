alter publication supabase_realtime add table public.menu_items;

alter table public.menu_items replica identity full;
