import { NextRequest, NextResponse } from 'next/server';
import { verifyUser } from '@/lib/supabaseServer';
import { buildSupportIceServers } from '../../_lib/support';

export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    return NextResponse.json({ iceServers: buildSupportIceServers(me.email || me.id || 'customer') });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
