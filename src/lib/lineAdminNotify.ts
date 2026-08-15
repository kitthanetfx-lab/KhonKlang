import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminDealSnapshot, AdminQueueStep } from '@/app/api/_lib/adminDealQueue';
import type { FeeConfig } from '@/lib/fees';
import { DEAL_BUCKET, fileViewUrl } from '@/lib/supabase';
import { adminDealsPagePath, getAdminCategoryLabel, getDealCategory } from '@/lib/adminDealCategory';
import { computeDealPaymentBreakdown, formatDealPaymentBreakdownLines, type PriceStateInput } from '@/lib/dealPaymentBreakdown';
import { formatWarranty } from '@/lib/warranty';

const STEP_LABELS: Record<AdminQueueStep, string> = {
  confirm_pay: '⚡ ยืนยันรับเงิน',
  pay_seller: '💰 โอนเงินค่าสินค้า',
  refund_pending: '🔄 คืนเงินผู้ซื้อ',
  middleman_fee: '💼 โอนเงินค่าคนกลาง',
  meetup_refund: '💸 คืนเงินประกัน',
};

type LineMessage =
  | { type: 'text'; text: string }
  | { type: 'image'; originalContentUrl: string; previewImageUrl: string };

type SlipRef = { label: string; fileId: string };

function isLineImageFile(fileId: string): boolean {
  const ext = fileId.split('.').pop()?.toLowerCase() || '';
  return ext === 'jpg' || ext === 'jpeg' || ext === 'png';
}

function slipPublicUrl(fileId: string): string {
  return fileViewUrl(DEAL_BUCKET, fileId);
}

function slipsForStep(step: AdminQueueStep, snap: AdminDealSnapshot): SlipRef[] {
  const { deal, priceState, meetup } = snap;
  const out: SlipRef[] = [];
  const add = (label: string, fileId?: string | null) => {
    if (fileId) out.push({ label, fileId });
  };

  switch (step) {
    case 'confirm_pay':
      add('สลิปผู้ซื้อ', deal.payment_slip_file_id);
      add('สลิปค่าบริการผู้ขาย', priceState?.seller_fee_slip);
      break;
    case 'pay_seller':
    case 'refund_pending':
      add('สลิปผู้ซื้อ', deal.payment_slip_file_id);
      break;
    case 'middleman_fee':
      break;
    case 'meetup_refund':
      add('สลิปเงินประกันผู้ซื้อ', meetup?.buyer_slip);
      add('สลิปเงินประกันผู้ขาย', meetup?.seller_slip);
      break;
    default:
      break;
  }
  return out;
}

function warrantyNotifyLine(deal: Record<string, unknown> | AdminDealSnapshot['deal']): string | null {
  const w = formatWarranty(
    Number((deal as Record<string, unknown>).warranty_years) || 0,
    Number((deal as Record<string, unknown>).warranty_months) || 0,
    Number((deal as Record<string, unknown>).warranty_days) || 0,
  );
  return w ? `🛡️ เงื่อนไขประกัน: ${w}` : null;
}

function buildNotifyText(
  snap: AdminDealSnapshot,
  step: AdminQueueStep,
  slips: SlipRef[],
  fees: FeeConfig,
): string {
  const { deal, priceState } = snap;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.glanghub.com').replace(/\/$/, '');
  const label = STEP_LABELS[step];
  const category = getDealCategory(deal);
  const catLabel = getAdminCategoryLabel(category);
  const num = deal.deal_number || deal.id.slice(0, 8).toUpperCase();
  const title = deal.title || 'ดีล';
  const buyer = deal.buyer_name?.trim() || '-';
  const seller = deal.seller_name?.trim() || '-';

  const lines = [
    `[กลางฮับ · ${catLabel}] ${label}`,
    `${num} · ${title}`,
    `ผู้ขาย: ${seller}`,
    `ผู้ซื้อ: ${buyer}`,
  ];

  const warranty = warrantyNotifyLine(deal);
  if (warranty) lines.push(warranty);

  const payBd = computeDealPaymentBreakdown(deal, priceState, fees);
  if (payBd) {
    lines.push(...formatDealPaymentBreakdownLines(payBd));
  } else {
    lines.push(`มูลค่า ฿${Number(deal.price || 0).toLocaleString('th-TH')}`);
  }

  for (const slip of slips) {
    if (!isLineImageFile(slip.fileId)) {
      lines.push(`${slip.label}: ${slipPublicUrl(slip.fileId)}`);
    }
  }

  lines.push(`${appUrl}${adminDealsPagePath(category, step)}`);
  return lines.join('\n').slice(0, 5000);
}

