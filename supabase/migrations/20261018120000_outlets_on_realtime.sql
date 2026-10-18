-- Outlet changes streamed to whoever is looking, so an open page reacts to an
-- outlet opening, closing or re-timing itself instead of polling for it.
--
-- The publication is what makes Realtime carry this table at all; it exists in
-- every Supabase project, and a table joins it by being named here. It grants
-- nothing: Realtime runs the same row level security policies this schema
-- already has against each subscriber, so a student is sent what it may read and
-- a restaurant only its own row. The policies remain the boundary, and this line
-- is only about delivery.
alter publication supabase_realtime add table public.restaurant_info;

-- Two things measured against a local stack, for whoever reads this next.
--
-- One: deletes are the exception to the policies. Realtime cannot check a policy
-- against a row that no longer exists, so a delete reaches every subscriber -
-- including a restaurant, which is told an outlet id it may not read. That is
-- harmless only because nothing can delete: no account has a delete policy. Let
-- one in and it stops being harmless, and `alter table public.restaurant_info
-- replica identity full;` is what gives the old record enough of itself to be
-- checked.
--
-- Two: a subscriber can miss changes made in the second or so after it
-- subscribes, while the server is still setting the subscription up. Being
-- subscribed is not yet being caught up, so the first fetch is not made
-- redundant by it.

