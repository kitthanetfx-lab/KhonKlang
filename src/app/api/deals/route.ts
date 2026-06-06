import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, ID, Permission, Role, Query } from 'node-appwrite';

const DB_ID  = 'khonklang_db';
const COL_ID = 'deals';

function getAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(client);
}

async function ensureCollection(databases: Databases) {
  try { await databases.get(DB_ID); } catch { await databases.create(DB_ID, 'Khonklang Database'); }
  try {
    await databases.getCollection(DB_ID, COL_ID);
  } catch {
    await databases.createCollection(DB_ID, COL_ID, 'Deals', [
      Permission.read(Role.users()),
      Permission.create(Role.users()),
      Permission.update(Role.users()),
    ]);
    await Promise.all([
      databases.createStringAttribute(DB_ID, COL_ID, 'sellerId',              255, true),
      databases.createStringAttribute(DB_ID, COL_ID, 'sellerName',            200, false, ''),
      databases.createStringAttribute(DB_ID, COL_ID, 'middlemanId',           255, false, ''),
      databases.createStringAttribute(DB_ID, COL_ID, 'middlemanName',         200, false, ''),
      databases.createStringAttribute(DB_ID, COL_ID, 'buyerId',               255, false, ''),
      databases.createStringAttribute(DB_ID, COL_ID, 'buyerName',             200, false, ''),
      databases.createStringAttribute(DB_ID, COL_ID, 'title',                 200, true),
      databases.createStringAttribute(DB_ID, COL_ID, 'description',          2000, false, ''),
      databases.createIntegerAttribute(DB_ID, COL_ID, 'price',                true, 0, 999_999_999),
      databases.createStringAttribute(DB_ID, COL_ID, 'category',             100, false, ''),
      databases.createStringAttribute(DB_ID, COL_ID, 'status',                50, false, 'posted'),
      databases.createBooleanAttribute(DB_ID, COL_ID, 'sellerAcceptedTerms',  false, false),
      databases.createBooleanAttribute(DB_ID, COL_ID, 'middlemanAcceptedTerms', false, false),
      databases.createBooleanAttribute(DB_ID, COL_ID, 'buyerAcceptedTerms',   false, false),
      databases.createBooleanAttribute(DB_ID, COL_ID, 'middlemanConfirmedPayment', false, false),
      databases.createBooleanAttribute(DB_ID, COL_ID, 'buyerConfirmedCheck',  false, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'paymentSlipFileId',    255, false, ''),
      databases.createStringAttribute(DB_ID, COL_ID, 'packingEvidence',     4000, false, '[]'),
      databases.createStringAttribute(DB_ID, COL_ID, 'testingEvidence',     4000, false, '[]'),
      databases.createStringAttribute(DB_ID, COL_ID, 'receiveEvidence',     4000, false, '[]'),
      databases.createStringAttribute(DB_ID, COL_ID, 'checkEvidence',       4000, false, '[]'),
      databases.createStringAttribute(DB_ID, COL_ID, 'trackingToMiddleman',  100, false, ''),
      databases.createStringAttribute(DB_ID, COL_ID, 'trackingToBuyer',      100, false, ''),
      databases.createStringAttribute(DB_ID, COL_ID, 'rejectReason',         500, false, ''),
      databases.createStringAttribute(DB_ID, COL_ID, 'jitsiRoomId',          100, false, ''),
      databases.createStringAttribute(DB_ID, COL_ID, 'createdAt',             30, false, ''),
      databases.createStringAttribute(DB_ID, COL_ID, 'completedAt',           30, false, ''),
      databases.createStringAttribute(DB_ID, COL_ID, 'middlemanReceivedAt',   30, false, ''),
    ]);
    await new Promise(r => setTimeout(r, 3000));
  }
}

function getUser(jwt: string) {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c).get();
}

