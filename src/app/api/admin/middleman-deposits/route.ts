import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { syncMiddlemanDepositLedger } from '../../_lib/financeLedger';

/** GET — admin ดูรายการแจ้งโอนเงินค้ำประกันคนกลางทั้งหมด (กรองสถานะได้) */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const status = req.nextUrl.searchParams.get('status');

    let query = db.from('middleman_deposits').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(200);
    if (status) query = query.eq('status', status);
    const { data, count } = await query;

    const middlemanIds = Array.from(new Set((data || []).map(d => d.middleman_id).filter(Boolean)));
    let profilesById: Record<string, { display_name?: string; phone?: string; middleman_tier?: string }> = {};
    if (middlemanIds.length) {
      const { data: profiles } = await db.from('profiles').select('id, display_name, phone, middleman_tier').in('id', middlemanIds);
      profilesById = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    }

    const documents = (data || []).map(d => ({ ...d, middleman: profilesById[d.middleman_id] || null }));
    return NextResponse.json({ documents, total: count || 0 });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status });
  }
}

/** PATCH — admin อนุมัติ/ปฏิเสธรายการโอนเงินค้ำประกัน — อนุมัติแล้วเครดิตจึงจะถูกปลดให้คนกลางจริง */
export async function PATCH(req: NextRequest) {
  try {
    const adminId = await verifyAdmin(req);
    const db = getAdminClient();
    const { docId, action, reason } = await req.json();
    if (!docId || !action) return NextResponse.json({ error: 'missing params' }, { status: 400 });

    const { data: doc, error: getErr } = await db.from('middleman_deposits').select('*').eq('id', docId).single();
    if (getErr || !doc) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 });

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { data: updatedDoc, error } = await db.from('middleman_deposits').update({
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
      ...(reason ? { reject_reason: reason } : {}),
    }).eq('id', docId).select().single();
    if (error) throw new Error(error.message);

    await syncMiddlemanDepositLedger(db, updatedDoc as Record<string, unknown>);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status });
  }
}
