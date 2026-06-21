import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient, verifyUser, HttpError } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const db = getAdminClient();
    const { error } = await db.from('profiles').update({ role: 'admin' }).eq('id', me.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
