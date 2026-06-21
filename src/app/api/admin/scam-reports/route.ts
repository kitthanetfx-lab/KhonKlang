import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';

/** รายการรายงานคนโกงสำหรับแอดมิน (กรองตามสถานะได้: pending_review / approved / rejected) */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const status = req.nextUrl.searchParams.get('status') || 'pending_review';
    let query = db.from('scam_reports').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(200);
    if (status !== 'all') query = query.eq('status', status);
    const { data, count } = await query;
    return NextResponse.json({ documents: data || [], total: count || 0 });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

/** แอดมินอนุมัติ/ปฏิเสธรายงาน */
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const { id, action } = await req.json();
    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'missing params' }, { status: 400 });
    }
    const { data: updated, error } = await db.from('scam_reports').update({
      status: action === 'approve' ? 'approved' : 'rejected',
    }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ report: updated });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
