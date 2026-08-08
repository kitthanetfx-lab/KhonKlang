import type { SupabaseClient } from '@supabase/supabase-js';
import { computeDealFees, type FeeConfig } from '@/lib/fees';
import { splitFeeByPayer } from '@/lib/financeLedger';
import {
  dealSlipPublicUrl,
  isSlipImageFile,
  verifySlipByFileId,
  isSlipokConfigured,
  type SlipInfo,
  type SlipResult,
} from '@/lib/slipok';
import { notifyAdminLineSlipCheck, notifyAdminLineAutoApproved } from '@/lib/lineAdminNotify';
import { readFeesConfig, syncDealLedger } from '@/app/api/_lib/financeLedger';
import { readServiceControlsConfig } from '@/app/api/_lib/appConfig';
import { shouldAutoVerifySlip } from '@/lib/serviceControls';
import { notifyUsers } from '@/app/api/_lib/notify';
import { maybeNotifyAdminLineQueues } from '@/app/api/_lib/adminLineNotifyHook';
import { loadAdminDealSnapshot, type AdminDealRow } from '@/app/api/_lib/adminDealQueue';

export type SlipSide = 'buyer' | 'seller';

export interface SlipCheckEvaluation {
  pass: boolean;
  reasons: string[];
  warnings: string[];
  slip?: SlipInfo;
  raw: SlipResult;
}

const AMOUNT_TOLERANCE = 0.5;
const MAX_AGE_DAYS = 7;
const FUTURE_TOLERANCE_MS = 2 * 60 * 60 * 1000;

