-- Multi-user cleanup: stop baking one person's habits into the schema.
--
-- 1. New accounts no longer get a fixed set of habits. Everyone starts empty
--    and creates their own through the app's habit form. The trigger still
--    creates the settings row, which is infrastructure rather than content.
--
-- 2. The "currently reading" field was a per-user setting that only surfaced
--    on a habit literally named "Reading" — a name-based special case that
--    made no sense for anyone tracking something else. It becomes `focus`, a
--    free-text line any habit can carry: a book, a training block, a project.
--
-- Run in: Supabase dashboard → SQL Editor → New query.

-- ── 1. habits get their own focus line ───────────────────────────────────

alter table public.habits
  add column if not exists focus text not null default '';

comment on column public.habits.focus is
  'Optional free-text "what specifically, right now" line shown under the habit.';

-- ── 2. drop the global current_book setting it replaces ──────────────────
-- Safe: verified no rows existed in user_settings at time of writing.

alter table public.user_settings
  drop column if exists current_book;

-- ── 3. new accounts start empty ──────────────────────────────────────────

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

  -- Deliberately no habits: the account owner creates their own.
  return new;
end;
$$;
