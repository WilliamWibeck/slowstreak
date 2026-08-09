-- Hardening for open registration.
--
-- The original "own entries" policy only checked that the entry's user_id was
-- yours. That let an account write an entry referencing someone else's
-- habit_id — invisible to the habit's owner (their reads filter on their own
-- user_id) but junk data pointing across the tenant boundary all the same.
--
-- This version additionally requires the referenced habit to belong to you, so
-- an entry can never straddle two accounts.
--
-- Run in: Supabase dashboard → SQL Editor → New query.

drop policy if exists "own entries" on public.entries;

create policy "own entries" on public.entries
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.habits h
      where h.id = entries.habit_id
        and h.user_id = auth.uid()
    )
  );

-- Same reasoning is already covered elsewhere: journal_notes, bills and
-- user_settings have no cross-row references, so user_id alone is sufficient.
