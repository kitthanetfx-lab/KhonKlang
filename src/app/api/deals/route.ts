import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, DatabasesIndexType, ID, OrderBy, Permission, Role, Query } from 'node-appwrite';

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
    return; // already exists
  } catch { /* create below */ }
  await databases.createCollection(DB_ID, COL_ID, 'Deals', [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
  ]);
  // 22 attributes — compact schema
  await Promise.all([
    databases.createStringAttribute(DB_ID, COL_ID, 'sellerId',      255, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'sellerName',    200, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'middlemanId',   255, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'middlemanName', 200, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'buyerId',       255, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'buyerName',     200, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'title',         200, true),
    databases.createStringAttribute(DB_ID, COL_ID, 'description',   1000, false, ''),
    databases.createIntegerAttribute(DB_ID, COL_ID, 'price', true, 0, 999_999_999),
    databases.createStringAttribute(DB_ID, COL_ID, 'category',      100, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'status',         50, false, 'posted'),
    databases.createBooleanAttribute(DB_ID, COL_ID, 'sellerAcceptedTerms',    false, false),
    databases.createBooleanAttribute(DB_ID, COL_ID, 'middlemanAcceptedTerms', false, false),
    databases.createBooleanAttribute(DB_ID, COL_ID, 'buyerAcceptedTerms',     false, false),
    databases.createBooleanAttribute(DB_ID, COL_ID, 'middlemanConfirmedPayment', false, false),
    databases.createBooleanAttribute(DB_ID, COL_ID, 'buyerConfirmedCheck',    false, false),
    databases.createStringAttribute(DB_ID, COL_ID, 'paymentSlipFileId', 255, false, ''),
    // Combined evidence JSON: [{type,fileId,fileName,uploadedBy,at}]
    databases.createStringAttribute(DB_ID, COL_ID, 'evidenceData',  6000, false, '[]'),
    databases.createStringAttribute(DB_ID, COL_ID, 'trackingToMiddleman', 100, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'trackingToBuyer',    100, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'rejectReason',       500, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'createdAt',           30, false, ''),
  ]);
  await new Promise(r => setTimeout(r, 10000));
  // Create indexes for queryable fields
  const indexDefs = [
    { key: 'idx_seller',    attrs: ['sellerId'],    orders: [OrderBy.Asc]  },
    { key: 'idx_buyer',     attrs: ['buyerId'],     orders: [OrderBy.Asc]  },
    { key: 'idx_middleman', attrs: ['middlemanId'], orders: [OrderBy.Asc]  },
    { key: 'idx_status',    attrs: ['status'],      orders: [OrderBy.Asc]  },
    { key: 'idx_created',   attrs: ['createdAt'],   orders: [OrderBy.Desc] },
  ];
  await Promise.all(indexDefs.map(i =>
    databases.createIndex(DB_ID, COL_ID, i.key, DatabasesIndexType.Key, i.attrs, i.orders).catch(() => {})
  ));
}

// Ensure indexes exist on already-created collection (called on every query)
async function ensureIndexes(databases: Databases) {
  const indexDefs = [
    { key: 'idx_seller',    attrs: ['sellerId'],    orders: [OrderBy.Asc]  },
    { key: 'idx_buyer',     attrs: ['buyerId'],     orders: [OrderBy.Asc]  },
    { key: 'idx_middleman', attrs: ['middlemanId'], orders: [OrderBy.Asc]  },
    { key: 'idx_status',    attrs: ['status'],      orders: [OrderBy.Asc]  },
    { key: 'idx_created',   attrs: ['createdAt'],   orders: [OrderBy.Desc] },
  ];
  await Promise.all(indexDefs.map(i =>
    databases.createIndex(DB_ID, COL_ID, i.key, DatabasesIndexType.Key, i.attrs, i.orders).catch(() => {})
  ));
}

function getUser(jwt: string) {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c).get();
}

export async function GET(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = await getUser(jwt);
    const role = req.nextUrl.searchParams.get('role') || 'seller';
    const databases = getAdminClient();
    // Ensure indexes exist (fast no-op if already created)
    await ensureIndexes(databases);

    if (role === 'middleman') {
      // New flow: buyers assign middlemen — middleman sees only their assigned deals
      const result = await databases.listDocuments(DB_ID, COL_ID, [
        Query.equal('middlemanId', currentUser.$id),
        Query.orderDesc('createdAt'),
        Query.limit(100),
      ]).catch(() => ({ documents: [] }));
      return NextResponse.json({ deals: result.documents });
    }
    if (role === 'buyer') {
      const [posted, mine] = await Promise.all([
        databases.listDocuments(DB_ID, COL_ID, [Query.equal('status', 'posted'), Query.orderDesc('createdAt'), Query.limit(100)]).catch(() => ({ documents: [] })),
        databases.listDocuments(DB_ID, COL_ID, [Query.equal('buyerId', currentUser.$id), Query.orderDesc('createdAt'), Query.limit(100)]).catch(() => ({ documents: [] })),
      ]);
      const seen = new Set<string>();
      const unique = [...posted.documents, ...mine.documents].filter(d => { if (seen.has(d.$id)) return false; seen.add(d.$id); return true; });
      return NextResponse.json({ deals: unique });
    }
    const result = await databases.listDocuments(DB_ID, COL_ID, [Query.equal('sellerId', currentUser.$id), Query.orderDesc('createdAt'), Query.limit(100)]).catch(() => ({ documents: [] }));
    return NextResponse.json({ deals: result.documents });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

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
      paymentSlipFileId: '', evidenceData: '[]',
      trackingToMiddleman: '', trackingToBuyer: '', rejectReason: '',
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ deal: doc });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
