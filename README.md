# Slowstreak

**Small amounts, most days.** A habit tracker, daily journal and bill overview
in one place — [slowstreak.com](https://slowstreak.com).

Habits are logged in minutes rather than checkmarks, and a streak doesn't break
just because today isn't logged yet; you have until midnight. React +
TypeScript + Vite on the front, Supabase (Postgres + Auth) behind it. Styled
with the Nocturne design system tokens.

- **Dashboard** — today's habits, a week strip, and a year-long consistency map
- **Practice** — per-habit stats, full-year heatmap, recent entries
- **Analytics** — last 30 days vs the 30 before: completion, minutes, streaks
- **Notes** — one journal entry per day
- **Expenses** — recurring bills normalised to a monthly figure

---

## First-time setup

### 1. Create the Supabase project

Sign up at [supabase.com](https://supabase.com), create a project, and wait for
it to finish provisioning.

### 2. Create the schema

In the dashboard go to **SQL Editor → New query**, paste the entire contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and
run it.

Then do the same with `0002_tighten_entry_policy.sql` and
`0003_habits_not_seeded.sql`, in order.

Together they create five tables (`habits`, `entries`, `journal_notes`,
`bills`, `user_settings`) and turn on row level security with a "your rows
only" policy on each.

**No habits are seeded.** Every account — yours included — starts empty and
creates its own through the habit form (the `+` beside "Practices", or the
empty-state button on the dashboard). Nothing about the tracked activities is
baked into the schema or the code.

### 3. Point the app at it

```bash
cp .env.local.example .env.local
```

Fill in both values from **Project Settings → API**:

| Variable                 | Where to find it                                  |
| ------------------------ | ------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Project URL — bare origin, **no `/rest/v1` path** |
| `VITE_SUPABASE_ANON_KEY` | `anon` / publishable key                          |

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

Open the app, hit **Create one**, and sign up. You'll land on an empty
dashboard — add your habits from there.

---

## Who can sign up

This deployment leaves registration **open** — anyone who finds the URL can
create an account. They get their own empty tracker and cannot see anyone
else's data.

That isolation is enforced by Postgres, not by the app. Every table has RLS on
with a policy of `auth.uid() = user_id` for both reads and writes, so the
database itself refuses to return or accept a row that isn't yours. The
publishable key in the bundle grants no data access on its own — verified by
attempting an unauthenticated insert against each table, all rejected with
`42501 new row violates row-level security policy`.

Two things worth keeping in mind with open registration:

- **Leave "Confirm email" on** (Authentication → Sign In / Providers). It's the
  main thing stopping bots from creating accounts in bulk.
- **Watch the free tier.** Other people's accounts consume your project's row
  and bandwidth allowance. If it ever gets abused, flip off **"Allow new users
  to sign up"** in the same settings page — existing accounts keep working.

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

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in **Project Settings →
Environment Variables**, then redeploy. `vercel.json` already handles the build
and SPA rewrites.

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
├── lib/                  # supabase client, db types, date/format, series
├── components/           # cards, heatmap, dialogs, sidebar
└── views/                # the five screens
supabase/migrations/      # the schema
```
