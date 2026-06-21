# [OPEN] admin-api-500

## Symptoms
- Production returns `500` on `/api/admin/finance`
- Production returns `500` on `/api/support`
- Observed from browser console on admin pages after latest deploy

## Scope
- Admin finance page
- Admin deals/disputes page
- Possibly shared admin layout/widgets that call support API

## Hypotheses
1. `/api/admin/finance` fails during ledger sync or `priceData` parsing after the new admin payout slip fields were introduced.
2. `/api/admin/finance` fails because Appwrite rejects a document shape or attribute path at runtime in production.
3. `/api/support` is a separate failing endpoint caused by missing env/config or support backend runtime issues.
4. Admin pages invoke `/api/support` globally, so that error appears together with finance errors and may be masking the main failure.
5. A request/response shape mismatch in the latest client changes triggers a runtime exception in one or both route handlers.

## Plan
- Add instrumentation only, no business-logic changes yet
- Reproduce locally where possible
- Inspect runtime evidence
- Confirm or reject hypotheses
- Apply minimal fix only after evidence is clear

## Findings So Far
- Admin pages always mount `SupportWidget` from `src/app/layout.tsx`, so `/api/support` errors appear globally and are not specific to finance.
- Added instrumentation to:
  - `src/app/api/admin/finance/route.ts`
  - `src/app/api/support/route.ts`
- Local type diagnostics are clean after instrumentation.
- `support` has a suspicious lazy-bootstrap flow: collection creation errors can be swallowed and later operations may still execute against missing collections.
- `finance` still needs runtime evidence to confirm whether the failure is during admin auth, finance projection sync, ledger fetch, or summary build.
- Runtime evidence received:
  - `/api/support`: `Document with the requested ID ... already exists`
  - `/api/admin/finance`: `Unable to create finance string attribute: finance_ledger_v2.entryKey`
- Confirmed:
  - `support` is hitting a concurrent `getOrCreateThread()` race and must recover by re-reading the existing document.
  - `finance` is failing in Appwrite schema bootstrap under concurrent/lagging attribute creation and must wait/retry more robustly instead of throwing immediately.
  - `finance` may still be masking real Appwrite failures (quota/permission) because helper methods previously converted many exceptions into `not ready`.

## Next Evidence Needed
- Deploy the instrumentation build or reproduce locally with working Appwrite env and auth
- Capture response JSON/body for:
  - `/api/admin/finance?...`
  - `/api/support`
- Read `.dbg/trae-debug-log-admin-api-500.ndjson` after reproduction
