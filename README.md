# Slowstreak

**Small amounts, most days.** A habit tracker, daily journal and bill overview
in one place — [slowstreak.com](https://slowstreak.com).

Habits are logged in minutes rather than checkmarks, and a streak doesn't break
just because today isn't logged yet; you have until midnight. React +
TypeScript + Vite on the front, Supabase (Postgres + Auth) behind it. Styled
with the Nocturne design system tokens.

- **Dashboard** — today's habits, a week strip, and a year-long consistency map
- **Week** — this week vs last: habits, journal notes, and spend, with paging
  back through earlier weeks
- **Practice** — per-habit stats, full-year heatmap, recent entries
- **Analytics** — last 30 days vs the 30 before: completion, minutes, streaks
- **Notes** — one journal entry per day
- **Expenses** — recurring bills normalised to a monthly figure, in the
  currency picked in the sidebar
- **Budget** — spend-by-category against monthly targets, fed by a nightly
  import of real bank transactions, plus a six-month trend

---

## First-time setup

### 1. Create the Supabase project

Sign up at [supabase.com](https://supabase.com), create a project, and wait for
it to finish provisioning.

### 2. Create the schema

In the dashboard go to **SQL Editor → New query**, paste the entire contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and
run it.

Then do the same with `0002_tighten_entry_policy.sql`,
`0003_habits_not_seeded.sql`, `0004_currency_setting.sql` and
`0005_expense_tracking.sql`, in order.

Together they create the five core tables (`habits`, `entries`,
`journal_notes`, `bills`, `user_settings`) plus the expense-import tables
(`expense_transactions`, `bank_connections`, `category_rules`,
`merchant_categories`, `fx_rates`), and turn on row level security with a
"your rows only" policy on each.

`0005` is only needed if you want the bank import — the rest of the app runs
without it, and applying it costs nothing if you never connect an account.

**No habits are seeded.** Every account — yours included — starts empty and
creates its own through the habit form (the `+` beside "Practices", or the
empty-state button on the dashboard). Nothing about the tracked activities is
baked into the schema or the code.

### 3. Point the app at it

```bash
cp .env.local.example .env.local
```

Fill in these from **Project Settings → API**, plus your own email:

| Variable                 | Where to find it                                  |
| ------------------------ | ------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Project URL — bare origin, **no `/rest/v1` path** |
| `VITE_SUPABASE_ANON_KEY` | `anon` / publishable key                          |
| `VITE_OWNER_EMAIL`       | The one account the landing page will sign in as  |

`supabase-js` appends the service paths (`/rest/v1`, `/auth/v1`, …) itself, so
the URL must be just `https://<ref>.supabase.co`.

Both are meant to be public — they ship in the browser bundle, and RLS is what
actually protects your data. **Never put the `service_role` key here**; it
bypasses RLS entirely.

### 4. Run it

```bash
npm install
npm run dev
```

Open the app, type your password into the one field on the landing page, and
hit enter. You'll land on an empty dashboard — add your habits from there.

---

## Who can sign in

The landing page is a lock, not a registration form. It takes a password and
tries it against `VITE_OWNER_EMAIL` — there is no sign-up path in the app.

That is not enough on its own. Anyone can still hit Supabase Auth directly
with the publishable key unless you also turn registration off at the source:

**Authentication → Providers → Email → Allow new users to sign up → off.**

Existing accounts keep working. Every table still has RLS on with
`auth.uid() = user_id`, so even a session that somehow formed for someone else
cannot read your rows.

To verify isolation yourself at any time:

```sql
-- Every row must show rowsecurity = true
select tablename, rowsecurity
from pg_tables
where schemaname = 'public';
```

---

## Deploying

The app is a static SPA, so any host works. On Vercel:

```bash
npx vercel
```

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_OWNER_EMAIL` in
**Project Settings → Environment Variables**, then redeploy. `vercel.json`
already handles the build and SPA rewrites. `VITE_OWNER_EMAIL` is baked in at
build time, so changing it later needs another deploy.

Add your domain under **Settings → Domains**, then add that origin to Supabase
under **Authentication → URL Configuration → Site URL / Redirect URLs** so auth
redirects resolve correctly.

---

## How the data works

**Entries are one row per habit per day**, keyed on `(habit_id, entry_date)` and
written with an upsert, so toggling a day repeatedly updates in place rather
than piling up rows. `minutes = 0` means "explicitly not done"; no row at all
means "never logged" — they render the same but the distinction is preserved.

**Streaks** count consecutive logged days ending now. An unlogged _today_ does
not break a streak — you have until midnight — so a streak only dies on a fully
missed day.

**Deleting a habit archives it.** The row is flagged `archived` and disappears
from the app, but its history stays in the database.

Writes are optimistic: the UI updates immediately and reconciles against what
the database actually stored, rolling back if the write fails.

---

## Automated expense tracking

Optional, and independent of everything above. A nightly Vercel Cron job pulls
transactions from your own bank accounts through
[Enable Banking](https://enablebanking.com) and writes them to
`expense_transactions`; the **Budget** page reads them back.

Skip this section entirely if you only want the habit tracker.

### 1. Register the app

Sign up at Enable Banking and register an application in the Control Panel.
Choose **Restricted Production** — you are reading your own accounts, not
building a product for other people, and restricted mode is activated by
linking those accounts rather than by a commercial review.

Let the browser generate the key pair. A `.pem` lands in your downloads named
after the application id; that file is the only copy, and every API request is
signed with it.

### 2. Set the environment

See the second half of `.env.local.example` for the full list with notes. In
short: the Supabase server pair (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`),
your user id (`SLOWSTREAK_USER_ID`), the Enable Banking app id, private key and
redirect URL, a `GEMINI_API_KEY` for the categoriser, and a `CRON_SECRET`.

```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY
# …and so on, then redeploy
```

The service_role key bypasses RLS. That is deliberate — an unattended job has
no session to authorise against — but it means the key must never appear in
anything `VITE_`-prefixed, because those get inlined into the browser bundle.

### 3. Connect each account, once

```bash
open "https://slowstreak.com/api/connect/start?bank=seb&token=$CRON_SECRET"
```

Then `bank=bank-norwegian` and `bank=amex`. Each opens the bank's BankID flow;
on success the session is written to `bank_connections` server-side and never
touches the browser.

If a bank 404s, its ASPSP name doesn't match Enable Banking's catalogue —
override it with the `ASPSP_*_NAME` variables rather than editing
`api/_lib/banks.ts`.

**PSD2 consent lapses roughly every 90 days.** Nothing renews it silently: the
sync flags the connection, the Budget page shows a banner, and the sidebar
shows a dot. Re-run the same command to reconnect.

### 4. Let it run

`vercel.json` schedules `/api/cron/sync-expenses` daily at 05:00 UTC. To run it
by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
     https://slowstreak.com/api/cron/sync-expenses
```

**It is safe to re-run.** Rows are upserted on
`(user_id, account, bank_transaction_id)` rather than inserted, and FX rates
are cached per date, so a second run converges on the same rows with the same
values instead of duplicating or re-pricing anything.

### How the import decides things

**Dedup is on the bank's transaction id, never on amount + date.** A bank is
not obliged to keep that id stable when a pending transaction books, though,
and several reissue it — which would produce exactly the double count the id
was supposed to prevent. So before writing, a settled transaction whose id we
have never seen looks for an orphaned pending row of about the right size
(within 15%, or 20 kr, to absorb tips and FX adjustments) and within six days,
and adopts it.

**Pending transactions count toward "spent so far"**, drawn as a hatched tail
on the category bar. They are real money as far as a budget is concerned; the
hatching is there because the final figure can still move.

**Refunds are negative amounts under the same category**, so they net out
against the purchase instead of needing a second row type.

**Currency conversion prefers the bank's own figure.** Where the bank tells us
what a transaction was in SEK before it converted — a Swedish purchase on the
Norwegian card, say — that is exact and wins. Otherwise a daily ECB reference
rate, cached per date in `fx_rates`. Weekends resolve to the preceding business
day, which is what the ECB publishes.

**Internal transfers are excluded from spend** two ways: automatically, when a
debit on one account matches a credit on another within a day, and manually,
via a row in `category_rules` whose category is `Transfer`. Use the manual
route for anything the automatic pass can't see — the two legs landing days
apart, salary, or a card bill payment that would otherwise register as a giant
refund.

**Categorisation** checks `category_rules` first (merchant substring →
category, cheapest and always wins), then falls back to Gemini 3.6 Flash for
anything unmatched, caching the answer per normalised merchant in
`merchant_categories` so the same shop is never classified twice. The raw bank
text is stored untouched in `merchant_raw` and never overwritten. Correcting a
category on the Budget page pins it, and re-imports leave pinned rows alone.

Populate `category_rules` as patterns emerge — it's the fastest way to make the
categoriser right, and it costs nothing per transaction:

```sql
insert into category_rules (user_id, substring, category, priority)
values ('<your user id>', 'ICA', 'Food', 10);
```

## Scripts

| Command           | Does                           |
| ----------------- | ------------------------------ |
| `npm run dev`     | Dev server with HMR            |
| `npm run build`   | Typecheck and build to `dist/` |
| `npm run preview` | Serve the built output         |
| `npm run lint`    | oxlint                         |
| `npm run format`  | Prettier                       |

## Layout

```
src/
├── api/queries.ts        # every Supabase call
├── auth/                 # session provider + login screen
├── hooks/                # TanStack Query hooks, optimistic mutations
├── state/TrackerContext  # UI state (view, modals, inline edits)
├── lib/                  # supabase client, db types, date/format, series,
│                         #   budget aggregation
├── components/           # cards, heatmap, meter bar, dialogs, sidebar
└── views/                # the seven screens
api/                      # Vercel functions — server-side only
├── _lib/                 # Enable Banking client, FX, categoriser, sync
├── connect/              # the one-time bank consent flow
└── cron/sync-expenses.ts # the nightly import
supabase/migrations/      # the schema
```
