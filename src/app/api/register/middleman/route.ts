import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Users, Databases, ID, Permission, Role, Query } from 'node-appwrite';

const DB_ID  = 'khonklang_db';
const COL_ID = 'middleman_applications';

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
    await databases.createCollection(DB_ID, COL_ID, 'Middleman Applications', [
      Permission.read(Role.users()),
      Permission.write(Role.users()),
    ]);
    await Promise.all([
      databases.createStringAttribute(DB_ID, COL_ID, 'userId',          255, true),
      databases.createStringAttribute(DB_ID, COL_ID, 'fullNameId',      200, true),
      databases.createStringAttribute(DB_ID, COL_ID, 'idNumber',         13, true),
      databases.createIntegerAttribute(DB_ID, COL_ID, 'depositIntent',  false, 0, 99_999_999, 0),
      databases.createStringAttribute(DB_ID, COL_ID, 'tier',             20, false, 'Bronze'),
      databases.createStringAttribute(DB_ID, COL_ID, 'categories',      500, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'workProvince',    100, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'terms',          1000, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'bankAcct',        50, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'bankName',       100, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'bankOwner',      200, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'idCardFileId',   255, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'bookbankFileId', 255, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'slipFileId',     255, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'status',            50, false, 'pending_review'),
    ]);
    await new Promise(r => setTimeout(r, 3000));
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
      const doc = docs[0] as { status?: string; tier?: string; userId?: string };
      const foundStatus = doc.status || 'pending_review';

      // Sync prefs to current account (multi-account: LINE approved → Google account not updated)
      if (viaNameFallback || (doc.userId && doc.userId !== userId)) {
        try {
          const userRecord = await users.get(userId);
          const prefs = (userRecord.prefs || {}) as Record<string, string>;
          if (prefs.middlemanStatus !== foundStatus) {
            prefs.middlemanStatus = foundStatus;
            if (foundStatus === 'approved') {
              prefs.middlemanTierIntent = doc.tier || prefs.middlemanTierIntent || 'Bronze';
              if (!prefs.role || prefs.role === 'user') prefs.role = 'middleman';
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
      fullNameId, idNumber,
      depositIntent, tier,
      categories, workProvince, terms,
      bankAcct, bankName, bankOwner,
      idCardFileId, bookbankFileId, slipFileId,
    } = body;

    if (!fullNameId || !idNumber) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const { databases, users } = getAdminClient();
    await ensureCollection(databases);

    await databases.createDocument(DB_ID, COL_ID, ID.unique(), {
      userId,
      fullNameId, idNumber,
      depositIntent: depositIntent || 0,
      tier:          tier          || 'Bronze',
      categories:    Array.isArray(categories) ? categories.join(',') : '',
      workProvince:  workProvince  || '',
      terms:         terms         || '',
      bankAcct:      bankAcct      || '',
      bankName:      bankName      || '',
      bankOwner:     bankOwner     || '',
      idCardFileId:   idCardFileId   || '',
      bookbankFileId: bookbankFileId || '',
      slipFileId:     slipFileId     || '',
      status: 'pending_review',
    });

    // Save bank info + doc names + status to prefs (visible in profile)
    const existingPrefs = (await users.get(userId)).prefs as Record<string, string>;
    await users.updatePrefs(userId, {
      ...existingPrefs,
      middlemanStatus:     'pending_review',
      middlemanTierIntent: tier || 'Bronze',
      bankAcct:            bankAcct    || '',
      bankName:            bankName    || '',
      bankOwner:           bankOwner   || '',
      idCardFileId:        idCardFileId   || '',
      bookbankFileId:      bookbankFileId || '',
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Middleman register error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
