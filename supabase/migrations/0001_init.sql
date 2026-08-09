-- Habit tracker schema.
-- Paste this whole file into the Supabase dashboard → SQL Editor → New query → Run.
-- Safe to re-run: every statement is guarded.
--
-- Security model: every row carries a user_id, RLS is on for every table, and
-- the only policy is "the row is yours". The anon key shipped in the frontend
-- can therefore not read anyone else's data.

-- ─────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null check (length(trim(name)) > 0),
  goal           text not null default '',
  target_minutes integer not null default 20 check (target_minutes between 1 and 1440),
  sort_order     integer not null default 0,
  archived       boolean not null default false,
  created_at     timestamptz not null default now()
);

-- One entry per habit per day. minutes = 0 means "explicitly not done today",
-- which is distinct from having no row at all (never logged).
create table if not exists public.entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  habit_id   uuid not null references public.habits (id) on delete cascade,
  entry_date date not null,
  minutes    integer not null default 0 check (minutes between 0 and 1440),
  note       text not null default '',
  updated_at timestamptz not null default now(),
  unique (habit_id, entry_date)
);

-- The daily journal — one free-text note per calendar day.
create table if not exists public.journal_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  note_date  date not null,
  body       text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, note_date)
);

create table if not exists public.bills (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  amount     numeric(12, 2) not null check (amount >= 0),
  category   text not null default 'Other',
  cadence    text not null default 'monthly' check (cadence in ('monthly', 'quarterly', 'yearly')),
  due_day    integer not null default 1 check (due_day between 1 and 31),
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  theme        text not null default 'nocturne',
  current_book text not null default '',
  updated_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Indexes — the heatmap pulls a year of entries at a time, so entry_date
-- lookups per user are the hot path.
-- ─────────────────────────────────────────────────────────────────────────

create index if not exists habits_user_sort_idx    on public.habits (user_id, sort_order);
create index if not exists entries_user_date_idx   on public.entries (user_id, entry_date);
create index if not exists entries_habit_date_idx  on public.entries (habit_id, entry_date desc);
create index if not exists journal_user_date_idx   on public.journal_notes (user_id, note_date desc);
create index if not exists bills_user_idx          on public.bills (user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Row level security — one policy per table: you can only touch your own rows.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.habits        enable row level security;
alter table public.entries       enable row level security;
alter table public.journal_notes enable row level security;
alter table public.bills         enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "own habits"   on public.habits;
create policy "own habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own entries"  on public.entries;
create policy "own entries" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own notes"    on public.journal_notes;
create policy "own notes" on public.journal_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own bills"    on public.bills;
create policy "own bills" on public.bills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own settings" on public.user_settings;
create policy "own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Keep updated_at honest on edited rows.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists entries_touch  on public.entries;
create trigger entries_touch  before update on public.entries
  for each row execute function public.touch_updated_at();

drop trigger if exists journal_touch  on public.journal_notes;
create trigger journal_touch  before update on public.journal_notes
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.user_settings;
create trigger settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- New-user bootstrap: give every new account a settings row and the four
-- starting habits, so the dashboard is never empty on first login.
-- Runs as security definer because auth.users inserts happen outside RLS.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.habits (user_id, name, goal, target_minutes, sort_order)
  values
    (new.id, 'French',   'Daily · 20 min',     20, 0),
    (new.id, 'Freddy',   'Daily · 15 min',     15, 1),
    (new.id, 'Exercise', '4× / week · 45 min', 45, 2),
    (new.id, 'Reading',  'Daily · 30 min',     30, 3);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
