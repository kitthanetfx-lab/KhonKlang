-- ============================================================================
-- KHONKLANG — Supabase/Postgres schema (target schema for Appwrite migration)
-- ============================================================================
-- Generated from a full audit of the live Appwrite codebase (17 collections,
-- 3 storage buckets, Users.prefs, and 2 auth flows). See SCHEMA_DESIGN.md in
-- this folder for rationale, the Appwrite→Postgres field mapping, and the
-- open questions that must be confirmed before running this against a real
-- Supabase project.
--
-- This file is idempotent-ish (uses IF NOT EXISTS / CREATE OR REPLACE where
-- possible) but is meant to be run ONCE against a fresh Supabase project,
-- then evolved via normal numbered migrations from this point on.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

create type user_role as enum ('user', 'seller', 'middleman', 'admin');
create type approval_status as enum ('pending_review', 'approved', 'rejected');
create type middleman_tier as enum ('Bronze', 'Silver', 'Gold', 'Platinum');

create type deal_source as enum ('listing', 'private');
create type deal_type as enum ('normal', 'meetup', 'simple');
create type fee_payer as enum ('buyer', 'seller', 'split');
create type deal_status as enum (
  'posted', 'waiting_seller', 'waiting_buyer', 'buyer_joined', 'terms_pending',
  'payment_pending', 'payment_uploaded', 'packing', 'shipped_to_middleman',
  'middleman_received', 'middleman_checking', 'shipped_to_buyer', 'delivered',
  'meetup_ready', 'completed', 'cancelled', 'disputed'
);
-- NOTE: 'delivered' is a dead state in the current app (defined, never set).
-- Kept for parity; safe to leave unused.

create type evidence_type as enum ('packing', 'testing', 'receive', 'check', 'chat', 'chat_text', 'call', 'other');
create type message_role as enum ('user', 'system');
create type message_type as enum ('text', 'image', 'file', 'system');

create type ledger_reference_type as enum ('deal', 'seller_application', 'middleman_application', 'onsite_job');
create type ledger_owner_type as enum ('platform', 'buyer', 'seller', 'middleman', 'system');
create type ledger_direction as enum ('incoming', 'outgoing', 'internal', 'hold');
create type ledger_status as enum (
  'expected', 'pending_review', 'confirmed', 'scheduled', 'paid', 'held',
  'released', 'forfeited', 'refunded', 'cancelled', 'void'
);
create type ledger_entry_type as enum (
  'buyer_payment', 'seller_fee_payment', 'seller_payout', 'buyer_refund',
  'meetup_buyer_deposit', 'meetup_seller_deposit', 'meetup_buyer_fee', 'meetup_seller_fee',
  'meetup_buyer_refund', 'meetup_seller_refund',
  'platform_fee', 'middleman_fee_gross', 'platform_cut', 'middleman_fee_net',
  'middleman_credit_hold', 'seller_registration', 'middleman_registration',
  'onsite_service_fee', 'onsite_travel_fee'
);

create type onsite_status as enum ('open', 'quoted', 'accepted', 'in_progress', 'completed', 'cancelled');
create type support_thread_status as enum ('open', 'closed');
create type support_sender_role as enum ('customer', 'staff', 'system');
create type call_status as enum ('idle', 'customer_requesting', 'staff_ringing', 'connecting', 'active', 'ended');
create type call_party_role as enum ('customer', 'staff');
create type call_signal_type as enum ('offer', 'answer', 'candidate', 'hangup', 'debug');

create type review_role as enum ('buyer', 'seller', 'middleman', 'platform');
create type wanted_status as enum ('open', 'closed');
create type buy_mode as enum ('middleman', 'direct', 'both');

-- ============================================================================
-- shared trigger: keep updated_at current
-- ============================================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- 2. PROFILES  (replaces: `profiles` collection + Users.prefs, 1:1 with auth.users)
-- ============================================================================
-- This is the single source of truth for user data. The Appwrite app had the
-- same fields duplicated in two places (a `profiles` collection AND
-- Users.prefs) reconciled by an ad-hoc /api/profile/sync route. That entire
-- class of bug disappears once there is exactly one row per user.

create table profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  role                  user_role not null default 'user',

  first_name            text,
  last_name             text,
  display_name          text,
  phone                 text,
  address               text,
  email                 text,

  bank_name             text,
  bank_acct             text,
  bank_owner            text,
  bank_qr_file_id       text,                 -- storage object path in bucket 'deal-files'

  seller_status         approval_status,
  middleman_status      approval_status,
  middleman_tier_intent middleman_tier,        -- self-declared at registration
  middleman_tier        middleman_tier,        -- set by admin on approval (source of truth for credit limit)

  review_score          numeric(3,2) not null default 0,   -- denormalized avg, kept in sync by trigger on reviews
  review_count          integer not null default 0,

  shop_name             text,
  shop_location         text,
  shop_address          text,
  shop_public           boolean not null default false,

  -- Optional manual-merge pointer, kept only as an escape hatch. Prefer
  -- Supabase's native auth.identities linking over re-implementing the old
  -- phone-matching auto-link logic — see SCHEMA_DESIGN.md §Auth.
  linked_to             uuid references profiles(id),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index idx_profiles_phone on profiles(phone);
