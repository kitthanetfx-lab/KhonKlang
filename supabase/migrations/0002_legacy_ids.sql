-- ============================================================================
-- 0002_legacy_ids.sql
-- ============================================================================
-- schema.sql (0001) was already applied without traceability back to the
-- source Appwrite document IDs. This adds a `legacy_appwrite_id` column to
-- every table that maps 1:1 from an Appwrite collection, so the migration
-- scripts in supabase/migration/ can:
--   1. upsert idempotently (run the import twice without duplicating rows)
--   2. let a human spot-check "does Supabase row X match Appwrite doc Y"
--   3. let deal_number / file paths / FK remapping scripts look up the new
--      UUID for an old Appwrite ID during the transform step
--
-- Child tables that were decomposed out of a JSON blob on `deals`
-- (deal_price_state, deal_meetup, deal_images, deal_evidence) don't get one —
-- they're reached via deal_id, which itself resolves through deals.legacy_appwrite_id.
-- ============================================================================

alter table profiles               add column if not exists legacy_appwrite_id text unique;
alter table deals                  add column if not exists legacy_appwrite_id text unique;
alter table messages                add column if not exists legacy_appwrite_id text unique;
alter table dm_messages             add column if not exists legacy_appwrite_id text unique;
alter table finance_ledger          add column if not exists legacy_appwrite_id text unique;
alter table middleman_wallets       add column if not exists legacy_appwrite_id text unique;
alter table seller_applications     add column if not exists legacy_appwrite_id text unique;
alter table middleman_applications  add column if not exists legacy_appwrite_id text unique;
alter table onsite_jobs             add column if not exists legacy_appwrite_id text unique;
alter table support_threads         add column if not exists legacy_appwrite_id text unique;  -- = old customerId, redundant with PK but kept for symmetry
alter table support_messages        add column if not exists legacy_appwrite_id text unique;
alter table call_signals            add column if not exists legacy_appwrite_id text unique;
alter table notifications           add column if not exists legacy_appwrite_id text unique;
alter table scam_reports            add column if not exists legacy_appwrite_id text unique;
alter table wanted_posts            add column if not exists legacy_appwrite_id text unique;
alter table reviews                 add column if not exists legacy_appwrite_id text unique;

create index if not exists idx_profiles_legacy on profiles(legacy_appwrite_id);
create index if not exists idx_deals_legacy on deals(legacy_appwrite_id);