export function normalizeAccount(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

export function accountsMatch(expected: string, actual: string): boolean {
  const a = normalizeAccount(expected);
  const b = normalizeAccount(actual);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.endsWith(b) || b.endsWith(a);
}

export function parseSlipTransferDate(slip: SlipInfo): Date | null {
  if (slip.transTimestamp) {
    const d = new Date(slip.transTimestamp);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const datePart = String(slip.transDate || '').trim();
  const timePart = String(slip.transTime || '').trim();
  if (!datePart) return null;
  const composed = timePart ? `${datePart} ${timePart}` : datePart;
  const d = new Date(composed);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function evaluateSlipCheck(
  result: SlipResult,
  opts: {
    expectedAmount: number;
    companyBankAcct: string;
    uploadedAt: Date;
  },
): SlipCheckEvaluation {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (result.code === 'no_config') {
    return { pass: false, reasons: [result.message], warnings, slip: result.slip, raw: result };
  }
  if (result.code === 'not_image') {
    return { pass: false, reasons: [result.message], warnings, slip: result.slip, raw: result };
  }
  if (!result.ok) {
    if (result.duplicate) reasons.push('สลิปซ้ำ — เคยใช้ในระบบแล้ว');
    else if (result.wrongReceiver) reasons.push('บัญชีผู้รับไม่ตรงบัญชีบริษัท');
    else reasons.push(result.message || 'สลิปไม่ผ่านการตรวจสอบ');
    return { pass: false, reasons, warnings, slip: result.slip, raw: result };
  }

  const slip = result.slip;
  if (!slip) {
    reasons.push('ไม่ได้รับข้อมูลจากสลิป');
    return { pass: false, reasons, warnings, slip, raw: result };
  }

  const expected = Math.round(Number(opts.expectedAmount) || 0);
  if (expected > 0 && Math.abs(Number(slip.amount) - expected) > AMOUNT_TOLERANCE) {
    reasons.push(`ยอดเงินไม่ตรง (สลิป ฿${Number(slip.amount).toLocaleString()} / ต้องโอน ฿${expected.toLocaleString()})`);
  }

  const companyAcct = String(opts.companyBankAcct || '').trim();
  if (companyAcct && slip.receiverAccount && !accountsMatch(companyAcct, slip.receiverAccount)) {
    reasons.push(`เลขบัญชีผู้รับไม่ตรง (สลิป: ${slip.receiverAccount} / บริษัท: ${companyAcct})`);
  } else if (companyAcct && !slip.receiverAccount) {
    warnings.push('ไม่พบเลขบัญชีผู้รับบนสลิป — ตรวจด้วยตนเองเพิ่มเติม');
  }

  const transferAt = parseSlipTransferDate(slip);
  if (transferAt) {
    const uploadAt = opts.uploadedAt.getTime();
    const transferMs = transferAt.getTime();
    const ageMs = uploadAt - transferMs;
    if (ageMs > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
      reasons.push(`เวลาโอนบนสลิปเก่ากว่าตอนอัปมากกว่า ${MAX_AGE_DAYS} วัน`);
    }
    if (transferMs - uploadAt > FUTURE_TOLERANCE_MS) {
      reasons.push('เวลาโอนบนสลิปอยู่หลังเวลาอัปสลิปผิดปกติ');
    }
  } else {
    warnings.push('อ่านเวลาโอนจากสลิปไม่ได้ — ไม่ใช้เป็นข้อ fail');
  }

  return {
    pass: reasons.length === 0,
    reasons,
    warnings,
    slip,
    raw: result,
  };
}

function sellerSlipRequired(deal: Record<string, unknown>, priceState: Record<string, unknown> | null): boolean {
  const feePayer = String(priceState?.proposed_fee_payer || deal.fee_payer || 'split');
  return deal.deal_type !== 'meetup' && (feePayer === 'seller' || feePayer === 'split');
}

function computeExpectedAmounts(
  deal: Record<string, unknown>,
  priceState: Record<string, unknown> | null,
  fees: FeeConfig,
) {
  const price = Number(deal.price) || 0;
  const feeBreakdown = computeDealFees(fees, price, String(deal.deal_type || ''));
  const feePayer = splitFeeByPayer(feeBreakdown.total, String(priceState?.proposed_fee_payer || deal.fee_payer || 'split'));
  return {
    buyer: price + feePayer.buyerShare,
    seller: feePayer.sellerShare,
    sellerRequired: sellerSlipRequired(deal, priceState),
  };
}

async function insertSystemMsg(db: SupabaseClient, dealId: string, content: string) {
  await db.from('messages').insert({
    deal_id: dealId,
    sender_id: null,
    sender_name: 'ระบบ',
    role: 'system',
    type: 'system',
    content,
    file_id: '',
    file_name: '',
  });
}

async function verifyOneSide(
  deal: Record<string, unknown>,
  fileId: string,
  expectedAmount: number,
  companyBankAcct: string,
): Promise<SlipCheckEvaluation> {
  const result = await verifySlipByFileId(fileId, expectedAmount > 0 ? expectedAmount : undefined);
  return evaluateSlipCheck(result, {
    expectedAmount,
    companyBankAcct,
    uploadedAt: new Date(),
  });
}

async function markSideVerified(db: SupabaseClient, dealId: string, side: SlipSide) {
  const now = new Date().toISOString();
  if (side === 'buyer') {
    await db.from('deals').update({ payment_slip_verified_at: now }).eq('id', dealId);
  } else {
    await db.from('deal_price_state').upsert({ deal_id: dealId, seller_fee_slip_verified_at: now }, { onConflict: 'deal_id' });
  }
}

async function tryAutoApprove(db: SupabaseClient, dealId: string, deal: Record<string, unknown>, priceState: Record<string, unknown> | null) {
  if (deal.deal_type === 'meetup' || deal.status !== 'payment_uploaded') return null;
  if (!deal.payment_slip_file_id || !deal.payment_slip_verified_at) return null;
  if (sellerSlipRequired(deal, priceState)) {
    if (!priceState?.seller_fee_slip || !priceState?.seller_fee_slip_verified_at) return null;
  }

  const before = await loadAdminDealSnapshot(db, deal as AdminDealRow);
  const { data: updated } = await db.from('deals').update({
    status: 'packing',
    middleman_confirmed_payment: true,
  }).eq('id', dealId).select().single();

  if (!updated) return null;

  const msg = '🤖 ระบบตรวจสลิปครบและอนุมัติรับเงินอัตโนมัติ — ผู้ขายเริ่มแพ็คสินค้าได้';
  await insertSystemMsg(db, dealId, msg);

  const recipients = [updated.seller_id, updated.buyer_id, updated.middleman_id].filter((x): x is string => typeof x === 'string' && !!x);
  if (recipients.length) {
    await notifyUsers(db, recipients, {
      title: `ยืนยันรับเงิน: ${updated.title || 'ดีล'}`,
      body: msg,
      link: `/deal/${dealId}`,
    });
  }

  await syncDealLedger(db, updated as Record<string, unknown>).catch(() => {});
  await maybeNotifyAdminLineQueues(db, before, updated);
  await notifyAdminLineAutoApproved(updated as Record<string, unknown>);
  return updated;
}

/** ตรวจสลิปอัตโนมัติหลังอัปสลิป — แยกผู้ซื้อ/ผู้ขาย */
export async function runAutoSlipVerification(
  db: SupabaseClient,
  dealId: string,
  trigger: 'buyer' | 'seller' | 'both' = 'both',
): Promise<Record<string, unknown> | null> {
  const { data: deal } = await db.from('deals').select('*').eq('id', dealId).maybeSingle();
  if (!deal || deal.deal_type === 'meetup') return deal;
  if (!['payment_pending', 'payment_uploaded'].includes(String(deal.status))) return deal;

  const controls = await readServiceControlsConfig(db);
  const dealPrice = Number(deal.price || 0);
  if (!shouldAutoVerifySlip(controls, dealPrice)) return deal;
  if (!isSlipokConfigured()) return deal;

  const { data: priceState } = await db.from('deal_price_state').select('*').eq('deal_id', dealId).maybeSingle();
  const fees = await readFeesConfig(db);
  const amounts = computeExpectedAmounts(deal, priceState, fees);
  const companyBankAcct = fees.companyBankAcct || '';

  let latestDeal = deal as Record<string, unknown>;

  const sides: SlipSide[] = [];
  if (trigger === 'both' || trigger === 'buyer') sides.push('buyer');
  if (trigger === 'both' || trigger === 'seller') sides.push('seller');

  for (const side of sides) {
    const fileId = side === 'buyer' ? String(deal.payment_slip_file_id || '') : String(priceState?.seller_fee_slip || '');
    const alreadyVerified = side === 'buyer' ? !!deal.payment_slip_verified_at : !!priceState?.seller_fee_slip_verified_at;

    if (!fileId || alreadyVerified) continue;
    if (side === 'seller' && !amounts.sellerRequired) continue;

    const expected = side === 'buyer' ? amounts.buyer : amounts.seller;
    const evaluation = await verifyOneSide(deal, fileId, expected, companyBankAcct);
    const sideLabel = side === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย';

    await notifyAdminLineSlipCheck({
      deal: latestDeal,
      side,
      evaluation,
      slipUrl: isSlipImageFile(fileId) ? dealSlipPublicUrl(fileId) : '',
    });

    if (evaluation.pass) {
      await markSideVerified(db, dealId, side);
      await insertSystemMsg(
        db,
        dealId,
        `🤖 ระบบตรวจสลิป${sideLabel}ผ่านอัตโนมัติ — ยอด ฿${Number(evaluation.slip?.amount || expected).toLocaleString()}${evaluation.slip?.transRef ? ` · ref ${evaluation.slip.transRef}` : ''}`,
      );
      if (side === 'buyer') latestDeal = { ...latestDeal, payment_slip_verified_at: new Date().toISOString() };
    } else {
      await insertSystemMsg(
        db,
        dealId,
        `⚠️ สลิป${sideLabel}มีปัญหา — รอแอดมินตรวจสอบ (${evaluation.reasons.join(' · ') || 'ตรวจไม่ผ่าน'})`,
      );
    }
  }

  const { data: freshDeal } = await db.from('deals').select('*').eq('id', dealId).maybeSingle();
  const { data: freshPrice } = await db.from('deal_price_state').select('*').eq('deal_id', dealId).maybeSingle();
  if (!freshDeal) return latestDeal;

  const approved = await tryAutoApprove(db, dealId, freshDeal, freshPrice);
  return approved || freshDeal;
}
