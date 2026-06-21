import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';
import { listSignalsSince } from '../../_lib/support';

/** GET — ลูกค้าโพลสัญญาณ WebRTC ใหม่ ๆ ของสายตัวเอง */
export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const sp = req.nextUrl.searchParams;
    const callId = sp.get('callId') || '';
    const since = sp.get('since') || '';
    if (!callId) return NextResponse.json({ signals: [] });
    const db = getAdminClient();
    const signals = await listSignalsSince(db, callId, since);
    // ลูกค้าเห็นเฉพาะสัญญาณที่ไม่ได้มาจากตัวเอง
    return NextResponse.json({ signals: signals.filter((s) => s.from_role !== 'customer'), me: me.id });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}

/** POST — ลูกค้าส่งสัญญาณ WebRTC (answer/candidate/hangup) */
export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const body = await req.json().catch(() => ({}));
    const callId = String(body.callId || '');
    const type = String(body.type || '');
    const data = body.data ?? {};
    if (!callId || !type) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const db = getAdminClient();
    const { error } = await db.from('call_signals').insert({
      thread_id: me.id, call_id: callId, from_role: 'customer', type, data, created_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