function buildLineMessages(snap: AdminDealSnapshot, step: AdminQueueStep, fees: FeeConfig): LineMessage[] {
  const slips = slipsForStep(step, snap);
  const messages: LineMessage[] = [{ type: 'text', text: buildNotifyText(snap, step, slips, fees) }];

  for (const slip of slips) {
    if (messages.length >= 5) break;
    if (!isLineImageFile(slip.fileId)) continue;
    const url = slipPublicUrl(slip.fileId);
    if (!url) continue;
    messages.push({ type: 'image', originalContentUrl: url, previewImageUrl: url });
  }

  return messages;
}

async function sendLineAdminMessages(messages: LineMessage[]): Promise<void> {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_ADMIN_GROUP_ID;
  if (!token || !to || !messages.length) return;

  const push = async (batch: LineMessage[]) => {
    if (!batch.length) return true;
    try {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ to, messages: batch.slice(0, 5) }),
      });
      if (!res.ok) {
        console.error('[lineAdminNotify] push failed:', res.status, await res.text());
        return false;
      }
      return true;
    } catch (err) {
      console.error('[lineAdminNotify] push error:', err);
      return false;
    }
  };

  const texts = messages.filter((m): m is Extract<LineMessage, { type: 'text' }> => m.type === 'text');
  const images = messages.filter((m): m is Extract<LineMessage, { type: 'image' }> => m.type === 'image');
  const textOk = await push(texts.length ? texts : messages.slice(0, 1));
  if (!textOk) return;
  for (const img of images) {
    await push([img]);
  }
}

/** แจ้ง LINE OA ทีมแอดมิน — ครั้งเดียวต่อดีลต่อขั้นตอน (dedupe ใน DB) */
export async function notifyAdminLineStep(
  db: SupabaseClient,
  snap: AdminDealSnapshot,
  step: AdminQueueStep,
  fees: FeeConfig,
): Promise<void> {
  const deal = snap.deal;
  const { error } = await db.from('admin_line_notifications').insert({ deal_id: deal.id, step });
  if (error) {
    if (error.code === '23505') return;
    console.error('[lineAdminNotify] dedupe insert failed:', error.message);
    return;
  }

  await sendLineAdminMessages(buildLineMessages(snap, step, fees));
}

export async function notifyAdminLineSteps(
  db: SupabaseClient,
  snap: AdminDealSnapshot,
  steps: AdminQueueStep[],
  fees: FeeConfig,
): Promise<void> {
  for (const step of steps) {
    await notifyAdminLineStep(db, snap, step, fees);
  }
}

