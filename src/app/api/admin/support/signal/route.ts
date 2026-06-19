import { NextRequest, NextResponse } from 'next/server';
import { Databases, ID } from 'node-appwrite';
import { verifyAdmin, getAdminClient } from '../../_lib';
import { DB_ID, COL_SIGNALS, ensureSupportCollections, listSignalsSince } from '../../../_lib/support';

/** GET — พนักงานโพลสัญญาณ WebRTC ใหม่ ๆ ของสายที่กำลังคุยอยู่ */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const sp = req.nextUrl.searchParams;
    const callId = sp.get('callId') || '';
    const since = sp.get('since') || '';
    if (!callId) return NextResponse.json({ signals: [] });
    const db = new Databases(getAdminClient());
    await ensureSupportCollections(db);
    const signals = await listSignalsSince(db, callId, since);
    return NextResponse.json({ signals: signals.filter(s => s.fromRole !== 'staff') });
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
    const data = String(body.data || '').slice(0, 8000);
    if (!customerId || !callId || !type) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const db = new Databases(getAdminClient());
    await ensureSupportCollections(db);
    await db.createDocument(DB_ID, COL_SIGNALS, ID.unique(), {
      threadId: customerId, callId, fromRole: 'staff', type, data, createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, staffId });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
