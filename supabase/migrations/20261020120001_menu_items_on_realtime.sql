-- Menu changes streamed to whoever is looking, so an open menu follows a price
-- change or an item going sold out instead of polling for it.
--
-- Same division as restaurant_info's: the publication decides what Realtime
-- carries at all, and the policies decide who is sent each row. The note there
-- about deletes being the one thing Realtime cannot hold a policy against needed
-- nothing added for this table while no account could delete a menu item. An
-- outlet can remove one now, so the old record has to carry enough of itself to
-- be filtered - which is what the second half of this file is about.
alter publication supabase_realtime add table public.menu_items;

-- A delete's old record is what Realtime filters a subscription against, and with
-- the default replica identity it is the primary key and nothing more. Measured
-- against the local stack, with a student watching one outlet's menu: the page
-- subscribes with `restaurant_id=eq.<outlet>`, a payload carrying only an id has
-- no restaurant_id to match, and the delete never arrives - an item would go and
-- the page would not hear about it. With the whole record it arrives. What the
-- client is handed is still the id alone: it is the filter the wider record
-- serves, not the payload.
--
-- It does not make the policies apply to deletes, either. Realtime checks the
-- filter against a row that is gone, not a policy, so an outlet is told the id of
-- an item on another outlet's menu, which its policy shows it none of. An id is
-- all it is told, and an id for an item a page never had on screen folds away to
-- nothing, which is the whole of why that is harmless. The policies remain the
-- boundary for every read.
alter table public.menu_items replica identity full;
