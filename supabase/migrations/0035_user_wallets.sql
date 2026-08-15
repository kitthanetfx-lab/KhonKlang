-- ============================================================================
-- 0035_user_wallets.sql
-- กระเป๋าเงินสดของผู้ใช้ทุกคน (เติม / ล็อกมัดจำประมูล / ถอน)
-- มัดจำสิทธิประมูล: ผู้ขายตั้งยอดคงที่ → ล็อกตอนบิด → แพ้คืน / ชนะไม่รับของหักให้ผู้ขาย
-- ============================================================================

alter table deal_auction
  add column if not exists bid_deposit integer not null default 0 check (bid_deposit >= 0);

comment on column deal_auction.bid_deposit is
  'มัดจำสิทธิประมูล (บาท) ที่ผู้ขายกำหนด — ผู้บิดต้องมียอดว่างในกระเป๋าอย่างน้อยเท่านี้ และถูกล็อกจนกว่าจะแพ้หรือชำระครบ; ชนะแล้วไม่รับของจะถูกหักเป็นค่าเสียเวลาให้ผู้ขาย';

create table if not exists user_wallets (
  user_id             uuid primary key,
  display_name        text not null default '',
  available_balance   integer not null default 0 check (available_balance >= 0),
  held_balance        integer not null default 0 check (held_balance >= 0),
  updated_at          timestamptz not null default now()
);

comment on table user_wallets is
  'กระเป๋าเงินสดผู้ใช้ — ไม่ผูก FK ไป profiles เพื่อให้แถวการเงินอยู่ถาวรแม้บัญชีถูกลบ (แนวเดียวกับ middleman_wallets)';

create table if not exists wallet_ledger (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,
  entry_key           text not null unique,
  type                text not null,
  amount              integer not null check (amount > 0),
  available_delta     integer not null default 0,
  held_delta          integer not null default 0,
  title               text not null default '',
  reference_type      text not null default '',
  reference_id        text not null default '',
  meta                jsonb not null default '{}',
  created_at          timestamptz not null default now()
);
create index if not exists idx_wallet_ledger_user on wallet_ledger(user_id, created_at desc);

create table if not exists wallet_topups (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  amount        integer not null check (amount > 0),
  slip_file_id  text,
  status        approval_status not null default 'pending_review',
  reject_reason text,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid
);
create index if not exists idx_wallet_topups_user on wallet_topups(user_id, created_at desc);
create index if not exists idx_wallet_topups_status on wallet_topups(status);

create table if not exists wallet_withdrawals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  amount        integer not null check (amount > 0),
  bank_name     text not null default '',
  bank_acct     text not null default '',
  bank_owner    text not null default '',
  status        approval_status not null default 'pending_review',
  reject_reason text,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid
);
create index if not exists idx_wallet_withdrawals_user on wallet_withdrawals(user_id, created_at desc);
create index if not exists idx_wallet_withdrawals_status on wallet_withdrawals(status);

create table if not exists auction_deposit_holds (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references deals(id) on delete cascade,
  bidder_id     uuid not null,
  amount        integer not null check (amount > 0),
  status        text not null default 'held' check (status in ('held', 'released', 'forfeited')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (deal_id, bidder_id)
);
create index if not exists idx_auction_deposit_holds_deal on auction_deposit_holds(deal_id, status);
create index if not exists idx_auction_deposit_holds_bidder on auction_deposit_holds(bidder_id, status);

create or replace function apply_user_wallet(
  p_user_id uuid,
  p_amount integer,
  p_available_delta integer,
  p_held_delta integer,
  p_entry_key text,
  p_type text,
  p_title text default '',
  p_reference_type text default '',
  p_reference_id text default '',
  p_meta jsonb default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avail integer;
  v_held integer;
begin
  if p_user_id is null then
    raise exception 'WALLET_BAD_USER';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'WALLET_BAD_AMOUNT';
  end if;
  if p_entry_key is null or length(p_entry_key) = 0 then
    raise exception 'WALLET_BAD_KEY';
  end if;

  insert into user_wallets (user_id, display_name)
  values (p_user_id, '')
  on conflict (user_id) do nothing;

  if exists (select 1 from wallet_ledger where entry_key = p_entry_key) then
    select available_balance, held_balance into v_avail, v_held
    from user_wallets where user_id = p_user_id;
    return jsonb_build_object(
      'available_balance', coalesce(v_avail, 0),
      'held_balance', coalesce(v_held, 0),
      'idempotent', true
    );
  end if;

  select available_balance, held_balance into v_avail, v_held
  from user_wallets
  where user_id = p_user_id
  for update;

  if (v_avail + p_available_delta) < 0 or (v_held + p_held_delta) < 0 then
    raise exception 'WALLET_INSUFFICIENT';
  end if;

  update user_wallets
  set available_balance = v_avail + p_available_delta,
      held_balance = v_held + p_held_delta,
      updated_at = now()
  where user_id = p_user_id;

  insert into wallet_ledger (
    user_id, entry_key, type, amount, available_delta, held_delta,
    title, reference_type, reference_id, meta
  ) values (
    p_user_id, p_entry_key, p_type, p_amount, p_available_delta, p_held_delta,
    coalesce(p_title, ''), coalesce(p_reference_type, ''), coalesce(p_reference_id, ''),
    coalesce(p_meta, '{}'::jsonb)
  );

  return jsonb_build_object(
    'available_balance', v_avail + p_available_delta,
    'held_balance', v_held + p_held_delta,
    'idempotent', false
  );
end;
$$;

revoke all on function apply_user_wallet(uuid, integer, integer, integer, text, text, text, text, text, jsonb) from public;
revoke all on function apply_user_wallet(uuid, integer, integer, integer, text, text, text, text, text, jsonb) from anon, authenticated;
grant execute on function apply_user_wallet(uuid, integer, integer, integer, text, text, text, text, text, jsonb) to service_role;

alter table user_wallets enable row level security;
create policy user_wallets_owner_or_admin on user_wallets
  for select using (user_id = auth.uid() or is_admin());

alter table wallet_ledger enable row level security;
create policy wallet_ledger_owner_or_admin on wallet_ledger
  for select using (user_id = auth.uid() or is_admin());

alter table wallet_topups enable row level security;
create policy wallet_topups_owner_or_admin on wallet_topups
  for select using (user_id = auth.uid() or is_admin());

alter table wallet_withdrawals enable row level security;
create policy wallet_withdrawals_owner_or_admin on wallet_withdrawals
  for select using (user_id = auth.uid() or is_admin());

alter table auction_deposit_holds enable row level security;
create policy auction_deposit_holds_owner_or_admin on auction_deposit_holds
  for select using (bidder_id = auth.uid() or is_admin());
