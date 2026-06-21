# Khonklang — Appwrite → Supabase data migration

Three scripts, run in order. Each step is independently re-runnable and
none of them deletes anything in Appwrite — this is a read-from-Appwrite,
write-to-Supabase pipeline, one direction only.

```
node supabase/migration/export-appwrite.mjs          # Appwrite -> local JSON
node supabase/migration/transform.mjs                # local JSON -> local JSON, reshaped for Supabase
node supabase/migration/import-supabase.mjs --dry-run # validate the reshaped data, no writes
node supabase/migration/import-supabase.mjs           # actually write to Supabase
```

Run `npm install` first (adds `@supabase/supabase-js` and `dotenv`, used only
by these scripts — not bundled into the Next.js app).

## Before you run anything

1. **schema.sql and 0002_legacy_ids.sql must already be applied** to the
   target Supabase project (via the SQL Editor, same as before). The import
   script assumes every table already exists.
2. **Add to `.env.local`** (on top of what's already there for Appwrite):
   ```
   SUPABASE_URL=https://mwzotvfgzavwkfdmukuv.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service role key, from Project Settings > API>
   ```
   The service role key bypasses RLS — that's required for a bulk import,
   but it means this key should never be pasted into chat, a commit, or
   anywhere outside `.env.local`. `.env.local` is already gitignored.
3. Decide **when** you're running this. `export-appwrite.mjs` takes a live
   snapshot — if real users keep using the Appwrite app after you export,
   anything that changes after the snapshot won't be in Supabase. For a
   real cutover you'd put the app in read-only/maintenance mode, export,
   import, verify, then switch the app's backend — not in scope of these
   three scripts (they're the data-mover, not the cutover orchestration).

## Step 1 — export-appwrite.mjs

Read-only against Appwrite. Dumps every collection plus every user's
`prefs` into `supabase/migration/.data/*.json` (gitignored — contains real
names, phone numbers, bank account numbers). Safe to run against production
repeatedly; it never writes anything back to Appwrite.

## Step 2 — transform.mjs

Pure local transform, touches neither backend. Reads `.data/`, writes
`supabase/migration/.transformed/*.json` — one file per Supabase table,
rows shaped exactly like the columns in `schema.sql`. Re-run as many times
as you want while tuning the mapping; nothing is written anywhere external.

Prints a `_warnings.json` listing every row it had to skip (usually: a
foreign key it couldn't resolve, e.g. a message pointing at a deal that no
longer exists). **Read this file before moving to step 3** — a high skip
count on `deals`, `profiles`, or `finance_ledger` specifically means
something is wrong with the export, not just normal data mess.

## Step 3 — import-supabase.mjs

```
node supabase/migration/import-supabase.mjs --dry-run
```
Validates row shapes (catches `undefined` fields = a mapping bug) without
writing anything. Run this first, every time, even on a re-run.

```
node supabase/migration/import-supabase.mjs
```
Writes for real, table by table in FK-safe order, batched, idempotent
(every table upserts on `legacy_appwrite_id` or an equivalent natural key —
see the `RUN_ORDER` table at the top of the script — so a second run after
a partial failure won't duplicate rows). If one table fails partway, fix
the data, then re-run scoped to just that table:
```
node supabase/migration/import-supabase.mjs --table=deals
```

## Verification checklist (do this before trusting the migrated data)

Run these in the Supabase SQL Editor after a real import:

1. **Row counts match.** For every collection, compare
   `select count(*) from <table>` in Supabase against the corresponding
   `<collection>.json` length printed by `export-appwrite.mjs`, minus
   whatever `_warnings.json` says was intentionally skipped.
2. **deal_number continuity.** Pick 5 real deal IDs you recognize from the
   live Appwrite app (the codes shown in the UI, e.g. `KKL-3E406A46`).
   Confirm `select deal_number from deals where legacy_appwrite_id = '<old appwrite $id>'`
   returns the *exact same* code. If it doesn't, stop — something is wrong
   with the `dealCode()` port in `transform.mjs`, and every user-facing
   deal reference will be broken if you proceed.
3. **One completed deal, full ledger.** Pick a deal with `status =
   'completed'` and walk its whole financial trail in Supabase: the
   `buyer_payment` entry, the `seller_fee_payment` entry (if the fee was
   split), `platform_fee`, `middleman_fee_gross`/`middleman_fee_net`, and
   `seller_payout` — all via `select * from finance_ledger where deal_id =
   (select id from deals where legacy_appwrite_id = '<old id>')`. Confirm
   the amounts sum the same way they do on the live `/admin/finance` page
   today.
4. **Spot-check a profile's bank info.** Pick a user who has bank info
   filled in on `/profile` in the live app, find their row by
   `legacy_appwrite_id`, confirm `bank_name`/`bank_acct`/`bank_owner`/
   `bank_qr_file_id` all match.
5. **`fee_config` and `service_controls`.** These were `UPDATE`s against
   pre-seeded rows, not inserts — confirm `select * from fee_config` shows
   your real configured fee percentages, not the schema defaults (if the
   admin in Appwrite never changed them from default, this check is moot).
6. **Storage files are NOT migrated by these scripts.** `payment_slip_file_id`,
   `bank_qr_file_id`, every `file_id` column, etc. still hold the *old*
   Appwrite file IDs — they won't resolve to anything in Supabase Storage
   until a separate file-migration script copies the actual bytes and
   rewrites these columns. Don't be surprised when slip images don't load
   yet; that's the next piece of work, not a bug in this one.

## What's deliberately NOT done by these scripts

- **No auth migration.** No Supabase `auth.users` rows are created. Every
  `profiles.id` here is a freshly generated UUID with no matching auth
  identity yet — see the assumption flagged at the top of `transform.mjs`
  and in `SCHEMA_DESIGN.md` open question #2. Logging in via the migrated
  data isn't possible until that's built.
- **No storage migration.** See verification step 6 above.
- **No cutover.** The live app keeps reading/writing Appwrite the entire
  time these scripts run. Nothing about running this is destructive or
  user-visible until you deliberately point the app at Supabase.
