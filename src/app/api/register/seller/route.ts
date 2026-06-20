import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Users, Databases, ID, Permission, Role, Query } from 'node-appwrite';
import { readServiceControlsConfig } from '../../_lib/appConfig';

const DB_ID  = 'khonklang_db';
const COL_ID = 'seller_applications';

function getAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return { users: new Users(client), databases: new Databases(client) };
}

async function ensureCollection(databases: Databases) {
  try { await databases.get(DB_ID); }
  catch { await databases.create(DB_ID, 'Khonklang Database'); }

  try {
    await databases.getCollection(DB_ID, COL_ID);
  } catch {
    await databases.createCollection(DB_ID, COL_ID, 'Seller Applications', [
      Permission.read(Role.users()),
      Permission.write(Role.users()),
    ]);
    await Promise.all([
      databases.createStringAttribute(DB_ID, COL_ID, 'userId',              255, true),
      databases.createStringAttribute(DB_ID, COL_ID, 'sellerType',           50, true),
      databases.createStringAttribute(DB_ID, COL_ID, 'fullNameId',          200, true),
      databases.createStringAttribute(DB_ID, COL_ID, 'idNumber',             13, true),
      databases.createStringAttribute(DB_ID, COL_ID, 'province',            100, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'address',             500, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'onlineLink',          500, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'companyName',         200, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'companyRegNum',        13, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'bankAcct',             50, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'bankName',            100, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'bankOwner',           200, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'companyBankAcct',      50, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'companyBankName',     100, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'idCardFileId',      255, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'companyCertFileId', 255, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'bookbankFileId',    255, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'slipFileId',        255, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'status',               50, false, 'pending_review'),
      databases.createStringAttribute(DB_ID, COL_ID, 'rejectReason',       500, false, ''),
    ]);
    await new Promise(r => setTimeout(r, 3000));
  }

  try {
    await databases.getAttribute(DB_ID, COL_ID, 'rejectReason');
  } catch {
    await databases.createStringAttribute(DB_ID, COL_ID, 'rejectReason', 500, false, '').catch(() => {});
  }
}

export async function GET(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ status: null });

    const sessionClient = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setJWT(jwt);
    const currentUser = await new Account(sessionClient).get();
    const userId = currentUser.$id;

    const { databases, users } = getAdminClient();
    let docs = await databases.listDocuments(DB_ID, COL_ID, [
      Query.equal('userId', userId),
    ]).then(r => r.documents).catch(() => []);

    let viaNameFallback = false;
    if (docs.length === 0 && currentUser.name) {
      docs = await databases.listDocuments(DB_ID, COL_ID, [
        Query.equal('fullNameId', currentUser.name),
      ]).then(r => r.documents).catch(() => []);
      if (docs.length > 0) viaNameFallback = true;
    }

    if (docs.length > 0) {
      const doc = docs[0] as { status?: string; userId?: string };
      const foundStatus = doc.status || 'pending_review';

      // Sync prefs to current account (multi-account: LINE approved → Google account not updated)
      if (viaNameFallback || (doc.userId && doc.userId !== userId)) {
        try {
          const userRecord = await users.get(userId);
          const prefs = (userRecord.prefs || {}) as Record<string, string>;
          if (prefs.sellerStatus !== foundStatus) {
            prefs.sellerStatus = foundStatus;
            if (foundStatus === 'approved' && (!prefs.role || prefs.role === 'user')) {
              prefs.role = 'seller';
            }
            await users.updatePrefs(userId, prefs);
          }
        } catch { /* best-effort */ }
      }

      return NextResponse.json({ status: foundStatus });
    }
    return NextResponse.json({ status: null });
  } catch {
    return NextResponse.json({ status: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });

    const sessionClient = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setJWT(jwt);
    const currentUser = await new Account(sessionClient).get();
    const userId = currentUser.$id;

    const body = await req.json();
    const {
      sellerType, fullNameId, idNumber,
      province, address, onlineLink,
      companyName, companyRegNum,
      bankAcct, bankName, bankOwner,
      companyBankAcct, companyBankName,
      idCardFileId, companyCertFileId, bookbankFileId, slipFileId,
    } = body;

    if (!sellerType || !fullNameId || !idNumber) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const { databases, users } = getAdminClient();
    const services = await readServiceControlsConfig(databases);
    if (!services.sellerRegistration.enabled) {
      return NextResponse.json({ error: services.sellerRegistration.note || 'การสมัครผู้ขายถูกปิดชั่วคราว' }, { status: 403 });
    }
    await ensureCollection(databases);

    const existing = await databases.listDocuments(DB_ID, COL_ID, [
      Query.equal('userId', userId),
      Query.limit(1),
    ]).then(r => r.documents).catch(() => []);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'บัญชีนี้เคยยื่นสมัครผู้ขายแล้ว กรุณารอผลตรวจสอบหรือดูสถานะในโปรไฟล์' }, { status: 409 });
    }

    await databases.createDocument(DB_ID, COL_ID, ID.unique(), {
      userId,
      sellerType, fullNameId, idNumber,
      province:           province            || '',
      address:            address             || '',
      onlineLink:         onlineLink          || '',
      companyName:        companyName         || '',
      companyRegNum:      companyRegNum       || '',
      bankAcct:           bankAcct            || '',
      bankName:           bankName            || '',
      bankOwner:          bankOwner           || '',
      companyBankAcct:    companyBankAcct     || '',
      companyBankName:    companyBankName     || '',
      idCardFileId:      idCardFileId      || '',
      companyCertFileId: companyCertFileId || '',
      bookbankFileId:    bookbankFileId    || '',
      slipFileId:        slipFileId        || '',
      status: 'pending_review',
      rejectReason: '',
    });

    // Save bank info + doc names + status to prefs (visible in profile)
    const existingPrefs = (await users.get(userId)).prefs as Record<string, string>;
    await users.updatePrefs(userId, {
      ...existingPrefs,
      sellerStatus:     'pending_review',
      bankAcct:         bankAcct    || '',
      bankName:         bankName    || '',
      bankOwner:        bankOwner   || '',
      idCardFileId:   idCardFileId   || '',
      bookbankFileId: bookbankFileId || '',
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Seller register error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
