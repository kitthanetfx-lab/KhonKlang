import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { notifyUsers } from '../../_lib/notify';
import { syncOnsiteJobLedger } from '../../_lib/financeLedger';

function onsiteLabel(job: Record<string, unknown>): string {
  const desc = String(job.item_description || 'งานออนไซต์');
  return desc.length > 60 ? `${desc.slice(0, 60)}…` : desc;
}

/** รายการงานนัดออนไซต์สำหรับแอดมิน: ?filter=active | open | completed | cancelled | all */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const filter = req.nextUrl.searchParams.get('filter') || 'active';
    const { data } = await db.from('onsite_jobs').select('*').order('created_at', { ascending: false }).limit(200);
    let docs = data || [];
    if (filter === 'open') docs = docs.filter(d => d.status === 'open' || d.status === 'quoted');
    else if (filter === 'active') docs = docs.filter(d => ['accepted', 'in_progress'].includes(String(d.status)));
    else if (filter === 'completed') docs = docs.filter(d => d.status === 'completed');
    else if (filter === 'cancelled') docs = docs.filter(d => d.status === 'cancelled');
    return NextResponse.json({ documents: docs, total: docs.length });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}

/** แอดมินจัดการงานออนไซต์: cancel (ยกเลิก+เหตุผล) / mark_refunded (บันทึกคืนมัดจำ) / complete (ปิดงานแทน) */
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();
    const { id, action, note } = await req.json();
    if (!id || !action) return NextResponse.json({ error: 'missing params' }, { status: 400 });

    const { data: job, error: getErr } = await db.from('onsite_jobs').select('*').eq('id', id).single();
    if (getErr || !job) return NextResponse.json({ error: 'ไม่พบงาน' }, { status: 404 });
    const now = new Date().toISOString();
    const appendNote = (tag: string) =>
      `${job.report_notes ? job.report_notes + ' · ' : ''}[${tag}] ${String(note || '').slice(0, 200)}`.slice(0, 480);

    if (action === 'cancel') {
      const { data: updated } = await db.from('onsite_jobs').update({ status: 'cancelled', report_notes: appendNote('แอดมินยกเลิก') }).eq('id', id).select().single();
      await syncOnsiteJobLedger(db, updated as Record<string, unknown>);
      if (updated) {
        const label = onsiteLabel(updated as Record<string, unknown>);
        const recipients = [updated.buyer_id, updated.middleman_id].filter((x): x is string => typeof x === 'string' && !!x);
        if (recipients.length) {
          await notifyUsers(db, recipients, {
            title: '❌ แอดมินยกเลิกงานออนไซต์',
            body: `งาน "${label}" ถูกยกเลิกโดยทีมงาน`,
            link: `/onsite/${id}`,
          });
        }
      }
      return NextResponse.json({ job: updated });
    }
    if (action === 'mark_refunded') {
      const { data: updated } = await db.from('onsite_jobs').update({ report_notes: appendNote('คืนมัดจำแล้ว') }).eq('id', id).select().single();
      await syncOnsiteJobLedger(db, updated as Record<string, unknown>);
      if (updated?.buyer_id) {
        await notifyUsers(db, [updated.buyer_id as string], {
          title: '💰 คืนมัดจำงานออนไซต์แล้ว',
          body: `งาน "${onsiteLabel(updated as Record<string, unknown>)}" — ตรวจสอบรายละเอียดในหน้างาน`,
          link: `/onsite/${id}`,
        });
      }
      return NextResponse.json({ job: updated });
    }
    if (action === 'complete') {
      const { data: updated } = await db.from('onsite_jobs').update({ status: 'completed', completed_at: now, report_notes: appendNote('แอดมินปิดงาน') }).eq('id', id).select().single();
      await syncOnsiteJobLedger(db, updated as Record<string, unknown>);
      if (updated) {
        const label = onsiteLabel(updated as Record<string, unknown>);
        const recipients = [updated.buyer_id, updated.middleman_id].filter((x): x is string => typeof x === 'string' && !!x);
        if (recipients.length) {
          await notifyUsers(db, recipients, {
            title: '🎉 แอดมินปิดงานออนไซต์แล้ว',
            body: `งาน "${label}" เสร็จสมบูรณ์`,
            link: `/onsite/${id}`,
          });
        }
      }
      return NextResponse.json({ job: updated });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
