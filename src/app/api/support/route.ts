import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, ID, Query } from 'node-appwrite';
import { DB_ID, COL_THREADS, COL_MESSAGES, ensureSupportCollections, getOrCreateThread } from '../_lib/support';

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
  try {
    const me = await getMe(req);
    const db = getAdmin();
    await ensureSupportCollections(db);
    let thread = await getOrCreateThread(db, me.$id, ((me.prefs || {}) as Record<string, string>).displayName || me.name || 'ลูกค้า');

    const r = await db.listDocuments(DB_ID, COL_MESSAGES, [
      Query.equal('threadId', me.$id), Query.orderAsc('createdAt'), Query.limit(200),
    ]).catch(() => ({ documents: [] as unknown[] }));

    // ทำเครื่องหมายอ่านแล้วเฉพาะตอนลูกค้าเปิดดูแชทจริง ๆ (ไม่ใช่ทุกครั้งที่โพลพื้นหลัง)
    if (
      req.nextUrl.searchParams.get('open') === '1'
      && (thread.unreadCustomer || (thread.lastSender === 'staff' && (!thread.lastReadByCustomerAt || thread.lastReadByCustomerAt < thread.lastAt)))
    ) {
      const now = new Date().toISOString();
      thread = await db.updateDocument(DB_ID, COL_THREADS, me.$id, {
        unreadCustomer: false,
        lastReadByCustomerAt: now,
      }).catch(() => thread) as typeof thread;
    }

    return NextResponse.json({ thread, messages: r.documents });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
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
