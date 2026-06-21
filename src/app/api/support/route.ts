import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, ID, Query } from 'node-appwrite';
import { readFile } from 'node:fs/promises';
import { DB_ID, COL_THREADS, COL_MESSAGES, ensureSupportCollections, getOrCreateThread } from '../_lib/support';

// #region debug-point E:reporter
async function reportDebug(hypothesisId: string, location: string, msg: string, data: Record<string, unknown> = {}, traceId = '') {
  let url = 'http://127.0.0.1:7777/event';
  let sessionId = 'admin-api-500';
  try {
    const env = await readFile('.dbg/admin-api-500.env', 'utf8');
    url = env.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || url;
    sessionId = env.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || sessionId;
  } catch {}
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, runId: 'pre-fix', hypothesisId, location, msg: `[DEBUG] ${msg}`, data, traceId, ts: Date.now() }),
  }).catch(() => {});
}
// #endregion

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

/** GET — ห้องแชทของฉัน (ลูกค้า) พร้อมข้อความล่าสุด */
export async function GET(req: NextRequest) {
  const traceId = `support-get-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let debugStage = 'entry';
  const debugInfo: Record<string, unknown> = {
    searchParams: req.nextUrl.searchParams.toString(),
    hasJwt: !!req.headers.get('x-session-jwt'),
  };
  try {
    // #region debug-point E:get-entry
    await reportDebug('E', 'src/app/api/support/route.ts:GET:entry', 'support GET entry', {
      searchParams: req.nextUrl.searchParams.toString(),
      hasJwt: !!req.headers.get('x-session-jwt'),
    }, traceId);
    // #endregion
    debugStage = 'getMe';
    const me = await getMe(req);
    debugInfo.userId = me.$id;
    // #region debug-point E:after-auth
    await reportDebug('E', 'src/app/api/support/route.ts:GET:after-auth', 'support GET authenticated', {
      userId: me.$id,
    }, traceId);
    // #endregion
    debugStage = 'getAdmin';
    const db = getAdmin();
    debugStage = 'ensureSupportCollections';
    await ensureSupportCollections(db);
    debugStage = 'getOrCreateThread';
    let thread = await getOrCreateThread(db, me.$id, ((me.prefs || {}) as Record<string, string>).displayName || me.name || 'ลูกค้า');

    debugStage = 'listMessages';
    const r = await db.listDocuments(DB_ID, COL_MESSAGES, [
      Query.equal('threadId', me.$id), Query.orderAsc('createdAt'), Query.limit(200),
    ]).catch(() => ({ documents: [] as unknown[] }));
    debugInfo.messageCount = r.documents.length;

    // ทำเครื่องหมายอ่านแล้วเฉพาะตอนลูกค้าเปิดดูแชทจริง ๆ (ไม่ใช่ทุกครั้งที่โพลพื้นหลัง)
    if (
      req.nextUrl.searchParams.get('open') === '1'
      && (thread.unreadCustomer || (thread.lastSender === 'staff' && (!thread.lastReadByCustomerAt || thread.lastReadByCustomerAt < thread.lastAt)))
    ) {
      debugStage = 'markRead';
      const now = new Date().toISOString();
      thread = await db.updateDocument(DB_ID, COL_THREADS, me.$id, {
        unreadCustomer: false,
        lastReadByCustomerAt: now,
      }).catch(() => thread) as typeof thread;
    }

    return NextResponse.json({ thread, messages: r.documents });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    // #region debug-point F:get-error
    await reportDebug('F', 'src/app/api/support/route.ts:GET:catch', 'support GET failed', {
      status,
      message: String((err as Error)?.message || err),
      stack: err instanceof Error ? err.stack : String(err),
      debugStage,
      debugInfo,
    }, traceId);
    // #endregion
    return NextResponse.json({
      error: String((err as Error)?.message || err),
      debugStage,
      debugInfo,
      debugName: err instanceof Error ? err.name : typeof err,
      debugStack: err instanceof Error ? err.stack : String(err),
    }, { status });
  }
}

/** POST — ลูกค้าส่งข้อความถึงทีมงาน */
export async function POST(req: NextRequest) {
  try {
    const me = await getMe(req);
    const body = await req.json().catch(() => ({}));
    const content = String(body.content || '').trim().slice(0, 2000);
    const imageUrl = String(body.imageUrl || '').trim().slice(0, 500);
    const mimeType = String(body.mimeType || '').trim().slice(0, 60);
    if (!content && !imageUrl) return NextResponse.json({ error: 'กรุณากรอกข้อความหรือแนบรูป' }, { status: 400 });

    const db = getAdmin();
    await ensureSupportCollections(db);
    const myName = ((me.prefs || {}) as Record<string, string>).displayName || me.name || 'ลูกค้า';
    await getOrCreateThread(db, me.$id, myName);

    const now = new Date().toISOString();
    const msg = await db.createDocument(DB_ID, COL_MESSAGES, ID.unique(), {
      threadId: me.$id, senderId: me.$id, senderName: myName, senderRole: 'customer',
      content, imageUrl, mimeType, createdAt: now,
    });
    await db.updateDocument(DB_ID, COL_THREADS, me.$id, {
      customerName: myName, status: 'open', lastMessage: content || 'ส่งรูปภาพ', lastAt: now,
      lastSender: 'customer', unreadStaff: true, updatedAt: now,
    }).catch(() => null);

    return NextResponse.json({ message: msg });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
