import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';

const APPEAL_STATUSES = new Set(['pending_review', 'approved', 'rejected', 'all']);

/** รายการอุธรณ์คำชี้แจงสำหรับแอดมิน */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const status = req.nextUrl.searchParams.get('status') || 'pending_review';
    if (!APPEAL_STATUSES.has(status)) {
      return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
    }

    let query = db
      .from('scam_report_appeals')
      .select(`
        *,
        report:scam_reports(
          id, first_name, last_name, bank_accounts, product, amount,
          seller_page, province, detail, status,
          slip_image_ids, chat_image_ids, police_doc_ids, created_at
        )
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ documents: data || [], total: (data || []).length });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

/** แอดมินพิจารณาอุธรณ์ — accept = ถอนรายงานออกจากฐานข้อมูลสาธารณะ */
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const { id, action } = await req.json();

    if (!id || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const { data: appeal, error: fetchErr } = await db
      .from('scam_report_appeals')
      .select('id, report_id, status')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!appeal) return NextResponse.json({ error: 'ไม่พบคำอุธรณ์' }, { status: 404 });
    if (appeal.status !== 'pending_review') {
      return NextResponse.json({ error: 'คำอุธรณ์นี้พิจารณาแล้ว' }, { status: 400 });
    }

    const appealStatus = action === 'accept' ? 'approved' : 'rejected';
    const { error: appealErr } = await db
      .from('scam_report_appeals')
      .update({ status: appealStatus })
      .eq('id', id);
    if (appealErr) throw new Error(appealErr.message);

    if (action === 'accept') {
      const { error: reportErr } = await db
        .from('scam_reports')
        .update({ status: 'rejected' })
        .eq('id', appeal.report_id);
      if (reportErr) throw new Error(reportErr.message);
    }

    return NextResponse.json({ ok: true, action, appealId: id, reportId: appeal.report_id });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
