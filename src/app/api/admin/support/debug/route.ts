import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '../../_lib';

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const customerId = String(req.nextUrl.searchParams.get('customerId') || '').trim();
    const last = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('last') || 100) || 100));

    const db = getAdminClient();
    let query = db.from('call_signals').select('*').eq('type', 'debug').order('created_at', { ascending: false }).limit(last);
    if (customerId) query = query.eq('thread_id', customerId);
    const { data } = await query;

    const logs = (data || []).map((doc) => ({
      id: doc.id,
      threadId: doc.thread_id,
      fromRole: doc.from_role,
      createdAt: doc.created_at,
      payload: doc.data || {},
    }));

    return NextResponse.json({ logs });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const body = await req.json().catch(() => ({}));
    const customerId = String(body.customerId || '').trim();
    if (!customerId) return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 400 });

    const db = getAdminClient();
    await db.from('call_signals').insert({
      thread_id: customerId,
      call_id: 'debug',
      from_role: 'staff',
      type: 'debug',
      data: body,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
