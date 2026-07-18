// POST /api/push/register { token, platform }   ← แอปยิงตอนได้รับ FCM/APNs token ใหม่
// DELETE /api/push/register { token }            ← แอปยิงตอน logout หรือแอปถูกถอน
//
// ฝั่งแอป (Capacitor): ใช้ @capacitor/push-notifications ขอ token จากระบบ → ยิงมาที่นี่
// ทุกครั้งที่แอปเปิดควร register ใหม่ (token อาจหมุนเวียน) — upsert จัดการซ้ำให้
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';

const PLATFORMS = ['android', 'ios', 'web'] as const;
type Platform = typeof PLATFORMS[number];

export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const body = await req.json();
    const token = String(body.token || '').trim();
    const platform = String(body.platform || '').trim() as Platform;
    if (!token) return NextResponse.json({ error: 'ต้องระบุ token' }, { status: 400 });
    if (!PLATFORMS.includes(platform)) return NextResponse.json({ error: 'platform ต้องเป็น android/ios/web' }, { status: 400 });

    const db = getAdminClient();
    // upsert ที่ (user_id, token) — ถ้า token นี้ของ user คนเดิมมีอยู่แล้ว → update updated_at; ไม่งั้น insert ใหม่
    const { error } = await db.from('device_tokens').upsert(
      { user_id: me.id, token, platform, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' },
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const body = await req.json();
    const token = String(body.token || '').trim();
    if (!token) return NextResponse.json({ error: 'ต้องระบุ token' }, { status: 400 });

    const db = getAdminClient();
    // ลบเฉพาะ token ของ user คนนี้เท่านั้น (กัน user คนอื่นมาลบ token คนอื่น)
    await db.from('device_tokens').delete().eq('user_id', me.id).eq('token', token);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
