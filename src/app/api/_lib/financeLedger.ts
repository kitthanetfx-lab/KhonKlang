import type { SupabaseClient } from '@supabase/supabase-js';
import { FEE_DEFAULTS, computeDealFees, effectiveRegFee, type FeeConfig, type FeeLine } from '@/lib/fees';
import { dealShippingCost } from '@/lib/dealPaymentBreakdown';
import {
  financeReferenceCode,
  splitDealFeeComponents,
  splitFeeByPayer,
  tierForDeposit,
  type LedgerDirection,
  type LedgerEntryType,
  type LedgerOwnerType,
  type LedgerReferenceType,
  type LedgerStatus,
  type MiddlemanWalletSnapshot,
} from '@/lib/financeLedger';

const HELD_DEAL_STATUSES = new Set([
  'terms_pending', 'payment_pending', 'payment_uploaded', 'packing', 'shipped_to_middleman',
  'middleman_received', 'middleman_checking', 'shipped_to_buyer', 'delivered', 'meetup_ready', 'disputed',
]);
const CONFIRMED_DEAL_STATUSES = new Set([
  'packing', 'shipped_to_middleman', 'middleman_received', 'middleman_checking', 'shipped_to_buyer', 'delivered', 'completed',
]);

export interface LedgerDoc {
  id?: string;
  entry_key: string;
  reference_type: LedgerReferenceType;
  reference_id: string;
  deal_id: string | null;
  deal_number: string;
  owner_type: LedgerOwnerType;
  owner_id: string | null;
  owner_name: string;
  entry_type: LedgerEntryType;
  direction: LedgerDirection;
  amount: number;
  status: LedgerStatus;
  title: string;
  purpose: string;
  counterparty_name: string;
  bucket: string;
  file_id: string;
  approve_link: string;
  meta: Record<string, unknown>;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

function text(value: unknown, max: number) {
  return String(value ?? '').slice(0, max);
}

function feeSummary(lines: FeeLine[]) {
  return lines.map(line => ({ label: line.label, amount: Number(line.amount) || 0 }));
}

export async function readFeesConfig(db: SupabaseClient): Promise<FeeConfig> {
  const { data } = await db.from('fee_config').select('*').eq('id', true).maybeSingle();
  if (!data) return FEE_DEFAULTS;
  return {
    escrowFeePercent: Number(data.escrow_fee_percent) || FEE_DEFAULTS.escrowFeePercent,
    escrowFeeMin: Number(data.escrow_fee_min) || FEE_DEFAULTS.escrowFeeMin,
    middlemanFeePercent: Number(data.middleman_fee_percent) || FEE_DEFAULTS.middlemanFeePercent,
    middlemanFeeMin: Number(data.middleman_fee_min) || FEE_DEFAULTS.middlemanFeeMin,
    platformCutPercent: Number(data.platform_cut_percent) || FEE_DEFAULTS.platformCutPercent,
    simpleFeePercent: Number(data.simple_fee_percent) || FEE_DEFAULTS.simpleFeePercent,
    simpleFeeMin: Number(data.simple_fee_min) || FEE_DEFAULTS.simpleFeeMin,
    simpleMiddlemanSharePercent: Number(data.simple_middleman_share_percent) || FEE_DEFAULTS.simpleMiddlemanSharePercent,
    simpleShareTier1Multiplier: Number(data.simple_share_tier1_multiplier) || FEE_DEFAULTS.simpleShareTier1Multiplier,
    simpleShareTier1Percent: Number(data.simple_share_tier1_percent) ?? FEE_DEFAULTS.simpleShareTier1Percent,
    simpleShareTier2Multiplier: Number(data.simple_share_tier2_multiplier) || FEE_DEFAULTS.simpleShareTier2Multiplier,
    simpleShareTier2Percent: Number(data.simple_share_tier2_percent) ?? FEE_DEFAULTS.simpleShareTier2Percent,
    simpleShareTier3Multiplier: Number(data.simple_share_tier3_multiplier) || FEE_DEFAULTS.simpleShareTier3Multiplier,
    simpleShareTier3Percent: Number(data.simple_share_tier3_percent) ?? FEE_DEFAULTS.simpleShareTier3Percent,
    inspectionFee: Number(data.inspection_fee) || FEE_DEFAULTS.inspectionFee,
    packingFee: Number(data.packing_fee) || FEE_DEFAULTS.packingFee,
    depositBronze: Number(data.deposit_bronze) || FEE_DEFAULTS.depositBronze,
    depositSilver: Number(data.deposit_silver) || FEE_DEFAULTS.depositSilver,
    depositGold: Number(data.deposit_gold) || FEE_DEFAULTS.depositGold,
    depositPlatinum: Number(data.deposit_platinum) || FEE_DEFAULTS.depositPlatinum,
    failedDealFee: Number(data.failed_deal_fee) || FEE_DEFAULTS.failedDealFee,
    onsiteBaseFee: Number(data.onsite_base_fee) || FEE_DEFAULTS.onsiteBaseFee,
    onsitePerKm: Number(data.onsite_per_km) || FEE_DEFAULTS.onsitePerKm,
    meetupFeePercent: Number(data.meetup_fee_percent) || FEE_DEFAULTS.meetupFeePercent,
    meetupFeeMin: Number(data.meetup_fee_min) || FEE_DEFAULTS.meetupFeeMin,
    sellerRegFee: data.seller_reg_fee != null ? Number(data.seller_reg_fee) : FEE_DEFAULTS.sellerRegFee,
    middlemanRegFee: data.middleman_reg_fee != null ? Number(data.middleman_reg_fee) : FEE_DEFAULTS.middlemanRegFee,
    returnShippingBy: data.return_shipping_by || FEE_DEFAULTS.returnShippingBy,
    companyPromptPay: data.company_prompt_pay || '',
    companyBankName: data.company_bank_name || '',
    companyBankAcct: data.company_bank_acct || '',
    companyBankHolder: data.company_bank_holder || '',
    companyQrFileId: data.company_qr_file_id || '',
    promoEnabled: !!data.promo_enabled,
    promoScope: (['all', 'seller', 'middleman'].includes(data.promo_scope) ? data.promo_scope : FEE_DEFAULTS.promoScope),
    promoPercent: data.promo_percent != null ? Number(data.promo_percent) : FEE_DEFAULTS.promoPercent,
    promoFree: !!data.promo_free,
    promoStart: data.promo_start || '',
    promoEnd: data.promo_end || '',
    promoLabel: data.promo_label || '',
    promoVideoUrl: data.promo_video_url || '',
    marketplaceGpPercent: data.marketplace_gp_percent != null ? Number(data.marketplace_gp_percent) : FEE_DEFAULTS.marketplaceGpPercent,
    marketplaceGpCommissionPercent: data.marketplace_gp_commission_percent != null ? Number(data.marketplace_gp_commission_percent) : FEE_DEFAULTS.marketplaceGpCommissionPercent,
    auctionGpPercent: data.auction_gp_percent != null ? Number(data.auction_gp_percent) : FEE_DEFAULTS.auctionGpPercent,
    auctionGpCommissionPercent: data.auction_gp_commission_percent != null ? Number(data.auction_gp_commission_percent) : FEE_DEFAULTS.auctionGpCommissionPercent,
  };
}

export async function upsertLedgerEntry(db: SupabaseClient, entry: LedgerDoc) {
  const payload = {
    entry_key: text(entry.entry_key, 120),
    reference_type: entry.reference_type,
    reference_id: entry.reference_id,
    deal_id: entry.deal_id || null,
    deal_number: text(entry.deal_number, 50),
    owner_type: entry.owner_type,
    owner_id: entry.owner_id || null,
    owner_name: text(entry.owner_name, 200),
    entry_type: entry.entry_type,
    direction: entry.direction,
    amount: Math.max(0, Math.round(Number(entry.amount) || 0)),
    status: entry.status,
    title: text(entry.title, 200),
    purpose: text(entry.purpose, 200),
    counterparty_name: text(entry.counterparty_name, 200),
    bucket: text(entry.bucket, 50),
    file_id: text(entry.file_id, 255),
    approve_link: text(entry.approve_link, 255),
    meta: entry.meta || {},
    active: !!entry.active,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from('finance_ledger').upsert(payload, { onConflict: 'entry_key' });
  if (error) throw error;
}

async function deactivateMissingEntries(db: SupabaseClient, referenceType: LedgerReferenceType, referenceId: string, activeKeys: Set<string>) {
  const { data: existing } = await db
    .from('finance_ledger')
    .select('id, entry_key, status')
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId);
  await Promise.all((existing || []).map(async entry => {
    if (activeKeys.has(entry.entry_key)) return;
    const keepStatus = ['paid', 'released', 'refunded'].includes(entry.status);
    await db.from('finance_ledger').update({
      active: false,
      status: keepStatus ? entry.status : 'void',
      updated_at: new Date().toISOString(),
    }).eq('id', entry.id);
  }));
}

async function getMiddlemanProfile(db: SupabaseClient, middlemanId: string) {
  const { data } = await db.from('profiles').select('display_name, middleman_tier, middleman_tier_intent').eq('id', middlemanId).maybeSingle();
  return data;
}

function buildEntry(partial: Omit<LedgerDoc, 'meta'> & { meta?: Record<string, unknown> }): LedgerDoc {
  return { ...partial, meta: partial.meta || {} };
}

export async function syncDealLedger(db: SupabaseClient, deal: Record<string, unknown>, feesConfig?: FeeConfig) {
  const fees = feesConfig || await readFeesConfig(db);
  const dealId = String(deal.id || '');
  const dealNumber = String(deal.deal_number || financeReferenceCode('deal', dealId, dealId));
  const title = String(deal.title || '');
  const dealType = String(deal.deal_type || 'normal');
  const status = String(deal.status || '');
  const price = Number(deal.price) || 0;

  const { data: pdRow } = await db.from('deal_price_state').select('*').eq('deal_id', dealId).maybeSingle();
  const pd = pdRow || {};

  const feePayerInput = String(deal.fee_payer || pd.proposed_fee_payer || 'split');
  const feeBreakdown = computeDealFees(fees, price, dealType);
  const feePayer = splitFeeByPayer(feeBreakdown.total, feePayerInput);

  let creatorEligible = false;
  let creatorId = String(deal.creator_id || '');
  let creatorName = '';
  if (dealType === 'simple' && creatorId) {
    const { data: creatorProfile } = await db.from('profiles')
      .select('display_name, seller_status, middleman_status')
      .eq('id', creatorId).maybeSingle();
    creatorEligible = creatorProfile?.seller_status === 'approved' && creatorProfile?.middleman_status === 'approved';
    creatorName = creatorProfile?.display_name || '';
  }

  const feeParts = splitDealFeeComponents(fees, feeBreakdown.lines, {
    dealType,
    creatorEligible: dealType === 'simple' ? creatorEligible : undefined,
  });
  const activeKeys = new Set<string>();

  const push = async (entry: LedgerDoc) => {
    activeKeys.add(entry.entry_key);
    await upsertLedgerEntry(db, entry);
  };

  if (dealType === 'meetup') {
    const { data: meetupRow } = await db.from('deal_meetup').select('*').eq('deal_id', dealId).maybeSingle();
    const md = meetupRow || {};
    const depositEach = Number(md.deposit) || 0;
    const buyerFee = Number(md.buyer_fee || 0);
    const sellerFee = Number(md.seller_fee || 0);
    const finished = status === 'completed' || status === 'cancelled';
    const buyerDepositStatus: LedgerStatus = !md.buyer_slip ? 'expected' : finished ? (md.refunded_at ? 'refunded' : 'confirmed') : 'confirmed';
    const sellerDepositStatus: LedgerStatus = !md.seller_slip ? 'expected' : finished ? (md.refunded_at ? 'refunded' : 'confirmed') : 'confirmed';

    if (depositEach > 0 || md.buyer_slip) {
      await push(buildEntry({
        entry_key: `deal:${dealId}:meetup:buyer:deposit`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
        owner_type: 'buyer', owner_id: String(deal.buyer_id || '') || null, owner_name: text(deal.buyer_name, 200),
        entry_type: 'meetup_buyer_deposit', direction: 'incoming', amount: depositEach, status: buyerDepositStatus, title,
        purpose: 'เงินประกันการเดินทาง (ผู้ซื้อ)', counterparty_name: 'ศูนย์กลาง', bucket: 'deal-files', file_id: text(md.buyer_slip, 255),
        approve_link: `/deal/${dealId}`, active: depositEach > 0 || !!md.buyer_slip,
        meta: { depositEach, fee: buyerFee, totalPaid: depositEach + buyerFee, dealType: 'meetup' },
      }));
    }
    if (buyerFee > 0 || md.buyer_slip) {
      await push(buildEntry({
        entry_key: `deal:${dealId}:meetup:buyer:fee`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
        owner_type: 'platform', owner_id: null, owner_name: 'ศูนย์กลาง',
        entry_type: 'meetup_buyer_fee', direction: 'incoming', amount: buyerFee, status: !md.buyer_slip ? 'expected' : 'confirmed', title,
        purpose: 'ค่าบริการรับประกันการเดินทาง (ผู้ซื้อ)', counterparty_name: text(deal.buyer_name, 200), bucket: 'deal-files', file_id: text(md.buyer_slip, 255),
        approve_link: `/deal/${dealId}`, active: buyerFee > 0 || !!md.buyer_slip,
        meta: { depositEach, fee: buyerFee, payer: 'buyer' },
      }));
    }
    if (depositEach > 0 || md.seller_slip) {
      await push(buildEntry({
        entry_key: `deal:${dealId}:meetup:seller:deposit`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
        owner_type: 'seller', owner_id: String(deal.seller_id || '') || null, owner_name: text(deal.seller_name, 200),
        entry_type: 'meetup_seller_deposit', direction: 'incoming', amount: depositEach, status: sellerDepositStatus, title,
        purpose: 'เงินประกันการเดินทาง (ผู้ขาย)', counterparty_name: 'ศูนย์กลาง', bucket: 'deal-files', file_id: text(md.seller_slip, 255),
        approve_link: `/deal/${dealId}`, active: depositEach > 0 || !!md.seller_slip,
        meta: { depositEach, fee: sellerFee, totalPaid: depositEach + sellerFee, dealType: 'meetup' },
      }));
    }
    if (sellerFee > 0 || md.seller_slip) {
      await push(buildEntry({
        entry_key: `deal:${dealId}:meetup:seller:fee`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
        owner_type: 'platform', owner_id: null, owner_name: 'ศูนย์กลาง',
        entry_type: 'meetup_seller_fee', direction: 'incoming', amount: sellerFee, status: !md.seller_slip ? 'expected' : 'confirmed', title,
        purpose: 'ค่าบริการรับประกันการเดินทาง (ผู้ขาย)', counterparty_name: text(deal.seller_name, 200), bucket: 'deal-files', file_id: text(md.seller_slip, 255),
        approve_link: `/deal/${dealId}`, active: sellerFee > 0 || !!md.seller_slip,
        meta: { depositEach, fee: sellerFee, payer: 'seller' },
      }));
    }
    if (finished && md.buyer_slip) {
      await push(buildEntry({
        entry_key: `deal:${dealId}:meetup:buyer:refund`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
        owner_type: 'buyer', owner_id: String(deal.buyer_id || '') || null, owner_name: text(deal.buyer_name, 200),
        entry_type: 'meetup_buyer_refund', direction: 'outgoing', amount: depositEach, status: md.refunded_at ? 'paid' : 'scheduled', title,
        purpose: 'คืนเงินประกันการเดินทาง (ผู้ซื้อ)', counterparty_name: 'ศูนย์กลาง', bucket: '', file_id: '',
        approve_link: '/admin/deals', active: depositEach > 0,
        meta: { refundNote: text(md.refund_note, 300), dealType: 'meetup' },
      }));
    }
    if (finished && md.seller_slip) {
      await push(buildEntry({
        entry_key: `deal:${dealId}:meetup:seller:refund`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
        owner_type: 'seller', owner_id: String(deal.seller_id || '') || null, owner_name: text(deal.seller_name, 200),
        entry_type: 'meetup_seller_refund', direction: 'outgoing', amount: depositEach, status: md.refunded_at ? 'paid' : 'scheduled', title,
        purpose: 'คืนเงินประกันการเดินทาง (ผู้ขาย)', counterparty_name: 'ศูนย์กลาง', bucket: '', file_id: '',
        approve_link: '/admin/deals', active: depositEach > 0,
        meta: { refundNote: text(md.refund_note, 300), dealType: 'meetup' },
      }));
    }
  } else {
    const shippingCost = dealShippingCost(deal);
    const buyerPaymentAmount = price + shippingCost + feePayer.buyerShare;
    const sellerFeeAmount = feePayer.sellerShare;
    const buyerPaymentStatus: LedgerStatus = !deal.payment_slip_file_id
      ? (status === 'payment_pending' ? 'expected' : 'void')
      : status === 'payment_uploaded'
        ? 'pending_review'
        : status === 'cancelled' && pd.refund_sent_at
          ? 'refunded'
          : CONFIRMED_DEAL_STATUSES.has(status) || status === 'cancelled'
            ? 'confirmed'
            : 'pending_review';

    if (status === 'payment_pending' || deal.payment_slip_file_id || CONFIRMED_DEAL_STATUSES.has(status) || status === 'cancelled') {
      await push(buildEntry({
        entry_key: `deal:${dealId}:buyer_payment`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
        owner_type: 'buyer', owner_id: String(deal.buyer_id || '') || null, owner_name: text(deal.buyer_name, 200),
        entry_type: 'buyer_payment', direction: 'incoming', amount: buyerPaymentAmount, status: buyerPaymentStatus, title,
        purpose: 'ค่าสินค้าและค่าบริการส่วนผู้ซื้อ', counterparty_name: 'ศูนย์กลาง', bucket: 'deal-files', file_id: text(deal.payment_slip_file_id, 255),
        approve_link: `/deal/${dealId}`, active: buyerPaymentAmount > 0,
        meta: { price, shippingCost, buyerFeeShare: feePayer.buyerShare, lines: feeSummary(feeBreakdown.lines), feePayer: feePayer.feePayer },
      }));
    }

    if (sellerFeeAmount > 0 || pd.seller_fee_slip) {
      const sellerFeeStatus: LedgerStatus = !pd.seller_fee_slip
        ? 'expected'
        : status === 'cancelled' && pd.refund_sent_at
          ? 'refunded'
          : CONFIRMED_DEAL_STATUSES.has(status) || status === 'cancelled'
            ? 'confirmed'
            : 'pending_review';
      await push(buildEntry({
        entry_key: `deal:${dealId}:seller_fee`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
        owner_type: 'seller', owner_id: String(deal.seller_id || '') || null, owner_name: text(deal.seller_name, 200),
        entry_type: 'seller_fee_payment', direction: 'incoming', amount: sellerFeeAmount, status: sellerFeeStatus, title,
        purpose: 'ค่าบริการส่วนผู้ขาย', counterparty_name: 'ศูนย์กลาง', bucket: 'deal-files', file_id: text(pd.seller_fee_slip, 255),
        approve_link: `/deal/${dealId}`, active: sellerFeeAmount > 0 || !!pd.seller_fee_slip,
        meta: { sellerFeeShare: sellerFeeAmount, feePayer: feePayer.feePayer },
      }));
    }

    if (feeParts.platformFee > 0) {
      await push(buildEntry({
        entry_key: `deal:${dealId}:platform_fee`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
        owner_type: 'platform', owner_id: null, owner_name: 'ศูนย์กลาง',
        entry_type: 'platform_fee', direction: 'incoming', amount: feeParts.platformFee,
        status: status === 'completed' ? 'confirmed' : status === 'cancelled' ? 'cancelled' : buyerPaymentStatus, title,
        purpose: dealType === 'simple' ? 'ค่าธรรมเนียมแพลตฟอร์ม (ซื้อขายผ่านกลางแบบง่าย)' : 'ค่าธรรมเนียมแพลตฟอร์ม',
        counterparty_name: `${text(deal.buyer_name, 200)} / ${text(deal.seller_name, 200)}`.trim(), bucket: '', file_id: '',
        approve_link: `/deal/${dealId}`, active: feeParts.platformFee > 0,
        meta: {
          lines: feeSummary(feeBreakdown.lines.filter(line => line.label !== 'ค่าบริการคนกลาง')),
          platformCutFromMiddleman: feeParts.platformCutFromMiddleman,
          dealType,
          simpleCreatorShare: feeParts.simpleCreatorShare || 0,
          simpleSharePercent: dealType === 'simple' ? feeParts.simpleSharePercent || 0 : undefined,
          simpleShareTier: dealType === 'simple' ? feeParts.simpleShareTier || 0 : undefined,
        },
      }));
    }

    if (dealType === 'simple' && (feeParts.simpleCreatorShare || 0) > 0 && creatorId) {
      await push(buildEntry({
        entry_key: `deal:${dealId}:simple_creator_share`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
        owner_type: 'middleman', owner_id: creatorId, owner_name: text(creatorName, 200),
        entry_type: 'middleman_fee_net', direction: 'outgoing', amount: feeParts.simpleCreatorShare || 0,
        status: status === 'completed' ? (pd.middleman_fee_sent_at ? 'paid' : 'scheduled') : status === 'cancelled' ? 'cancelled' : 'expected', title,
        purpose: 'คอมมิชชั่นดีลแบบง่าย (ผู้สร้างดีล — ผู้ซื้อหรือผู้ขายที่ลงทะเบียนครบ)', counterparty_name: 'ศูนย์กลาง', bucket: '', file_id: text(pd.middleman_fee_slip_file_id, 255),
        approve_link: `/deal/${dealId}`, active: true,
        meta: {
          dealType: 'simple',
          sharePercent: feeParts.simpleSharePercent || 0,
          shareTier: feeParts.simpleShareTier || 0,
          creatorEligible: true,
          payoutNote: text(pd.middleman_fee_note, 300),
        },
      }));
    }

    if (feeParts.middlemanGrossFee > 0 && deal.middleman_id) {
      await push(buildEntry({
        entry_key: `deal:${dealId}:middleman_fee_gross`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
        owner_type: 'middleman', owner_id: String(deal.middleman_id), owner_name: text(deal.middleman_name, 200),
        entry_type: 'middleman_fee_gross', direction: 'internal', amount: feeParts.middlemanGrossFee,
        status: status === 'completed' ? 'confirmed' : status === 'cancelled' ? 'cancelled' : buyerPaymentStatus, title,
        purpose: 'ค่าบริการคนกลาง (ก่อนหักเข้าแอป)', counterparty_name: 'ศูนย์กลาง', bucket: '', file_id: '',
        approve_link: `/deal/${dealId}`, active: true,
        meta: { grossFee: feeParts.middlemanGrossFee, dealType },
      }));
      if (feeParts.platformCutFromMiddleman > 0) {
        await push(buildEntry({
          entry_key: `deal:${dealId}:platform_cut`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
          owner_type: 'platform', owner_id: null, owner_name: 'ศูนย์กลาง',
          entry_type: 'platform_cut', direction: 'internal', amount: feeParts.platformCutFromMiddleman,
          status: status === 'completed' ? 'confirmed' : status === 'cancelled' ? 'cancelled' : buyerPaymentStatus, title,
          purpose: 'ส่วนหักเข้าแอปจากค่าบริการคนกลาง', counterparty_name: text(deal.middleman_name, 200), bucket: '', file_id: '',
          approve_link: `/deal/${dealId}`, active: true,
          meta: { grossFee: feeParts.middlemanGrossFee, cutPercent: Number(fees.platformCutPercent) || 0 },
        }));
      }
      await push(buildEntry({
        entry_key: `deal:${dealId}:middleman_fee_net`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
        owner_type: 'middleman', owner_id: String(deal.middleman_id), owner_name: text(deal.middleman_name, 200),
        entry_type: 'middleman_fee_net', direction: 'outgoing', amount: feeParts.middlemanNetFee,
        status: status === 'completed' ? (pd.middleman_fee_sent_at ? 'paid' : 'scheduled') : status === 'cancelled' ? 'cancelled' : 'expected', title,
        purpose: 'รายได้สุทธิของคนกลางหลังหักเข้าแอป', counterparty_name: 'ศูนย์กลาง', bucket: '', file_id: text(pd.middleman_fee_slip_file_id, 255),
        approve_link: `/deal/${dealId}`, active: feeParts.middlemanNetFee > 0,
        meta: { grossFee: feeParts.middlemanGrossFee, platformCut: feeParts.platformCutFromMiddleman, payoutNote: text(pd.middleman_fee_note, 300) },
      }));
    }

    if (status === 'completed') {
      const sellerPayoutAmount = Math.max(price, 0) + shippingCost;
      await push(buildEntry({
        entry_key: `deal:${dealId}:seller_payout`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
        owner_type: 'seller', owner_id: String(deal.seller_id || '') || null, owner_name: text(deal.seller_name, 200),
        entry_type: 'seller_payout', direction: 'outgoing', amount: sellerPayoutAmount, status: pd.payout_sent_at ? 'paid' : 'scheduled', title,
        purpose: 'จ่ายคืนผู้ขายเมื่อดีลสำเร็จ', counterparty_name: 'ศูนย์กลาง', bucket: '', file_id: '',
        approve_link: `/deal/${dealId}`, active: sellerPayoutAmount > 0,
        meta: { payoutNote: text(pd.payout_note, 300), sellerFeeShare: sellerFeeAmount, goodsPrice: price, shippingCost },
      }));
    }

    if (status === 'cancelled' && deal.payment_slip_file_id) {
      await push(buildEntry({
        entry_key: `deal:${dealId}:buyer_refund`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
        owner_type: 'buyer', owner_id: String(deal.buyer_id || '') || null, owner_name: text(deal.buyer_name, 200),
        entry_type: 'buyer_refund', direction: 'outgoing', amount: price, status: pd.refund_sent_at ? 'paid' : 'scheduled', title,
        purpose: 'คืนเงินผู้ซื้อเมื่อยกเลิกดีล', counterparty_name: 'ศูนย์กลาง', bucket: '', file_id: '',
        approve_link: `/deal/${dealId}`, active: price > 0,
        meta: { refundNote: text(pd.refund_note, 300) },
      }));
    }
  }

  const middlemanId = text(deal.middleman_id, 255);
  if (middlemanId && Number(pd.mm_deposit_held || 0) > 0) {
    const profile = await getMiddlemanProfile(db, middlemanId);
    const middlemanName = profile?.display_name || text(deal.middleman_name, 200) || middlemanId;
    const holdStatus: LedgerStatus = status === 'completed' || status === 'cancelled'
      ? 'released'
      : status === 'disputed'
        ? 'held'
        : HELD_DEAL_STATUSES.has(status)
          ? 'held'
          : 'expected';
    await push(buildEntry({
      entry_key: `deal:${dealId}:middleman_credit_hold`, reference_type: 'deal', reference_id: dealId, deal_id: dealId, deal_number: dealNumber,
      owner_type: 'middleman', owner_id: middlemanId, owner_name: middlemanName,
      entry_type: 'middleman_credit_hold', direction: 'hold', amount: Number(pd.mm_deposit_held) || 0, status: holdStatus, title,
      purpose: 'เครดิตประกันคนกลางที่ hold ไว้กับดีลนี้', counterparty_name: 'ศูนย์กลาง', bucket: '', file_id: '',
      approve_link: `/deal/${dealId}`, active: true,
      meta: { dealStatus: status, disputed: status === 'disputed' },
    }));
    await syncMiddlemanWallet(db, middlemanId, middlemanName, undefined, fees);
  }

  await deactivateMissingEntries(db, 'deal', dealId, activeKeys);
}

export async function syncSellerApplicationLedger(db: SupabaseClient, app: Record<string, unknown>, feesConfig?: FeeConfig) {
  const fees = feesConfig || await readFeesConfig(db);
  const referenceId = String(app.id || '');
  const amount = effectiveRegFee(fees, 'seller');
  const activeKeys = new Set<string>();
  if (amount > 0 || app.slip_file_id) {
    const status = String(app.status || '') === 'approved' ? 'confirmed' : String(app.status || '') === 'rejected' ? 'cancelled' : 'pending_review';
    const entry = buildEntry({
      entry_key: `seller-app:${referenceId}:registration`, reference_type: 'seller_application', reference_id: referenceId, deal_id: null,
      deal_number: financeReferenceCode('seller_application', referenceId),
      owner_type: 'seller', owner_id: String(app.user_id || '') || null, owner_name: text(app.full_name_id, 200),
      entry_type: 'seller_registration', direction: 'incoming', amount, status, title: text(app.full_name_id || 'สมัครผู้ขาย', 200),
      purpose: 'ค่าสมัครผู้ขาย', counterparty_name: 'ศูนย์กลาง', bucket: 'kyc-docs', file_id: text(app.slip_file_id, 255),
      approve_link: '/admin/sellers', active: true,
      meta: { sellerType: text(app.seller_type, 50) },
    });
    activeKeys.add(entry.entry_key);
    await upsertLedgerEntry(db, entry);
  }
  await deactivateMissingEntries(db, 'seller_application', referenceId, activeKeys);
}

export async function syncMiddlemanApplicationLedger(db: SupabaseClient, app: Record<string, unknown>, feesConfig?: FeeConfig) {
  const fees = feesConfig || await readFeesConfig(db);
  const referenceId = String(app.id || '');
  const amount = effectiveRegFee(fees, 'middleman');
  const activeKeys = new Set<string>();
  if (amount > 0 || app.slip_file_id) {
    const status = String(app.status || '') === 'approved' ? 'confirmed' : String(app.status || '') === 'rejected' ? 'cancelled' : 'pending_review';
    const entry = buildEntry({
      entry_key: `middleman-app:${referenceId}:registration`, reference_type: 'middleman_application', reference_id: referenceId, deal_id: null,
      deal_number: financeReferenceCode('middleman_application', referenceId),
      owner_type: 'middleman', owner_id: String(app.user_id || '') || null, owner_name: text(app.full_name_id, 200),
      entry_type: 'middleman_registration', direction: 'incoming', amount, status, title: text(app.full_name_id || 'สมัครคนกลาง', 200),
      purpose: 'ค่าสมัครคนกลาง', counterparty_name: 'ศูนย์กลาง', bucket: 'kyc-docs', file_id: text(app.slip_file_id, 255),
      approve_link: '/admin/middlemen', active: true,
      meta: { tier: text(app.tier, 20), depositIntent: Number(app.deposit_intent) || 0 },
    });
    activeKeys.add(entry.entry_key);
    await upsertLedgerEntry(db, entry);
  }
  await deactivateMissingEntries(db, 'middleman_application', referenceId, activeKeys);
  if (String(app.status || '') === 'approved' && app.user_id) {
    await syncMiddlemanWallet(db, text(app.user_id, 255), text(app.full_name_id, 200), text(app.tier, 20), fees);
  }
}

/** บันทึกรายการเงินค้ำประกันคนกลางลง finance_ledger ให้เห็นในหน้า "การเงิน" ของ admin ด้วย
 *  แล้ว sync wallet ใหม่ทุกครั้งที่สถานะ deposit เปลี่ยน (โดยเฉพาะตอน approved — ปลดเครดิตให้จริง) */
export async function syncMiddlemanDepositLedger(db: SupabaseClient, deposit: Record<string, unknown>, feesConfig?: FeeConfig) {
  const fees = feesConfig || await readFeesConfig(db);
  const referenceId = String(deposit.id || '');
  const middlemanId = text(deposit.middleman_id, 255);
  const profile = await getMiddlemanProfile(db, middlemanId);
  const middlemanName = profile?.display_name || middlemanId;
  const status = String(deposit.status || '') === 'approved'
    ? 'confirmed'
    : String(deposit.status || '') === 'rejected'
      ? 'cancelled'
      : 'pending_review';
  const entry = buildEntry({
    entry_key: `middleman-deposit:${referenceId}`, reference_type: 'middleman_deposit', reference_id: referenceId, deal_id: null,
    deal_number: financeReferenceCode('middleman_deposit', referenceId),
    owner_type: 'middleman', owner_id: middlemanId || null, owner_name: middlemanName,
    entry_type: 'middleman_deposit', direction: 'incoming', amount: Number(deposit.amount) || 0, status,
    title: `เงินค้ำประกันคนกลาง — ${middlemanName}`,
    purpose: 'เงินค้ำประกันคนกลาง', counterparty_name: 'ศูนย์กลาง', bucket: 'deal-files', file_id: text(deposit.slip_file_id, 255),
    approve_link: '/admin/middleman-deposits', active: true,
    meta: { rejectReason: text(deposit.reject_reason, 300) },
  });
  await upsertLedgerEntry(db, entry);
  if (middlemanId) await syncMiddlemanWallet(db, middlemanId, middlemanName, undefined, fees);
}

export async function syncOnsiteJobLedger(db: SupabaseClient, job: Record<string, unknown>, feesConfig?: FeeConfig) {
  const fees = feesConfig || await readFeesConfig(db);
  const referenceId = String(job.id || '');
  const referenceCode = financeReferenceCode('onsite_job', referenceId);
  const status = String(job.status || '');
  const activeKeys = new Set<string>();
  const middlemanId = text(job.middleman_id, 255);
  let middlemanName = '';
  if (middlemanId) {
    const profile = await getMiddlemanProfile(db, middlemanId);
    middlemanName = profile?.display_name || text(job.middleman_name, 200);
  }
  const travelFee = Number(job.travel_fee) || 0;
  const serviceFee = Number(job.service_fee) || 0;
  const creditHold = Number(job.middleman_deposit) || 0;

  const push = async (entry: LedgerDoc) => {
    activeKeys.add(entry.entry_key);
    await upsertLedgerEntry(db, entry);
  };

  if (travelFee > 0 && middlemanId) {
    await push(buildEntry({
      entry_key: `onsite:${referenceId}:travel_fee`, reference_type: 'onsite_job', reference_id: referenceId, deal_id: null, deal_number: referenceCode,
      owner_type: 'middleman', owner_id: middlemanId, owner_name: middlemanName,
      entry_type: 'onsite_travel_fee', direction: 'outgoing', amount: travelFee,
      status: status === 'completed' ? 'scheduled' : status === 'cancelled' ? 'cancelled' : 'expected',
      title: text(job.item_description || 'งานนัดออนไซต์', 200), purpose: 'ค่าเดินทางคนกลาง (งานนัดออนไซต์)', counterparty_name: text(job.buyer_name, 200),
      bucket: '', file_id: '', approve_link: `/onsite/${referenceId}`, active: true,
      meta: { sellerProvince: text(job.seller_province, 80), estimatedArrival: text(job.estimated_arrival, 40) },
    }));
  }
  if (serviceFee > 0 && middlemanId) {
    await push(buildEntry({
      entry_key: `onsite:${referenceId}:service_fee`, reference_type: 'onsite_job', reference_id: referenceId, deal_id: null, deal_number: referenceCode,
      owner_type: 'middleman', owner_id: middlemanId, owner_name: middlemanName,
      entry_type: 'onsite_service_fee', direction: 'outgoing', amount: serviceFee,
      status: status === 'completed' ? 'scheduled' : status === 'cancelled' ? 'cancelled' : 'expected',
      title: text(job.item_description || 'งานนัดออนไซต์', 200), purpose: 'ค่าบริการตรวจ/นัดออนไซต์ของคนกลาง', counterparty_name: text(job.buyer_name, 200),
      bucket: '', file_id: '', approve_link: `/onsite/${referenceId}`, active: true,
      meta: { itemPrice: Number(job.item_price) || 0 },
    }));
  }
  if (creditHold > 0 && middlemanId) {
    await push(buildEntry({
      entry_key: `onsite:${referenceId}:credit_hold`, reference_type: 'onsite_job', reference_id: referenceId, deal_id: null, deal_number: referenceCode,
      owner_type: 'middleman', owner_id: middlemanId, owner_name: middlemanName,
      entry_type: 'middleman_credit_hold', direction: 'hold', amount: creditHold,
      status: status === 'accepted' || status === 'in_progress' ? 'held' : status === 'completed' || status === 'cancelled' ? 'released' : 'expected',
      title: text(job.item_description || 'งานนัดออนไซต์', 200), purpose: 'เครดิตประกันคนกลางสำหรับงานนัดออนไซต์', counterparty_name: 'ศูนย์กลาง',
      bucket: '', file_id: '', approve_link: `/onsite/${referenceId}`, active: true,
      meta: { travelFee, serviceFee, onsiteStatus: status },
    }));
    await syncMiddlemanWallet(db, middlemanId, middlemanName, text(job.middleman_tier, 20), fees);
  }

  await deactivateMissingEntries(db, 'onsite_job', referenceId, activeKeys);
}

/** ยอดเงินค้ำประกันที่ "ยืนยันแล้ว" (admin อนุมัติแล้วจริง) ของคนกลางคนนี้ — ใช้เป็น credit_limit
 *  แทนการปล่อยวงเงินอัตโนมัติตาม tier แบบเดิม (ซึ่งให้เครดิตทั้งที่ยังไม่ได้โอนเงินประกันเข้ามาจริง) */
export async function getConfirmedDepositTotal(db: SupabaseClient, middlemanId: string): Promise<number> {
  const { data } = await db
    .from('middleman_deposits')
    .select('amount')
    .eq('middleman_id', middlemanId)
    .eq('status', 'approved');
  return (data || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

export async function syncMiddlemanWallet(
  db: SupabaseClient,
  middlemanId: string,
  fallbackName = '',
  /** @deprecated ไม่ใช้แล้ว — tier คำนวณจากยอดเงินประกันจริงเท่านั้น เก็บพารามิเตอร์ไว้เพื่อไม่ต้องแก้จุดเรียกใช้เดิมทั้งหมด */
  _tierHint?: string,
  feesConfig?: FeeConfig,
): Promise<MiddlemanWalletSnapshot> {
  const fees = feesConfig || await readFeesConfig(db);
  const profile = await getMiddlemanProfile(db, middlemanId);
  const middlemanName = profile?.display_name || fallbackName || middlemanId;
  // เปลี่ยนจาก auto-grant ตาม tier (getTierCreditLimit) เป็นยอดเงินประกันที่โอนเข้ามาจริงและอนุมัติแล้วเท่านั้น
  // ใช้เครดิตได้เต็มยอดที่วางจริงเสมอ ไม่มีขั้นต่ำ ไม่มี cap ต่อ tier
  const creditLimit = await getConfirmedDepositTotal(db, middlemanId);
  // tier เป็นแค่ป้ายแสดงผล คำนวณจากยอดเงินประกันจริง ไม่ใช่ค่าที่ self-declare ตอนสมัครอีกต่อไป
  const tier = tierForDeposit(fees, creditLimit);

  const { data: entries } = await db
    .from('finance_ledger')
    .select('amount, status, active')
    .eq('owner_id', middlemanId)
    .eq('entry_type', 'middleman_credit_hold')
    .limit(500);
  const rows = entries || [];
  const activeHeld = rows.filter(e => e.active !== false && e.status === 'held');
  const heldCredit = activeHeld.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const releasedCredit = rows.filter(e => e.status === 'released').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const penaltyCredit = rows.filter(e => e.status === 'forfeited').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const wallet: MiddlemanWalletSnapshot = {
    middlemanId, middlemanName, tier,
    creditLimit,
    availableCredit: Math.max(creditLimit - heldCredit - penaltyCredit, 0),
    heldCredit, releasedCredit, penaltyCredit,
    activeDealCount: activeHeld.length,
    updatedAt: new Date().toISOString(),
  };

  await db.from('middleman_wallets').upsert({
    middleman_id: middlemanId,
    middleman_name: middlemanName,
    tier,
    credit_limit: wallet.creditLimit,
    available_credit: wallet.availableCredit,
    held_credit: wallet.heldCredit,
    released_credit: wallet.releasedCredit,
    penalty_credit: wallet.penaltyCredit,
    active_deal_count: wallet.activeDealCount,
    updated_at: wallet.updatedAt,
  }, { onConflict: 'middleman_id' });

  // sync tier ที่คำนวณได้กลับเข้า profiles ด้วย เผื่อจุดอื่นในระบบอ่าน profiles.middleman_tier ตรง ๆ
  // (เป็นแค่ป้ายแสดงผล ไม่ใช่ค่าที่ใครเลือกเอง — เปลี่ยนอัตโนมัติตามยอดเงินประกันจริงเสมอ)
  if (profile && profile.middleman_tier !== tier) {
    await db.from('profiles').update({ middleman_tier: tier }).eq('id', middlemanId);
  }

  return wallet;
}

export async function getMiddlemanWallet(db: SupabaseClient, middlemanId: string) {
  const { data } = await db.from('middleman_wallets').select('*').eq('middleman_id', middlemanId).maybeSingle();
  if (data) return data;
  // ยังไม่มีแถวในตาราง — sync แล้วดึงแถวที่เพิ่ง upsert กลับมา (เพื่อให้ shape เป็น snake_case เหมือนกันเสมอ ไม่ใช่ camelCase ของ syncMiddlemanWallet)
  await syncMiddlemanWallet(db, middlemanId);
  const { data: created } = await db.from('middleman_wallets').select('*').eq('middleman_id', middlemanId).maybeSingle();
  return created;
}

export async function listLedgerEntriesForOwner(db: SupabaseClient, ownerId: string) {
  const { data } = await db
    .from('finance_ledger')
    .select('*')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(100);
  return data || [];
}

export async function syncFinanceProjection(db: SupabaseClient) {
  const fees = await readFeesConfig(db);
  const [{ data: deals }, { data: sellerApps }, { data: middlemanApps }, { data: onsiteJobs }] = await Promise.all([
    db.from('deals').select('*').order('created_at', { ascending: false }).limit(200),
    db.from('seller_applications').select('*').order('created_at', { ascending: false }).limit(200),
    db.from('middleman_applications').select('*').order('created_at', { ascending: false }).limit(200),
    db.from('onsite_jobs').select('*').order('created_at', { ascending: false }).limit(200),
  ]);

  for (const deal of deals || []) await syncDealLedger(db, deal as Record<string, unknown>, fees);
  for (const app of sellerApps || []) await syncSellerApplicationLedger(db, app as Record<string, unknown>, fees);
  for (const app of middlemanApps || []) await syncMiddlemanApplicationLedger(db, app as Record<string, unknown>, fees);
  for (const job of onsiteJobs || []) await syncOnsiteJobLedger(db, job as Record<string, unknown>, fees);

  const middlemanIds = new Set<string>();
  for (const deal of deals || []) if (deal.middleman_id) middlemanIds.add(String(deal.middleman_id));
  for (const job of onsiteJobs || []) if (job.middleman_id) middlemanIds.add(String(job.middleman_id));
  for (const app of middlemanApps || []) if (app.user_id && app.status === 'approved') middlemanIds.add(String(app.user_id));
  for (const middlemanId of middlemanIds) await syncMiddlemanWallet(db, middlemanId, '', undefined, fees);
}
