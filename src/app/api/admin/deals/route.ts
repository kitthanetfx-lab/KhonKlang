import { NextRequest, NextResponse } from 'next/server';
import { Databases, Query } from 'node-appwrite';
import { verifyAdmin, getAdminClient, DB_ID } from '../../admin/_lib';

const COL = 'deals';

/** รายการดีลสำหรับแอดมิน: ?filter=disputed | active | completed | meetup_refund | all */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = new Databases(getAdminClient());
    const filter = req.nextUrl.searchParams.get('filter') || 'disputed';
    const queries = [Query.orderDesc('createdAt'), Query.limit(200)];
    if (filter === 'disputed') queries.push(Query.equal('status', 'disputed'));
    else if (filter === 'completed') queries.push(Query.equal('status', 'completed'));
    else if (filter === 'meetup_refund') queries.push(Query.equal('dealType', 'meetup'), Query.equal('status', 'completed'));
    else if (filter === 'active') queries.push(Query.notEqual('status', 'completed'));
    const res = await db.listDocuments(DB_ID, COL, queries).catch(() => ({ documents: [], total: 0 }));
    return NextResponse.json(res);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}

/** แอดมินดำเนินการกับดีล: resolve_dispute (ตัดสินข้อพิพาท) / mark_refunded (คืนเงินประกัน meetup) */
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = new Databases(getAdminClient());
    const { id, action, note } = await req.json();
    if (!id || !action) return NextResponse.json({ error: 'missing params' }, { status: 400 });

    const deal = await db.getDocument(DB_ID, COL, id);

    if (action === 'resolve_dispute') {
      if (deal.status !== 'disputed') return NextResponse.json({ error: 'ดีลนี้ไม่ได้อยู่ในข้อพิพาท' }, { status: 400 });
      const updated = await db.updateDocument(DB_ID, COL, id, {
        status: 'completed',
        rejectReason: `[แอดมินตัดสิน] ${String(note || '').slice(0, 400)}`,
      });
      return NextResponse.json({ deal: updated });
    }

    if (action === 'cancel_refund') {
      const updated = await db.updateDocument(DB_ID, COL, id, {
        status: 'cancelled',
        rejectReason: `[แอดมินยกเลิก+คืนเงิน] ${String(note || '').slice(0, 400)}`,
      });
      return NextResponse.json({ deal: updated });
    }

    if (action === 'mark_refunded') {
      // บันทึกว่าโอนเงินประกัน meetup คืนแล้ว ลงใน meetupData
      const md = (() => { try { return JSON.parse(deal.meetupData || '{}'); } catch { return {}; } })();
      md.refundedAt = new Date().toISOString();
      md.refundNote = String(note || '').slice(0, 200);
      const updated = await db.updateDocument(DB_ID, COL, id, { meetupData: JSON.stringify(md) });
      return NextResponse.json({ deal: updated });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}
