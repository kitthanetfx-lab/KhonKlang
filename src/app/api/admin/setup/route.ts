/**
 * POST /api/admin/setup
 * ตั้งค่า role = 'admin' ให้กับ user ที่ call endpoint นี้
 * ใช้ได้เฉพาะเมื่อยังไม่มี admin คนอื่นในระบบ (ป้องกัน privilege escalation)
 */
import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Users } from 'node-appwrite';

function getAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Users(client);
}

export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });

    // Verify the caller
    const sessionClient = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setJWT(jwt);
    const currentUser = await new Account(sessionClient).get();
    const userId = currentUser.$id;

    const users = getAdminClient();

    // Guard: list up to 100 users and check if any admin already exists
    const list = await users.list();
    const existingAdmin = list.users.find(u => {
      const prefs = (u.prefs || {}) as Record<string, string>;
      return prefs.role === 'admin';
    });

    if (existingAdmin && existingAdmin.$id !== userId) {
      return NextResponse.json(
        { error: 'มี Admin อยู่แล้วในระบบ ไม่สามารถใช้ setup ได้อีก' },
        { status: 403 }
      );
    }

    // Set role = admin
    const existing = (currentUser.prefs || {}) as Record<string, string>;
    await users.updatePrefs(userId, { ...existing, role: 'admin' });

    return NextResponse.json({ success: true, message: 'ตั้งค่า Admin สำเร็จ' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Admin setup error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
