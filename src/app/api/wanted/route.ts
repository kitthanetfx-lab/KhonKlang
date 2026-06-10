import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, DatabasesIndexType, ID, OrderBy, Permission, Role, Query } from 'node-appwrite';

const DB_ID = 'khonklang_db';
const COL_ID = 'wanted_posts';

const BUY_MODES = ['middleman', 'direct', 'both'] as const;
type BuyMode = typeof BUY_MODES[number];

function getDb() {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(c);
}

function getUserFromJwt(jwt: string) {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c).get();
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function ensureCollection(db: Databases) {
  try { await db.getCollection(DB_ID, COL_ID); return; } catch { /* create below */ }
  try {
    await db.createCollection(DB_ID, COL_ID, 'Wanted Posts', [
      Permission.read(Role.any()),
    ]);
    await Promise.all([
      db.createStringAttribute(DB_ID, COL_ID, 'userId',    255, true),
      db.createStringAttribute(DB_ID, COL_ID, 'userName',  200, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'title',     200, true),
      db.createStringAttribute(DB_ID, COL_ID, 'detail',   1000, false, ''),
      db.createIntegerAttribute(DB_ID, COL_ID, 'budgetMin', false, 0, 999999999, 0),
      db.createIntegerAttribute(DB_ID, COL_ID, 'budgetMax', false, 0, 999999999, 0),
      db.createStringAttribute(DB_ID, COL_ID, 'category',  100, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'province',  100, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'buyMode',    20, false, 'middleman'),
      db.createStringAttribute(DB_ID, COL_ID, 'contact',   200, false, ''),
      db.createStringAttribute(DB_ID, COL_ID, 'status',     20, false, 'open'),
      db.createStringAttribute(DB_ID, COL_ID, 'createdAt',  30, false, ''),
    ]);
    for (let i = 0; i < 20; i += 1) {
      try {
        const col = await db.listAttributes(DB_ID, COL_ID);
        if ((col.attributes as { status?: string }[]).every(a => a.status === 'available')) break;
      } catch { /* keep polling */ }
      await sleep(500);
    }
    await Promise.all([
      { key: 'idx_status',  attrs: ['status'],    orders: [OrderBy.Asc] },
      { key: 'idx_user',    attrs: ['userId'],    orders: [OrderBy.Asc] },
      { key: 'idx_created', attrs: ['createdAt'], orders: [OrderBy.Desc] },
    ].map(i => db.createIndex(DB_ID, COL_ID, i.key, DatabasesIndexType.Key, i.attrs, i.orders).catch(() => {})));
  } catch (err) {
    if (String(err).includes('missing scopes')) return;
    throw err;
  }
}

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const mine = req.nextUrl.searchParams.get('mine') === '1';

    if (mine) {
      const jwt = req.headers.get('x-session-jwt');
      if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const me = await getUserFromJwt(jwt);
      const r = await db.listDocuments(DB_ID, COL_ID, [
        Query.equal('userId', me.$id),
        Query.orderDesc('createdAt'),
        Query.limit(100),
      ]).catch(() => ({ documents: [] }));
      return NextResponse.json({ posts: r.documents });
    }

    const r = await db.listDocuments(DB_ID, COL_ID, [
      Query.equal('status', 'open'),
      Query.orderDesc('createdAt'),
      Query.limit(100),
    ]).catch(() => ({ documents: [] }));
    return NextResponse.json({ posts: r.documents });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = await getUserFromJwt(jwt);

    const body = await req.json();
    const title = String(body.title || '').trim().slice(0, 200);
    if (!title) return NextResponse.json({ error: 'กรุณากรอกชื่อสินค้าที่ต้องการหา' }, { status: 400 });
    const buyMode: BuyMode = BUY_MODES.includes(body.buyMode) ? body.buyMode : 'middleman';
    const budgetMin = Math.max(0, Math.round(Number(body.budgetMin) || 0));
    const budgetMax = Math.max(0, Math.round(Number(body.budgetMax) || 0));
    if (budgetMax && budgetMin > budgetMax) {
      return NextResponse.json({ error: 'งบต่ำสุดต้องไม่มากกว่างบสูงสุด' }, { status: 400 });
    }

    const db = getDb();
    await ensureCollection(db);

    // จำกัดประกาศเปิดค้างไม่เกิน 10 รายการต่อคน กันสแปม
    const open = await db.listDocuments(DB_ID, COL_ID, [
      Query.equal('userId', me.$id),
      Query.equal('status', 'open'),
      Query.limit(11),
    ]).catch(() => ({ total: 0 }));
    if ((open.total || 0) >= 10) {
      return NextResponse.json({ error: 'คุณมีประกาศเปิดอยู่ครบ 10 รายการแล้ว กรุณาปิดประกาศเก่าก่อน' }, { status: 400 });
    }

    const doc = await db.createDocument(DB_ID, COL_ID, ID.unique(), {
      userId: me.$id,
      userName: me.name || 'สมาชิก',
      title,
      detail: String(body.detail || '').slice(0, 1000),
      budgetMin, budgetMax,
      category: String(body.category || '').slice(0, 100),
      province: String(body.province || '').slice(0, 100),
      buyMode,
      contact: String(body.contact || '').slice(0, 200),
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ post: doc });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = await getUserFromJwt(jwt);

    const body = await req.json();
    const { id, action } = body;
    if (!id || !['close', 'reopen'].includes(action)) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const db = getDb();
    const doc = await db.getDocument(DB_ID, COL_ID, id);
    if (doc.userId !== me.$id) return NextResponse.json({ error: 'แก้ไขได้เฉพาะประกาศของตัวเอง' }, { status: 403 });

    const updated = await db.updateDocument(DB_ID, COL_ID, id, {
      status: action === 'close' ? 'closed' : 'open',
    });
    return NextResponse.json({ post: updated });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
