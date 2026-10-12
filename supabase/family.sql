-- Invite-only family accounts. Run once in Supabase → SQL Editor.
-- Each person's data stays private via the existing user_data row-level security.

-- 1. Emails allowed to create an account.
create table if not exists public.allowed_emails (
  email      text primary key check (email = lower(email)),
  added_by   uuid default auth.uid() references auth.users(id) on delete set null,
  added_at   timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;

-- 2. Admins (can manage invites). Every account that exists right now becomes an admin,
--    which today is just the owner's account.
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.app_admins enable row level security;
insert into public.app_admins (user_id) select id from auth.users on conflict do nothing;
-- Existing accounts are allowed too.
insert into public.allowed_emails (email) select lower(email) from auth.users where email is not null on conflict do nothing;

drop policy if exists "admin: see self" on public.app_admins;
create policy "admin: see self" on public.app_admins for select using (user_id = auth.uid());

drop policy if exists "admin: manage invites" on public.allowed_emails;
create policy "admin: manage invites" on public.allowed_emails for all
  using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

-- 3. Block sign-ups from emails that were not invited (enforced inside the database).
create or replace function public.enforce_invite_only() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.allowed_emails where email = lower(new.email)) then
    raise exception 'Email % is not invited', new.email;
  end if;
  return new;
end $$;

drop trigger if exists enforce_invite_only on auth.users;
create trigger enforce_invite_only before insert on auth.users
  for each row execute function public.enforce_invite_only();
