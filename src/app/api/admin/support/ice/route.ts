import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, getAdminClient } from '../../_lib';
import { buildSupportIceServers } from '../../../_lib/support';

export async function GET(req: NextRequest) {
  try {
    const staffId = await verifyAdmin(req);
    const db = getAdminClient();
    const { data } = await db.from('profiles').select('display_name').eq('id', staffId).maybeSingle();
    const label = data?.display_name || staffId || 'staff';
    return NextResponse.json({ iceServers: buildSupportIceServers(label) });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
