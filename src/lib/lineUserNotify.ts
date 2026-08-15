import type { SupabaseClient } from '@supabase/supabase-js';

async function pushLineText(lineUserId: string, text: string): Promise<void> {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!token || !lineUserId) return;
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: text.slice(0, 5000) }],
      }),
    });
    if (!res.ok) {
      console.error('[lineUserNotify] push failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[lineUserNotify] push error:', err);
  }
}

async function lineUserIdOf(db: SupabaseClient, userId: string): Promise<string> {
  const { data: profile } = await db
    .from('profiles')
    .select('line_user_id')
    .eq('id', userId)
    .maybeSingle();
  return String(profile?.line_user_id || '').trim();
}

function fullAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://www.glanghub.com').replace(/\/$/, '');
}

/** Push แจ้งเตือนขั้นตอนดีลให้ผู้ใช้หลายคนที่ผูก LINE แล้ว — best effort */
export async function notifyUsersLine(
  db: SupabaseClient,
  userIds: string[],
  params: { title: string; body: string; link: string },
): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  const { data: profiles } = await db
    .from('profiles')
    .select('id, line_user_id')
    .in('id', unique);
  const appUrl = fullAppUrl();
  const link = params.link.startsWith('http') ? params.link : `${appUrl}${params.link}`;
  const text = [
    `📦 ${params.title}`,
    params.body,
    link,
  ].join('\n');
  await Promise.all(
    (profiles || [])
      .map(p => String(p.line_user_id || '').trim())
      .filter(Boolean)
      .map(lineUserId => pushLineText(lineUserId, text)),
  );
}

/** Push ถึงลูกค้าที่ถูก overbid ผ่าน LINE OA — ทำงานแม้ปิดเว็บ */
export async function notifyUserLineOverbid(
  db: SupabaseClient,
  userId: string,
  params: { title: string; amount: number; dealId: string },
): Promise<void> {
  const lineUserId = await lineUserIdOf(db, userId);
  if (!lineUserId) return;
  const appUrl = fullAppUrl();
  const text = [
    '🔨 มีคน overbid คุณแล้ว',
    `"${params.title}"`,
    `ราคาปัจจุบัน ฿${params.amount.toLocaleString('th-TH')}`,
    `${appUrl}/marketplace/${params.dealId}`,
  ].join('\n');
  await pushLineText(lineUserId, text);
}

/** แจ้งผู้ขายเมื่อมี bid ใหม่บนสินค้าประมูล */
export async function notifySellerLineNewBid(
  db: SupabaseClient,
  sellerId: string,
  params: { title: string; amount: number; dealId: string; bidderName: string },
): Promise<void> {
  const lineUserId = await lineUserIdOf(db, sellerId);
  if (!lineUserId) return;
  const appUrl = fullAppUrl();
  const text = [
    '🔨 มี bid ใหม่ในประมูลของคุณ',
    `"${params.title}"`,
    `฿${params.amount.toLocaleString('th-TH')} โดย ${params.bidderName}`,
    `${appUrl}/marketplace/${params.dealId}`,
  ].join('\n');
  await pushLineText(lineUserId, text);
}

export { lineOaAddFriendUrl } from './lineFriendship';
