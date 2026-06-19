import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, ID } from 'node-appwrite';
import { DB_ID, COL_SIGNALS, ensureSupportCollections, listSignalsSince } from '../../_lib/support';

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

/** GET — ลูกค้าโพลสัญญาณ WebRTC ใหม่ ๆ ของสายตัวเอง */
export async function GET(req: NextRequest) {
  try {
    const me = await getMe(req);
    const sp = req.nextUrl.searchParams;
    const callId = sp.get('callId') || '';
    const since = sp.get('since') || '';
    if (!callId) return NextResponse.json({ signals: [] });
    const db = getAdmin();
    await ensureSupportCollections(db);
    const signals = await listSignalsSince(db, callId, since);
    // ลูกค้าเห็นเฉพาะสัญญาณที่ไม่ได้มาจากตัวเอง
    return NextResponse.json({ signals: signals.filter(s => s.fromRole !== 'customer'), me: me.$id });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}

/** POST — ลูกค้าส่งสัญญาณ WebRTC (answer/candidate/hangup) */
export async function POST(req: NextRequest) {
  try {
    const me = await getMe(req);
    const body = await req.json().catch(() => ({}));
    const callId = String(body.callId || '');
    const type = String(body.type || '');
    const data = String(body.data || '').slice(0, 8000);
    if (!callId || !type) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const db = getAdmin();
    await ensureSupportCollections(db);
    await db.createDocument(DB_ID, COL_SIGNALS, ID.unique(), {
      threadId: me.$id, callId, fromRole: 'customer', type, data, createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
