import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';
import { createCallToken, livekitConfigured, LIVEKIT_NOT_READY } from '@/lib/livekit';

/**
 * POST — ลูกค้าขอ LiveKit token เข้าห้องสายกับแอดมิน
 * ออกให้เฉพาะสายที่กำลังดำเนินอยู่ของตัวเอง (call_id ใน thread ต้องตรง)
 */
export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    if (!livekitConfigured()) return NextResponse.json({ error: LIVEKIT_NOT_READY }, { status: 503 });

    const body = await req.json().catch(() => ({}));
    const callId = String(body.callId || '');
    if (!callId) return NextResponse.json({ error: 'ไม่พบสาย' }, { status: 400 });

    const db = getAdminClient();
    const { data: thread } = await db.from('support_threads')
      .select('customer_id, customer_name, call_id, call_status').eq('customer_id', me.id).maybeSingle();
    if (!thread || thread.call_id !== callId) return NextResponse.json({ error: 'ไม่พบสายนี้' }, { status: 404 });
    if (!['connecting', 'active', 'staff_ringing', 'customer_requesting'].includes(thread.call_status)) {
      return NextResponse.json({ error: 'สายนี้จบไปแล้ว' }, { status: 409 });
    }

    const { token, url } = await createCallToken({
      room: `support-${callId}`,
      identity: me.id,
      name: thread.customer_name || 'ลูกค้า',
      ttl: '2h',
    });
    return NextResponse.json({ token, url });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
