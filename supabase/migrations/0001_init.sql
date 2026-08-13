-- Garden Calendar — initial schema
-- One JSON document per authenticated user, mirroring the app's localStorage
-- snapshot. RLS ensures each user can only read/write their own row.

create table if not exists public.garden_state (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Keep updated_at fresh on every write.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_garden_state on public.garden_state;
create trigger trg_touch_garden_state
  before update on public.garden_state
  for each row execute function public.touch_updated_at();

-- ----- Row Level Security -----
-- The browser uses the anon public key; without RLS it could read/write ALL
-- rows. These policies restrict every operation to the caller's own row.
alter table public.garden_state enable row level security;

create policy "read own state"
  on public.garden_state for select
  using (auth.uid() = user_id);

create policy "insert own state"
  on public.garden_state for insert
  with check (auth.uid() = user_id);

create policy "update own state"
  on public.garden_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
