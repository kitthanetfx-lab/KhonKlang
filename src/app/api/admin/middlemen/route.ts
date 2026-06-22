import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { getMiddlemanWallet, syncMiddlemanApplicationLedger } from '../../_lib/financeLedger';

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const status = req.nextUrl.searchParams.get('status');
    let query = db.from('middleman_applications').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(200);
    if (status) query = query.eq('status', status);
    const { data, count } = await query;
    const documents = await Promise.all((data || []).map(async doc => {
      if (doc.status !== 'approved' || !doc.user_id) return doc;
      const wallet = await getMiddlemanWallet(db, String(doc.user_id)).catch(() => null);
      return { ...doc, wallet };
    }));
    return NextResponse.json({ documents, total: count || 0 });
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

    const { data: doc, error: getErr } = await db.from('middleman_applications').select('*').eq('id', docId).single();
    if (getErr || !doc) return NextResponse.json({ error: 'ไม่พบใบสมัคร' }, { status: 404 });
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { data: updatedDoc, error } = await db.from('middleman_applications').update({
      status: newStatus,
      ...(reason ? { reject_reason: reason } : {}),
    }).eq('id', docId).select().single();
    if (error) throw new Error(error.message);

    // Update profile — หมายเหตุ: ไม่ set middleman_tier ตรงนี้แล้ว เพราะ tier ต้องคำนวณจากยอดเงินค้ำประกัน
    // จริงที่โอนเข้ามาและ admin อนุมัติแล้วเท่านั้น (ดู syncMiddlemanWallet) ไม่ใช่ตามที่ self-declare ไว้ตอนสมัคร
    const profileUpdates: Record<string, unknown> = { middleman_status: newStatus };
    if (action === 'approve') {
      profileUpdates.role = 'middleman';
    }
    await db.from('profiles').update(profileUpdates).eq('id', doc.user_id);

    await syncMiddlemanApplicationLedger(db, updatedDoc as Record<string, unknown>);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
