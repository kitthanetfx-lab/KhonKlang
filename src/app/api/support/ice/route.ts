import { NextRequest, NextResponse } from 'next/server';
import { Account, Client } from 'node-appwrite';
import { buildSupportIceServers } from '../../_lib/support';

async function getMe(req: NextRequest) {
  const jwt = req.headers.get('x-session-jwt');
  if (!jwt) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const c = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
  return new Account(c).get();
}

export async function GET(req: NextRequest) {
  try {
    const me = await getMe(req);
    const label = ((me.prefs || {}) as Record<string, string>).displayName || me.name || me.$id || 'customer';
    return NextResponse.json({ iceServers: buildSupportIceServers(label) });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json({ error: String((err as Error)?.message || err) }, { status });
  }
}
