import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, DatabasesIndexType, ID, OrderBy, Permission, Role, Query, Users } from 'node-appwrite';
import { notifyUsers } from '../_lib/notify';

const DB_ID  = 'khonklang_db';
const COL_ID = 'deals';

function getAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(client);
}

function getAdminUsers() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Users(client);
}

async function ensureCollection(databases: Databases) {
  try { await databases.get(DB_ID); } catch { await databases.create(DB_ID, 'Khonklang Database'); }
  try { await databases.getCollection(DB_ID, COL_ID); return; } catch { /* create below */ }
  await databases.createCollection(DB_ID, COL_ID, 'Deals', [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
  ]);
  await Promise.all([
    databases.createStringAttribute(DB_ID, COL_ID, 'sellerId',      255, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'sellerName',    200, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'middlemanId',   255, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'middlemanName', 200, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'buyerId',       255, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'buyerName',     200, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'title',         200, true),
    databases.createStringAttribute(DB_ID, COL_ID, 'description',   1000, false, ''),
    databases.createIntegerAttribute(DB_ID, COL_ID, 'price', true, 0, 999999999),
    databases.createStringAttribute(DB_ID, COL_ID, 'category',      100, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'condition',      50, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'location',      100, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'sellingMode',    50, false, 'normal'),
    databases.createStringAttribute(DB_ID, COL_ID, 'imageFileIds',  2000, false, '[]'),
    databases.createStringAttribute(DB_ID, COL_ID, 'status',         50, false, 'posted'),
    databases.createBooleanAttribute(DB_ID, COL_ID, 'sellerAcceptedTerms',       false, false),
    databases.createBooleanAttribute(DB_ID, COL_ID, 'middlemanAcceptedTerms',    false, false),
    databases.createBooleanAttribute(DB_ID, COL_ID, 'buyerAcceptedTerms',        false, false),
    databases.createBooleanAttribute(DB_ID, COL_ID, 'middlemanConfirmedPayment', false, false),
    databases.createBooleanAttribute(DB_ID, COL_ID, 'buyerConfirmedCheck',       false, false),
    databases.createStringAttribute(DB_ID, COL_ID, 'paymentSlipFileId',  255, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'evidenceData',      6000, false, '[]'),
    databases.createStringAttribute(DB_ID, COL_ID, 'trackingToMiddleman', 100, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'trackingToBuyer',    100, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'rejectReason',       500, false, ''),
    databases.createStringAttribute(DB_ID, COL_ID, 'createdAt',           30, false, ''),
  ]);
  await new Promise(r => setTimeout(r, 10000));
  await Promise.all([
    { key: 'idx_seller',    attrs: ['sellerId'],    orders: [OrderBy.Asc]  },
    { key: 'idx_buyer',     attrs: ['buyerId'],     orders: [OrderBy.Asc]  },
    { key: 'idx_middleman', attrs: ['middlemanId'], orders: [OrderBy.Asc]  },
    { key: 'idx_status',    attrs: ['status'],      orders: [OrderBy.Asc]  },
    { key: 'idx_created',   attrs: ['createdAt'],   orders: [OrderBy.Desc] },
  ].map(i => databases.createIndex(DB_ID, COL_ID, i.key, DatabasesIndexType.Key, i.attrs, i.orders).catch(() => {})));
}

/** Add new attributes to existing collection (idempotent — ignores errors if attr already exists) */
async function ensureExtraAttributes(databases: Databases) {
  await Promise.all([
    ensureAttributeReady(databases, 'condition', () => databases.createStringAttribute(DB_ID, COL_ID, 'condition', 50, false, '')),
    ensureAttributeReady(databases, 'location', () => databases.createStringAttribute(DB_ID, COL_ID, 'location', 100, false, '')),
    ensureAttributeReady(databases, 'sellingMode', () => databases.createStringAttribute(DB_ID, COL_ID, 'sellingMode', 50, false, 'normal')),
    ensureAttributeReady(databases, 'imageFileIds', () => databases.createStringAttribute(DB_ID, COL_ID, 'imageFileIds', 2000, false, '[]')),
    // source: 'listing' = ประกาศขายสาธารณะ (โชว์ในตลาด) / 'private' = ดีลส่วนตัว (แชร์ลิงก์เอง)
    ensureAttributeReady(databases, 'source', () => databases.createStringAttribute(DB_ID, COL_ID, 'source', 20, false, '')),
  ]);
}

async function ensureIndexes(databases: Databases) {
  await Promise.all([
    { key: 'idx_seller',    attrs: ['sellerId'],    orders: [OrderBy.Asc]  },
    { key: 'idx_buyer',     attrs: ['buyerId'],     orders: [OrderBy.Asc]  },
    { key: 'idx_middleman', attrs: ['middlemanId'], orders: [OrderBy.Asc]  },
    { key: 'idx_status',    attrs: ['status'],      orders: [OrderBy.Asc]  },
    { key: 'idx_created',   attrs: ['createdAt'],   orders: [OrderBy.Desc] },
  ].map(i => databases.createIndex(DB_ID, COL_ID, i.key, DatabasesIndexType.Key, i.attrs, i.orders).catch(() => {})));
}

function getUser(jwt: string) {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c).get();
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hasScopeError(err: unknown, scope: string) {
  const msg = String(err);
  return msg.includes(`missing scopes ["${scope}"]`);
}

