-- Per-user display currency for the expenses page.
--
-- Amounts are stored as bare numerics and always have been; this only changes
-- how they are formatted, so there is nothing to convert. Existing rows keep
-- the dollar formatting they had by defaulting to USD.
--
-- ISO 4217 alphabetic code — validated in the app against
-- Intl.supportedValuesOf('currency') rather than a CHECK constraint, so the
-- list stays in step with the runtime instead of needing a migration per code.
--
-- Run in: Supabase dashboard → SQL Editor → New query.

alter table public.user_settings
  add column if not exists currency text not null default 'USD';

comment on column public.user_settings.currency is
  'ISO 4217 code used to format money on the expenses page.';
