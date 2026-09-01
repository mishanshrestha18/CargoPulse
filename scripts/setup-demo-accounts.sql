-- Demo account setup for the public CargoPulse demo.
-- Run in the Supabase SQL Editor for project xtvxkcdzsyxsufjyecju.
--
-- These credentials are published in the README so reviewers can sign in.
-- Treat this project as disposable and never reuse the password elsewhere.

-- 1. Set a known password on the two accounts that already exist.
--    Done in place so the UIDs survive and profiles rows keep their roles.
update auth.users
set encrypted_password = extensions.crypt('CargoPulseDemo2026!', extensions.gen_salt('bf')),
    updated_at = now()
where email in ('admin@cargopulse.com', 'james.wilson@cargopulse.com');


-- 2. Create the missing dispatcher.
--    The empty strings on the token columns are deliberate: GoTrue reads them
--    as text and errors on NULL, which is the usual cause of a user that looks
--    fine in the dashboard but cannot sign in.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'mike.johnson@cargopulse.com',
  extensions.crypt('CargoPulseDemo2026!', extensions.gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Mike Johnson"}'::jsonb,
  '', '', '', ''
where not exists (
  select 1 from auth.users where email = 'mike.johnson@cargopulse.com'
);


-- 3. Give the new user an email identity.
--    Without this row, sign-in fails on current GoTrue even though the user exists.
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(), now(), now()
from auth.users u
where u.email = 'mike.johnson@cargopulse.com'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );


-- 4. Profile row with the dispatcher role.
--    Handles the case where a trigger already created the profile on signup.
insert into public.profiles (id, email, role, full_name)
select u.id, u.email, 'dispatcher', 'Mike Johnson'
from auth.users u
where u.email = 'mike.johnson@cargopulse.com'
on conflict (id) do update
  set role = 'dispatcher',
      full_name = coalesce(public.profiles.full_name, 'Mike Johnson');


-- 5. Verify. All three should appear with the right role.
select u.email, p.role, p.full_name, u.email_confirmed_at is not null as confirmed
from auth.users u
left join public.profiles p on p.id = u.id
where u.email like '%@cargopulse.com'
order by p.role;
