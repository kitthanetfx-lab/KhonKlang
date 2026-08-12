import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyUsers } from '../../../_lib/notify';
import { verifyAdmin, getAdminClient } from '../../_lib';
import { newCallId } from '../../../_lib/support';

async function getStaffName(db: SupabaseClient, staffId: string) {
  const { data } = await db.from('profiles').select('display_name').eq('id', staffId).maybeSingle();
  return data?.display_name || 'พนักงาน';
}

async function logSystem(db: SupabaseClient, threadId: string, content: string) {
  await db.from('support_messages').insert({
    thread_id: threadId, sender_id: 'system', sender_name: 'ระบบ', sender_role: 'system',
    content, created_at: new Date().toISOString(),
  });
}

/**
 * ฝั่งพนักงาน — โทรออกตรง / อนุมัติ-ปฏิเสธคำขอของลูกค้า / วางสาย
 * action: 'call' | 'approve' | 'active' | 'decline' | 'hangup'
 * เงื่อนไข: พนักงานคนใดก็ได้กดรับคำขอได้ (เผื่อพนักงานคนอื่นไม่อยู่/ติดสาย)
 */
export async function POST(req: NextRequest) {
  try {
    const staffId = await verifyAdmin(req);
    const body = await req.json().catch(() => ({}));
    const customerId = String(body.customerId || '').trim();
    const action = String(body.action || '');
    if (!customerId) return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 400 });

    const db = getAdminClient();
    const { data: thread } = await db.from('support_threads').select('*').eq('customer_id', customerId).maybeSingle();
    if (!thread) return NextResponse.json({ error: 'ไม่พบห้องแชท' }, { status: 404 });
    const staffName = await getStaffName(db, staffId);
    const now = new Date().toISOString();

    if (action === 'call') {
      if (thread.call_status !== 'idle' && thread.call_status !== 'ended') {
        return NextResponse.json({ error: 'มีสาย/คำขออยู่แล้ว' }, { status: 409 });
      }
      const callId = newCallId();
      await db.from('support_threads').update({
        call_status: 'staff_ringing', call_id: callId, call_initiator: 'staff',
        call_staff_id: staffId, call_staff_name: staffName, call_updated_at: now, updated_at: now,
      }).eq('customer_id', customerId);
      await logSystem(db, customerId, `พนักงาน ${staffName} กำลังโทรหาลูกค้า`);
      await notifyUsers(db, [customerId], {
        title: '📞 ทีมงานกำลังโทรหาคุณ',
        body: `${staffName} โทรจากกลางฮับ — กดเพื่อเปิดแชทและรับสาย`,
        link: '/?support=1',
        kind: 'call',
        data: { type: 'support_call', callerName: staffName },
      });
      return NextResponse.json({ ok: true, callId });
    }

    if (action === 'approve') {
      if (thread.call_status !== 'customer_requesting') return NextResponse.json({ error: 'ไม่มีคำขอโทรรอดำเนินการ' }, { status: 409 });
      await db.from('support_threads').update({
        call_status: 'connecting', call_staff_id: staffId, call_staff_name: staffName, call_updated_at: now, updated_at: now,
      }).eq('customer_id', customerId);
      await logSystem(db, customerId, `พนักงาน ${staffName} รับคำขอโทรกลับและกำลังเชื่อมต่อเสียง`);
      await notifyUsers(db, [customerId], {
        title: '📞 พนักงานรับคำขอโทรกลับแล้ว',
        body: `${staffName} กำลังเชื่อมต่อ — เปิดแชทเพื่อรับสาย`,
        link: '/?support=1',
      });
      return NextResponse.json({ ok: true, callId: thread.call_id, callStatus: 'connecting' });
    }

    if (action === 'active') {
      if (!['connecting', 'staff_ringing', 'active'].includes(thread.call_status)) return NextResponse.json({ ok: true });
      await db.from('support_threads').update({
        call_status: 'active', call_staff_id: staffId, call_staff_name: staffName, call_updated_at: now, updated_at: now,
      }).eq('customer_id', customerId);
      return NextResponse.json({ ok: true, callId: thread.call_id, callStatus: 'active' });
    }

    if (action === 'decline') {
      if (thread.call_status !== 'customer_requesting') return NextResponse.json({ ok: true });
      await db.from('support_threads').update({ call_status: 'ended', call_updated_at: now, updated_at: now }).eq('customer_id', customerId);
      await logSystem(db, customerId, `พนักงาน ${staffName} ไม่สามารถรับสายได้ในขณะนี้`);
      return NextResponse.json({ ok: true });
    }

    if (action === 'hangup') {
      if (thread.call_status === 'idle' || thread.call_status === 'ended') return NextResponse.json({ ok: true });
      await db.from('support_threads').update({ call_status: 'ended', call_updated_at: now, updated_at: now }).eq('customer_id', customerId);
      await logSystem(db, customerId, `พนักงาน ${staffName} วางสาย`);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'ไม่รู้จักคำสั่ง' }, { status: 400 });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
