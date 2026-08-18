import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const body = await req.json();

    const reportId = String(body.reportId || '').trim();
    if (!reportId) return NextResponse.json({ error: 'ไม่พบรายงานที่อ้างถึง' }, { status: 400 });

    const { data: report } = await db
      .from('scam_reports')
      .select('id, status')
      .eq('id', reportId)
      .neq('status', 'rejected')
      .maybeSingle();
    if (!report) return NextResponse.json({ error: 'ไม่พบรายงานนี้ หรือถูกถอนแล้ว' }, { status: 404 });

    const appellantName = String(body.appellantName || '').trim().slice(0, 120);
    if (!appellantName) return NextResponse.json({ error: 'กรุณากรอกชื่อ-นามสกุล' }, { status: 400 });

    const statement = String(body.statement || '').trim().slice(0, 5000);
    if (statement.length < 30) {
      return NextResponse.json({ error: 'กรุณาชี้แจงอย่างน้อย 30 ตัวอักษร' }, { status: 400 });
    }

    const contactPhone = String(body.contactPhone || '').trim().slice(0, 30);
    const contactLine = String(body.contactLine || '').trim().slice(0, 100);
    const contactEmail = String(body.contactEmail || '').trim().slice(0, 200);
    if (!contactPhone && !contactLine && !contactEmail) {
      return NextResponse.json({ error: 'กรุณากรอกช่องทางติดต่ออย่างน้อย 1 ช่อง' }, { status: 400 });
    }

    const evidenceImageIds: string[] = (Array.isArray(body.evidenceImageIds) ? body.evidenceImageIds : [])
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      .slice(0, 10);

    const { data: doc, error } = await db.from('scam_report_appeals').insert({
      report_id: reportId,
      appellant_id: me.id,
      appellant_name: appellantName,
      contact_phone: contactPhone || null,
      contact_line: contactLine || null,
      contact_email: contactEmail || null,
      statement,
      evidence_image_ids: evidenceImageIds,
      status: 'pending_review',
    }).select('id').single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ appeal: { id: doc.id } });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return NextResponse.json({ error: e.message || String(err) }, { status: e.status || 500 });
  }
}
