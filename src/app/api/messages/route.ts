import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, ID, Permission, Role, Query } from 'node-appwrite';

const DB_ID = 'khonklang_db';
const COL   = 'messages';

function getAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(client);
}

async function ensureCollection(db: Databases) {
  try { await db.getCollection(DB_ID, COL); return; } catch { /* create */ }
  try { await db.get(DB_ID); } catch { await db.create(DB_ID, 'Khonklang Database'); }
  await db.createCollection(DB_ID, COL, 'Messages', [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
  ]);
  await Promise.all([
    db.createStringAttribute(DB_ID, COL, 'dealId',     50, true),
    db.createStringAttribute(DB_ID, COL, 'senderId',  255, true),
    db.createStringAttribute(DB_ID, COL, 'senderName',200, false, ''),
    db.createStringAttribute(DB_ID, COL, 'role',       20, false, 'user'),
    db.createStringAttribute(DB_ID, COL, 'type',       20, false, 'text'),
    db.createStringAttribute(DB_ID, COL, 'content',  2000, false, ''),
    db.createStringAttribute(DB_ID, COL, 'fileId',    255, false, ''),
    db.createStringAttribute(DB_ID, COL, 'fileName',  255, false, ''),
    db.createStringAttribute(DB_ID, COL, 'createdAt',  30, false, ''),
  ]);
  await new Promise(r => setTimeout(r, 3000));
}

function getUser(jwt: string) {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c).get();
}

/** อ่าน/โพสต์แชทได้เฉพาะผู้ร่วมดีล — กันคนสุ่ม dealId มาอ่าน/ยิงข้อความดีลคนอื่น */
async function assertDealParty(db: Databases, dealId: string, userId: string): Promise<NextResponse | null> {
  try {
    const deal = await db.getDocument(DB_ID, 'deals', dealId);
    if (![deal.buyerId, deal.sellerId, deal.middlemanId].includes(userId))
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงแชทของดีลนี้' }, { status: 403 });
    return null;
  } catch {
    return NextResponse.json({ error: 'ไม่พบดีล' }, { status: 404 });
  }
}

// GET /api/messages?dealId=xxx&after=isoDate
export async function GET(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = await getUser(jwt);
    const dealId = req.nextUrl.searchParams.get('dealId');
    const after  = req.nextUrl.searchParams.get('after');
    if (!dealId) return NextResponse.json({ error: 'Missing dealId' }, { status: 400 });

    const db = getAdminClient();
    const denied = await assertDealParty(db, dealId, me.$id);
    if (denied) return denied;

    const queries = [Query.equal('dealId', dealId), Query.orderAsc('createdAt'), Query.limit(200)];
    if (after) queries.push(Query.greaterThan('createdAt', after));

    const res = await db.listDocuments(DB_ID, COL, queries).catch(() => ({ documents: [] }));
    return NextResponse.json({ messages: res.documents });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/messages
export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await getUser(jwt);
    const body = await req.json();
    const { dealId, content, type, fileId, fileName, role } = body;
    if (!dealId || (!content && !fileId)) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const db = getAdminClient();
    await ensureCollection(db);
    const denied = await assertDealParty(db, dealId, user.$id);
    if (denied) return denied;

    const msg = await db.createDocument(DB_ID, COL, ID.unique(), {
      dealId,
      senderId:   user.$id,
      senderName: user.name || '',
      role:       role    || 'user',
      type:       type    || 'text',
      content:    content || '',
      fileId:     fileId  || '',
      fileName:   fileName || '',
      createdAt:  new Date().toISOString(),
    });
    return NextResponse.json({ message: msg });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
