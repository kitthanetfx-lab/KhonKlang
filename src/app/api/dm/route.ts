import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, DatabasesIndexType, ID, OrderBy, Permission, Role, Query, Users } from 'node-appwrite';

const DB_ID = 'khonklang_db';
const COL_ID = 'dm_messages';

function getAdmin() {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return { db: new Databases(c), users: new Users(c) };
}

function getUserFromJwt(jwt: string) {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c).get();
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
const threadIdOf = (a: string, b: string) => [a, b].sort().join('_');

async function ensureCollection(db: Databases) {
  try { await db.getCollection(DB_ID, COL_ID); return; } catch { /* create below */ }
  try {
    await db.createCollection(DB_ID, COL_ID, 'Direct Messages', [Permission.read(Role.users())]);
    await Promise.all([
      db.createStringAttribute(DB_ID, COL_ID, 'threadId', 120, true),
      db.createStringAttribute(DB_ID, COL_ID, 'fromId',   255, true),
      db.createStringAttribute(DB_ID, COL_ID, 'fromName', 200, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'toId',     255, true),
      db.createStringAttribute(DB_ID, COL_ID, 'toName',   200, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'content', 2000, true),
      db.createBooleanAttribute(DB_ID, COL_ID, 'read',    false, false),
      db.createStringAttribute(DB_ID, COL_ID, 'createdAt', 30, false, ''),
    ]);
    for (let i = 0; i < 20; i += 1) {
      try {
        const col = await db.listAttributes(DB_ID, COL_ID);
        if ((col.attributes as { status?: string }[]).every(a => a.status === 'available')) break;
      } catch { /* poll */ }
      await sleep(500);
    }
    await Promise.all([
      { key: 'idx_thread',  attrs: ['threadId'],  orders: [OrderBy.Asc] },
      { key: 'idx_to',      attrs: ['toId'],      orders: [OrderBy.Asc] },
      { key: 'idx_from',    attrs: ['fromId'],    orders: [OrderBy.Asc] },
      { key: 'idx_created', attrs: ['createdAt'], orders: [OrderBy.Desc] },
    ].map(i => db.createIndex(DB_ID, COL_ID, i.key, DatabasesIndexType.Key, i.attrs, i.orders).catch(() => {})));
  } catch (err) {
    if (String(err).includes('missing scopes')) return;
    throw err;
  }
}

interface DmDoc { $id: string; threadId: string; fromId: string; fromName: string; toId: string; toName: string; content: string; read: boolean; createdAt: string }

export async function GET(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = await getUserFromJwt(jwt);
    const { db } = getAdmin();
    const sp = req.nextUrl.searchParams;

    // ── จำนวนยังไม่อ่าน (สำหรับ badge ไอคอนซองจดหมาย) ──
    if (sp.get('box') === 'unread') {
      const r = await db.listDocuments(DB_ID, COL_ID, [
        Query.equal('toId', me.$id), Query.equal('read', false), Query.limit(1),
      ]).catch(() => ({ total: 0 }));
      return NextResponse.json({ unread: r.total || 0 });
    }

    // ── บทสนทนากับคนใดคนหนึ่ง (เปิดอ่าน = mark read) ──
    const withId = sp.get('with') || '';
    if (withId) {
      const threadId = threadIdOf(me.$id, withId);
      const r = await db.listDocuments(DB_ID, COL_ID, [
        Query.equal('threadId', threadId),
        Query.orderDesc('createdAt'),
        Query.limit(100),
      ]).catch(() => ({ documents: [] as unknown[] }));
      const msgs = (r.documents as DmDoc[]).reverse();
      // ข้อความที่ส่งถึงฉันและยังไม่อ่าน → ทำเป็นอ่านแล้ว
      await Promise.all(msgs.filter(m => m.toId === me.$id && !m.read).map(m =>
        db.updateDocument(DB_ID, COL_ID, m.$id, { read: true }).catch(() => null)));
      return NextResponse.json({ messages: msgs });
    }

    // ── รายชื่อบทสนทนาทั้งหมด ──
    const [sent, received] = await Promise.all([
      db.listDocuments(DB_ID, COL_ID, [Query.equal('fromId', me.$id), Query.orderDesc('createdAt'), Query.limit(300)]).catch(() => ({ documents: [] as unknown[] })),
      db.listDocuments(DB_ID, COL_ID, [Query.equal('toId', me.$id), Query.orderDesc('createdAt'), Query.limit(300)]).catch(() => ({ documents: [] as unknown[] })),
    ]);
    const byThread = new Map<string, { last: DmDoc; unread: number }>();
    for (const doc of [...sent.documents, ...received.documents] as DmDoc[]) {
      const cur = byThread.get(doc.threadId);
      if (!cur || doc.createdAt > cur.last.createdAt) {
        byThread.set(doc.threadId, { last: doc, unread: cur?.unread || 0 });
      }
    }
    for (const doc of received.documents as DmDoc[]) {
      if (!doc.read) {
        const cur = byThread.get(doc.threadId);
        if (cur) cur.unread += 1;
      }
    }
    const threads = [...byThread.values()]
      .map(({ last, unread }) => {
        const otherIsFrom = last.fromId !== me.$id ? true : false;
        const otherId = otherIsFrom ? last.fromId : last.toId;
        const otherName = otherIsFrom ? last.fromName : last.toName;
        return {
          threadId: last.threadId, otherId, otherName: otherName || 'สมาชิก',
          lastContent: last.content, lastAt: last.createdAt,
          fromMe: last.fromId === me.$id, unread,
        };
      })
      .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
    return NextResponse.json({ threads });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนส่งข้อความ' }, { status: 401 });
    const me = await getUserFromJwt(jwt);
    const body = await req.json();

    const toId = String(body.toId || '').trim();
    const content = String(body.content || '').trim().slice(0, 2000);
    if (!toId || !content) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    if (toId === me.$id) return NextResponse.json({ error: 'ส่งข้อความหาตัวเองไม่ได้' }, { status: 400 });

    const { db, users } = getAdmin();
    await ensureCollection(db);

    let toName = String(body.toName || '').slice(0, 200);
    try {
      const u = await users.get(toId);
      toName = ((u.prefs || {}) as Record<string, string>).displayName || u.name || toName || 'สมาชิก';
    } catch {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้ปลายทาง' }, { status: 404 });
    }

    const doc = await db.createDocument(DB_ID, COL_ID, ID.unique(), {
      threadId: threadIdOf(me.$id, toId),
      fromId: me.$id,
      fromName: me.name || 'สมาชิก',
      toId, toName,
      content,
      read: false,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ message: doc });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
