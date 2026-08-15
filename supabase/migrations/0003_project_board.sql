-- Garden Calendar — project board (internal kanban)
-- Backs PROJECT_BOARD.html. Admin-only: only users with role='admin' in
-- profiles may read/write. Uses the existing public.is_admin() helper and
-- public.touch_updated_at() trigger from earlier migrations.

create table if not exists public.project_board (
  id          text primary key,
  title       text not null,
  notes       text not null default '',
  priority    text not null default 'P2',   -- 'P0' | 'P1' | 'P2' | 'P3'
  tag         text not null default '',
  column_id   text not null default 'todo', -- 'backlog' | 'todo' | 'doing' | 'done'
  position    integer not null default 0,   -- ordering within a column
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_touch_project_board on public.project_board;
create trigger trg_touch_project_board
  before update on public.project_board
  for each row execute function public.touch_updated_at();

alter table public.project_board enable row level security;

-- Admin-only access (read + write) via the existing is_admin() helper.
drop policy if exists "admins manage project board" on public.project_board;
create policy "admins manage project board"
  on public.project_board for all
  using (public.is_admin())
  with check (public.is_admin());
