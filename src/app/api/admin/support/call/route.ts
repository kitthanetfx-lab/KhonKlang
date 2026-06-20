import { NextRequest, NextResponse } from 'next/server';
import { Account, Client, Databases, ID } from 'node-appwrite';
import { verifyAdmin, getAdminClient, DB_ID } from '../../_lib';
import { COL_THREADS, COL_MESSAGES, ensureSupportCollections, newCallId } from '../../../_lib/support';

async function getAdminName(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt')!;
    const c = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setJWT(jwt);
    const u = await new Account(c).get();
    return ((u.prefs || {}) as Record<string, string>).displayName || u.name || 'พนักงาน';
  } catch { return 'พนักงาน'; }
}

async function logSystem(db: Databases, threadId: string, content: string) {
  await db.createDocument(DB_ID, COL_MESSAGES, ID.unique(), {
    threadId, senderId: 'system', senderName: 'ระบบ', senderRole: 'system',
    content, createdAt: new Date().toISOString(),
  }).catch(() => null);
}

/**
 * ฝั่งพนักงาน — โทรออกตรง / อนุมัติ-ปฏิเสธคำขอของลูกค้า / วางสาย
 * action: 'call' | 'approve' | 'decline' | 'hangup'
 * เงื่อนไข: พนักงานคนใดก็ได้กดรับคำขอได้ (เผื่อพนักงานคนอื่นไม่อยู่/ติดสาย)
 */
export async function POST(req: NextRequest) {
  try {
    const staffId = await verifyAdmin(req);
    const body = await req.json().catch(() => ({}));
    const customerId = String(body.customerId || '').trim();
    const action = String(body.action || '');
    if (!customerId) return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 400 });

    const db = new Databases(getAdminClient());
    await ensureSupportCollections(db);
    const thread = await db.getDocument(DB_ID, COL_THREADS, customerId).catch(() => null);
    if (!thread) return NextResponse.json({ error: 'ไม่พบห้องแชท' }, { status: 404 });
    const staffName = await getAdminName(req);
    const now = new Date().toISOString();

    if (action === 'call') {
      if (thread.callStatus !== 'idle' && thread.callStatus !== 'ended') {
        return NextResponse.json({ error: 'มีสาย/คำขออยู่แล้ว' }, { status: 409 });
      }
      const callId = newCallId();
      await db.updateDocument(DB_ID, COL_THREADS, customerId, {
        callStatus: 'staff_ringing', callId, callInitiator: 'staff',
        callStaffId: staffId, callStaffName: staffName, callUpdatedAt: now, updatedAt: now,
      });
      await logSystem(db, customerId, `พนักงาน ${staffName} กำลังโทรหาลูกค้า`);
      return NextResponse.json({ ok: true, callId });
    }

    if (action === 'approve') {
      if (thread.callStatus !== 'customer_requesting') return NextResponse.json({ error: 'ไม่มีคำขอโทรรอดำเนินการ' }, { status: 409 });
      await db.updateDocument(DB_ID, COL_THREADS, customerId, {
        callStatus: 'staff_ringing', callStaffId: staffId, callStaffName: staffName, callUpdatedAt: now, updatedAt: now,
      });
      await logSystem(db, customerId, `พนักงาน ${staffName} รับคำขอโทรกลับและกำลังเปิดห้องสนทนาเสียง`);
      return NextResponse.json({ ok: true, callId: thread.callId, callStatus: 'staff_ringing' });
    }

    if (action === 'decline') {
      if (thread.callStatus !== 'customer_requesting') return NextResponse.json({ ok: true });
      await db.updateDocument(DB_ID, COL_THREADS, customerId, { callStatus: 'ended', callUpdatedAt: now, updatedAt: now });
      await logSystem(db, customerId, `พนักงาน ${staffName} ไม่สามารถรับสายได้ในขณะนี้`);
      return NextResponse.json({ ok: true });
    }

    if (action === 'hangup') {
      if (thread.callStatus === 'idle' || thread.callStatus === 'ended') return NextResponse.json({ ok: true });
      await db.updateDocument(DB_ID, COL_THREADS, customerId, { callStatus: 'ended', callUpdatedAt: now, updatedAt: now });
      await logSystem(db, customerId, `พนักงาน ${staffName} วางสาย`);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'ไม่รู้จักคำสั่ง' }, { status: 400 });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