/** แจ้ง LINE ครั้งเดียว — ผลตรวจสลิป (ผ่าน/ไม่ผ่าน) + สถานะอนุมัติอัตโนมัติ */
export async function notifyAdminLineSlipResult(params: {
  deal: Record<string, unknown>;
  side: 'buyer' | 'seller';
  evaluation: { pass: boolean; reasons: string[]; warnings: string[]; slip?: { amount?: number; transRef?: string; receiverAccount?: string; senderName?: string; transDate?: string; transTime?: string } };
  slipUrl?: string;
  autoApproved?: boolean;
  expectedAmount?: number;
  fees?: FeeConfig;
  priceState?: PriceStateInput;
}): Promise<void> {
  const { deal, side, evaluation, slipUrl, autoApproved, expectedAmount, fees, priceState } = params;
  const sideLabel = side === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย';
  const num = String(deal.deal_number || String(deal.id || '').slice(0, 8).toUpperCase());
  const title = String(deal.title || 'ดีล');
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.glanghub.com').replace(/\/$/, '');
  const category = getDealCategory({
    source: String(deal.source || ''),
    status: String(deal.status || ''),
    deal_type: String(deal.deal_type || ''),
  });
  const catLabel = getAdminCategoryLabel(category);
  const buyer = String(deal.buyer_name || '-').trim() || '-';
  const seller = String(deal.seller_name || '-').trim() || '-';

  let headline: string;
  if (evaluation.pass && autoApproved) {
    headline = String(deal.deal_type || '') === 'meetup'
      ? `✅ ตรวจสลิป${sideLabel} — ผ่าน · อนุมัติอัตโนมัติแล้ว (เริ่มนัดพบได้)`
      : `✅ ตรวจสลิป${sideLabel} — ผ่าน · อนุมัติอัตโนมัติแล้ว (เริ่มแพ็คได้)`;
  } else if (evaluation.pass) {
    headline = `✅ ตรวจสลิป${sideLabel} — ผ่าน · รอแอดมินยืนยัน`;
  } else {
    headline = `⚠️ ตรวจสลิป${sideLabel} — ไม่ผ่าน · รอแอดมินตรวจมือ`;
  }

  const lines = [
    `[กลางฮับ · ${catLabel}] ${headline}`,
    `${num} · ${title}`,
    `ผู้ขาย: ${seller}`,
    `ผู้ซื้อ: ${buyer}`,
  ];

  const warranty = warrantyNotifyLine(deal);
  if (warranty) lines.push(warranty);

  if (fees && String(deal.deal_type || '') !== 'meetup') {
    const payBd = computeDealPaymentBreakdown(deal, priceState, fees);
    if (payBd) {
      lines.push(...formatDealPaymentBreakdownLines(payBd, { highlightSide: side }));
    }
  } else if (expectedAmount != null && expectedAmount > 0) {
    lines.push(`ยอดที่ต้องโอน (${sideLabel}): ฿${Math.round(expectedAmount).toLocaleString('th-TH')}`);
  } else {
    lines.push(`มูลค่าสินค้า ฿${Number(deal.price || 0).toLocaleString('th-TH')}`);
  }

  if (evaluation.pass) {
    lines.push('ผล: ผ่าน');
  } else {
    lines.push(`ผล: ไม่ผ่าน — ${evaluation.reasons.join(' · ') || 'ตรวจไม่ผ่าน'}`);
  }

  const slip = evaluation.slip;
  if (slip) {
    if (slip.amount != null) lines.push(`ยอดในสลิป: ฿${Number(slip.amount).toLocaleString('th-TH')}`);
    if (slip.senderName) lines.push(`ผู้โอน: ${slip.senderName}`);
    if (slip.receiverAccount) lines.push(`บัญชีผู้รับ: ${slip.receiverAccount}`);
    if ('receiverProxy' in slip && slip.receiverProxy) lines.push(`PromptPay ผู้รับ: ${slip.receiverProxy}`);
    if (slip.transRef) lines.push(`เลขอ้างอิง: ${slip.transRef}`);
    if (slip.transDate || slip.transTime) lines.push(`เวลาโอน: ${[slip.transDate, slip.transTime].filter(Boolean).join(' ')}`);
  }
  if (evaluation.warnings.length) lines.push(`หมายเหตุ: ${evaluation.warnings.join(' · ')}`);

  const adminTab = autoApproved ? 'active' : 'confirm_pay';
  lines.push(`${appUrl}${adminDealsPagePath(category, adminTab)}`);

  const messages: LineMessage[] = [{ type: 'text', text: lines.join('\n').slice(0, 5000) }];
  if (slipUrl && messages.length < 5) {
    messages.push({ type: 'image', originalContentUrl: slipUrl, previewImageUrl: slipUrl });
  }
  await sendLineAdminMessages(messages);
}

/** @deprecated ใช้ notifyAdminLineSlipResult แทน — คงไว้เพื่อ backward compat */
export async function notifyAdminLineSlipCheck(params: {
  deal: Record<string, unknown>;
  side: 'buyer' | 'seller';
  evaluation: { pass: boolean; reasons: string[]; warnings: string[]; slip?: { amount?: number; transRef?: string; receiverAccount?: string; senderName?: string; transDate?: string; transTime?: string } };
  slipUrl?: string;
}): Promise<void> {
  await notifyAdminLineSlipResult({ ...params, autoApproved: false });
}

/** แจ้ง LINE เมื่อระบบอนุมัติรับเงินอัตโนมัติครบทุกสลิป */
export async function notifyAdminLineAutoApproved(
  deal: Record<string, unknown>,
  fees?: FeeConfig,
  priceState?: PriceStateInput,
): Promise<void> {
  const num = String(deal.deal_number || String(deal.id || '').slice(0, 8).toUpperCase());
  const title = String(deal.title || 'ดีล');
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.glanghub.com').replace(/\/$/, '');
  const category = getDealCategory({
    source: String(deal.source || ''),
    status: String(deal.status || ''),
    deal_type: String(deal.deal_type || ''),
  });
  const catLabel = getAdminCategoryLabel(category);
  const lines = [
    `[กลางฮับ · ${catLabel}] ✅ อนุมัติรับเงินอัตโนมัติ — เริ่มแพ็คได้`,
    `${num} · ${title}`,
  ];
  if (fees) {
    const payBd = computeDealPaymentBreakdown(deal, priceState, fees);
    if (payBd) lines.push(...formatDealPaymentBreakdownLines(payBd));
  }
  lines.push(`${appUrl}${adminDealsPagePath(category, 'confirm_pay')}`);
  await sendLineAdminMessages([{
    type: 'text',
    text: lines.join('\n').slice(0, 5000),
  }]);
}

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://www.glanghub.com').replace(/\/$/, '');
}

