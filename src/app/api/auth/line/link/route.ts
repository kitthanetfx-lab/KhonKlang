import { NextRequest, NextResponse } from 'next/server';
import { verifyUser } from '@/lib/supabaseServer';
import { buildLineAuthorizeUrl, signLineLinkState } from '@/lib/lineLinkState';

/** เริ่ม OAuth เพื่อผูก LINE กับบัญชีที่ล็อกอินอยู่ — ไม่สลับ session */
export async function GET(req: NextRequest) {
  try {
    const user = await verifyUser(req);
    const returnTo = req.nextUrl.searchParams.get('returnTo') || '/profile';
    const state = `link:${signLineLinkState({ userId: user.id, returnTo })}`;
    const lineUrl = buildLineAuthorizeUrl(state, 'profile openid');

    if (req.nextUrl.searchParams.get('format') === 'json') {
      return NextResponse.json({ url: lineUrl });
    }
    return NextResponse.redirect(lineUrl);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