// GET /api/deals?role=middleman|seller|buyer
export async function GET(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = await getUser(jwt);
    const role = req.nextUrl.searchParams.get('role') || 'seller';
    const databases = getAdminClient();

    if (role === 'middleman') {
      const [posted, mine] = await Promise.all([
        databases.listDocuments(DB_ID, COL_ID, [Query.equal('status', 'posted'), Query.orderDesc('createdAt'), Query.limit(50)]).catch(() => ({ documents: [] })),
        databases.listDocuments(DB_ID, COL_ID, [Query.equal('middlemanId', currentUser.$id), Query.orderDesc('createdAt'), Query.limit(100)]).catch(() => ({ documents: [] })),
      ]);
      const seen = new Set<string>();
      const unique = [...posted.documents, ...mine.documents].filter(d => { if (seen.has(d.$id)) return false; seen.add(d.$id); return true; });
      return NextResponse.json({ deals: unique });
    }

    if (role === 'buyer') {
      // All posted deals (marketplace) + deals where buyer = me
      const [posted, mine] = await Promise.all([
        databases.listDocuments(DB_ID, COL_ID, [Query.equal('status', 'posted'), Query.orderDesc('createdAt'), Query.limit(100)]).catch(() => ({ documents: [] })),
        databases.listDocuments(DB_ID, COL_ID, [Query.equal('buyerId', currentUser.$id), Query.orderDesc('createdAt'), Query.limit(100)]).catch(() => ({ documents: [] })),
      ]);
      const seen = new Set<string>();
      const unique = [...posted.documents, ...mine.documents].filter(d => { if (seen.has(d.$id)) return false; seen.add(d.$id); return true; });
      return NextResponse.json({ deals: unique });
    }

    // seller
    const result = await databases.listDocuments(DB_ID, COL_ID, [Query.equal('sellerId', currentUser.$id), Query.orderDesc('createdAt'), Query.limit(100)]).catch(() => ({ documents: [] }));
    return NextResponse.json({ deals: result.documents });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/deals — seller OR buyer creates deal
// body: { title, description, price, category, creatorRole: 'seller'|'buyer' }
export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = await getUser(jwt);
    const body = await req.json();
    const { title, description, price, category, creatorRole } = body;
    if (!title || price == null) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const isBuyerCreator = creatorRole === 'buyer';
    const databases = getAdminClient();
    await ensureCollection(databases);
    const roomId = `khonklang-${Date.now().toString(36)}`;
    const doc = await databases.createDocument(DB_ID, COL_ID, ID.unique(), {
      sellerId:    isBuyerCreator ? '' : currentUser.$id,
      sellerName:  isBuyerCreator ? '' : (currentUser.name || ''),
      buyerId:     isBuyerCreator ? currentUser.$id : '',
      buyerName:   isBuyerCreator ? (currentUser.name || '') : '',
      middlemanId: '', middlemanName: '',
      title, description: description || '', price: Number(price), category: category || '',
      status: isBuyerCreator ? 'waiting_seller' : 'posted',
      sellerAcceptedTerms: false, middlemanAcceptedTerms: false, buyerAcceptedTerms: false,
      middlemanConfirmedPayment: false, buyerConfirmedCheck: false,
      paymentSlipFileId: '', packingEvidence: '[]', testingEvidence: '[]',
      receiveEvidence: '[]', checkEvidence: '[]',
      trackingToMiddleman: '', trackingToBuyer: '', rejectReason: '',
      jitsiRoomId: roomId,
      createdAt: new Date().toISOString(), completedAt: '', middlemanReceivedAt: '',
    });
    return NextResponse.json({ deal: doc });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH /api/deals?id=xxx — legacy accept/cancel for middleman dashboard
export async function PATCH(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = await getUser(jwt);
    const dealId = req.nextUrl.searchParams.get('id');
    if (!dealId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const body = await req.json();
    const { action, rejectReason } = body;
    const databases = getAdminClient();
    const deal = await databases.getDocument(DB_ID, COL_ID, dealId);
    const isSeller    = deal.sellerId    === currentUser.$id;
    const isMiddleman = deal.middlemanId === currentUser.$id;
    let updates: Record<string, unknown> = {};
    if (action === 'accept' && deal.status === 'posted') {
      updates = { middlemanId: currentUser.$id, middlemanName: currentUser.name || '', status: 'buyer_joined' };
    } else if (action === 'confirm') {
      if (isSeller) updates.sellerAcceptedTerms = true;
      if (isMiddleman) updates.middlemanAcceptedTerms = true;
    } else if (action === 'cancel') {
      updates = { status: 'cancelled', rejectReason: rejectReason || '' };
    } else if (action === 'dispute') {
      updates = { status: 'disputed', rejectReason: rejectReason || '' };
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    const updated = await databases.updateDocument(DB_ID, COL_ID, dealId, updates);
    return NextResponse.json({ deal: updated });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
