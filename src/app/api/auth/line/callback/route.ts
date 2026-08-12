import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabaseServer';
import { lineUserUuid } from '@/lib/deterministicUuid';
import { fetchLineProfileFromCode } from '@/lib/lineOAuth';
import { verifyLineLinkState } from '@/lib/lineLinkState';

async function handleLineLink(
  request: NextRequest,
  code: string,
  linkRaw: string,
  appUrl: string,
): Promise<NextResponse> {
  const linkPayload = verifyLineLinkState(linkRaw);
  if (!linkPayload) {
    return NextResponse.redirect(`${appUrl}/profile?line_link_error=invalid_state`);
  }

  try {
    const profile = await fetchLineProfileFromCode(code);
    const admin = getAdminClient();

    const { data: taken } = await admin
      .from('profiles')
      .select('id')
      .eq('line_user_id', profile.userId)
      .neq('id', linkPayload.userId)
      .maybeSingle();

    if (taken) {
      return NextResponse.redirect(
        `${appUrl}${linkPayload.returnTo}?line_link_error=already_linked`,
      );
    }

    const { error: updateErr } = await admin
      .from('profiles')
      .update({ line_user_id: profile.userId })
      .eq('id', linkPayload.userId);

    if (updateErr) {
      throw new Error(updateErr.message);
    }

    return NextResponse.redirect(`${appUrl}${linkPayload.returnTo}?line_linked=1`);
  } catch (error: unknown) {
    console.error('LINE link error:', error);
    const msg = encodeURIComponent(error instanceof Error ? error.message : 'unknown');
    return NextResponse.redirect(
      `${appUrl}${linkPayload.returnTo}?line_link_error=${msg}`,
    );
  }
}

export async function GET(request: NextRequest) {
  const code     = request.nextUrl.searchParams.get('code');
  const state    = request.nextUrl.searchParams.get('state') || '';
  const returnTo = (state && state !== 'line_login' && !state.startsWith('link:'))
    ? decodeURIComponent(state)
    : '/';
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL!;
  const secureCookie = appUrl.startsWith('https://');

  if (!code) {
    if (state.startsWith('link:')) {
      const payload = verifyLineLinkState(state.slice(5));
      const dest = payload?.returnTo || '/profile';
      return NextResponse.redirect(`${appUrl}${dest}?line_link_error=cancelled`);
    }
    return NextResponse.redirect(`${appUrl}/login?error=line_cancelled`);
  }

  if (state.startsWith('link:')) {
    return handleLineLink(request, code, state.slice(5), appUrl);
  }

  try {
    const profile = await fetchLineProfileFromCode(code);

    // Email for LINE login account
    let email = `line_${profile.userId}@line.khonklang.app`;

    const userId = lineUserUuid(profile.userId);
    const password = crypto.createHmac('sha256', process.env.LINE_CHANNEL_SECRET!).update(profile.userId).digest('hex');

    const admin = getAdminClient();

    const { error: createErr } = await admin.auth.admin.createUser({
      id: userId,
      email,
      password,
      email_confirm: true,
      user_metadata: { displayName: profile.displayName, pictureUrl: profile.pictureUrl || null, lineUserId: profile.userId },
    });
    if (createErr && !/already.*registered|already exists/i.test(createErr.message)) {
      throw new Error(`Create user: ${createErr.message}`);
    }
    if (createErr) {
      await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { displayName: profile.displayName, pictureUrl: profile.pictureUrl || null, lineUserId: profile.userId },
      }).catch(() => {});
    }

    try {
      await admin.from('profiles').upsert({
        id: userId,
        email,
        display_name: profile.displayName || null,
        line_user_id: profile.userId,
      }, { onConflict: 'id' });
    } catch { /* best-effort */ }
    try {
      await admin.from('profiles').update({ line_user_id: profile.userId }).eq('id', userId);
    } catch { /* best-effort */ }

    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
    if (signInErr || !signInData.session) throw new Error(`Sign in: ${signInErr?.message || 'no session'}`);

    const safeReturn = returnTo.startsWith('/') ? returnTo : '/';
    const response = NextResponse.redirect(
      `${appUrl}/auth/line/complete?returnTo=${encodeURIComponent(safeReturn)}`,
    );

    response.cookies.set('line_session_pending', JSON.stringify({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    }), {
      httpOnly: false, secure: secureCookie, sameSite: 'lax', path: '/', maxAge: 300,
    });

    return response;
  } catch (error: unknown) {
    console.error('LINE login error:', error);
    const msg = encodeURIComponent(error instanceof Error ? error.message : 'unknown');
    return NextResponse.redirect(`${appUrl}/login?error=line_failed&msg=${msg}`);
  }
}
