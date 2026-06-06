import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Users, Databases, ID, Permission, Role } from 'node-appwrite';

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
      databases.createStringAttribute(DB_ID, COL_ID, 'idCardFileName',      255, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'companyCertFileName', 255, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'bookbankFileName',    255, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'status',               50, false, 'pending_review'),
    ]);
    await new Promise(r => setTimeout(r, 3000));
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
      idCardFileName, companyCertFileName, bookbankFileName,
    } = body;

    if (!sellerType || !fullNameId || !idNumber) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const { databases, users } = getAdminClient();
    await ensureCollection(databases);

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
      idCardFileName:     idCardFileName      || '',
      companyCertFileName:companyCertFileName || '',
      bookbankFileName:   bookbankFileName    || '',
      status: 'pending_review',
    });

    // Save bank info + doc names + status to prefs (visible in profile)
    const existingPrefs = (await users.get(userId)).prefs as Record<string, string>;
    await users.updatePrefs(userId, {
      ...existingPrefs,
      sellerStatus:     'pending_review',
      bankAcct:         bankAcct    || '',
      bankName:         bankName    || '',
      bankOwner:        bankOwner   || '',
      idCardFileName:   idCardFileName   || '',
      bookbankFileName: bookbankFileName || '',
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Seller register error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
