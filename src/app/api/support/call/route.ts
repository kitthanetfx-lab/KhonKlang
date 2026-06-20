import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, ID } from 'node-appwrite';
import { DB_ID, COL_THREADS, COL_MESSAGES, ensureSupportCollections, getOrCreateThread, newCallId } from '../../_lib/support';

function getAdmin() {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(c);
}

async function getMe(req: NextRequest) {
  const jwt = req.headers.get('x-session-jwt');
  if (!jwt) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c).get();
}

async function logSystem(db: Databases, threadId: string, content: string) {
  await db.createDocument(DB_ID, COL_MESSAGES, ID.unique(), {
    threadId, senderId: 'system', senderName: 'ระบบ', senderRole: 'system',
    content, createdAt: new Date().toISOString(),
  }).catch(() => null);
}

/**
 * ฝั่งลูกค้า — ขอให้พนักงานโทรกลับ / ยกเลิกคำขอ / รับ-ปฏิเสธสายที่พนักงานโทรมา / วางสาย
 * action: 'request' | 'cancel' | 'answer' | 'active' | 'decline' | 'hangup'
 */
export async function POST(req: NextRequest) {
  try {
    const me = await getMe(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    const db = getAdmin();
    await ensureSupportCollections(db);
    const myName = ((me.prefs || {}) as Record<string, string>).displayName || me.name || 'ลูกค้า';
    const thread = await getOrCreateThread(db, me.$id, myName);
    const now = new Date().toISOString();

    if (action === 'request') {
      if (thread.callStatus !== 'idle' && thread.callStatus !== 'ended') {
        return NextResponse.json({ error: 'มีการขอโทรอยู่แล้ว' }, { status: 409 });
      }
      const callId = newCallId();
      await db.updateDocument(DB_ID, COL_THREADS, me.$id, {
        callStatus: 'customer_requesting', callId, callInitiator: 'customer',
        callStaffId: '', callStaffName: '', callUpdatedAt: now, updatedAt: now,
      });
      await logSystem(db, me.$id, 'ลูกค้าขอให้พนักงานโทรกลับ');
      return NextResponse.json({ ok: true, callId, callStatus: 'customer_requesting' });
    }

    if (action === 'cancel') {
      if (thread.callStatus !== 'customer_requesting') return NextResponse.json({ ok: true });
      await db.updateDocument(DB_ID, COL_THREADS, me.$id, { callStatus: 'ended', callUpdatedAt: now, updatedAt: now });
      await logSystem(db, me.$id, 'ลูกค้ายกเลิกคำขอโทร');
      return NextResponse.json({ ok: true });
    }

    if (action === 'answer') {
      if (thread.callStatus !== 'staff_ringing') return NextResponse.json({ error: 'ไม่มีสายเข้า' }, { status: 409 });
      await db.updateDocument(DB_ID, COL_THREADS, me.$id, { callStatus: 'connecting', callUpdatedAt: now, updatedAt: now });
      await logSystem(db, me.$id, 'ลูกค้ารับสายแล้ว — กำลังเชื่อมต่อเสียง');
      return NextResponse.json({ ok: true, callId: thread.callId, callStatus: 'connecting' });
    }

    if (action === 'active') {
      if (!['connecting', 'staff_ringing', 'active'].includes(thread.callStatus)) return NextResponse.json({ ok: true });
      await db.updateDocument(DB_ID, COL_THREADS, me.$id, { callStatus: 'active', callUpdatedAt: now, updatedAt: now });
      return NextResponse.json({ ok: true, callId: thread.callId, callStatus: 'active' });
    }

    if (action === 'decline') {
      if (thread.callStatus !== 'staff_ringing') return NextResponse.json({ ok: true });
      await db.updateDocument(DB_ID, COL_THREADS, me.$id, { callStatus: 'ended', callUpdatedAt: now, updatedAt: now });
      await logSystem(db, me.$id, 'ลูกค้าปฏิเสธสาย');
      return NextResponse.json({ ok: true });
    }

    if (action === 'hangup') {
      if (thread.callStatus === 'idle' || thread.callStatus === 'ended') return NextResponse.json({ ok: true });
      await db.updateDocument(DB_ID, COL_THREADS, me.$id, { callStatus: 'ended', callUpdatedAt: now, updatedAt: now });
      await logSystem(db, me.$id, 'ลูกค้าวางสาย');
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'ไม่รู้จักคำสั่ง' }, { status: 400 });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
