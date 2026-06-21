import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '../../_lib';
import { listSignalsSince } from '../../../_lib/support';

/** GET — พนักงานโพลสัญญาณ WebRTC ใหม่ ๆ ของสายที่กำลังคุยอยู่ */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const sp = req.nextUrl.searchParams;
    const callId = sp.get('callId') || '';
    const since = sp.get('since') || '';
    if (!callId) return NextResponse.json({ signals: [] });
    const db = getAdminClient();
    const signals = await listSignalsSince(db, callId, since);
    return NextResponse.json({ signals: signals.filter((s) => s.from_role !== 'staff') });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}

/** POST — พนักงานส่งสัญญาณ WebRTC (offer/answer/candidate/hangup) {customerId, callId, type, data} */
export async function POST(req: NextRequest) {
  try {
    const staffId = await verifyAdmin(req);
    const body = await req.json().catch(() => ({}));
    const customerId = String(body.customerId || '');
    const callId = String(body.callId || '');
    const type = String(body.type || '');
    const data = body.data ?? {};
    if (!customerId || !callId || !type) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const db = getAdminClient();
    const { error } = await db.from('call_signals').insert({
      thread_id: customerId, call_id: callId, from_role: 'staff', type, data, created_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, staffId });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
