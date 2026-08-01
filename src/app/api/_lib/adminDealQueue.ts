import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeeConfig } from '@/lib/fees';
import { computeDealFees } from '@/lib/fees';
import { splitDealFeeComponents } from '@/lib/financeLedger';
import { readFeesConfig } from './financeLedger';

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
  payment_slip_file_id?: string | null;
  middleman_id?: string | null;
  price?: number | null;
  deal_number?: string | null;
  title?: string | null;
  buyer_name?: string | null;
  seller_name?: string | null;
};

export type AdminPriceStateRow = {
  deal_id?: string;
  payout_slip_file_id?: string | null;
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
  return deal.status === 'completed' && deal.deal_type !== 'meetup' && !ps?.payout_slip_file_id;
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

/** นับจำนวนดีลทุก tab — ใช้เงื่อนไขเดียวกับรายการในแต่ละแท็บ */
export async function getAdminDealCounts(db: SupabaseClient) {
  const fees = await readFeesConfig(db);
  const [active, confirmPay, disputed, { data: queueDeals }, { data: priceStates }, { data: meetups }] = await Promise.all([
    db.from('deals').select('id', { count: 'exact', head: true }).neq('status', 'completed').neq('status', 'cancelled'),
    db.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'payment_uploaded'),
    db.from('deals').select('id', { count: 'exact', head: true }).eq('status', 'disputed'),
    db.from('deals').select('id, status, deal_type, payment_slip_file_id, middleman_id, price')
      .or('status.eq.completed,status.eq.cancelled'),
    db.from('deal_price_state').select('deal_id, payout_slip_file_id, refund_slip_file_id, middleman_fee_sent_at'),
    db.from('deal_meetup').select('deal_id, refund_outcome'),
  ]);

  const priceMap = new Map((priceStates || []).map(p => [p.deal_id, p]));
  const meetupMap = new Map((meetups || []).map(m => [m.deal_id, m]));

  let paySeller = 0;
  let refundPending = 0;
  let middlemanFee = 0;
  let meetupRefund = 0;
  for (const d of queueDeals || []) {
    const ps = priceMap.get(d.id);
    const mu = meetupMap.get(d.id);
    if (isInPaySellerQueue(d, ps)) paySeller++;
    if (isInRefundPendingQueue(d, ps)) refundPending++;
    if (isInMiddlemanFeeQueue(d, ps, fees)) middlemanFee++;
    if (isInMeetupRefundQueue(d, mu)) meetupRefund++;
  }

  return {
    active: active.count || 0,
    confirm_pay: confirmPay.count || 0,
    pay_seller: paySeller,
    refund_pending: refundPending,
    meetup_refund: meetupRefund,
    disputed: disputed.count || 0,
    middleman_fee: middlemanFee,
  };
}