create index idx_profiles_role on profiles(role);
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ============================================================================
-- 3. WANTED POSTS  (created before `deals` because deals references it)
-- ============================================================================
create table wanted_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id),
  user_name   text,
  title       text not null,
  detail      text,
  budget_min  integer not null default 0,
  budget_max  integer not null default 0,
  category    text,
  province    text,
  buy_mode    buy_mode not null default 'middleman',
  contact     text,
  status      wanted_status not null default 'open',
  created_at  timestamptz not null default now()
);
create index idx_wanted_user on wanted_posts(user_id);
create index idx_wanted_status on wanted_posts(status);

-- ============================================================================
-- 4. DEALS  (core entity)
-- ============================================================================
create table deals (
  id                        uuid primary key default gen_random_uuid(),
  deal_number               text not null unique,   -- e.g. 'KKL-3E406A46' — MUST be carried over verbatim
                                                      -- from the old dealCode(appwriteId) during data migration,
                                                      -- not regenerated, or every existing deal's visible code changes.

  -- on delete set null: ลบบัญชีผู้ใช้แล้วดีลยังอยู่ครบ (ดู migration 0014_account_deletion.sql)
  -- ชื่อ ณ ขณะทำดีล (seller_name/middleman_name/buyer_name) เป็น text แยก ไม่หายไปด้วย
  seller_id                 uuid references profiles(id) on delete set null,
  seller_name                text,
  middleman_id              uuid references profiles(id) on delete set null,
  middleman_name             text,
  buyer_id                  uuid references profiles(id) on delete set null,
  buyer_name                 text,
  creator_id                uuid references profiles(id) on delete set null,  -- ผู้สร้างดีล (ใช้คำนวณส่วนแบ่ง simple)

  title                     text not null,
  description               text,
  price                     integer not null check (price >= 0),
  category                  text,
  condition                 text,
  location                  text,
  selling_mode              text not null default 'normal',

  status                    deal_status not null default 'posted',
  source                    deal_source,
  deal_type                 deal_type not null default 'normal',
  fee_payer                 fee_payer,

  seller_accepted_terms     boolean not null default false,
  middleman_accepted_terms  boolean not null default false,
  buyer_accepted_terms      boolean not null default false,
  middleman_confirmed_payment boolean not null default false,
  buyer_confirmed_check     boolean not null default false,

  payment_slip_file_id      text,   -- storage path in 'deal-files'
  payment_slip_verified_at  timestamptz,
  tracking_to_middleman     text,
  tracking_to_middleman_provider text,
  tracking_to_buyer         text,
  tracking_to_buyer_provider text,
  reject_reason             text,

  wanted_post_id            uuid references wanted_posts(id),

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index idx_deals_seller on deals(seller_id);
create index idx_deals_buyer on deals(buyer_id);
create index idx_deals_creator on deals(creator_id);
create index idx_deals_middleman on deals(middleman_id);
create index idx_deals_status on deals(status);
create index idx_deals_created on deals(created_at desc);
create trigger trg_deals_updated_at before update on deals
  for each row execute function set_updated_at();

-- 4a. deal_price_state — replaces the `priceData` JSON blob, 1:1 with deals
create table deal_price_state (
  deal_id               uuid primary key references deals(id) on delete cascade,
  proposed_price        integer,
  proposed_fee_payer    fee_payer,
  proposed_by           text check (proposed_by in ('seller', 'buyer', 'middleman')),
  proposal_kind         text check (proposal_kind in ('current', 'reprice')),
  agreed                boolean not null default false,
  seller_agreed         boolean not null default false,
  buyer_agreed          boolean not null default false,
  middleman_agreed      boolean not null default false,
  mm_deposit_held       integer not null default 0,
  evidence_done_seller  boolean not null default false,
  evidence_done_buyer   boolean not null default false,
  evidence_done_middleman boolean not null default false,
  chat_done_seller      boolean not null default false,
  chat_done_buyer       boolean not null default false,
  chat_done_middleman   boolean not null default false,
  seller_fee_slip       text,
  seller_fee_slip_verified_at timestamptz,
  payout_sent_at        timestamptz,
  payout_slip_file_id   text,
  payout_note           text,
  refund_sent_at        timestamptz,
  refund_slip_file_id   text,
  refund_note           text,
  updated_at            timestamptz not null default now()
);
create trigger trg_deal_price_state_updated_at before update on deal_price_state
  for each row execute function set_updated_at();

-- 4b. deal_meetup — replaces the `meetupData` JSON blob, 1:1 with deals (deal_type = 'meetup')
create table deal_meetup (
  deal_id             uuid primary key references deals(id) on delete cascade,
  buyer_loc           jsonb,                 -- {province, amphoe, tambon}
  seller_loc          jsonb,
  meet_label          text,
  pending_meet_label  text,
  deposit             integer not null default 0,
  buyer_departed_at   timestamptz,
  seller_departed_at  timestamptz,
  buyer_pos           jsonb,                 -- {lat, lng, at}
  seller_pos          jsonb,
  pending_deposit     integer,
  pending_by          text check (pending_by in ('buyer', 'seller')),
  buyer_fee           integer not null default 0,
  seller_fee          integer not null default 0,
  buyer_slip          text,
  seller_slip         text,
  buyer_met           boolean not null default false,
  seller_met          boolean not null default false,
  refunded_at         timestamptz,
  refund_note         text,
  -- Catch-all for legacy v1 fields (buyerProvince/sellerProvince/meetProvince/
  -- buyerKm/sellerKm/ratePerKm/buyerDeposit/sellerDeposit/fee/feeWho) found on
  -- old rows during the data migration. Not used by new code.
  legacy_meta         jsonb,
  updated_at          timestamptz not null default now()
);
create trigger trg_deal_meetup_updated_at before update on deal_meetup
  for each row execute function set_updated_at();

-- 4c. deal_images — replaces `imageFileIds` JSON array
create table deal_images (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references deals(id) on delete cascade,
  file_id     text not null,    -- storage path in 'deal-files'
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index idx_deal_images_deal on deal_images(deal_id, position);

-- 4d. deal_evidence — replaces `evidenceData` JSON array
create table deal_evidence (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid not null references deals(id) on delete cascade,
  type            evidence_type not null,
  file_id         text,
  file_name       text,
  content         text,
  uploaded_by     uuid references profiles(id) on delete set null,
  uploader_name   text,
  created_at      timestamptz not null default now()
);
create index idx_deal_evidence_deal on deal_evidence(deal_id, created_at);

-- ============================================================================
-- 5. MESSAGES (per-deal chat) & DM_MESSAGES (1:1 direct chat)
-- ============================================================================
create table messages (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references deals(id) on delete cascade,
  sender_id   uuid references profiles(id) on delete set null,     -- null for system messages, หรือหลังลบบัญชีผู้ส่ง
  sender_name text,
  role        message_role not null default 'user',
  type        message_type not null default 'text',
  content     text,
  file_id     text,
  file_name   text,
  created_at  timestamptz not null default now()
);
create index idx_messages_deal on messages(deal_id, created_at);

create table dm_messages (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid not null references profiles(id),
  from_name   text,
  to_id       uuid not null references profiles(id),
  to_name     text,
  content     text not null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index idx_dm_pair on dm_messages(least(from_id, to_id), greatest(from_id, to_id), created_at);
create index idx_dm_to on dm_messages(to_id);
create index idx_dm_from on dm_messages(from_id);

-- ============================================================================
-- 6. FINANCE LEDGER & MIDDLEMAN WALLETS
-- ============================================================================
create table finance_ledger (
  id                  uuid primary key default gen_random_uuid(),
  entry_key           text not null unique,   -- e.g. 'deal:{id}:buyer_payment' — idempotency key for upserts
  reference_type      ledger_reference_type not null,
  reference_id        uuid not null,
  deal_id             uuid references deals(id),
  deal_number         text,
  owner_type          ledger_owner_type not null,   -- NOTE: always set this. Appwrite version declared but
                                                      -- never wrote this field — fix carried into this schema.
  owner_id            uuid references profiles(id) on delete set null, -- null when owner_type in ('platform','system') หรือหลังลบบัญชีเจ้าของ
  owner_name          text,
  entry_type          ledger_entry_type not null,
  direction           ledger_direction not null,
  amount              integer not null check (amount >= 0),
  status              ledger_status not null,
  title               text,
  purpose             text,
  counterparty_name   text,
  bucket              text,             -- 'deal-files' | 'kyc-docs' | null
  file_id             text,
  approve_link        text,
  meta                jsonb not null default '{}',   -- native jsonb, replaces stringified-JSON column
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_ledger_ref on finance_ledger(reference_type, reference_id);
create index idx_ledger_deal on finance_ledger(deal_id);
create index idx_ledger_owner on finance_ledger(owner_id);
create index idx_ledger_status on finance_ledger(status);
create index idx_ledger_updated on finance_ledger(updated_at desc);
create trigger trg_finance_ledger_updated_at before update on finance_ledger
  for each row execute function set_updated_at();

create table middleman_wallets (
  -- ไม่ใส่ FK ไป profiles(id) โดยตั้งใจ — เป็นแถวการเงิน ต้องอยู่ถาวรแม้บัญชีถูกลบ (ดู migration 0014)
  middleman_id        uuid primary key,
  middleman_name      text,
  tier                middleman_tier not null default 'Bronze',
  credit_limit        integer not null default 0,
  available_credit    integer not null default 0,
  held_credit         integer not null default 0,
  released_credit     integer not null default 0,
  penalty_credit      integer not null default 0,
  active_deal_count   integer not null default 0,
  updated_at          timestamptz not null default now()
);

-- ============================================================================
-- 7. APPLICATIONS (seller / middleman)
-- ============================================================================
create table seller_applications (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles(id),
  seller_type         text not null check (seller_type in ('freelance', 'physical', 'distributor', 'corporate')),
  full_name_id        text not null,
  id_number           text not null,
  province            text,
  address             text,
  online_link         text,
  company_name        text,
  company_reg_num     text,
  bank_acct           text,
  bank_name           text,
  bank_owner          text,
  company_bank_acct   text,
  company_bank_name   text,
  id_card_file_id     text,
  company_cert_file_id text,
  bookbank_file_id    text,
  slip_file_id        text,
  status              approval_status not null default 'pending_review',
  reject_reason       text,
  created_at          timestamptz not null default now()
);
create index idx_seller_apps_user on seller_applications(user_id);
create index idx_seller_apps_status on seller_applications(status);

create table middleman_applications (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles(id),
  full_name_id        text not null,
  id_number           text not null,
  deposit_intent      integer not null default 0,
  tier                middleman_tier not null default 'Bronze',
  categories          text[] not null default '{}',
  work_province       text,
  terms               text,
  bank_acct           text,
  bank_name           text,
  bank_owner          text,
  id_card_file_id     text,
  bookbank_file_id    text,
  slip_file_id        text,
  status              approval_status not null default 'pending_review',
  reject_reason       text,
  created_at          timestamptz not null default now()
);
create index idx_mm_apps_user on middleman_applications(user_id);
create index idx_mm_apps_status on middleman_applications(status);

-- ============================================================================
-- 8. ONSITE JOBS
-- ============================================================================
create table onsite_jobs (
  id                  uuid primary key default gen_random_uuid(),
  buyer_id            uuid references profiles(id) on delete set null,   -- ดีลออนไซต์ต้องอยู่ครบแม้ลบบัญชีผู้ซื้อ (ดู migration 0014)
  buyer_name          text,
  item_description    text not null,
  item_price          integer not null default 0,   -- fixed: was numeric-as-string in Appwrite
  seller_location     text not null,
  seller_province     text,
  seller_contact      text,
  max_budget          integer not null default 0,
  status              onsite_status not null default 'open',
  middleman_id        uuid references profiles(id) on delete set null,
  middleman_name      text,
  middleman_tier      middleman_tier,
  middleman_deposit   integer not null default 0,
  travel_fee          integer not null default 0,
  service_fee         integer not null default 0,
  estimated_arrival   text,
  conditions          text,
  quoted_at           timestamptz,
  accepted_at         timestamptz,
  started_at          timestamptz,
  completed_at        timestamptz,
  report_notes        text,
  created_at          timestamptz not null default now()
);
create index idx_onsite_buyer on onsite_jobs(buyer_id);
create index idx_onsite_mm on onsite_jobs(middleman_id);
create index idx_onsite_status on onsite_jobs(status);
create index idx_onsite_province on onsite_jobs(seller_province);

-- ============================================================================
-- 9. PLATFORM CONFIG  (replaces the generic `app_config` key/blob collection)
-- ============================================================================
-- Singleton row instead of a key-value bag — every field is a real, typed
-- column instead of a parsed JSON string, and admin/settings just does a
-- plain UPDATE.
create table fee_config (
  id                      boolean primary key default true check (id),  -- enforces single row
  escrow_fee_percent      numeric(5,2) not null default 2.5,
  escrow_fee_min          integer not null default 20,
  middleman_fee_percent   numeric(5,2) not null default 1.5,
  middleman_fee_min       integer not null default 30,
  platform_cut_percent    numeric(5,2) not null default 20,
  simple_fee_percent      numeric(5,2) not null default 2,
  simple_fee_min          integer not null default 20,
  simple_middleman_share_percent numeric(5,2) not null default 18,  -- legacy; ใช้ simple_share_tier* แทน
  simple_share_tier1_multiplier numeric(8,2) not null default 1,
  simple_share_tier1_percent numeric(5,2) not null default 30,
  simple_share_tier2_multiplier numeric(8,2) not null default 2,
  simple_share_tier2_percent numeric(5,2) not null default 40,
  simple_share_tier3_multiplier numeric(8,2) not null default 4,
  simple_share_tier3_percent numeric(5,2) not null default 50,
  inspection_fee          integer not null default 100,
  packing_fee             integer not null default 50,
  deposit_bronze          integer not null default 1000,
  deposit_silver          integer not null default 5000,
  deposit_gold            integer not null default 20000,
  deposit_platinum        integer not null default 50000,
  failed_deal_fee         integer not null default 50,
  onsite_base_fee         integer not null default 300,
  onsite_per_km           integer not null default 5,
  meetup_fee_percent      numeric(5,2) not null default 0,
  meetup_fee_min          integer not null default 50,
  seller_reg_fee          integer not null default 199,
  middleman_reg_fee       integer not null default 499,
  return_shipping_by      fee_payer not null default 'buyer',
  company_prompt_pay      text not null default '',
  company_bank_name       text not null default '',
  company_bank_acct       text not null default '',
  company_bank_holder     text not null default '',
  company_qr_file_id      text not null default '',
  -- โปรโมชัน/ส่วนลดค่าสมัคร (ผู้ขาย/คนกลาง) ตามช่วงเวลาที่กำหนด — ดู 0006_promo_and_reg_fee_defaults.sql
  promo_enabled           boolean not null default false,
  promo_scope             text not null default 'all' check (promo_scope in ('all', 'seller', 'middleman')),
  promo_percent           numeric(5,2) not null default 0 check (promo_percent >= 0 and promo_percent <= 100),
  promo_free              boolean not null default false,
  promo_start             timestamptz,
  promo_end               timestamptz,
  promo_label             text not null default '',
  -- Slip verification (SlipOK) — admin-configurable instead of env-var-only.
  -- Store the API key via Supabase Vault in production; this column exists
  -- so the settings UI has somewhere to read/write it through an RPC that
  -- talks to Vault, rather than a plaintext column. See SCHEMA_DESIGN.md.
  slipok_branch_id        text,
  slipok_api_key_secret_id uuid,   -- reference into vault.secrets, not the key itself
  updated_at              timestamptz not null default now()
);
insert into fee_config (id) values (true);
create trigger trg_fee_config_updated_at before update on fee_config
  for each row execute function set_updated_at();

create table service_controls (
  key         text primary key,   -- tradeOnline, tradeSimple, meetupGuarantee, meetupSafeZone,
                                   -- consign, onsite, sellerRegistration, middlemanRegistration,
                                   -- siteMaintenance, slipAutoVerify
  enabled     boolean not null default true,
  note        text not null default '',
  reopen_at   timestamptz,
  amount_threshold numeric,
  updated_at  timestamptz not null default now()
);
insert into service_controls (key) values
  ('tradeOnline'), ('tradeSimple'), ('meetupGuarantee'), ('meetupSafeZone'),
  ('consign'), ('onsite'), ('sellerRegistration'), ('middlemanRegistration'),
  ('siteMaintenance'), ('slipAutoVerify');
create trigger trg_service_controls_updated_at before update on service_controls
  for each row execute function set_updated_at();

-- ============================================================================
-- 10. CUSTOMER SUPPORT (threads / messages / call signaling)
-- ============================================================================
create table support_threads (
  customer_id               uuid primary key references profiles(id),
  customer_name             text,
  status                    support_thread_status not null default 'open',
  last_message              text,
  last_at                   timestamptz,
  last_sender               text check (last_sender in ('customer', 'staff')),
  unread_customer           boolean not null default false,
  unread_staff              boolean not null default false,
  assigned_staff_id         uuid references profiles(id),
  assigned_staff_name       text,
  call_status               call_status not null default 'idle',
  call_id                   text,
  call_initiator            call_party_role,
  call_staff_id             uuid references profiles(id),
  call_staff_name           text,
  call_updated_at           timestamptz,
  last_read_by_customer_at  timestamptz,
  last_read_by_staff_at     timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create trigger trg_support_threads_updated_at before update on support_threads
  for each row execute function set_updated_at();

create table support_messages (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references support_threads(customer_id) on delete cascade,
  sender_id     uuid references profiles(id),
  sender_name   text,
  sender_role   support_sender_role not null default 'customer',
  content       text,
  image_url     text,
  mime_type     text,
  created_at    timestamptz not null default now()
);
create index idx_support_messages_thread on support_messages(thread_id, created_at);

create table call_signals (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references support_threads(customer_id) on delete cascade,
  call_id     text not null,
  from_role   call_party_role not null,
  type        call_signal_type not null,
  data        jsonb,
  created_at  timestamptz not null default now()
);
create index idx_call_signals_call on call_signals(call_id, created_at);

-- ============================================================================
-- 11. NOTIFICATIONS
-- ============================================================================
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id),
  title       text,
  body        text,
  link        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id, created_at desc);

create table admin_line_notifications (
  deal_id   uuid not null references deals(id) on delete cascade,
  step      text not null check (step in ('confirm_pay', 'pay_seller', 'refund_pending', 'middleman_fee', 'meetup_refund')),
  sent_at   timestamptz not null default now(),
  primary key (deal_id, step)
);
create index idx_admin_line_notifications_sent on admin_line_notifications(sent_at desc);

-- ============================================================================
-- 11.5. DEVICE TOKENS (FCM/APNs — push notification สำหรับแอปมือถือ)
-- ============================================================================
-- เก็บ token ที่แอป (Capacitor) ขอจาก FCM/APNs แล้วยิง POST /api/push/register มา
-- 1 user สามารถมีหลายเครื่อง → เก็บหลาย token ได้ (unique ที่ user_id+token)
create table device_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  token      text not null,
  platform   text check (platform in ('android','ios','web')) not null,
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);
create index idx_device_tokens_user on device_tokens(user_id);

-- ============================================================================
-- 12. SCAM REPORTS
-- ============================================================================
create table scam_reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid references profiles(id) on delete set null,  -- เก็บรายงานไว้เพื่อความปลอดภัยผู้อื่น แม้ผู้รายงานลบบัญชี
  first_name        text not null,
  last_name         text,
  id_card           text,
  bank_accounts     jsonb not null default '[]',     -- [{acct, bank}]
  search_blob       text not null default '',
  product           text,
  amount            integer not null default 0 check (amount >= 0),
  transfer_date     text,
  seller_page       text,
  province          text,
  detail            text not null check (char_length(detail) >= 30),
  chat_image_ids    text[] not null default '{}',
  police_doc_ids    text[] not null default '{}',
  slip_image_ids    text[] not null default '{}',
  contact_email     text,
  contact_phone     text,
  contact_line      text,
  source_name       text,
  status            approval_status not null default 'pending_review',
  created_at        timestamptz not null default now()
);
create index idx_scam_reports_status on scam_reports(status);
create index idx_scam_reports_reporter on scam_reports(reporter_id);
create index idx_scam_reports_search on scam_reports using gin (to_tsvector('simple', search_blob));

-- ============================================================================
-- 13. REVIEWS
-- ============================================================================
create table reviews (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid not null references deals(id),
  reviewer_id     uuid not null references profiles(id),
  reviewer_name   text,
  reviewer_role   review_role not null,
  target_id       uuid references profiles(id) on delete set null,  -- รีวิวที่ผู้ถูกลบบัญชีเป็นฝ่ายได้รับยังอยู่ (หลักฐานดีล)
  target_role     review_role not null,
  rating          smallint not null check (rating between 1 and 5),
  tags            text[] not null default '{}' check (array_length(tags, 1) is null or array_length(tags, 1) <= 6),
  comment         text check (char_length(comment) <= 1000),
  created_at      timestamptz not null default now(),
  unique (deal_id, reviewer_id)   -- DB-enforced "one review per reviewer per deal" (was app-level 409 check)
);
create index idx_reviews_deal on reviews(deal_id);
create index idx_reviews_target on reviews(target_id);

-- keep profiles.review_score / review_count in sync automatically
create or replace function recompute_review_stats() returns trigger as $$
declare
  target uuid := coalesce(new.target_id, old.target_id);
begin
  if target is null then
    return coalesce(new, old);
  end if;
  update profiles p
    set review_score = coalesce((select round(avg(rating)::numeric, 2) from reviews where target_id = target), 0),
        review_count  = (select count(*) from reviews where target_id = target)
    where p.id = target;
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger trg_reviews_stats_ins after insert on reviews
  for each row execute function recompute_review_stats();
create trigger trg_reviews_stats_upd after update on reviews
  for each row execute function recompute_review_stats();
create trigger trg_reviews_stats_del after delete on reviews
  for each row execute function recompute_review_stats();

-- ============================================================================
-- 13a. ลบบัญชีผู้ใช้ (แอดมิน) — ดู migration 0014_account_deletion.sql สำหรับ
-- คำอธิบายเต็ม: ลบ "ประวัติที่ไม่ใช่การเงิน/ดีล" แบบ transaction เดียว ก่อนที่
-- ฝั่ง API จะเรียก auth.admin.deleteUser() ต่อ (ลบ auth.users → cascade ลบ
-- profiles → deals/finance_ledger/onsite_jobs/messages/deal_evidence/
-- reviews.target_id/scam_reports.reporter_id กลายเป็น NULL อัตโนมัติ ตัวแถว
-- ไม่หาย เพราะทุกคอลัมน์ข้างบนตั้งเป็น ON DELETE SET NULL แล้ว)
-- ============================================================================
-- หมายเหตุ: พารามิเตอร์ตั้งชื่อ p_user_id (ไม่ใช่ target_id) โดยตั้งใจ — ถ้าตั้งชื่อ
-- target_id จะชนกับคอลัมน์ reviews.target_id ทำให้ Postgres error "ambiguous"
-- (แก้จริงใน migration 0015_fix_delete_account_history.sql)
create or replace function delete_account_history(p_user_id uuid) returns void as $$
begin
  delete from support_threads where customer_id = p_user_id;     -- cascades: support_messages, call_signals
  delete from notifications   where user_id = p_user_id;
  delete from dm_messages     where from_id = p_user_id or to_id = p_user_id;
  delete from wanted_posts    where user_id = p_user_id;
  delete from seller_applications    where user_id = p_user_id;
  delete from middleman_applications where user_id = p_user_id;
  delete from reviews         where reviewer_id = p_user_id;      -- รีวิวที่เขาเป็นคนเขียนเอง (target ฝั่งถูกรีวิวเก็บไว้)
end;
$$ language plpgsql security definer;

-- ============================================================================
-- 14. ROW LEVEL SECURITY
-- ============================================================================
-- Design principle: most multi-party state-machine writes (deal status
-- transitions, ledger sync, wallet sync) stay server-side using the Supabase
-- service role key, exactly like today's API routes — RLS here is primarily
-- a read-path guard plus a safety net, not the only line of defense. See
-- SCHEMA_DESIGN.md §RLS for the full rationale per table.

create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

alter table profiles enable row level security;
create policy profiles_select_own_or_admin on profiles
  for select using (id = auth.uid() or is_admin());
create policy profiles_update_own on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on profiles
  for all using (is_admin());

alter table deals enable row level security;
create policy deals_select_participant_or_admin on deals
  for select using (
    buyer_id = auth.uid() or seller_id = auth.uid() or middleman_id = auth.uid()
    or status in ('posted', 'waiting_seller', 'waiting_buyer')   -- public marketplace listing browse
    or is_admin()
  );
create policy deals_admin_write on deals
  for all using (is_admin());
-- Day-to-day writes (status transitions, accept terms, etc.) go through
-- server-side RPCs / API routes using the service role — see SCHEMA_DESIGN.md.

alter table deal_price_state enable row level security;
create policy deal_price_state_participant on deal_price_state
  for select using (
    is_admin() or exists (
      select 1 from deals d where d.id = deal_id
      and (d.buyer_id = auth.uid() or d.seller_id = auth.uid() or d.middleman_id = auth.uid())
    )
  );

alter table deal_meetup enable row level security;
create policy deal_meetup_participant on deal_meetup
  for select using (
    is_admin() or exists (
      select 1 from deals d where d.id = deal_id
      and (d.buyer_id = auth.uid() or d.seller_id = auth.uid() or d.middleman_id = auth.uid())
    )
  );

alter table deal_images enable row level security;
create policy deal_images_participant on deal_images
  for select using (
    is_admin() or exists (
      select 1 from deals d where d.id = deal_id
      and (d.buyer_id = auth.uid() or d.seller_id = auth.uid() or d.middleman_id = auth.uid()
           or d.status in ('posted', 'waiting_seller', 'waiting_buyer'))
    )
  );

alter table deal_evidence enable row level security;
create policy deal_evidence_participant on deal_evidence
  for select using (
    is_admin() or exists (
      select 1 from deals d where d.id = deal_id
      and (d.buyer_id = auth.uid() or d.seller_id = auth.uid() or d.middleman_id = auth.uid())
    )
  );

alter table messages enable row level security;
create policy messages_participant on messages
  for select using (
    is_admin() or exists (
      select 1 from deals d where d.id = deal_id
      and (d.buyer_id = auth.uid() or d.seller_id = auth.uid() or d.middleman_id = auth.uid())
    )
  );
create policy messages_insert_participant on messages
  for insert with check (
    sender_id = auth.uid() and exists (
      select 1 from deals d where d.id = deal_id
      and (d.buyer_id = auth.uid() or d.seller_id = auth.uid() or d.middleman_id = auth.uid())
    )
  );

alter table dm_messages enable row level security;
create policy dm_participant on dm_messages
  for select using (from_id = auth.uid() or to_id = auth.uid() or is_admin());
create policy dm_insert on dm_messages
  for insert with check (from_id = auth.uid());

-- Finance is sensitive: owner can see their own entries, admin sees all.
-- Nobody other than the service role can write directly.
alter table finance_ledger enable row level security;
create policy finance_ledger_owner_or_admin on finance_ledger
  for select using (owner_id = auth.uid() or is_admin());

alter table middleman_wallets enable row level security;
create policy wallet_owner_or_admin on middleman_wallets
  for select using (middleman_id = auth.uid() or is_admin());

alter table seller_applications enable row level security;
create policy seller_app_owner_or_admin on seller_applications
  for select using (user_id = auth.uid() or is_admin());
create policy seller_app_insert_own on seller_applications
  for insert with check (user_id = auth.uid());
create policy seller_app_admin_update on seller_applications
  for update using (is_admin());

alter table middleman_applications enable row level security;
create policy mm_app_owner_or_admin on middleman_applications
  for select using (user_id = auth.uid() or is_admin());
create policy mm_app_insert_own on middleman_applications
  for insert with check (user_id = auth.uid());
create policy mm_app_admin_update on middleman_applications
  for update using (is_admin());

alter table onsite_jobs enable row level security;
create policy onsite_visible on onsite_jobs
  for select using (
    status = 'open' or buyer_id = auth.uid() or middleman_id = auth.uid() or is_admin()
  );
create policy onsite_insert_own on onsite_jobs
  for insert with check (buyer_id = auth.uid());

alter table fee_config enable row level security;
create policy fee_config_read_all on fee_config for select using (true);
create policy fee_config_admin_write on fee_config for update using (is_admin());

alter table service_controls enable row level security;
create policy service_controls_read_all on service_controls for select using (true);
create policy service_controls_admin_write on service_controls for update using (is_admin());

alter table support_threads enable row level security;
create policy support_thread_owner_or_staff on support_threads
  for select using (customer_id = auth.uid() or is_admin());
create policy support_thread_owner_insert on support_threads
  for insert with check (customer_id = auth.uid());

alter table support_messages enable row level security;
create policy support_messages_owner_or_staff on support_messages
  for select using (
    is_admin() or exists (select 1 from support_threads t where t.customer_id = thread_id and t.customer_id = auth.uid())
  );

alter table call_signals enable row level security;
create policy call_signals_owner_or_staff on call_signals
  for select using (
    is_admin() or exists (select 1 from support_threads t where t.customer_id = thread_id and t.customer_id = auth.uid())
  );

alter table notifications enable row level security;
create policy notifications_owner on notifications
  for select using (user_id = auth.uid());
create policy notifications_owner_update on notifications
  for update using (user_id = auth.uid());

alter table scam_reports enable row level security;
create policy scam_reports_public_read_approved on scam_reports
  for select using (status = 'approved' or reporter_id = auth.uid() or is_admin());
create policy scam_reports_insert_any on scam_reports
  for insert with check (true);   -- public reporting form, reporter_id optional (anonymous allowed)
create policy scam_reports_admin_moderate on scam_reports
  for update using (is_admin());

alter table wanted_posts enable row level security;
create policy wanted_public_read on wanted_posts for select using (true);
create policy wanted_owner_write on wanted_posts
  for insert with check (user_id = auth.uid());
create policy wanted_owner_update on wanted_posts
  for update using (user_id = auth.uid() or is_admin());

alter table reviews enable row level security;
create policy reviews_public_read on reviews for select using (true);
create policy reviews_insert_own on reviews
  for insert with check (
    reviewer_id = auth.uid()
    and exists (select 1 from deals d where d.id = deal_id and d.status = 'completed')
  );

-- ============================================================================
-- 15. STORAGE BUCKETS
-- ============================================================================
-- Run via the Supabase dashboard or supabase-js admin client; included here
-- for completeness. Mirrors the 3 Appwrite buckets 1:1.
--
-- PUBLIC buckets — this matches the old Appwrite app's actual behavior: every
-- file URL there was a plain `.../view?project=...` with no auth header
-- (images/slips/QR codes are rendered via plain <img src>, which can't carry
-- an Authorization header anyway). Access control was "unguessable file id",
-- not real per-user permission checks at the storage layer — ported as-is,
-- see supabase/migrations/0003_public_buckets.sql for the rationale in full.
insert into storage.buckets (id, name, public) values
  ('deal-files', 'deal-files', true),
  ('kyc-docs', 'kyc-docs', true),
  ('report-files', 'report-files', true)
on conflict (id) do nothing;
