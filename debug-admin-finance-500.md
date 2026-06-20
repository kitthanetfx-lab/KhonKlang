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
- Waiting for instrumentation and reproduction.
