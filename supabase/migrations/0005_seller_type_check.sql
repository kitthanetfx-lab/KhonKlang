-- ============================================================================
-- 0005_seller_type_check.sql
-- ============================================================================
-- seller_applications.seller_type had a check constraint left over from an
-- earlier draft of the schema (only 'individual' | 'corporate'), but the
-- actual /register/seller form (and the admin/sellers review page that reads
-- it back) uses four granular categories: 'freelance', 'physical',
-- 'distributor', 'corporate'. Every real submission except 'corporate' was
-- failing with:
--   new row for relation "seller_applications" violates check constraint
--   "seller_applications_seller_type_check"
-- This widens the constraint to match what the app actually sends/displays.
-- ============================================================================

alter table seller_applications drop constraint if exists seller_applications_seller_type_check;
alter table seller_applications add constraint seller_applications_seller_type_check
  check (seller_type in ('freelance', 'physical', 'distributor', 'corporate'));
