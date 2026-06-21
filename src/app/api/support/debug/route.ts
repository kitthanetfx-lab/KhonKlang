import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const body = await req.json().catch(() => ({}));
    const db = getAdminClient();

    const payload = { ...body, actorId: me.id };

    await db.from('call_signals').insert({
      thread_id: me.id,
      call_id: 'debug',
      from_role: 'customer',
      type: 'debug',
      data: payload,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
