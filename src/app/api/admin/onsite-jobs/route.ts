import { NextRequest, NextResponse } from 'next/server';
import { Databases, Query, Users } from 'node-appwrite';
import { verifyAdmin, getAdminClient, DB_ID } from '../../admin/_lib';
import { syncOnsiteJobLedger } from '../../_lib/financeLedger';

const COL = 'onsite_jobs';

/** รายการงานนัดออนไซต์สำหรับแอดมิน: ?filter=active | open | completed | cancelled | all */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = new Databases(getAdminClient());
    const filter = req.nextUrl.searchParams.get('filter') || 'active';
    const res = await db.listDocuments(DB_ID, COL, [Query.orderDesc('$createdAt'), Query.limit(200)])
      .catch(() => ({ documents: [], total: 0 }));
    let docs = res.documents as Array<Record<string, unknown>>;
    if (filter === 'open') docs = docs.filter(d => d.status === 'open' || d.status === 'quoted');
    else if (filter === 'active') docs = docs.filter(d => ['accepted', 'in_progress'].includes(String(d.status)));
    else if (filter === 'completed') docs = docs.filter(d => d.status === 'completed');
    else if (filter === 'cancelled') docs = docs.filter(d => d.status === 'cancelled');
    return NextResponse.json({ documents: docs, total: docs.length });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}

/** แอดมินจัดการงานออนไซต์: cancel (ยกเลิก+เหตุผล) / mark_refunded (บันทึกคืนมัดจำ) / complete (ปิดงานแทน) */
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const client = getAdminClient();
    const db = new Databases(client);
    const users = new Users(client);
    const { id, action, note } = await req.json();
    if (!id || !action) return NextResponse.json({ error: 'missing params' }, { status: 400 });

    const job = await db.getDocument(DB_ID, COL, id);
    const now = new Date().toISOString();
    const appendNote = (tag: string) =>
      `${job.reportNotes ? job.reportNotes + ' · ' : ''}[${tag}] ${String(note || '').slice(0, 200)}`.slice(0, 480);

    if (action === 'cancel') {
      const updated = await db.updateDocument(DB_ID, COL, id, { status: 'cancelled', reportNotes: appendNote('แอดมินยกเลิก') });
      await syncOnsiteJobLedger(db, users, updated as unknown as Record<string, unknown>);
      return NextResponse.json({ job: updated });
    }
    if (action === 'mark_refunded') {
      const updated = await db.updateDocument(DB_ID, COL, id, { reportNotes: appendNote('คืนมัดจำแล้ว') });
      await syncOnsiteJobLedger(db, users, updated as unknown as Record<string, unknown>);
      return NextResponse.json({ job: updated });
    }
    if (action === 'complete') {
      const updated = await db.updateDocument(DB_ID, COL, id, { status: 'completed', completedAt: now, reportNotes: appendNote('แอดมินปิดงาน') });
      await syncOnsiteJobLedger(db, users, updated as unknown as Record<string, unknown>);
      return NextResponse.json({ job: updated });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}
