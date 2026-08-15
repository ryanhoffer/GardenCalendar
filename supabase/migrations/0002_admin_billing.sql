-- Garden Calendar — admin + billing foundation (SCAFFOLD)
-- Adds: profiles (role/plan/subscription state), discount_codes, and an
-- admin audit log. Billing fields are written ONLY by the service role
-- (webhooks / admin endpoints); users may read their own profile.
--
-- NOTE: This is scaffolding. Some columns are placeholders until Stripe billing
-- is wired up (see BILLING.md / ADMIN_PANEL.md).

-- ============================================================= profiles
create table if not exists public.profiles (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  email                  text,
  role                   text not null default 'user',      -- 'user' | 'admin'
  plan                   text not null default 'none',      -- 'none' | 'pro'
  status                 text not null default 'inactive',  -- 'trialing' | 'active' | 'past_due' | 'canceled' | 'inactive'
  stripe_customer_id     text,
  stripe_subscription_id text,
  price_id               text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  comp_reason            text,                              -- set for admin-comped accounts
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

drop trigger if exists trg_touch_profiles on public.profiles;
create trigger trg_touch_profiles
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----- RLS -----
alter table public.profiles enable row level security;

-- Users can read their own profile (to learn their plan/status). They may NOT
-- write billing fields — the service role handles all writes.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

-- Helper: is the current caller an admin? (SECURITY DEFINER to bypass RLS.)
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Admins can read every profile (used by the admin panel if it ever queries
-- directly; the API prefers the service-role key).
drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- ============================================================= discount_codes
create table if not exists public.discount_codes (
  code             text primary key,
  type             text not null default 'percent',  -- 'percent' | 'amount' | 'free_period'
  value            numeric not null default 0,        -- 20 (%), 500 (cents), or period length
  duration         text not null default 'once',      -- 'once' | 'repeating' | 'forever'
  max_redemptions  integer,
  redemptions      integer not null default 0,
  expires_at       timestamptz,
  active           boolean not null default true,
  stripe_coupon_id text,                               -- placeholder until Stripe is wired up
  created_by       uuid references auth.users (id),
  created_at       timestamptz not null default now()
);

alter table public.discount_codes enable row level security;

-- Only admins can see/manage codes via direct queries; the API uses service role.
drop policy if exists "admins manage codes" on public.discount_codes;
create policy "admins manage codes"
  on public.discount_codes for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================= admin_audit_log
create table if not exists public.admin_audit_log (
  id             bigint generated always as identity primary key,
  admin_user_id  uuid references auth.users (id),
  action         text not null,        -- 'grant_free' | 'revoke_free' | 'create_code' | ...
  target_user_id uuid,
  detail         jsonb,
  created_at     timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admins read audit" on public.admin_audit_log;
create policy "admins read audit"
  on public.admin_audit_log for select
  using (public.is_admin());

-- To promote yourself to admin after applying this migration, run (with your
-- user id) in the Supabase SQL editor:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
