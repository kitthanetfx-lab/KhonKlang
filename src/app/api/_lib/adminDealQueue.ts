import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeeConfig } from '@/lib/fees';
import { computeDealFees } from '@/lib/fees';
import { splitDealFeeComponents } from '@/lib/financeLedger';
import { readFeesConfig } from './financeLedger';
import {
  type AdminDealCategory,
  type AdminStatusTab,
  dealMatchesCategory,
  isBareListing,
  onsiteMatchesTab,
  parseAdminDealCategory,
} from '@/lib/adminDealCategory';

export type AdminQueueStep =
  | 'confirm_pay'
  | 'pay_seller'
  | 'refund_pending'
  | 'middleman_fee'
  | 'meetup_refund';

export type AdminDealRow = {
  id: string;
  status: string;
  deal_type: string;
  source?: string | null;
  payment_slip_file_id?: string | null;
  middleman_id?: string | null;
  price?: number | null;
  shipping_cost?: number | null;
  fee_payer?: string | null;
  buyer_id?: string | null;
  warranty_years?: number | null;
  warranty_months?: number | null;
  warranty_days?: number | null;
  deal_number?: string | null;
  title?: string | null;
  buyer_name?: string | null;
  seller_name?: string | null;
};

export type AdminPriceStateRow = {
  deal_id?: string;
  proposed_fee_payer?: string | null;
  payout_slip_file_id?: string | null;
  payout_requested_at?: string | null;
  refund_slip_file_id?: string | null;
  middleman_fee_sent_at?: string | null;
  seller_fee_slip?: string | null;
};

export type AdminMeetupRow = {
  deal_id?: string;
  refund_outcome?: string | null;
  buyer_slip?: string | null;
  seller_slip?: string | null;
};

export type AdminDealSnapshot = {
  deal: AdminDealRow;
  priceState?: AdminPriceStateRow | null;
  meetup?: AdminMeetupRow | null;
};

export function middlemanNetFeeAmount(fees: FeeConfig, deal: AdminDealRow): number {
  const fb = computeDealFees(fees, Number(deal.price) || 0, deal.deal_type);
  return splitDealFeeComponents(fees, fb.lines).middlemanNetFee;
}

export function isInPaySellerQueue(deal: AdminDealRow, ps?: AdminPriceStateRow | null) {
  if (deal.status !== 'completed' || deal.deal_type === 'meetup' || !!ps?.payout_slip_file_id) return false;
  // ดีลแบบง่าย: รอผู้ขายรีวิวแล้วกดขอรับเงิน ก่อนเข้าคิวโอน
  if (deal.deal_type === 'simple') return !!ps?.payout_requested_at;
  return true;
}

export function isInRefundPendingQueue(deal: AdminDealRow, ps?: AdminPriceStateRow | null) {
  return deal.status === 'cancelled'
    && deal.deal_type !== 'meetup'
    && !!deal.payment_slip_file_id
    && !ps?.refund_slip_file_id;
}

export function isInMiddlemanFeeQueue(deal: AdminDealRow, ps: AdminPriceStateRow | null | undefined, fees: FeeConfig) {
  return deal.status === 'completed'
    && !!deal.middleman_id
    && !ps?.middleman_fee_sent_at
    && middlemanNetFeeAmount(fees, deal) > 0;
}

export function isInMeetupRefundQueue(deal: AdminDealRow, meetup?: AdminMeetupRow | null) {
  return deal.deal_type === 'meetup' && deal.status === 'completed' && !meetup?.refund_outcome;
}

const ALL_STEPS: AdminQueueStep[] = [
  'confirm_pay',
  'pay_seller',
  'refund_pending',
  'middleman_fee',
  'meetup_refund',
];

function isInQueue(step: AdminQueueStep, snap: AdminDealSnapshot, fees: FeeConfig): boolean {
  switch (step) {
    case 'confirm_pay':
      return snap.deal.status === 'payment_uploaded';
    case 'pay_seller':
      return isInPaySellerQueue(snap.deal, snap.priceState);
    case 'refund_pending':
      return isInRefundPendingQueue(snap.deal, snap.priceState);
    case 'middleman_fee':
      return isInMiddlemanFeeQueue(snap.deal, snap.priceState, fees);
    case 'meetup_refund':
      return isInMeetupRefundQueue(snap.deal, snap.meetup);
    default:
      return false;
  }
}

