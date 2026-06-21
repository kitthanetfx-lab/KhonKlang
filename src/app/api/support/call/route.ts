import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';
import { getOrCreateThread, newCallId } from '../../_lib/support';

async function logSystem(db: SupabaseClient, threadId: string, content: string) {
  await db.from('support_messages').insert({
    thread_id: threadId, sender_id: 'system', sender_name: 'ระบบ', sender_role: 'system',
    content, created_at: new Date().toISOString(),
  }).then(() => null).catch(() => null);
}

/**
 * ฝั่งลูกค้า — ขอให้พนักงานโทรกลับ / ยกเลิกคำขอ / รับ-ปฏิเสธสายที่พนักงานโทรมา / วางสาย
 * action: 'request' | 'cancel' | 'answer' | 'active' | 'decline' | 'hangup'
 */
export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    const db = getAdminClient();
    const { data: profile } = await db.from('profiles').select('display_name').eq('id', me.id).maybeSingle();
    const myName = profile?.display_name || 'ลูกค้า';
    const thread = await getOrCreateThread(db, me.id, myName);
    const now = new Date().toISOString();

    if (action === 'request') {
      if (thread.call_status !== 'idle' && thread.call_status !== 'ended') {
        return NextResponse.json({ error: 'มีการขอโทรอยู่แล้ว' }, { status: 409 });
      }
      const callId = newCallId();
      await db.from('support_threads').update({
        call_status: 'customer_requesting', call_id: callId, call_initiator: 'customer',
        call_staff_id: '', call_staff_name: '', call_updated_at: now, updated_at: now,
      }).eq('customer_id', me.id);
      await logSystem(db, me.id, 'ลูกค้าขอให้พนักงานโทรกลับ');
      return NextResponse.json({ ok: true, callId, callStatus: 'customer_requesting' });
    }

    if (action === 'cancel') {
      if (thread.call_status !== 'customer_requesting') return NextResponse.json({ ok: true });
      await db.from('support_threads').update({ call_status: 'ended', call_updated_at: now, updated_at: now }).eq('customer_id', me.id);
      await logSystem(db, me.id, 'ลูกค้ายกเลิกคำขอโทร');
      return NextResponse.json({ ok: true });
    }

    if (action === 'answer') {
      if (thread.call_status !== 'staff_ringing') return NextResponse.json({ error: 'ไม่มีสายเข้า' }, { status: 409 });
      await db.from('support_threads').update({ call_status: 'connecting', call_updated_at: now, updated_at: now }).eq('customer_id', me.id);
      await logSystem(db, me.id, 'ลูกค้ารับสายแล้ว — กำลังเชื่อมต่อเสียง');
      return NextResponse.json({ ok: true, callId: thread.call_id, callStatus: 'connecting' });
    }

    if (action === 'active') {
      if (!['connecting', 'staff_ringing', 'active'].includes(thread.call_status)) return NextResponse.json({ ok: true });
      await db.from('support_threads').update({ call_status: 'active', call_updated_at: now, updated_at: now }).eq('customer_id', me.id);
      return NextResponse.json({ ok: true, callId: thread.call_id, callStatus: 'active' });
    }

    if (action === 'decline') {
      if (thread.call_status !== 'staff_ringing') return NextResponse.json({ ok: true });
      await db.from('support_threads').update({ call_status: 'ended', call_updated_at: now, updated_at: now }).eq('customer_id', me.id);
      await logSystem(db, me.id, 'ลูกค้าปฏิเสธสาย');
      return NextResponse.json({ ok: true });
    }

    if (action === 'hangup') {
      if (thread.call_status === 'idle' || thread.call_status === 'ended') return NextResponse.json({ ok: true });
      await db.from('support_threads').update({ call_status: 'ended', call_updated_at: now, updated_at: now }).eq('customer_id', me.id);
      await logSystem(db, me.id, 'ลูกค้าวางสาย');
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'ไม่รู้จักคำสั่ง' }, { status: 400 });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
