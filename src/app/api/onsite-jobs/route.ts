import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, DatabasesIndexType, ID, OrderBy, Permission, Role, Query } from 'node-appwrite';

const DB_ID  = 'khonklang_db';
const COL_ID = 'onsite_jobs';

function adminDb() {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(c);
}

function userAccount(jwt: string) {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c);
}

async function ensureCol(db: Databases) {
  try { await db.getCollection(DB_ID, COL_ID); return; } catch { /* create */ }
  await db.createCollection(DB_ID, COL_ID, 'Onsite Jobs', [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
  ]);
  await Promise.all([
    db.createStringAttribute(DB_ID, COL_ID, 'buyerId',          255,  true),
    db.createStringAttribute(DB_ID, COL_ID, 'buyerName',        200,  false, ''),
    db.createStringAttribute(DB_ID, COL_ID, 'itemDescription',  1000, true),
    db.createStringAttribute(DB_ID, COL_ID, 'itemPrice',        50,   false, '0'),
    db.createStringAttribute(DB_ID, COL_ID, 'sellerLocation',   300,  true),
    db.createStringAttribute(DB_ID, COL_ID, 'sellerProvince',   100,  false, ''),
    db.createStringAttribute(DB_ID, COL_ID, 'sellerContact',    200,  false, ''),
    db.createStringAttribute(DB_ID, COL_ID, 'maxBudget',         50,  false, '0'),
    db.createStringAttribute(DB_ID, COL_ID, 'status',            50,  false, 'open'),
    db.createStringAttribute(DB_ID, COL_ID, 'middlemanId',      255,  false, ''),
    db.createStringAttribute(DB_ID, COL_ID, 'middlemanName',    200,  false, ''),
    db.createStringAttribute(DB_ID, COL_ID, 'middlemanTier',     50,  false, ''),
    db.createStringAttribute(DB_ID, COL_ID, 'middlemanDeposit',  50,  false, '0'),
    db.createStringAttribute(DB_ID, COL_ID, 'travelFee',         50,  false, '0'),
    db.createStringAttribute(DB_ID, COL_ID, 'serviceFee',        50,  false, '0'),
    db.createStringAttribute(DB_ID, COL_ID, 'estimatedArrival', 100,  false, ''),
    db.createStringAttribute(DB_ID, COL_ID, 'conditions',       500,  false, ''),
    db.createStringAttribute(DB_ID, COL_ID, 'quotedAt',          30,  false, ''),
    db.createStringAttribute(DB_ID, COL_ID, 'acceptedAt',        30,  false, ''),
    db.createStringAttribute(DB_ID, COL_ID, 'startedAt',         30,  false, ''),
    db.createStringAttribute(DB_ID, COL_ID, 'completedAt',       30,  false, ''),
    db.createStringAttribute(DB_ID, COL_ID, 'reportNotes',      500,  false, ''),
    db.createStringAttribute(DB_ID, COL_ID, 'createdAt',         30,  false, ''),
  ]);
  await new Promise(r => setTimeout(r, 8000));
  await Promise.all([
    db.createIndex(DB_ID, COL_ID, 'idx_buyer',     DatabasesIndexType.Key, ['buyerId'],     [OrderBy.Asc]).catch(()=>{}),
    db.createIndex(DB_ID, COL_ID, 'idx_mm',        DatabasesIndexType.Key, ['middlemanId'], [OrderBy.Asc]).catch(()=>{}),
    db.createIndex(DB_ID, COL_ID, 'idx_status',    DatabasesIndexType.Key, ['status'],      [OrderBy.Asc]).catch(()=>{}),
    db.createIndex(DB_ID, COL_ID, 'idx_province',  DatabasesIndexType.Key, ['sellerProvince'], [OrderBy.Asc]).catch(()=>{}),
    db.createIndex(DB_ID, COL_ID, 'idx_created',   DatabasesIndexType.Key, ['createdAt'],   [OrderBy.Desc]).catch(()=>{}),
  ]);
}

// GET /api/onsite-jobs?role=buyer|middleman&province=X&status=open
export async function GET(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userAccount(jwt).get();
    const db = adminDb();
    const { searchParams } = req.nextUrl;
    const role     = searchParams.get('role') || 'buyer';
    const province = searchParams.get('province') || '';
    const status   = searchParams.get('status') || '';

    let queries: string[];
    if (role === 'buyer') {
      queries = [Query.equal('buyerId', user.$id), Query.orderDesc('createdAt'), Query.limit(50)];
    } else {
      // middleman sees open jobs + their own assigned jobs
      queries = [Query.orderDesc('createdAt'), Query.limit(100)];
      if (province) queries.push(Query.equal('sellerProvince', province));
      if (status)   queries.push(Query.equal('status', status));
      else          queries.push(Query.equal('status', 'open'));
    }

    const result = await db.listDocuments(DB_ID, COL_ID, queries).catch(() => ({ documents: [] }));
    return NextResponse.json({ jobs: result.documents });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/onsite-jobs — buyer creates a job
export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userAccount(jwt).get();
    const body = await req.json();
    const { itemDescription, itemPrice, sellerLocation, sellerProvince, sellerContact, maxBudget } = body;
    if (!itemDescription || !sellerLocation)
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const db = adminDb();
    await ensureCol(db);
    const doc = await db.createDocument(DB_ID, COL_ID, ID.unique(), {
      buyerId: user.$id,
      buyerName: user.name || '',
      itemDescription,
      itemPrice: String(itemPrice || 0),
      sellerLocation,
      sellerProvince: sellerProvince || '',
      sellerContact: sellerContact || '',
      maxBudget: String(maxBudget || 0),
      status: 'open',
      middlemanId: '', middlemanName: '', middlemanTier: '', middlemanDeposit: '0',
      travelFee: '0', serviceFee: '0', estimatedArrival: '', conditions: '',
      quotedAt: '', acceptedAt: '', startedAt: '', completedAt: '', reportNotes: '',
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ job: doc });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
