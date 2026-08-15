import type { SupabaseClient } from '@supabase/supabase-js';
import { type FeeConfig } from '@/lib/fees';
import {
  dealSlipPublicUrl,
  isSlipImageFile,
  verifySlipByFileId,
  isSlipokConfigured,
  formatSlipokError,
  type SlipInfo,
  type SlipResult,
} from '@/lib/slipok';
import { notifyAdminLineSlipResult } from '@/lib/lineAdminNotify';
import { readFeesConfig, syncDealLedger } from '@/app/api/_lib/financeLedger';
import { readServiceControlsConfig } from '@/app/api/_lib/appConfig';
import { shouldAutoVerifySlip } from '@/lib/serviceControls';
import { notifyUsers } from '@/app/api/_lib/notify';
import { maybeNotifyAdminLineQueues } from '@/app/api/_lib/adminLineNotifyHook';
import { loadAdminDealSnapshot, type AdminDealRow } from '@/app/api/_lib/adminDealQueue';
import { isListingCheckoutOrder, marketplaceBuyerPayAmount } from '@/lib/marketplaceOrder';
import { dealBuyerPayAmount, dealSellerServiceDue } from '@/lib/dealPaymentBreakdown';

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
    return { pass: false, reasons: [formatSlipokError('no_config')], warnings, slip: result.slip, raw: result };
  }
  if (result.code === 'not_image') {
    return { pass: false, reasons: [formatSlipokError('not_image')], warnings, slip: result.slip, raw: result };
  }

  // 1012 สลิปซ้ำ แต่ SlipOK ส่งข้อมูลสลิปมา = อ่านได้แล้วครั้งก่อน → ใช้ตรวจยอดต่อ
  const slipFromDup = !result.ok && result.duplicate && result.slip;
  if (!result.ok && !slipFromDup) {
    if (result.duplicate) reasons.push(formatSlipokError('1012'));
    else if (result.wrongReceiver) reasons.push(formatSlipokError('1014'));
    else reasons.push(formatSlipokError(result.code, result.message));
    return { pass: false, reasons, warnings, slip: result.slip, raw: result };
  }

  const slip = result.slip;
  if (!slip) {
    reasons.push('ไม่ได้รับข้อมูลจากสลิป');
    return { pass: false, reasons, warnings, slip, raw: result };
  }

  if (slipFromDup) {
    warnings.push('สลิปเคยส่งตรวจใน SlipOK แล้ว — ใช้ข้อมูลเดิมตรวจยอด');
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
  if (isListingCheckoutOrder(deal as { source?: string; deal_type?: string; buyer_id?: string })) return false;
  const feePayer = String(priceState?.proposed_fee_payer || deal.fee_payer || 'split');
  return deal.deal_type !== 'meetup' && (feePayer === 'seller' || feePayer === 'split');
}

