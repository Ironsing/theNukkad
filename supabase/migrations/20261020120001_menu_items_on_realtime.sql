-- Menu changes streamed to whoever is looking, so an open menu follows a price
-- change or an item going sold out instead of polling for it.
--
-- Same division as restaurant_info's: the publication decides what Realtime
-- carries at all, and the policies decide who is sent each row. The note there
-- about deletes being the one thing Realtime cannot hold a policy against needs
-- nothing added for this table - no account can delete a menu item either, so
-- there is still nothing to leak.
alter publication supabase_realtime add table public.menu_items;
