# Khonklang — Supabase schema design

This is the target Postgres schema for migrating Khonklang off Appwrite, based on a
full audit of the live codebase (17 Appwrite collections, 3 storage buckets,
`Users.prefs`, and 2 auth flows). The runnable SQL is in `schema.sql` in this
same folder. This document explains the *why* behind each decision and lists
everything that needs a human decision before this is run against a real
Supabase project.

This is schema design only — no data has been moved, no code has been
changed, and Appwrite is still the live production backend. Nothing here is
reversible-sensitive yet.

## What changed shape, and why

**Users.prefs + `profiles` collection → one `profiles` table.** The Appwrite
app stored the same fields (name, phone, address, bank info, role, status) in
two places — Appwrite's native `Users.prefs` *and* a separate `profiles`
collection — reconciled by an `/api/profile/sync` route that ran phone-number
matching across linked accounts. That entire reconciliation system goes away
once there's one row per user with one auth identity. If you need to merge
two existing Appwrite users into one Supabase identity during migration,
that's a one-time data-migration script, not a permanent code path.

**Three JSON-blob columns on `deals` → real child tables.** `priceData`,
`meetupData`, and `evidenceData` were each a single string column holding
`JSON.stringify()`'d state. That's how the team worked around Appwrite's
production `collections.write` permission scope — they couldn't reliably add
new attributes, so they grew the blob instead. In Postgres there's no reason
to do that: `deal_price_state` and `deal_meetup` are proper 1:1 child tables,
`deal_images` and `deal_evidence` are proper 1:many child tables. This also
fixes a real bug class — JSON blobs can't have a `check` constraint or a
foreign key, so nothing stopped malformed data from ever reaching them.

**`finance_ledger_v2.meta` (stringified JSON) → `jsonb`.** Same data, but
queryable (`meta->>'feePayer'`) instead of opaque. Also fixed a discrepancy
the audit found: the Appwrite `LedgerDoc` interface declares `ownerType` but
the code that writes ledger entries never actually sets it — so on every
real row today that column is implicitly wrong/empty. The new schema makes
`owner_type` `not null`; application code must supply it going forward.

**`app_config` (generic key→JSON-string doc bag) → two real tables.** The
Appwrite app had one collection where each "row" was `{id: 'fees', data:
'<json string>'}` — basically a hand-rolled key-value store sitting on top of
a document database. `fee_config` is now a genuine singleton row with one
typed column per fee, and `service_controls` is a real table keyed by
service name. Both are just `UPDATE` statements now — no more
parse-the-blob-then-merge-then-stringify dance on every settings save.

**`onsite_jobs` numeric-as-string fields → real `integer` columns.**
`itemPrice`, `maxBudget`, `travelFee`, `serviceFee`, `middlemanDeposit` were
all stored as strings in Appwrite (`'0'` not `0`). Fixed in the new schema;
will need explicit `::integer` casts in the data migration script.

**`categories` (comma-joined string) on `middleman_applications` → `text[]`.**
Same data, but you can now do `categories @> array['electronics']` instead of
`LIKE '%electronics%'`.

**JSON-array-as-string fields on `scam_reports`** (`chatImageIds`,
`policeDocIds`, `slipImageIds`, `bankAccounts`) **→ native `text[]`/`jsonb`.**

**`reviews.reviewScore`/`reviewCount` on `Users.prefs` → trigger-maintained
columns on `profiles`.** Same denormalized-average pattern, but now kept
correct by a database trigger (`recompute_review_stats()`) instead of
hand-written increment/average logic in the API route — and a `unique
(deal_id, reviewer_id)` constraint now enforces "one review per deal" at the
database level instead of an app-level 409 check that a future code change
could accidentally bypass.

**Deal status transitions stay in application code, not the database.** The
Appwrite version has the entire state machine (who can do what from which
status) living in `src/app/api/deals/[id]/route.ts`. That's appropriate and
is *not* being pulled into triggers/RPCs by default — it's complex,
multi-party, notification-emitting business logic that reads better as
TypeScript than as PL/pgSQL. RLS policies here are read-path guards, not a
re-implementation of the state machine. Keep using the service-role key from
API routes for all deal/ledger/wallet writes, same as today.

## Open questions — confirm before running this for real

