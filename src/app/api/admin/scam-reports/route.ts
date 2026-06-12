import { NextRequest, NextResponse } from 'next/server';
import { Databases, Query } from 'node-appwrite';
import { verifyAdmin, getAdminClient, DB_ID } from '../../admin/_lib';

const COL = 'scam_reports';

/** รายการรายงานคนโกงสำหรับแอดมิน (กรองตามสถานะได้: pending_review / approved / rejected) */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const databases = new Databases(getAdminClient());
    const status = req.nextUrl.searchParams.get('status') || 'pending_review';
    const queries = [Query.orderDesc('createdAt'), Query.limit(200)];
    if (status !== 'all') queries.push(Query.equal('status', status));
    const res = await databases.listDocuments(DB_ID, COL, queries).catch(() => ({ documents: [], total: 0 }));
    return NextResponse.json(res);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}

/** แอดมินอนุมัติ/ปฏิเสธรายงาน */
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const databases = new Databases(getAdminClient());
    const { id, action } = await req.json();
    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'missing params' }, { status: 400 });
    }
    const updated = await databases.updateDocument(DB_ID, COL, id, {
      status: action === 'approve' ? 'approved' : 'rejected',
    });
    return NextResponse.json({ report: updated });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message ?? 'error' }, { status: e.status ?? 500 });
  }
}
