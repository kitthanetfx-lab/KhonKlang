// Shared notification helper — ใช้สร้างแจ้งเตือนจาก API ฝั่ง server
// ทำ 2 อย่าง: (1) บันทึก in-app notification ลง DB, (2) ยิง push ไปแอปมือถือ (FCM/APNs)
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendPush } from '@/lib/push';

export interface NotifyOptions {
  title: string;
  body: string;
  link: string;
  /** 'call' = สายเรียกเข้า high-priority (FCM android.priority:high + APNs voip); 'normal' (default) = แจ้งเตือนทั่วไป */
  kind?: 'normal' | 'call';
  /** custom data payload ส่งไปฝั่ง native (เช่น { type:'incoming_call', dealId, mode } สำหรับสร้าง full-screen call UI) */
  data?: Record<string, string>;
}

/** สร้างแจ้งเตือนให้ผู้ใช้หลายคน (best-effort — ห้ามทำให้ action หลักล้ม) */
export async function notifyUsers(
  db: SupabaseClient,
  userIds: string[],
  n: NotifyOptions,
) {
  try {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (!unique.length) return;
    // 1. บันทึก in-app notification (ผู้ใช้เห็นในแถบแจ้งเตือนของเว็บ)
    const rows = unique.map(userId => ({
      user_id: userId,
      title: n.title.slice(0, 200),
      body: n.body.slice(0, 500),
      link: n.link.slice(0, 300),
      read: false,
    }));
    await db.from('notifications').insert(rows);
    // 2. ยิง push ไปแอปมือถือ — ถ้ายังไม่ configured Firebase env → เงียบข้าม (sendPush เช็คเอง)
    await sendPush(db, unique, {
      title: n.title,
      body: n.body,
      link: n.link,
      kind: n.kind || 'normal',
      data: n.data,
    });
  } catch { /* best effort */ }
}
