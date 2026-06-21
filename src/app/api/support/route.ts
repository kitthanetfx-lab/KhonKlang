import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';
import { getOrCreateThread } from '../_lib/support';

/** GET — ห้องแชทของฉัน (ลูกค้า) พร้อมข้อความล่าสุด */
export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const { data: profile } = await db.from('profiles').select('display_name').eq('id', me.id).maybeSingle();
    const myName = profile?.display_name || 'ลูกค้า';

    let thread = await getOrCreateThread(db, me.id, myName);

    const { data: messages } = await db
      .from('support_messages')
      .select('*')
      .eq('thread_id', me.id)
      .order('created_at', { ascending: true })
      .limit(200);

    // ทำเครื่องหมายอ่านแล้วเฉพาะตอนลูกค้าเปิดดูแชทจริง ๆ (ไม่ใช่ทุกครั้งที่โพลพื้นหลัง)
    if (
      req.nextUrl.searchParams.get('open') === '1'
      && (thread.unread_customer || (thread.last_sender === 'staff' && (!thread.last_read_by_customer_at || thread.last_read_by_customer_at < thread.last_at)))
    ) {
      const now = new Date().toISOString();
      const { data: updated } = await db.from('support_threads').update({
        unread_customer: false,
        last_read_by_customer_at: now,
      }).eq('customer_id', me.id).select().single();
      if (updated) thread = updated;
    }

    return NextResponse.json({ thread, messages: messages || [] });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}

/** POST — ลูกค้าส่งข้อความถึงทีมงาน */
export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const body = await req.json().catch(() => ({}));
    const content = String(body.content || '').trim().slice(0, 2000);
    const imageUrl = String(body.imageUrl || '').trim().slice(0, 500);
    const mimeType = String(body.mimeType || '').trim().slice(0, 60);
    if (!content && !imageUrl) return NextResponse.json({ error: 'กรุณากรอกข้อความหรือแนบรูป' }, { status: 400 });

    const { data: profile } = await db.from('profiles').select('display_name').eq('id', me.id).maybeSingle();
    const myName = profile?.display_name || 'ลูกค้า';
    await getOrCreateThread(db, me.id, myName);

    const now = new Date().toISOString();
    const { data: msg, error } = await db.from('support_messages').insert({
      thread_id: me.id, sender_id: me.id, sender_name: myName, sender_role: 'customer',
      content, image_url: imageUrl, mime_type: mimeType, created_at: now,
    }).select().single();
    if (error) throw new Error(error.message);

    await db.from('support_threads').update({
      customer_name: myName, status: 'open', last_message: content || 'ส่งรูปภาพ', last_at: now,
      last_sender: 'customer', unread_staff: true, updated_at: now,
    }).eq('customer_id', me.id);

    return NextResponse.json({ message: msg });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
