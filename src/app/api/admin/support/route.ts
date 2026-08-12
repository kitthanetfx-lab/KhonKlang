import { NextRequest, NextResponse } from 'next/server';
import { notifyUsers } from '../../_lib/notify';
import { verifyAdmin, getAdminClient } from '../_lib';

async function getStaffName(db: ReturnType<typeof getAdminClient>, staffId: string) {
  const { data } = await db.from('profiles').select('display_name').eq('id', staffId).maybeSingle();
  return data?.display_name || 'พนักงาน';
}

/**
 * GET (ไม่มี ?with) — รายชื่อห้องแชททั้งหมด เรียงจากอัปเดตล่าสุด
 * GET ?with=customerId — ข้อความในห้องนั้น (ทำเครื่องหมายอ่านแล้วฝั่งพนักงาน)
 */
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const db = getAdminClient();

    const withId = req.nextUrl.searchParams.get('with') || '';
    if (withId) {
      const { data: messages } = await db
        .from('support_messages')
        .select('*')
        .eq('thread_id', withId)
        .order('created_at', { ascending: true })
        .limit(300);

      let { data: thread } = await db.from('support_threads').select('*').eq('customer_id', withId).maybeSingle();
      if (thread && (thread.unread_staff || (thread.last_sender === 'customer' && (!thread.last_read_by_staff_at || thread.last_read_by_staff_at < thread.last_at)))) {
        const now = new Date().toISOString();
        const { data: updated } = await db.from('support_threads').update({
          unread_staff: false,
          last_read_by_staff_at: now,
        }).eq('customer_id', withId).select().single();
        if (updated) thread = updated;
      }
      return NextResponse.json({ thread, messages: messages || [] });
    }

    const { data: threads } = await db.from('support_threads').select('*').order('updated_at', { ascending: false }).limit(200);
    return NextResponse.json({ threads: threads || [] });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}

/** POST — พนักงานส่งข้อความถึงลูกค้า {customerId, content} */
export async function POST(req: NextRequest) {
  try {
    const staffId = await verifyAdmin(req);
    const body = await req.json().catch(() => ({}));
    const customerId = String(body.customerId || '').trim();
    const content = String(body.content || '').trim().slice(0, 2000);
    const imageUrl = String(body.imageUrl || '').trim().slice(0, 500);
    const mimeType = String(body.mimeType || '').trim().slice(0, 60);
    if (!customerId || (!content && !imageUrl)) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const db = getAdminClient();
    const staffName = await getStaffName(db, staffId);
    const now = new Date().toISOString();

    const { data: msg, error } = await db.from('support_messages').insert({
      thread_id: customerId, sender_id: staffId, sender_name: staffName, sender_role: 'staff',
      content, image_url: imageUrl, mime_type: mimeType, created_at: now,
    }).select().single();
    if (error) throw new Error(error.message);

    await db.from('support_threads').update({
      last_message: content || 'ส่งรูปภาพ', last_at: now, last_sender: 'staff', unread_customer: true,
      assigned_staff_id: staffId, assigned_staff_name: staffName, updated_at: now,
    }).eq('customer_id', customerId);

    const preview = imageUrl ? '📷 ส่งรูปภาพ' : content.slice(0, 100);
    await notifyUsers(db, [customerId], {
      title: `💬 ${staffName} (ทีมงาน)`,
      body: preview,
      link: '/?support=1',
    });

    return NextResponse.json({ message: msg });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}

/** PATCH — ปิด/เปิดห้องแชท {customerId, status:'open'|'closed'} */
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const body = await req.json().catch(() => ({}));
    const customerId = String(body.customerId || '').trim();
    const status = String(body.status || '');
    if (!customerId || !['open', 'closed'].includes(status)) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });

    const db = getAdminClient();
    await db.from('support_threads').update({ status, updated_at: new Date().toISOString() }).eq('customer_id', customerId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
