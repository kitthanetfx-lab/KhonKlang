import { NextRequest, NextResponse } from 'next/server';
import { Account, Client } from 'node-appwrite';
import { verifyAdmin } from '../../_lib';
import { buildSupportIceServers } from '../../../_lib/support';

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
    const jwt = req.headers.get('x-session-jwt')!;
    const c = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setJWT(jwt);
    const me = await new Account(c).get();
    const label = ((me.prefs || {}) as Record<string, string>).displayName || me.name || me.$id || 'staff';
    return NextResponse.json({ iceServers: buildSupportIceServers(label) });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
