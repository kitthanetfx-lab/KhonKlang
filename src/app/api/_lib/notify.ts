// Shared notification helper — ใช้สร้างแจ้งเตือนจาก API ฝั่ง server
import type { SupabaseClient } from '@supabase/supabase-js';

/** สร้างแจ้งเตือนให้ผู้ใช้หลายคน (best-effort — ห้ามทำให้ action หลักล้ม) */
export async function notifyUsers(
  db: SupabaseClient,
  userIds: string[],
  n: { title: string; body: string; link: string },
) {
  try {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (!unique.length) return;
    const rows = unique.map(userId => ({
      user_id: userId,
      title: n.title.slice(0, 200),
      body: n.body.slice(0, 500),
      link: n.link.slice(0, 300),
      read: false,
    }));
    await db.from('notifications').insert(rows);
  } catch { /* best effort */ }
}