/** ขั้นตอนแอดมินที่ดีลเพิ่งเข้าคิว (เทียบ before/after) */
export function detectEnteredAdminQueueSteps(
  before: AdminDealSnapshot,
  after: AdminDealSnapshot,
  fees: FeeConfig,
): AdminQueueStep[] {
  return ALL_STEPS.filter(step => isInQueue(step, after, fees) && !isInQueue(step, before, fees));
}

export async function loadAdminDealSnapshot(
  db: SupabaseClient,
  deal: AdminDealRow,
): Promise<AdminDealSnapshot> {
  const [{ data: priceState }, { data: meetup }] = await Promise.all([
    db.from('deal_price_state').select('*').eq('deal_id', deal.id).maybeSingle(),
    db.from('deal_meetup').select('*').eq('deal_id', deal.id).maybeSingle(),
  ]);
  return { deal, priceState: priceState || null, meetup: meetup || null };
}

/** ดีลเข้าแท็บสถานะไหน */
export function dealMatchesStatusTab(
  snap: AdminDealSnapshot,
  tab: AdminStatusTab,
  fees: FeeConfig,
): boolean {
  const d = snap.deal;
  switch (tab) {
    case 'disputed':
      return d.status === 'disputed';
    case 'completed':
      return d.status === 'completed';
    case 'confirm_pay':
      return d.status === 'payment_uploaded';
    case 'pay_seller':
      return isInPaySellerQueue(d, snap.priceState);
    case 'refund_pending':
      return isInRefundPendingQueue(d, snap.priceState);
    case 'middleman_fee':
      return isInMiddlemanFeeQueue(d, snap.priceState, fees);
    case 'meetup_refund':
      return isInMeetupRefundQueue(d, snap.meetup);
    case 'active':
      return d.status !== 'completed'
        && d.status !== 'cancelled'
        && d.status !== 'disputed'
        && !isInQueue('confirm_pay', snap, fees)
        && !isInQueue('pay_seller', snap, fees)
        && !isInQueue('refund_pending', snap, fees)
        && !isInQueue('middleman_fee', snap, fees)
        && !isInQueue('meetup_refund', snap, fees);
    default:
      return false;
  }
}

/** นับจำนวนดีลทุก tab — ใช้เงื่อนไขเดียวกับรายการในแต่ละแท็บ */
export async function getAdminDealCounts(db: SupabaseClient, categoryRaw?: string | null) {
  const category = parseAdminDealCategory(categoryRaw);
  const fees = await readFeesConfig(db);

  if (category === 'consign') {
    return { active: 0, confirm_pay: 0, pay_seller: 0, refund_pending: 0, meetup_refund: 0, disputed: 0, middleman_fee: 0, completed: 0 };
  }

  if (category === 'onsite') {
    const { data: jobs } = await db.from('onsite_jobs').select('status, report_notes, middleman_deposit').limit(500);
    const tabs: AdminStatusTab[] = ['active', 'confirm_pay', 'pay_seller', 'refund_pending', 'middleman_fee', 'meetup_refund', 'disputed', 'completed'];
    const counts: Record<string, number> = {};
    for (const tab of tabs) {
      counts[tab] = (jobs || []).filter(j => onsiteMatchesTab(j, tab)).length;
    }
    return counts;
  }

  const [{ data: allDeals }, { data: priceStates }, { data: meetups }] = await Promise.all([
    db.from('deals').select('id, status, deal_type, source, payment_slip_file_id, middleman_id, price').order('created_at', { ascending: false }).limit(500),
    db.from('deal_price_state').select('deal_id, payout_slip_file_id, refund_slip_file_id, middleman_fee_sent_at'),
    db.from('deal_meetup').select('deal_id, refund_outcome'),
  ]);

  const priceMap = new Map((priceStates || []).map(p => [p.deal_id, p]));
  const meetupMap = new Map((meetups || []).map(m => [m.deal_id, m]));

  const snapshots: AdminDealSnapshot[] = (allDeals || [])
    .filter(d => !isBareListing(d) && dealMatchesCategory(d, category))
    .map(d => ({
      deal: d,
      priceState: priceMap.get(d.id) || null,
      meetup: meetupMap.get(d.id) || null,
    }));

  const tabs: AdminStatusTab[] = ['active', 'confirm_pay', 'pay_seller', 'refund_pending', 'middleman_fee', 'meetup_refund', 'disputed', 'completed'];
  const counts: Record<string, number> = {};
  for (const tab of tabs) {
    counts[tab] = snapshots.filter(s => dealMatchesStatusTab(s, tab, fees)).length;
  }
  return counts;
}
