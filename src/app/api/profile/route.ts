import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Users, Databases, Query } from 'node-appwrite';

const DB_ID  = 'khonklang_db';
const COL_ID = 'profiles';

function getAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return { users: new Users(client), databases: new Databases(client) };
}

async function getUserFromJwt(jwt: string) {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(client).get();
}

// ─── PATCH: update profile ────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });

    const currentUser = await getUserFromJwt(jwt);
    const userId      = currentUser.$id;

    const { firstName, lastName, phone, address, bankName, bankAcct, bankOwner, bankQrFileId } = await req.json();
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อ-นามสกุล' }, { status: 400 });
    }
    if (!phone?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกเบอร์โทรศัพท์' }, { status: 400 });
    }

    const { users, databases } = getAdminClient();
    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

    // Build new prefs (merge with existing)
    const existing = (currentUser.prefs || {}) as Record<string, string>;
    const newPrefs: Record<string, string> = {
      ...existing,
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      phone:     phone.trim(),
      address:   address || '',
      displayName,
      profileUpdatedAt: new Date().toISOString(), // ใช้ตัดสินว่าโปรไฟล์บัญชีไหนใหม่สุดตอน sync ข้ามช่องทาง login
      // บัญชีธนาคารสำหรับรับเงิน (อัปเดตเฉพาะเมื่อส่งมา)
      ...(bankName     !== undefined ? { bankName:     String(bankName).slice(0, 100) } : {}),
      ...(bankAcct     !== undefined ? { bankAcct:     String(bankAcct).slice(0, 50) } : {}),
      ...(bankOwner    !== undefined ? { bankOwner:    String(bankOwner).slice(0, 100) } : {}),
      ...(bankQrFileId !== undefined ? { bankQrFileId: String(bankQrFileId).slice(0, 255) } : {}),
    };

    // Update Appwrite account name + prefs
    await users.updateName(userId, displayName);
    await users.updatePrefs(userId, newPrefs);

    // Update the profiles collection document if it exists
    try {
      const docs = await databases.listDocuments(DB_ID, COL_ID, [Query.equal('userId', userId)]);
      if (docs.documents.length > 0) {
        await databases.updateDocument(DB_ID, COL_ID, docs.documents[0].$id, {
          firstName: firstName.trim(),
          lastName:  lastName.trim(),
          phone:     phone.trim(),
          address:   address || '',
          displayName,
        });
      }
    } catch {
      // profiles collection doesn't exist yet — non-fatal
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Profile PATCH error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
