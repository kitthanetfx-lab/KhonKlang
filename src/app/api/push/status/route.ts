// GET /api/push/status — ตรวจว่า push พร้อมใช้งานไหม (debug ตอนแอปไม่ดัง)
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';
import { pushConfigured } from '@/lib/push';

export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const { data: tokens } = await db.from('device_tokens')
      .select('platform, updated_at')
      .eq('user_id', me.id)
      .order('updated_at', { ascending: false });

    return NextResponse.json({
      pushConfigured: pushConfigured(),
      tokenCount: tokens?.length || 0,
      tokens: tokens || [],
      hint: !pushConfigured()
        ? 'Firebase env ยังไม่ครบบน Vercel — push จะไม่ยิง'
        : !(tokens?.length)
          ? 'ยังไม่มี device token — เปิดแอป login แล้วอนุญาตแจ้งเตือน'
          : 'พร้อมรับ push',
    });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
