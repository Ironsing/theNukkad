alter publication supabase_realtime add table public.restaurant_info;

-- A subscriber seem to miss changes made in the second or so after subscribing,
-- while the server is still setting the subscription up. Being
-- subscribed is not being caught up.
