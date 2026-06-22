-- ============================================================================
-- 0006_promo_and_reg_fee_defaults.sql
-- ============================================================================
-- 1) The seller/middleman registration pages had their bank account, QR, and
--    membership fee HARDCODED in the frontend instead of reading from
--    fee_config (companyPromptPay/companyBankAcct/.../sellerRegFee/
--    middlemanRegFee), so admin/settings changes never reached the customer.
--    seller_reg_fee/middleman_reg_fee defaulted to 0 in the DB while the
--    frontend showed ฿199 / ฿499 — backfill the real defaults onto the
--    existing singleton row only if it's still untouched (still 0), so we
--    don't clobber a value an admin may have already set.
-- 2) Add a promo/discount system for registration fees: enable/disable,
--    scope (all/seller/middleman), % off or fully free, date range, label.
-- ============================================================================

update fee_config set seller_reg_fee = 199 where seller_reg_fee = 0;
update fee_config set middleman_reg_fee = 499 where middleman_reg_fee = 0;

alter table fee_config
  add column if not exists promo_enabled boolean not null default false,
  add column if not exists promo_scope   text not null default 'all' check (promo_scope in ('all', 'seller', 'middleman')),
  add column if not exists promo_percent numeric(5,2) not null default 0 check (promo_percent >= 0 and promo_percent <= 100),
  add column if not exists promo_free    boolean not null default false,
  add column if not exists promo_start   timestamptz,
  add column if not exists promo_end     timestamptz,
  add column if not exists promo_label   text not null default '';
