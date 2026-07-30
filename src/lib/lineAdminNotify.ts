import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminDealRow, AdminQueueStep } from '@/app/api/_lib/adminDealQueue';

const STEP_LABELS: Record<AdminQueueStep, string> = {
  confirm_pay: '⚡ ยืนยันรับเงิน',
  pay_seller: '💰 โอนเงินค่าสินค้า',
  refund_pending: '🔄 คืนเงินผู้ซื้อ',
  middleman_fee: '💼 โอนเงินค่าคนกลาง',
  meetup_refund: '💸 คืนเงินประกัน',
};

async function sendLineAdminMessage(text: string): Promise<void> {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_ADMIN_GROUP_ID;
  if (!token || !to) return;
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to,
        messages: [{ type: 'text', text: text.slice(0, 5000) }],
      }),
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
  deal: AdminDealRow,
  step: AdminQueueStep,
): Promise<void> {
  const { error } = await db.from('admin_line_notifications').insert({ deal_id: deal.id, step });
  if (error) {
    if (error.code === '23505') return;
    console.error('[lineAdminNotify] dedupe insert failed:', error.message);
    return;
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.glanghub.com').replace(/\/$/, '');
  const label = STEP_LABELS[step];
  const num = deal.deal_number || deal.id.slice(0, 8).toUpperCase();
  const title = deal.title || 'ดีล';
  const price = Number(deal.price || 0).toLocaleString('th-TH');
  const text = [
    `[กลางฮับ] ${label}`,
    `${num} · ${title}`,
    `มูลค่า ฿${price}`,
    `${appUrl}/admin/deals?tab=${step}`,
  ].join('\n');

  await sendLineAdminMessage(text);
}

export async function notifyAdminLineSteps(
  db: SupabaseClient,
  deal: AdminDealRow,
  steps: AdminQueueStep[],
): Promise<void> {
  for (const step of steps) {
    await notifyAdminLineStep(db, deal, step);
  }
}