1. **`deal_number` continuity.** Existing deals already display codes like
   `KKL-3E406A46` to real users (`src/lib/dealNumber.ts` derives this
   deterministically from the Appwrite document ID). The new schema makes
   `deal_number` a plain `unique` column with no default-generating
   expression, specifically so the migration script can copy the *existing*
   computed code for every row rather than regenerating it. If new code
   instead recalculates `dealCode()` against the new UUID, every existing
   deal's visible code will change — confirm the migration script copies
   the old value, doesn't recompute it.
2. **LINE login has no Supabase Auth equivalent.** Supabase Auth doesn't
   ship a LINE OAuth provider. Today's flow (`/api/auth/line`,
   `/api/auth/line/callback`) manually exchanges a LINE auth code, derives a
   *deterministic* Appwrite user ID + password from the LINE user ID, and
   calls `Users.create()`/`createSession()`. The equivalent on Supabase is
   a Postgres function exposed as an Edge Function that does the same code
   exchange, then calls `supabase.auth.admin.createUser()` /
   `generateLink()` with a deterministic UUID derived from the LINE user ID
   (`uuid_generate_v5(namespace, line_user_id)` is the clean way to keep it
   deterministic). This needs its own design pass — it's the single
   riskiest piece of the whole migration because it's the front door for
   every user. Recommend doing this migration step in isolation, with a
   feature flag, well before touching deal/finance data.
3. **Google/Facebook login** currently uses Appwrite's OAuth2 *token* flow
   (deliberately not the session/cookie flow, to dodge third-party-cookie
   blocking inside LINE/Messenger in-app browsers). Supabase Auth supports
   both Google and Facebook natively, but the in-app-browser cookie problem
   is independent of which backend you use — `src/lib/inApp.ts`'s
   in-app-browser detection and "open in real browser" prompt needs to be
   kept regardless of backend.
4. **SlipOK API key storage.** `fee_config.slipok_api_key_secret_id` is a
   placeholder pointing at a secret, not a plaintext column — store the
   actual key via Supabase Vault and keep only its reference in the table.
   If a quick admin-UI input for the SlipOK key is wanted as a *separate,
   immediate* fix on the current Appwrite app (independent of this
   migration), that's a different, much smaller task — say so explicitly
   and we'll do it against `app_config` instead, since building it twice
   (once in Appwrite, once in Supabase) is wasted effort.
5. **Storage bucket RLS.** The sketch policy on `storage.objects` for
   `deal-files` in `schema.sql` is a placeholder (`auth.uid() is not null`)
   — it needs a real per-deal-participant check. The clean way is to
   encode the deal ID into the object path (e.g.
   `deal-files/{deal_id}/{filename}`) and write a policy that joins back to
   `deals` on that path segment, mirroring the `deal_images`/`deal_evidence`
   row-level policies. Worth deciding the path convention before any files
   are migrated, since rewriting paths after the fact means re-uploading
   everything.
6. **`middlemanTierIntent` vs `middlemanTier`.** Appwrite has two
   never-reconciled tier fields (self-declared at registration vs.
   admin-set at approval). Both are kept in the new schema
   (`middleman_tier_intent`, `middleman_tier`) for parity, but this is a
   good moment to decide whether `middleman_tier_intent` should simply be
   deleted as unnecessary — confirm before migration if dropping it.
7. **Realtime.** The current app does zero Appwrite Realtime/websocket
   usage (confirmed by full-tree grep) — it polls. Nothing needs porting,
   but Supabase Realtime is available for free if you want to add live
   chat/notification push as part of this migration rather than after.

## Migration order (once the schema above is approved)

1. Stand up this schema on a real Supabase project; do not touch production.
2. Write and test a one-time data-export script against Appwrite
   (`Databases.listDocuments` paginated per collection) → transform → bulk
   insert into Supabase, preserving original IDs as a `legacy_appwrite_id`
   column for traceability (not included above — add before running a real
   migration, don't generate fresh UUIDs that lose the mapping).
3. Migrate read-only/reporting code paths first (`admin/finance`, search)
   to run against Supabase while writes still go to Appwrite — compare
   output between both backends until they agree.
4. Migrate storage objects (slips, QR codes, KYC docs) with a script that
   preserves the file content and records the new Supabase Storage path
   back onto the migrated rows.
5. Migrate auth last: LINE flow first in isolation (see open question #2),
   then Google/Facebook, with a cutover window and rollback plan, since
   this is what every existing user's login depends on.
6. Only after all reads and writes are confirmed correct on Supabase for at
   least one full deal lifecycle (post → payment → completion) in
   production-like conditions, decommission the Appwrite project.

This document and `schema.sql` cover step 1 only.
