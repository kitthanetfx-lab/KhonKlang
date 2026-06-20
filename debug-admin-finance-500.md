[OPEN] admin-finance-500

## Symptom
- Production `/api/admin/finance` returns `500` on Vercel.
- Admin finance page renders header/tabs but data load fails.

## Scope
- Investigate runtime failure in finance admin API only.
- No business logic changes before evidence collection.

## Hypotheses
1. `syncFinanceProjection()` throws at runtime because Appwrite schema creation/read on `finance_ledger` or `middleman_wallets` fails in production permissions/state.
2. `GET /api/admin/finance` fails while reading/parsing ledger/meta documents, causing an exception before response serialization.
3. Bank lookup via `getBankInfoMap()` throws for one or more owner IDs in production data.
4. `verifyAdmin()` passes, but one downstream Appwrite call in finance route fails due to missing collection/attribute/index or API scope mismatch.
5. A route-level runtime error happens in the projection path for deals/middleman apps/onsite jobs because one synced document shape is incomplete in production data.

## Evidence Plan
- Add minimal instrumentation in `src/app/api/admin/finance/route.ts` around:
  - route entry / admin verification
  - projection sync
  - ledger fetch
  - bank map fetch
  - row build / summary
  - catch block
- Reproduce on production and inspect logs.

## Status
- Evidence collected from production.

## Evidence
- Production response:
  - `debugStage = "get:syncFinanceProjection"`
  - `error = "Invalid document structure: Unknown attribute: \"ownerType\""`
  - `debugName = "AppwriteException"`
- This confirms the failure happens before ledger read/summary and inside projection write.

## Hypothesis Result
- H1 confirmed: finance projection writes before `finance_ledger` schema is fully ready in Appwrite.
- H2 rejected: route does not reach ledger parsing/build stage.
- H3 rejected: route does not reach bank lookup stage.
- H4 confirmed: downstream Appwrite schema readiness is the failure source.
- H5 partially rejected: this is not caused by malformed deal/app/job payload first; it fails on collection attribute readiness.

## Fix Plan
- Make `ensureFinanceCollections()` wait until each required attribute is `available` before any ledger upsert runs.
- Keep route instrumentation in place until production verification succeeds.

## Follow-up Evidence
- After the first readiness patch, production still returned the same `Unknown attribute: "ownerType"` error.
- This rules out a simple timing-only issue and points to schema bootstrap not creating the attribute successfully at all.

## Revised Root Cause
- `ensureFinanceCollections()` created many attributes in parallel and swallowed creation errors.
- In production, at least `finance_ledger.ownerType` remained absent, but ledger writes still proceeded and failed on document validation.

## Revised Fix
- Create finance attributes sequentially instead of `Promise.all`.
- Stop swallowing attribute creation failures when the attribute still does not exist.
- Retry one ledger write after re-running schema ensure on `Unknown attribute` errors.

## New Hypotheses
1. `finance_ledger.ownerType` still does not exist at all in production after migrations.
2. `finance_ledger.ownerType` exists but remains non-`available`, so validation still rejects writes.
3. Production request is hitting a deployment/schema state different from what local code expects.
4. The same schema bootstrap issue may also affect `middleman_wallets`, indicating broader finance migration drift.

## New Instrumentation
- On `Unknown attribute` errors, `GET /api/admin/finance` now also returns:
  - `debugInfo.ledgerAttributes`
  - `debugInfo.walletAttributes`
- This will reveal the actual schema visible to the production runtime.
