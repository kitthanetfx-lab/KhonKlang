import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { syncSellerApplicationLedger } from '../../_lib/financeLedger';

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const status = req.nextUrl.searchParams.get('status');
    let query = db.from('seller_applications').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(200);
    if (status) query = query.eq('status', status);
    const { data, count } = await query;
    return NextResponse.json({ documents: data || [], total: count || 0 });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const { docId, action, reason } = await req.json();
    if (!docId || !action) return NextResponse.json({ error: 'missing params' }, { status: 400 });

    const { data: doc, error: getErr } = await db.from('seller_applications').select('*').eq('id', docId).single();
    if (getErr || !doc) return NextResponse.json({ error: 'ไม่พบใบสมัคร' }, { status: 404 });
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { data: updatedDoc, error } = await db.from('seller_applications').update({
      status: newStatus,
      ...(reason ? { reject_reason: reason } : {}),
    }).eq('id', docId).select().single();
    if (error) throw new Error(error.message);

    // Update profile
    const profileUpdates: Record<string, unknown> = { seller_status: newStatus };
    if (action === 'approve') profileUpdates.role = 'seller';
    await db.from('profiles').update(profileUpdates).eq('id', doc.user_id);

    await syncSellerApplicationLedger(db, updatedDoc as Record<string, unknown>);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
