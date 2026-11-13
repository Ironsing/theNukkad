-- Local fixtures: one student, four restaurants with menus.
-- Every account signs in with the password `password123`.

do $$
declare
    fixture record;
    account_id uuid;
begin
    for fixture in
        select * from (values
            ('chaat@nukkad.test', 'restaurant'),
            ('dosa@nukkad.test', 'restaurant'),
            ('momo@nukkad.test', 'restaurant'),
            ('chai@nukkad.test', 'restaurant'),
            ('student@nukkad.test', 'student')
        ) as account(email, type)
    loop
        select id into account_id from auth.users where email = fixture.email;

        if account_id is null then
            account_id := gen_random_uuid();

            -- What GoTrue itself writes.
            insert into auth.users (
                instance_id,
                id,
                aud,
                role,
                email,
                encrypted_password,
                email_confirmed_at,
                raw_app_meta_data,
                raw_user_meta_data,
                created_at,
                updated_at,
                confirmation_token,
                recovery_token,
                email_change_token_new,
                email_change
            )
            values (
                '00000000-0000-0000-0000-000000000000',
                account_id,
                'authenticated',
                'authenticated',
                fixture.email,
                extensions.crypt('password123', extensions.gen_salt('bf')),
                now(),
                '{"provider": "email", "providers": ["email"]}'::jsonb,
                '{}'::jsonb,
                now(),
                now(),
                '', '', '', ''
            );

            insert into auth.identities (
                provider_id,
                user_id,
                identity_data,
                provider,
                last_sign_in_at,
                created_at,
                updated_at
            )
            values (
                account_id::text,
                account_id,
                jsonb_build_object(
                    'sub', account_id::text,
                    'email', fixture.email,
                    'email_verified', true
                ),
                'email',
                now(),
                now(),
                now()
            );
        end if;

        -- The account arrives with its account type row, as the trigger makes
        -- it - a student. Which app signs in is what says otherwise.
        update public.account_types set type = fixture.type where id = account_id;
    end loop;
end $$;

insert into public.restaurant_info (
    id, name, phone, email, address, opens_at, closes_at, status
)
select
    account.id,
    restaurant.name,
    restaurant.phone,
    restaurant.email,
    restaurant.address,
    restaurant.opens_at::time,
    restaurant.closes_at::time,
    restaurant.status
from (values
    (
        'chaat@nukkad.test', 'Chaat Chowk', '+91 98100 11001',
        'chaatchowk@nukkad.example',
        'Block A, Ground Floor, Mess Complex', '09:00', '20:00', 'normal'
    ),
    (
        'dosa@nukkad.test', 'Dosa Junction', '+91 98100 11002',
        'dosajunction@nukkad.example',
        'Food Court, beside Gate 2', '07:30', '22:00', 'normal'
    ),
    (
        'momo@nukkad.test', 'Momo Mafia', '+91 98100 11003',
        'momomafia@nukkad.example',
        'Block D Lawn, near the Amphitheatre', '11:00', '23:30', 'normal'
    ),
    (
        'chai@nukkad.test', 'Chai Adda', '+91 98100 11004',
        'chaiadda@nukkad.example',
        'Library Block, Ground Floor', '06:00', '23:00', 'closedManually'
    )
) as restaurant(account_email, name, phone, email, address, opens_at, closes_at, status)
join auth.users as account on account.email = restaurant.account_email
on conflict (id) do update set
    name = excluded.name,
    phone = excluded.phone,
    email = excluded.email,
    address = excluded.address,
    opens_at = excluded.opens_at,
    closes_at = excluded.closes_at,
    status = excluded.status;

insert into public.menu_items (
    restaurant_id, name, price, category, diet, vegan, jain, calories, available
)
select
    restaurant.id,
    item.name,
    item.price,
    item.category,
    item.diet,
    item.vegan,
    item.jain,
    item.calories,
    item.available
from (values
    ('Chaat Chowk', 'Pani Puri', 40.00, 'Chaat', 'veg', true, false, 210, true),
    ('Chaat Chowk', 'Bhel Puri', 50.00, 'Chaat', 'veg', true, true, 260, true),
    ('Chaat Chowk', 'Aloo Tikki', 60.00, 'Chaat', 'veg', false, false, 320, true),
    ('Chaat Chowk', 'Papdi Chaat', 70.00, 'Chaat', 'veg', false, false, 380, true),
    ('Chaat Chowk', 'Samosa (2 pcs)', 30.00, 'Snacks', 'veg', true, false, 300, true),
    ('Chaat Chowk', 'Masala Chaas', 25.00, 'Drinks', 'veg', false, false, 90, false),
    ('Dosa Junction', 'Plain Dosa', 60.00, 'Dosa', 'veg', true, false, 310, true),
    ('Dosa Junction', 'Masala Dosa', 80.00, 'Dosa', 'veg', true, false, 420, true),
    ('Dosa Junction', 'Rava Dosa', 95.00, 'Dosa', 'veg', true, false, 460, true),
    ('Dosa Junction', 'Cheese Burst Dosa', 130.00, 'Dosa', 'veg', false, false, 610, true),
    ('Dosa Junction', 'Extra Coconut Chutney', 20.00, 'Sides', 'veg', true, true, null, true),
    ('Dosa Junction', 'Filter Coffee', 35.00, 'Drinks', 'veg', false, false, 120, true),
    ('Momo Mafia', 'Veg Momo (6 pcs)', 70.00, 'Steamed', 'veg', true, false, 290, true),
    ('Momo Mafia', 'Paneer Momo (6 pcs)', 90.00, 'Steamed', 'veg', false, false, 350, true),
    ('Momo Mafia', 'Chicken Momo (6 pcs)', 110.00, 'Steamed', 'nonveg', false, false, 400, true),
    ('Momo Mafia', 'Fried Veg Momo (6 pcs)', 85.00, 'Fried', 'veg', true, false, 430, false),
    ('Momo Mafia', 'Chilli Chicken Momo (6 pcs)', 130.00, 'Fried', 'nonveg', false, false, 520, true),
    ('Momo Mafia', 'Schezwan Chutney', 15.00, 'Sides', 'veg', true, true, null, true),
    ('Momo Mafia', 'Lemon Iced Tea', 45.00, 'Drinks', 'veg', true, false, 100, true),
    ('Chai Adda', 'Cutting Chai', 15.00, 'Tea', 'veg', false, false, 60, true),
    ('Chai Adda', 'Elaichi Chai', 20.00, 'Tea', 'veg', false, false, 70, true),
    ('Chai Adda', 'Black Lemon Tea', 25.00, 'Tea', 'veg', true, true, 20, true),
    ('Chai Adda', 'Bun Maska', 35.00, 'Snacks', 'veg', false, false, 280, true),
    ('Chai Adda', 'Vada Pav', 40.00, 'Snacks', 'veg', true, false, 350, true),
    ('Chai Adda', 'Egg Bhurji Pav', 60.00, 'Snacks', 'egg', false, false, 380, true)
) as item(restaurant_name, name, price, category, diet, vegan, jain, calories, available)
join public.restaurant_info as restaurant on restaurant.name = item.restaurant_name
-- Run against a database that already has these, this leaves an restaurant's own
-- edits alone: by name, an item is the same item.
where not exists (
    select 1
    from public.menu_items as existing
    where existing.restaurant_id = restaurant.id and existing.name = item.name
);
