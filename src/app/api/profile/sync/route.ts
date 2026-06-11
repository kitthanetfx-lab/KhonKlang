import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Users, Query } from 'node-appwrite';

/**
 * Sync โปรไฟล์ข้ามช่องทาง login — ผู้ใช้อีเมลเดียวกัน (LINE/Google/Facebook)
 * คือสมาชิกคนเดียวกัน โปรไฟล์ที่กรอกไว้ต้องเหมือนกันทุกบัญชี
 * วิธี: หาบัญชีทั้งหมดที่อีเมลตรงกัน → เลือกโปรไฟล์ที่อัปเดตล่าสุด/สมบูรณ์สุด → ทาทับให้ทุกบัญชี
 */

// field โปรไฟล์ที่ sync ข้ามบัญชี (ไม่รวมคะแนนรีวิว — ผูกกับ userId ของแต่ละบัญชี)
const SYNC_KEYS = [
  'firstName', 'lastName', 'displayName', 'phone', 'address',
  'bankAccountName', 'bankName', 'accountNumber', 'bankAcct', 'bankOwner',
  'role', 'sellerStatus', 'middlemanStatus', 'profileUpdatedAt',
] as const;

function getAdmin() {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Users(c);
}

function getUserFromJwt(jwt: string) {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c).get();
}

type Prefs = Record<string, string>;
const filledCount = (p: Prefs) => SYNC_KEYS.filter(k => (p[k] || '').trim()).length;

export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const me = await getUserFromJwt(jwt);
    if (!me.email) return NextResponse.json({ synced: false, reason: 'no-email' });

    const users = getAdmin();
    const list = await users.list([Query.equal('email', me.email), Query.limit(10)]).catch(() => ({ users: [] as { $id: string; email: string; prefs: object }[] }));
    const accounts = (list.users as { $id: string; email: string; prefs: object }[]).filter(u => u.email === me.email);
    if (accounts.length < 2) return NextResponse.json({ synced: false, reason: 'single-account' });

    // เลือกโปรไฟล์ "ตัวจริง": อัปเดตล่าสุดก่อน ถ้าไม่มี timestamp ใช้ตัวที่กรอกครบสุด
    const best = [...accounts].sort((a, b) => {
      const pa = (a.prefs || {}) as Prefs, pb = (b.prefs || {}) as Prefs;
      const ta = pa.profileUpdatedAt || '', tb = pb.profileUpdatedAt || '';
      if (ta !== tb) return tb.localeCompare(ta);
      return filledCount(pb) - filledCount(pa);
    })[0];
    const bestPrefs = (best.prefs || {}) as Prefs;
    const subset: Prefs = {};
    for (const k of SYNC_KEYS) if (bestPrefs[k]) subset[k] = bestPrefs[k];
    if (Object.keys(subset).length === 0) return NextResponse.json({ synced: false, reason: 'empty-profile' });

    let updatedMe = false;
    await Promise.all(accounts.map(async acc => {
      const cur = (acc.prefs || {}) as Prefs;
      const differs = SYNC_KEYS.some(k => (subset[k] || '') !== (cur[k] || '') && subset[k]);
      if (!differs) return;
      await users.updatePrefs(acc.$id, { ...cur, ...subset }).catch(() => null);
      if (subset.displayName) await users.updateName(acc.$id, subset.displayName).catch(() => null);
      if (acc.$id === me.$id) updatedMe = true;
    }));

    return NextResponse.json({ synced: true, updated: updatedMe, accounts: accounts.length });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
