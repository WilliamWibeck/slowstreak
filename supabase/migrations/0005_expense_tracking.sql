-- Automated expense tracking: imported bank transactions, the categoriser's
-- lookup tables, FX rates, and per-account bank connections.
--
-- Run in: Supabase dashboard → SQL Editor → New query. Safe to re-run.
--
-- Security model matches the rest of the schema: every user-owned table carries
-- a user_id, RLS is on, and the only policy is "the row is yours". The sync job
-- writes with the service_role key, which bypasses RLS — that key lives in
-- Vercel's environment, never in the frontend bundle.

-- ─────────────────────────────────────────────────────────────────────────
-- Bank connections — one row per PSD2 consent (SEB, Bank Norwegian, Amex).
--
-- Enable Banking sessions expire roughly every 90 days. Rather than assuming
-- the consent lasts forever, the sync job flags needs_reconnect and the budget
-- page surfaces it.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.bank_connections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  -- Stable slug used as expense_transactions.account, e.g. 'seb'.
  account         text not null check (length(trim(account)) > 0),
  display_name    text not null default '',
  aspsp_name      text not null default '',
  aspsp_country   text not null default '',
  -- Enable Banking session + the account uid within it. Both server-side only.
  session_id      text not null default '',
  account_uid     text not null default '',
  -- Native currency of the account, as reported by the bank.
  currency        text not null default 'SEK',
  consent_expires_at timestamptz,
  needs_reconnect boolean not null default false,
  last_error      text not null default '',
  -- Watermark for incremental sync: the last booking date we pulled through.
  last_synced_at  timestamptz,
  synced_through  date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, account)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Transactions.
--
-- One row per bank transaction. amount_sek is negative for refunds so that
-- category totals net out; is_transfer marks money moved between the owner's
-- own accounts, which the budget page excludes from spend.
--
-- Dedup is on (user_id, account, bank_transaction_id) — never on amount+date.
-- Note that a bank's entry_reference is not guaranteed stable across the
-- pending→booked transition, so the sync job additionally reconciles a booked
-- transaction onto a matching pending row before inserting (see api/_lib/sync.ts).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.expense_transactions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  account             text not null,
  bank_transaction_id text not null,
  -- The bank's booking date. Month grouping keys off this, not off created_at.
  booking_date        date not null,
  -- Converted at import. Negative = refund.
  amount_sek          numeric(12, 2) not null,
  original_amount     numeric(12, 2) not null,
  original_currency   text not null,
  -- Which conversion path produced amount_sek, so a bad rate can be traced.
  fx_source           text not null default 'native'
                        check (fx_source in ('native', 'bank', 'daily')),
  -- Untouched bank text. Never overwritten — the categoriser gets corrected.
  merchant_raw        text not null default '',
  merchant_key        text not null default '',
  category            text not null default 'Uncategorized',
  -- Set when the category was corrected by hand; re-imports leave it alone.
  category_locked     boolean not null default false,
  status              text not null check (status in ('pending', 'settled')),
  is_transfer         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, account, bank_transaction_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Categorisation.
--
-- category_rules is checked first on import: the first rule whose `substring`
-- appears in the upper-cased merchant text wins. Starts empty — fill it in as
-- data arrives. merchant_categories caches the LLM's answer per normalised
-- merchant so the same shop is never classified twice.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.category_rules (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  substring  text not null check (length(trim(substring)) > 0),
  category   text not null,
  -- Lower sorts first, so a specific rule can outrank a general one.
  priority   integer not null default 100,
  created_at timestamptz not null default now(),
  unique (user_id, substring)
);

create table if not exists public.merchant_categories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- Normalised merchant string: upper-cased, card noise and digits stripped.
  merchant_key text not null,
  category     text not null,
  -- 'rule' | 'llm' | 'manual' — manual entries are never re-classified.
  source       text not null default 'llm' check (source in ('rule', 'llm', 'manual')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, merchant_key)
);

-- ─────────────────────────────────────────────────────────────────────────
-- FX rates — SEK per one unit of `currency`, cached per date.
--
-- Cached so that re-running a day's sync converts identically, which is what
-- makes the job idempotent in value as well as in row count. Keyed by the date
-- we asked for; effective_date records the date the source actually served
-- (ECB publishes no weekend rates, so Sunday resolves to Friday).
--
-- Not user-scoped and never read from the browser: RLS is on with no policy,
-- so only the service_role key can touch it.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.fx_rates (
  rate_date      date not null,
  currency       text not null,
  sek_per_unit   numeric(18, 8) not null check (sek_per_unit > 0),
  effective_date date not null,
  source         text not null default 'frankfurter',
  fetched_at     timestamptz not null default now(),
  primary key (rate_date, currency)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Monthly targets per category.
--
-- A key-value blob on the existing settings row rather than a table of its own:
-- { "Food": 6000, "Transport": 1500 }, in SEK.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.user_settings
  add column if not exists budget_targets jsonb not null default '{}'::jsonb;

comment on column public.user_settings.budget_targets is
  'Monthly spend target per category, in SEK. { "<category>": <number> }';

-- ─────────────────────────────────────────────────────────────────────────
-- Indexes — the budget page pulls a month at a time, and the trend view six.
-- ─────────────────────────────────────────────────────────────────────────

create index if not exists tx_user_date_idx
  on public.expense_transactions (user_id, booking_date desc);
create index if not exists tx_user_category_date_idx
  on public.expense_transactions (user_id, category, booking_date desc);
-- Supports the pending→settled reconciliation lookup.
create index if not exists tx_pending_match_idx
  on public.expense_transactions (user_id, account, status, booking_date)
  where status = 'pending';
create index if not exists merchant_cat_key_idx
  on public.merchant_categories (user_id, merchant_key);
create index if not exists category_rules_user_idx
  on public.category_rules (user_id, priority);
create index if not exists bank_connections_user_idx
  on public.bank_connections (user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Row level security.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.bank_connections     enable row level security;
alter table public.expense_transactions enable row level security;
alter table public.category_rules       enable row level security;
alter table public.merchant_categories  enable row level security;
alter table public.fx_rates             enable row level security;

drop policy if exists "own connections" on public.bank_connections;
create policy "own connections" on public.bank_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own transactions" on public.expense_transactions;
create policy "own transactions" on public.expense_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rules" on public.category_rules;
create policy "own rules" on public.category_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own merchants" on public.merchant_categories;
create policy "own merchants" on public.merchant_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- fx_rates deliberately gets no policy: RLS on with zero policies means the
-- anon and authenticated roles can read nothing. Only service_role gets in.

-- ─────────────────────────────────────────────────────────────────────────
-- Keep updated_at honest.
-- ─────────────────────────────────────────────────────────────────────────

drop trigger if exists connections_touch on public.bank_connections;
create trigger connections_touch before update on public.bank_connections
  for each row execute function public.touch_updated_at();

drop trigger if exists transactions_touch on public.expense_transactions;
create trigger transactions_touch before update on public.expense_transactions
  for each row execute function public.touch_updated_at();

drop trigger if exists merchants_touch on public.merchant_categories;
create trigger merchants_touch before update on public.merchant_categories
  for each row execute function public.touch_updated_at();