function computeExpectedAmounts(
  deal: Record<string, unknown>,
  priceState: Record<string, unknown> | null,
  fees: FeeConfig,
) {
  if (isListingCheckoutOrder(deal as { source?: string; deal_type?: string; buyer_id?: string })) {
    return {
      buyer: marketplaceBuyerPayAmount(deal),
      seller: 0,
      sellerRequired: false,
    };
  }
  return {
    buyer: dealBuyerPayAmount(deal, priceState, fees),
    seller: dealSellerServiceDue(deal, priceState, fees),
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
  // ยอดตรวจใน evaluateSlipCheck ฝั่งเรา — ไม่ส่ง amount ให้ SlipOK (ลด false reject)
  const result = await verifySlipByFileId(fileId);
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

  const isListing = isListingCheckoutOrder(updated as { source?: string; deal_type?: string; buyer_id?: string });
  if (updated.seller_id) {
    await notifyUsers(db, [String(updated.seller_id)], {
      title: `ยืนยันรับเงิน: ${updated.title || 'ดีล'}`,
      body: isListing ? `${msg} — เข้าบอร์ดผู้ขายเพื่อแพ็คสินค้า` : msg,
      link: isListing ? '/dashboard/seller' : `/deal/${dealId}`,
    });
  }
  const otherRecipients = [updated.buyer_id, updated.middleman_id].filter((x): x is string => typeof x === 'string' && !!x);
  if (otherRecipients.length) {
    await notifyUsers(db, otherRecipients, {
      title: `ยืนยันรับเงิน: ${updated.title || 'ดีล'}`,
      body: msg,
      link: isListing ? `/cart/checkout/${dealId}` : `/deal/${dealId}`,
    });
  }

  await syncDealLedger(db, updated as Record<string, unknown>).catch(() => {});
  await maybeNotifyAdminLineQueues(db, before, updated);
  return updated;
}

function meetupExpectedAmount(md: Record<string, unknown>, side: SlipSide): number {
  const deposit = Number(md.deposit) || 0;
  const fee = side === 'buyer' ? Number(md.buyer_fee || 0) : Number(md.seller_fee || 0);
  return deposit + fee;
}

async function markMeetupSideVerified(db: SupabaseClient, dealId: string, side: SlipSide) {
  const field = side === 'buyer' ? 'buyer_slip_verified_at' : 'seller_slip_verified_at';
  await db.from('deal_meetup').upsert({ deal_id: dealId, [field]: new Date().toISOString() }, { onConflict: 'deal_id' });
}

async function tryAutoMeetupReady(
  db: SupabaseClient,
  dealId: string,
  deal: Record<string, unknown>,
  md: Record<string, unknown>,
) {
  if (deal.deal_type !== 'meetup' || deal.status !== 'payment_uploaded') return null;
  if (!md.buyer_slip_verified_at || !md.seller_slip_verified_at) return null;

  const before = await loadAdminDealSnapshot(db, deal as AdminDealRow);
  const { data: updated } = await db.from('deals').update({ status: 'meetup_ready', reject_reason: '' }).eq('id', dealId).select().single();
  if (!updated) return null;

  const msg = '🤖 ระบบตรวจสลิปเงินประกันครบและอนุมัติอัตโนมัติ — เริ่มขั้นตอนนัดพบได้';
  await insertSystemMsg(db, dealId, msg);

  const recipients = [updated.buyer_id, updated.seller_id].filter((x): x is string => typeof x === 'string' && !!x);
  if (recipients.length) {
    await notifyUsers(db, recipients, {
      title: `ยืนยันเงินประกัน: ${updated.title || 'ดีล'}`,
      body: msg,
      link: `/deal/${dealId}`,
    });
  }

  await syncDealLedger(db, updated as Record<string, unknown>).catch(() => {});
  await maybeNotifyAdminLineQueues(db, before, updated);
  return updated;
}

/** ตรวจสลิปเงินประกัน meetup อัตโนมัติ — แจ้ง LINE ครั้งเดียว (ผ่าน/ไม่ผ่าน) */
export async function runAutoMeetupSlipVerification(
  db: SupabaseClient,
  dealId: string,
  trigger: 'buyer' | 'seller' | 'both' = 'both',
): Promise<{ deal: Record<string, unknown>; skipConfirmPayLine: boolean }> {
  const { data: deal } = await db.from('deals').select('*').eq('id', dealId).maybeSingle();
  if (!deal || deal.deal_type !== 'meetup') {
    return { deal: deal as Record<string, unknown>, skipConfirmPayLine: false };
  }
  if (!['payment_pending', 'payment_uploaded'].includes(String(deal.status))) {
    return { deal: deal as Record<string, unknown>, skipConfirmPayLine: false };
  }

  const controls = await readServiceControlsConfig(db);
  const dealPrice = Number(deal.price || 0);
  if (!shouldAutoVerifySlip(controls, dealPrice)) {
    return { deal: deal as Record<string, unknown>, skipConfirmPayLine: false };
  }
  if (!isSlipokConfigured()) {
    return { deal: deal as Record<string, unknown>, skipConfirmPayLine: false };
  }

  const { data: md } = await db.from('deal_meetup').select('*').eq('deal_id', dealId).maybeSingle();
  if (!md) return { deal: deal as Record<string, unknown>, skipConfirmPayLine: false };

  const fees = await readFeesConfig(db);
  const companyBankAcct = fees.companyBankAcct || '';

  let latestDeal = deal as Record<string, unknown>;
  const sides: SlipSide[] = [];
  if (trigger === 'both' || trigger === 'buyer') sides.push('buyer');
  if (trigger === 'both' || trigger === 'seller') sides.push('seller');

  type PendingNotify = { side: SlipSide; evaluation: SlipCheckEvaluation; fileId: string; expected: number };
  const passedSides: PendingNotify[] = [];
  let anySlipChecked = false;

  for (const side of sides) {
    const fileId = side === 'buyer' ? String(md.buyer_slip || '') : String(md.seller_slip || '');
    const alreadyVerified = side === 'buyer' ? !!md.buyer_slip_verified_at : !!md.seller_slip_verified_at;
    if (!fileId || alreadyVerified) continue;

    anySlipChecked = true;
    const expected = meetupExpectedAmount(md, side);
    const evaluation = await verifyOneSide(deal, fileId, expected, companyBankAcct);
    const sideLabel = side === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย';
    const reasonText = evaluation.reasons.join(' · ') || 'ตรวจไม่ผ่าน';

    if (evaluation.pass) {
      await markMeetupSideVerified(db, dealId, side);
      await db.from('deals').update({ reject_reason: '' }).eq('id', dealId);
      await insertSystemMsg(
        db,
        dealId,
        `🤖 ระบบตรวจสลิปเงินประกัน${sideLabel}ผ่านอัตโนมัติ — ยอด ฿${Number(evaluation.slip?.amount || expected).toLocaleString()}${evaluation.slip?.transRef ? ` · ref ${evaluation.slip.transRef}` : ''}`,
      );
      latestDeal = { ...latestDeal, reject_reason: '' };
      passedSides.push({ side, evaluation, fileId, expected });
    } else {
      const via = evaluation.raw.via ? ` · ${evaluation.raw.via}` : '';
      const rejectReason = `[สลิปประกัน${sideLabel}${via}] ${reasonText}`.slice(0, 500);
      await db.from('deals').update({ reject_reason: rejectReason }).eq('id', dealId);
      latestDeal = { ...latestDeal, reject_reason: rejectReason };
      await insertSystemMsg(
        db,
        dealId,
        `⚠️ สลิปเงินประกัน${sideLabel}ไม่ผ่าน — ${reasonText} (รอแอดมินตรวจสอบ)`,
      );
      await notifyAdminLineSlipResult({
        deal: latestDeal,
        side,
        evaluation,
        slipUrl: isSlipImageFile(fileId) ? dealSlipPublicUrl(fileId) : '',
        autoApproved: false,
        expectedAmount: expected,
      });
    }
  }

  const { data: freshDeal } = await db.from('deals').select('*').eq('id', dealId).maybeSingle();
  const { data: freshMd } = await db.from('deal_meetup').select('*').eq('deal_id', dealId).maybeSingle();
  if (!freshDeal || !freshMd) return { deal: latestDeal, skipConfirmPayLine: anySlipChecked };

  const approved = await tryAutoMeetupReady(db, dealId, freshDeal, freshMd);
  const finalDeal = (approved || freshDeal) as Record<string, unknown>;

  for (const passed of passedSides) {
    await notifyAdminLineSlipResult({
      deal: finalDeal,
      side: passed.side,
      evaluation: passed.evaluation,
      slipUrl: isSlipImageFile(passed.fileId) ? dealSlipPublicUrl(passed.fileId) : '',
      autoApproved: !!approved,
      expectedAmount: passed.expected,
    });
  }

  return { deal: finalDeal, skipConfirmPayLine: anySlipChecked };
}

/** ตรวจสลิปอัตโนมัติหลังอัปสลิป — แจ้ง LINE ครั้งเดียว (ผ่าน/ไม่ผ่าน) */
export async function runAutoSlipVerification(
  db: SupabaseClient,
  dealId: string,
  trigger: 'buyer' | 'seller' | 'both' = 'both',
): Promise<{ deal: Record<string, unknown>; skipConfirmPayLine: boolean }> {
  const { data: deal } = await db.from('deals').select('*').eq('id', dealId).maybeSingle();
  if (!deal) {
    return { deal: {} as Record<string, unknown>, skipConfirmPayLine: false };
  }
  if (deal.deal_type === 'meetup') {
    return runAutoMeetupSlipVerification(db, dealId, trigger);
  }
  if (!['payment_pending', 'payment_uploaded', 'posted'].includes(String(deal.status))) {
    return { deal: deal as Record<string, unknown>, skipConfirmPayLine: false };
  }

  const controls = await readServiceControlsConfig(db);
  const dealPrice = Number(deal.price || 0);
  if (!shouldAutoVerifySlip(controls, dealPrice)) {
    return { deal: deal as Record<string, unknown>, skipConfirmPayLine: false };
  }
  if (!isSlipokConfigured()) {
    return { deal: deal as Record<string, unknown>, skipConfirmPayLine: false };
  }

  const { data: priceState } = await db.from('deal_price_state').select('*').eq('deal_id', dealId).maybeSingle();
  const fees = await readFeesConfig(db);
  const amounts = computeExpectedAmounts(deal, priceState, fees);
  const companyBankAcct = fees.companyBankAcct || '';

  let latestDeal = deal as Record<string, unknown>;

  const sides: SlipSide[] = [];
  if (trigger === 'both' || trigger === 'buyer') sides.push('buyer');
  if (trigger === 'both' || trigger === 'seller') sides.push('seller');

  type PendingNotify = { side: SlipSide; evaluation: SlipCheckEvaluation; fileId: string; expected: number };
  const passedSides: PendingNotify[] = [];
  let anySlipChecked = false;

  for (const side of sides) {
    const fileId = side === 'buyer' ? String(deal.payment_slip_file_id || '') : String(priceState?.seller_fee_slip || '');
    const alreadyVerified = side === 'buyer' ? !!deal.payment_slip_verified_at : !!priceState?.seller_fee_slip_verified_at;

    if (!fileId || alreadyVerified) continue;
    if (side === 'seller' && !amounts.sellerRequired) continue;

    anySlipChecked = true;
    const expected = side === 'buyer' ? amounts.buyer : amounts.seller;
    const evaluation = await verifyOneSide(deal, fileId, expected, companyBankAcct);
    const sideLabel = side === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย';
    const reasonText = evaluation.reasons.join(' · ') || 'ตรวจไม่ผ่าน';

    if (evaluation.pass) {
      await markSideVerified(db, dealId, side);
      await db.from('deals').update({ reject_reason: '' }).eq('id', dealId);
      await insertSystemMsg(
        db,
        dealId,
        `🤖 ระบบตรวจสลิป${sideLabel}ผ่านอัตโนมัติ — ยอด ฿${Number(evaluation.slip?.amount || expected).toLocaleString()}${evaluation.slip?.transRef ? ` · ref ${evaluation.slip.transRef}` : ''}`,
      );
      if (side === 'buyer') latestDeal = { ...latestDeal, payment_slip_verified_at: new Date().toISOString(), reject_reason: '' };
      else latestDeal = { ...latestDeal, reject_reason: '' };
      passedSides.push({ side, evaluation, fileId, expected });
    } else {
      const via = evaluation.raw.via ? ` · ${evaluation.raw.via}` : '';
      const rejectReason = `[สลิป${sideLabel}${via}] ${reasonText}`.slice(0, 500);
      await db.from('deals').update({ reject_reason: rejectReason }).eq('id', dealId);
      latestDeal = { ...latestDeal, reject_reason: rejectReason };
      await insertSystemMsg(
        db,
        dealId,
        `⚠️ สลิป${sideLabel}ไม่ผ่าน — ${reasonText} (รอแอดมินตรวจสอบ)`,
      );
      await notifyAdminLineSlipResult({
        deal: latestDeal,
        side,
        evaluation,
        slipUrl: isSlipImageFile(fileId) ? dealSlipPublicUrl(fileId) : '',
        autoApproved: false,
        expectedAmount: expected,
        fees,
        priceState,
      });
    }
  }

  const { data: freshDeal } = await db.from('deals').select('*').eq('id', dealId).maybeSingle();
  const { data: freshPrice } = await db.from('deal_price_state').select('*').eq('deal_id', dealId).maybeSingle();
  if (!freshDeal) return { deal: latestDeal, skipConfirmPayLine: anySlipChecked };

  const approved = await tryAutoApprove(db, dealId, freshDeal, freshPrice);
  const finalDeal = (approved || freshDeal) as Record<string, unknown>;

  for (const passed of passedSides) {
    await notifyAdminLineSlipResult({
      deal: finalDeal,
      side: passed.side,
      evaluation: passed.evaluation,
      slipUrl: isSlipImageFile(passed.fileId) ? dealSlipPublicUrl(passed.fileId) : '',
      autoApproved: !!approved,
      expectedAmount: passed.expected,
      fees,
      priceState: freshPrice,
    });
  }

  return { deal: finalDeal, skipConfirmPayLine: anySlipChecked };
}
