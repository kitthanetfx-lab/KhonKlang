import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminDealSnapshot, AdminQueueStep } from '@/app/api/_lib/adminDealQueue';
import { DEAL_BUCKET, fileViewUrl } from '@/lib/supabase';

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

function buildNotifyText(
  snap: AdminDealSnapshot,
  step: AdminQueueStep,
  slips: SlipRef[],
): string {
  const { deal } = snap;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.glanghub.com').replace(/\/$/, '');
  const label = STEP_LABELS[step];
  const num = deal.deal_number || deal.id.slice(0, 8).toUpperCase();
  const title = deal.title || 'ดีล';
  const price = Number(deal.price || 0).toLocaleString('th-TH');
  const buyer = deal.buyer_name?.trim() || '-';
  const seller = deal.seller_name?.trim() || '-';

  const lines = [
    `[กลางฮับ] ${label}`,
    `${num} · ${title}`,
    `ผู้ขาย: ${seller}`,
    `ผู้ซื้อ: ${buyer}`,
    `มูลค่า ฿${price}`,
  ];

  for (const slip of slips) {
    if (!isLineImageFile(slip.fileId)) {
      lines.push(`${slip.label}: ${slipPublicUrl(slip.fileId)}`);
    }
  }

  lines.push(`${appUrl}/admin/deals?tab=${step}`);
  return lines.join('\n').slice(0, 5000);
}

function buildLineMessages(snap: AdminDealSnapshot, step: AdminQueueStep): LineMessage[] {
  const slips = slipsForStep(step, snap);
  const messages: LineMessage[] = [{ type: 'text', text: buildNotifyText(snap, step, slips) }];

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
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to, messages: messages.slice(0, 5) }),
    });
    if (!res.ok) {
      console.error('[lineAdminNotify] push failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[lineAdminNotify] push error:', err);
  }
}

/** แจ้ง LINE OA ทีมแอดมิน — ครั้งเดียวต่อดีลต่อขั้นตอน (dedupe ใน DB) */
export async function notifyAdminLineStep(
  db: SupabaseClient,
  snap: AdminDealSnapshot,
  step: AdminQueueStep,
): Promise<void> {
  const deal = snap.deal;
  const { error } = await db.from('admin_line_notifications').insert({ deal_id: deal.id, step });
  if (error) {
    if (error.code === '23505') return;
    console.error('[lineAdminNotify] dedupe insert failed:', error.message);
    return;
  }

  await sendLineAdminMessages(buildLineMessages(snap, step));
}

export async function notifyAdminLineSteps(
  db: SupabaseClient,
  snap: AdminDealSnapshot,
  steps: AdminQueueStep[],
): Promise<void> {
  for (const step of steps) {
    await notifyAdminLineStep(db, snap, step);
  }
}