async function ensureAttributeReady(
  databases: Databases,
  key: string,
  createAttribute: () => Promise<unknown>,
) {
  try {
    const attr = await databases.getAttribute(DB_ID, COL_ID, key);
    if (attr.status === 'available') return;
  } catch {
    // Attribute does not exist yet.
  }

  await createAttribute().catch(() => {});

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const attr = await databases.getAttribute(DB_ID, COL_ID, key);
      if (attr.status === 'available') return;
    } catch {
      // Keep polling until Appwrite finishes creating the attribute.
    }
    await sleep(500);
  }

  throw new Error(`แอตทริบิวต์ ${key} ยังไม่พร้อมใช้งาน`);
}

async function ensureDealsSchemaBestEffort(databases: Databases) {
  try {
    await ensureCollection(databases);
    await ensureExtraAttributes(databases);
    await ensureIndexes(databases);
  } catch (err) {
    // In production we can keep working with an existing collection even if
    // the API key is not allowed to mutate collection schema.
    if (hasScopeError(err, 'collections.write')) return;
    throw err;
  }
}

export async function GET(req: NextRequest) {
  try {
    const role = req.nextUrl.searchParams.get('role') || 'seller';
    const databases = getAdminClient();
    await ensureDealsSchemaBestEffort(databases);

    if (role === 'buyer' && !req.headers.get('x-session-jwt')) {
      const posted = await databases.listDocuments(DB_ID, COL_ID, [
        Query.equal('status', 'posted'),
        Query.orderDesc('createdAt'),
        Query.limit(100),
      ]).catch(() => ({ documents: [] }));
      return NextResponse.json({ deals: posted.documents });
    }

    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = await getUser(jwt);

    if (role === 'middleman') {
      const result = await databases.listDocuments(DB_ID, COL_ID, [
        Query.equal('middlemanId', currentUser.$id),
        Query.orderDesc('createdAt'),
        Query.limit(100),
      ]).catch(() => ({ documents: [] }));
      const usersApi = getAdminUsers();
      const enriched = await Promise.all(result.documents.map(async doc => {
        let buyerPhone = '', sellerPhone = '';
        try { if (doc.buyerId)  { const u = await usersApi.get(doc.buyerId as string);  buyerPhone  = ((u.prefs||{}) as Record<string,string>).phone||''; } } catch {}
        try { if (doc.sellerId) { const u = await usersApi.get(doc.sellerId as string); sellerPhone = ((u.prefs||{}) as Record<string,string>).phone||''; } } catch {}
        return { ...doc, buyerPhone, sellerPhone };
      }));
      return NextResponse.json({ deals: enriched });
    }

    if (role === 'buyer') {
      const [posted, mine] = await Promise.all([
        databases.listDocuments(DB_ID, COL_ID, [Query.equal('status','posted'), Query.orderDesc('createdAt'), Query.limit(100)]).catch(() => ({ documents: [] })),
        databases.listDocuments(DB_ID, COL_ID, [Query.equal('buyerId', currentUser.$id), Query.orderDesc('createdAt'), Query.limit(100)]).catch(() => ({ documents: [] })),
      ]);
      const seen = new Set<string>();
      const unique = [...posted.documents, ...mine.documents].filter(d => {
        if (seen.has(d.$id)) return false;
        seen.add(d.$id); return true;
      });
      return NextResponse.json({ deals: unique });
    }

    const result = await databases.listDocuments(DB_ID, COL_ID, [
      Query.equal('sellerId', currentUser.$id),
      Query.orderDesc('createdAt'),
      Query.limit(100),
    ]).catch(() => ({ documents: [] }));
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
    const { title, description, price, category, creatorRole, condition, location, sellingMode, imageFileIds, source } = body;
    if (!title || price == null) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    const isBuyer = creatorRole === 'buyer';
    const databases = getAdminClient();
    await ensureDealsSchemaBestEffort(databases);
    const doc = await databases.createDocument(DB_ID, COL_ID, ID.unique(), {
      sellerId: isBuyer ? '' : currentUser.$id,
      sellerName: isBuyer ? '' : (currentUser.name || ''),
      buyerId: isBuyer ? currentUser.$id : '',
      buyerName: isBuyer ? (currentUser.name || '') : '',
      middlemanId: '', middlemanName: '',
      title, description: description || '', price: Number(price),
      category: category || '',
      condition: condition || '',
      location: location || '',
      sellingMode: sellingMode || 'normal',
      source: source === 'listing' ? 'listing' : 'private',
      imageFileIds: JSON.stringify(imageFileIds || []),
      status: isBuyer ? 'waiting_seller' : 'posted',
      sellerAcceptedTerms: false, middlemanAcceptedTerms: false, buyerAcceptedTerms: false,
      middlemanConfirmedPayment: false, buyerConfirmedCheck: false,
      paymentSlipFileId: '', evidenceData: '[]',
      trackingToMiddleman: '', trackingToBuyer: '', rejectReason: '',
      createdAt: new Date().toISOString(),
    });

    // ดีลนี้ถูกสร้างเพื่อเสนอขายตาม "ประกาศหาสินค้า" → แจ้งเจ้าของประกาศทันที
    if (body.wantedId && typeof body.wantedId === 'string') {
      try {
        const wanted = await databases.getDocument(DB_ID, 'wanted_posts', body.wantedId);
        if (wanted.userId && wanted.userId !== currentUser.$id) {
          await notifyUsers(databases, [wanted.userId as string], {
            title: `📢 มีผู้เสนอขายตามประกาศหาของคุณ`,
            body: `${currentUser.name || 'สมาชิก'} เสนอขาย "${title}" ราคา ฿${Number(price).toLocaleString()} — กดเข้าดูดีลและเข้าร่วมเป็นผู้ซื้อได้เลย`,
            link: `/deal/${doc.$id}`,
          });
        }
      } catch { /* ประกาศอาจถูกลบ — ไม่กระทบการสร้างดีล */ }
    }

    return NextResponse.json({ deal: doc });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
