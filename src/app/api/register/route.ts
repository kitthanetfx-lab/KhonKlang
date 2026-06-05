import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Users, Databases, Query, ID } from 'node-appwrite';

const DB_ID = 'khonklang_db';
const COL_ID = 'profiles';

function getAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return { users: new Users(client), databases: new Databases(client) };
}

async function ensureCollection(databases: Databases) {
  // สร้าง Database ถ้ายังไม่มี
  try {
    await databases.get(DB_ID);
  } catch {
    await databases.create(DB_ID, 'Khonklang Database');
  }

  // สร้าง Collection ถ้ายังไม่มี
  try {
    await databases.getCollection(DB_ID, COL_ID);
  } catch {
    await databases.createCollection(DB_ID, COL_ID, 'User Profiles', [
      'read("any")',
      'write("users")',
    ]);
    // สร้าง attributes
    await Promise.all([
      databases.createStringAttribute(DB_ID, COL_ID, 'userId', 255, true),
      databases.createStringAttribute(DB_ID, COL_ID, 'phone', 20, true),
      databases.createStringAttribute(DB_ID, COL_ID, 'firstName', 100, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'lastName', 100, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'address', 500, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'role', 20, false),
      databases.createStringAttribute(DB_ID, COL_ID, 'displayName', 200, false),
    ]);
    // รอให้ attributes พร้อม
    await new Promise((r) => setTimeout(r, 3000));
    // สร้าง index บน phone เพื่อ query ได้เร็ว
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await databases.createIndex(DB_ID, COL_ID, 'phone_idx', 'key' as any, ['phone']);
  }
}

export async function POST(req: NextRequest) {
  try {
    // ดึง session cookie เพื่อระบุ user
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
    const sessionCookie =
      req.cookies.get(`a_session_${projectId}`)?.value ||
      req.cookies.get(`a_session_${projectId}_legacy`)?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    // ระบุตัว user จาก session
    const sessionClient = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(projectId)
      .setSession(sessionCookie);
    const sessionAccount = new Account(sessionClient);
    const currentUser = await sessionAccount.get();
    const userId = currentUser.$id;

    const body = await req.json();
    const { firstName, lastName, phone, address, role, bankAccountName, bankName, accountNumber } = body;

    const { users, databases } = getAdminClient();

    // ตรวจสอบและสร้าง collection ถ้ายังไม่มี
    await ensureCollection(databases);

    const displayName = `${firstName} ${lastName}`.trim();
    const prefs: Record<string, string> = {
      firstName,
      lastName,
      phone,
      address,
      role,
      displayName,
      bankAccountName: bankAccountName || '',
      bankName: bankName || '',
      accountNumber: accountNumber || '',
    };

    // เช็คว่ามีเบอร์โทรนี้ในระบบแล้วหรือไม่
    let linked = false;
    let linkedFromUserId = '';
    try {
      const existing = await databases.listDocuments(DB_ID, COL_ID, [
        Query.equal('phone', phone),
      ]);

      if (existing.documents.length > 0) {
        // พบบัญชีที่ใช้เบอร์นี้แล้ว → ถือว่าเป็นคนคนเดียวกัน
        const existingProfile = existing.documents[0];
        linkedFromUserId = existingProfile.userId;

        // คัดลอกข้อมูลจาก profile เดิมมาให้ account ปัจจุบัน
        prefs.firstName = existingProfile.firstName || firstName;
        prefs.lastName = existingProfile.lastName || lastName;
        prefs.address = existingProfile.address || address;
        prefs.role = existingProfile.role || role;
        prefs.displayName = existingProfile.displayName || displayName;
        prefs.linkedTo = existingProfile.userId; // อ้างอิงว่า account หลักคือใคร

        // อัปเดต profile เดิมให้รู้ว่ามี account ใหม่ link เข้ามา
        const linkedAccounts: string[] = existingProfile.linkedAccounts
          ? JSON.parse(existingProfile.linkedAccounts)
          : [existingProfile.userId];

        if (!linkedAccounts.includes(userId)) {
          linkedAccounts.push(userId);
        }

        await databases.updateDocument(DB_ID, COL_ID, existingProfile.$id, {
          linkedAccounts: JSON.stringify(linkedAccounts),
        });

        linked = true;
      } else {
        // เบอร์ใหม่ → สร้าง profile document
        await databases.createDocument(DB_ID, COL_ID, ID.unique(), {
          userId,
          phone,
          firstName,
          lastName,
          address,
          role,
          displayName,
        });
      }
    } catch (dbError) {
      // ถ้า DB ยังไม่พร้อม (เพิ่ง create) ให้ไปต่อโดยไม่มี deduplication
      console.error('DB error (non-fatal):', dbError);
    }

    // บันทึก prefs และชื่อ user
    await users.updatePrefs(userId, prefs);
    await users.updateName(userId, displayName);

    return NextResponse.json({ success: true, linked, linkedFromUserId });
  } catch (err) {
    console.error('Register API error:', err);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