/** แจ้ง LINE กลุ่มแอดมิน — สลิปเติมเงินกระเป๋า (ผ่านอัตโนมัติ / ไม่ผ่าน / รอตรวจมือ) */
export async function notifyAdminLineWalletTopup(params: {
  userName: string;
  amount: number;
  autoApproved: boolean;
  skipped?: boolean;
  skipReason?: string;
  evaluation?: {
    pass: boolean;
    reasons: string[];
    warnings: string[];
    slip?: { amount?: number; transRef?: string; receiverAccount?: string; receiverProxy?: string; senderName?: string; transDate?: string; transTime?: string };
  };
  slipFileId?: string;
}): Promise<void> {
  const { userName, amount, autoApproved, skipped, skipReason, evaluation, slipFileId } = params;
  const appUrl = appBaseUrl();
  let headline: string;
  if (skipped) headline = `🧾 เติมเงินกระเป๋า — รอแอดมินตรวจมือ${skipReason ? ` (${skipReason})` : ''}`;
  else if (evaluation?.pass && autoApproved) headline = '✅ ตรวจสลิปเติมเงิน — ผ่าน · เข้ากระเป๋าอัตโนมัติแล้ว';
  else if (evaluation?.pass) headline = '✅ ตรวจสลิปเติมเงิน — ผ่าน · รอแอดมินยืนยัน';
  else headline = '⚠️ ตรวจสลิปเติมเงิน — ไม่ผ่าน · รอแอดมินตรวจมือ';

  const lines = [
    `[กลางฮับ · กระเป๋าเงิน] ${headline}`,
    `ผู้ใช้: ${userName || '-'}`,
    `ยอดที่แจ้งเติม: ฿${Math.round(amount).toLocaleString('th-TH')}`,
  ];
  if (evaluation) {
    lines.push(evaluation.pass ? 'ผล: ผ่าน' : `ผล: ไม่ผ่าน — ${evaluation.reasons.join(' · ') || 'ตรวจไม่ผ่าน'}`);
    const slip = evaluation.slip;
    if (slip) {
      if (slip.amount != null) lines.push(`ยอดในสลิป: ฿${Number(slip.amount).toLocaleString('th-TH')}`);
      if (slip.senderName) lines.push(`ผู้โอน: ${slip.senderName}`);
      if (slip.receiverAccount) lines.push(`บัญชีผู้รับ: ${slip.receiverAccount}`);
      if (slip.receiverProxy) lines.push(`PromptPay ผู้รับ: ${slip.receiverProxy}`);
      if (slip.transRef) lines.push(`เลขอ้างอิง: ${slip.transRef}`);
      if (slip.transDate || slip.transTime) lines.push(`เวลาโอน: ${[slip.transDate, slip.transTime].filter(Boolean).join(' ')}`);
    }
    if (evaluation.warnings.length) lines.push(`หมายเหตุ: ${evaluation.warnings.join(' · ')}`);
  }
  lines.push(`${appUrl}/admin/wallet`);

  const messages: LineMessage[] = [{ type: 'text', text: lines.join('\n').slice(0, 5000) }];
  if (slipFileId && isLineImageFile(slipFileId) && messages.length < 5) {
    const url = slipPublicUrl(slipFileId);
    if (url) messages.push({ type: 'image', originalContentUrl: url, previewImageUrl: url });
  }
  await sendLineAdminMessages(messages);
}

/** แจ้ง LINE กลุ่มแอดมิน — มีคำขอถอนเงิน */
export async function notifyAdminLineWalletWithdraw(params: {
  userName: string;
  amount: number;
  bankName: string;
  bankAcct: string;
  bankOwner: string;
}): Promise<void> {
  const appUrl = appBaseUrl();
  const lines = [
    '[กลางฮับ · กระเป๋าเงิน] 💸 มีคำขอถอนเงิน — รอโอนออก',
    `ผู้ใช้: ${params.userName || '-'}`,
    `ยอด: ฿${Math.round(params.amount).toLocaleString('th-TH')}`,
    `ธนาคาร: ${params.bankName || '-'}`,
    `เลขบัญชี: ${params.bankAcct || '-'}`,
    `ชื่อบัญชี: ${params.bankOwner || '-'}`,
    `${appUrl}/admin/wallet`,
  ];
  await sendLineAdminMessages([{ type: 'text', text: lines.join('\n').slice(0, 5000) }]);
}
