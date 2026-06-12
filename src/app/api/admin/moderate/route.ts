import { NextRequest, NextResponse } from 'next/server';
import { Databases, Query } from 'node-appwrite';
import { verifyAdmin, getAdminClient, DB_ID } from '../../admin/_lib';

/** รวม moderation ของประกาศหา (wanted_posts) และรีวิว (reviews) ในที่เดียว */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = new Databases(getAdminClient());
    const type = req.nextUrl.searchParams.get('type') || 'wanted';
    const col = type === 'reviews' ? 'reviews' : 'wanted_posts';
    const res = await db.listDocuments(DB_ID, col, [Query.orderDesc('createdAt'), Query.limit(200)])
      .catch(() => ({ documents: [], total: 0 }));
    return NextResponse.json(res);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}

/** ลบ/ปิดประกาศหรือรีวิวที่ไม่เหมาะสม */
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = new Databases(getAdminClient());
    const { type, id, action } = await req.json();
    if (!type || !id || !action) return NextResponse.json({ error: 'missing params' }, { status: 400 });

    if (type === 'wanted') {
      if (action === 'remove') {
        await db.updateDocument(DB_ID, 'wanted_posts', id, { status: 'closed' });
        return NextResponse.json({ ok: true });
      }
    }
    if (type === 'reviews') {
      if (action === 'delete') {
        await db.deleteDocument(DB_ID, 'reviews', id);
        return NextResponse.json({ ok: true });
      }
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}
