import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Users, Databases, Query, ID, Permission, Role } from 'node-appwrite';

const DB_ID  = 'khonklang_db';
const COL_ID = 'profiles';

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
    // collection มีแล้ว — ลองเพิ่ม email attribute ถ้ายังไม่มี
    try {
      await databases.createStringAttribute(DB_ID, COL_ID, 'email', 255, false);
      await new Promise((r) => setTimeout(r, 1500));
      await databases.createIndex(DB_ID, COL_ID, 'email_idx', 'key' as any, ['email']); // eslint-disable-line @typescript-eslint/no-explicit-any
    } catch { /* มีแล้ว skip */ }
  } catch {
    // สร้างใหม่
    await databases.createCollection(DB_ID, COL_ID, 'User Profiles', [
      Permission.read(Role.any()),
      Permission.write(Role.users()),
    ]);
    await Promise.all([
      databases.createStringAttribute(DB_ID, COL_ID, 'userId',         255, true),
      databases.createStringAttribute(DB_ID, COL_ID, 'phone',           20, true),
      databases.createStringAttribute(DB_ID, COL_ID, 'email',          255, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'firstName',      100, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'lastName',       100, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'address',        500, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'role',            20, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'displayName',    200, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'linkedAccounts', 2000, false),
    ]);
    await new Promise((r) => setTimeout(r, 3000));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await databases.createIndex(DB_ID, COL_ID, 'phone_idx', 'key' as any, ['phone']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await databases.createIndex(DB_ID, COL_ID, 'email_idx', 'key' as any, ['email']);
  }
}

function getJwt(req: NextRequest) {
  return req.headers.get('x-session-jwt');
}

async function getUser(jwt: string) {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(client).get();
}

// ─── GET: ตรวจสอบว่า user นี้มีโปรไฟล์ตรงกับคนในระบบหรือเปล่า ───
export async function GET(req: NextRequest) {
  try {
    const jwt = getJwt(req);
    if (!jwt) return NextResponse.json({ matched: false }, { status: 401 });

    const currentUser = await getUser(jwt);
    const userId      = currentUser.$id;
    const userName    = currentUser.name  || '';
    const userEmail   = currentUser.email || '';
    const isSyntheticEmail = userEmail.includes('@line.khonklang.app') || !userEmail;

    const { users, databases } = getAdminClient();
    await ensureCollection(databases);

    // ค้นหาโปรไฟล์ที่ตรงกับ email หรือ displayName
    const queries: string[][] = [];
    if (!isSyntheticEmail) queries.push([Query.equal('email', userEmail)]);
    if (userName)          queries.push([Query.equal('displayName', userName)]);

    let matchedDoc = null;
    for (const q of queries) {
      const res = await databases.listDocuments(DB_ID, COL_ID, q);
      if (res.documents.length > 0) {
        // ต้องไม่ใช่ document ของ user คนเดิม
        const doc = res.documents.find(d => d.userId !== userId);
        if (doc) { matchedDoc = doc; break; }
      }
    }

    if (!matchedDoc) return NextResponse.json({ matched: false });

    // พบโปรไฟล์ที่ตรงกัน → auto-link
    const prefs: Record<string, string> = {
      firstName:   matchedDoc.firstName   || '',
      lastName:    matchedDoc.lastName    || '',
      email:       matchedDoc.email       || userEmail,
      phone:       matchedDoc.phone       || '',
      address:     matchedDoc.address     || '',
      role:        matchedDoc.role        || 'user',
      displayName: matchedDoc.displayName || userName,
      linkedTo:    matchedDoc.userId,
    };

    // อัปเดต linkedAccounts ใน document เดิม
    const linkedAccounts: string[] = matchedDoc.linkedAccounts
      ? JSON.parse(matchedDoc.linkedAccounts) : [matchedDoc.userId];
    if (!linkedAccounts.includes(userId)) linkedAccounts.push(userId);
    await databases.updateDocument(DB_ID, COL_ID, matchedDoc.$id, {
      linkedAccounts: JSON.stringify(linkedAccounts),
    });

    await users.updatePrefs(userId, prefs);
    await users.updateName(userId, prefs.displayName);

    return NextResponse.json({ matched: true, profile: prefs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Register GET error:', msg);
    return NextResponse.json({ matched: false, error: msg });
  }
}

// ─── POST: บันทึกข้อมูลผู้ใช้ใหม่ ───
export async function POST(req: NextRequest) {
  try {
    const jwt = getJwt(req);
    if (!jwt) return NextResponse.json({ error: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });

    const currentUser = await getUser(jwt);
    const userId = currentUser.$id;

    const { firstName, lastName, email, phone, address, role } = await req.json();
    if (!firstName || !lastName || !phone) {
      re