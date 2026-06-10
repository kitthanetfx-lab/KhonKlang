import { NextRequest, NextResponse } from 'next/server';
import { Client, Account, Databases, Users } from 'node-appwrite';

const DB_ID  = 'khonklang_db';
const COL_ID = 'onsite_jobs';

function adminDb() {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Databases(c);
}
function adminUsers() {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  return new Users(c);
}
function userAccount(jwt: string) {
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await userAccount(jwt).get();
    const doc = await adminDb().getDocument(DB_ID, COL_ID, id);
    return NextResponse.json({ job: doc });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH actions:
//   submit_quote  (middleman): open → quoted
//   accept_quote  (buyer):     quoted → accepted
//   reject_quote  (buyer):     quoted → open (resets middleman)
//   start_work    (middleman): accepted → in_progress
//   complete      (middleman): in_progress → completed
//   cancel        (buyer):     open|quoted → cancelled
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const jwt = req.headers.get('x-session-jwt');
    if (!jwt) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await userAccount(jwt).get();
    const body = await req.json();
    const { action } = body;

    const db = adminDb();
    const usersApi = adminUsers();
    const job = await db.getDocument(DB_ID, COL_ID, id);
    const now = new Date().toISOString();

    // Fetch middleman deposit from user prefs
    async function getDeposit(uid: string): Promise<string> {
      try {
        const u = await usersApi.get(uid);
        const p = (u.prefs || {}) as Record<string, string>;
        const tier = p.middlemanTierIntent || 'Bronze';
        const deposits: Record<string, number> = { Bronze: 1000, Silver: 5000, Gold: 20000, Platinum: 50000 };
        return String(deposits[tier] || 1000);
      } catch { return '1000'; }
    }

    let update: Record<string, string> = {};

    if (action === 'submit_quote') {
      if (job.status !== 'open') return NextResponse.json({ error: 'งานไม่ได้อยู่สถานะ open' }, { status: 400 });
      const { travelFee, serviceFee, estimatedArrival, conditions } = body;
      const deposit = await getDeposit(user.$id);
      let mmName = user.name || '';
      try { const u = await usersApi.get(user.$id); const p = (u.prefs||{}) as Record<string,string>; mmName = p.displayName || u.name || mmName; } catch {}
      update = {
        status: 'quoted',
        middlemanId: user.$id,
        middlemanName: mmName,
        middlemanDeposit: deposit,
        travelFee: String(travelFee || 0),
        serviceFee: String(serviceFee || 0),
        estimatedArrival: estimatedArrival || '',
        conditions: conditions || '',
        quotedAt: now,
      };
    } else if (action === 'accept_quote') {
      if (job.buyerId !== user.$id) return NextResponse.json({ error: 'ไม่ใช่ผู้ว่าจ้าง' }, { status: 403 });
      if (job.status !== 'quoted') return NextResponse.json({ error: 'ยังไม่มีใบเสนอราคา' }, { status: 400 });
      update = { status: 'accepted', acceptedAt: now };
    } else if (action === 'reject_quote') {
      if (job.buyerId !== user.$id) return NextResponse.json({ error: 'ไม่ใช่ผู้ว่าจ้าง' }, { status: 403 });
      update = {
        status: 'open',
        middlemanId: '', middlemanName: '', middlemanDeposit: '0',
        travelFee: '0', serviceFee: '0', estimatedArrival: '', conditions: '', quotedAt: '',
      };
    } else if (action === 'start_work') {
      if (job.middlemanId !== user.$id) return NextResponse.json({ error: 'ไม่ใช่คนกลางที่ได้รับงาน' }, { status: 403 });
      if (job.status !== 'accepted') return NextResponse.json({ error: 'ยังไม่ได้รับการอนุมัติ' }, { status: 400 });
      update = { status: 'in_progress', startedAt: now };
    } else if (action === 'complete') {
      if (job.middlemanId !== user.$id) return NextResponse.json({ error: 'ไม่ใช่คนกลางที่ได้รับงาน' }, { status: 403 });
      if (job.status !== 'in_progress') return NextResponse.json({ error: 'งานยังไม่ได้เริ่มต้น' }, { status: 400 });
      update = { status: 'completed', completedAt: now, reportNotes: body.reportNotes || '' };
    } else if (action === 'cancel') {
      if (job.buyerId !== user.$id) return NextResponse.json({ error: 'ไม่ใช่ผู้ว่าจ้าง' }, { status: 403 });
      if (['completed','in_progress'].includes(job.status as string))
        return NextResponse.json({ error: 'ไม่สามารถยกเลิกได้ในขั้นตอนนี้' }, { status: 400 });
      update = { status: 'cancelled' };
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const updated = await db.updateDocument(DB_ID, COL_ID, id, update);
    return NextResponse.json({ job: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
