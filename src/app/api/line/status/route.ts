import { NextRequest, NextResponse } from 'next/server';
import { verifyUser, getAdminClient, HttpError } from '@/lib/supabaseServer';
import { forgetLineOaFriendCache, isLineOaFriend, lineOaAddFriendUrl } from '@/lib/lineFriendship';

export async function GET(req: NextRequest) {
  try {
    const me = await verifyUser(req);
    const refresh = req.nextUrl.searchParams.get('refresh') === '1';
    const db = getAdminClient();
    const { data: profile } = await db.from('profiles').select('line_user_id').eq('id', me.id).maybeSingle();
    const lineUserId = String(profile?.line_user_id || '').trim();
    const linked = Boolean(lineUserId);
    if (refresh && lineUserId) forgetLineOaFriendCache(lineUserId);
    const oaFriend = linked ? await isLineOaFriend(lineUserId) : false;
    return NextResponse.json({
      linked,
      oaFriend,
      ready: linked && oaFriend,
      lineOaUrl: lineOaAddFriendUrl(),
    });
  } catch (err: unknown) {
    const status = err instanceof HttpError ? err.status : 500;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status });
  }
}
