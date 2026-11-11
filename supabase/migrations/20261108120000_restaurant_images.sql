create policy "Restaurants can find their own pictures"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'restaurants'
    and public.is_restaurant_account()
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Restaurants can upload their own pictures"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'restaurants'
    and public.is_restaurant_account()
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Restaurants can replace their own pictures"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'restaurants'
    and public.is_restaurant_account()
    and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
    bucket_id = 'restaurants'
    and public.is_restaurant_account()
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Restaurants can remove their own pictures"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'restaurants'
    and public.is_restaurant_account()
    and (storage.foldername(name))[1] = (select auth.uid())::text
);
