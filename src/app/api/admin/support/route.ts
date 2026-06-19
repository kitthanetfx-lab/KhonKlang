import { NextRequest, NextResponse } from 'next/server';
import { Account, Client, Databases, ID, Query } from 'node-appwrite';
import { verifyAdmin, getAdminClient, DB_ID } from '../_lib';
import { COL_THREADS, COL_MESSAGES, ensureSupportCollections } from '../../_lib/support';

async function getAdminName(req: NextRequest, id: string) {
  try {
    const jwt = req.headers.get('x-session-jwt')!;
    const c = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setJWT(jwt);
    const u = await new Account(c).get();
    return ((u.prefs || {}) as Record<string, string>).displayName || u.name || 'พนักงาน';
  } catch { return id; }
}

/**
 * GET (ไม่มี ?with) — รายชื่อห้องแชททั้งหมด เรียงจากอัปเดตล่าสุด
 * GET ?with=customerId — ข้อความในห้องนั้น (ทำเครื่องหมายอ่านแล้วฝั่งพนักงาน)
 */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = new Databases(getAdminClient());
    await ensureSupportCollections(db);

    const withId = req.nextUrl.searchParams.get('with') || '';
    if (withId) {
      const r = await db.listDocuments(DB_ID, COL_MESSAGES, [
        Query.equal('threadId', withId), Query.orderAsc('createdAt'), Query.limit(300),
      ]).catch(() => ({ documents: [] as unknown[] }));
      const thread = await db.getDocument(DB_ID, COL_THREADS, withId).catch(() => null);
      if (thread?.unreadStaff) await db.updateDocument(DB_ID, COL_THREADS, withId, { unreadStaff: false }).catch(() => null);
      return NextResponse.json({ thread, messages: r.documents });
    }

    const r = await db.listDocuments(DB_ID, COL_THREADS, [Query.orderDesc('updatedAt'), Query.limit(200)])
      .catch(() => ({ documents: [] as unknown[] }));
    return NextResponse.json({ threads: r.documents });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}

/** POST — พนักงานส่งข้อความถึงลูกค้า {customerId, content} */
export async function POST(req: NextRequest) {
  try {
    const staffId = await verifyAdmin(req);
    const body = await req.json().catch(() => ({}));
    const customerId = String(body.customerId || '').trim();
    const content = String(body.content || '').trim().slice(0, 2000);
    const imageUrl = String(body.imageUrl || '').trim().slice(0, 500);
    const mimeType = String(body.mimeType || '').trim().slice(0, 60);
    if (!customerId || (!content && !imageUrl)) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const db = new Databases(getAdminClient());
    await ensureSupportCollections(db);
    const staffName = await getAdminName(req, staffId);
    const now = new Date().toISOString();

    const msg = await db.createDocument(DB_ID, COL_MESSAGES, ID.unique(), {
      threadId: customerId, senderId: staffId, senderName: staffName, senderRole: 'staff',
      content, imageUrl, mimeType, createdAt: now,
    });
    await db.updateDocument(DB_ID, COL_THREADS, customerId, {
      lastMessage: content || 'ส่งรูปภาพ', lastAt: now, lastSender: 'staff', unreadCustomer: true,
      assignedStaffId: staffId, assignedStaffName: staffName, updatedAt: now,
    }).catch(() => null);

    return NextResponse.json({ message: msg });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}

/** PATCH — ปิด/เปิดห้องแชท {customerId, status:'open'|'closed'} */
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const body = await req.json().catch(() => ({}));
    const customerId = String(body.customerId || '').trim();
    const status = String(body.status || '');
    if (!customerId || !['open', 'closed'].includes(status)) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const db = new Databases(getAdminClient());
    await ensureSupportCollections(db);
    await db.updateDocument(DB_ID, COL_THREADS, customerId, { status, updatedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
