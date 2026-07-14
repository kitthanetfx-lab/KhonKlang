import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyAdmin } from '@/lib/supabaseServer';
import { createCallToken, livekitConfigured, LIVEKIT_NOT_READY } from '@/lib/livekit';

/**
 * POST — พนักงานขอ LiveKit token เข้าห้องสายกับลูกค้า
 * ต้องระบุ customerId และ callId ต้องตรงกับสายปัจจุบันของ thread นั้น
 */
export async function POST(req: NextRequest) {
  try {
    const staffId = await verifyAdmin(req);
    if (!livekitConfigured()) return NextResponse.json({ error: LIVEKIT_NOT_READY }, { status: 503 });

    const body = await req.json().catch(() => ({}));
    const callId = String(body.callId || '');
    const customerId = String(body.customerId || '');
    if (!callId || !customerId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const db = getAdminClient();
    const { data: thread } = await db.from('support_threads')
      .select('customer_id, call_id, call_status').eq('customer_id', customerId).maybeSingle();
    if (!thread || thread.call_id !== callId) return NextResponse.json({ error: 'ไม่พบสายนี้' }, { status: 404 });
    if (!['connecting', 'active', 'staff_ringing', 'customer_requesting'].includes(thread.call_status)) {
      return NextResponse.json({ error: 'สายนี้จบไปแล้ว' }, { status: 409 });
    }

    const { data: p } = await db.from('profiles').select('display_name').eq('id', staffId).maybeSingle();
    const { token, url } = await createCallToken({
      room: `support-${callId}`,
      identity: staffId,
      name: p?.display_name || 'พนักงาน',
      ttl: '2h',
    });
    return NextResponse.json({ token, url });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
