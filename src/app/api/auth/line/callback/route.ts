import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabaseServer';
import { lineUserUuid } from '@/lib/deterministicUuid';

type LineIdTokenPayload = { email?: string };

export async function GET(request: NextRequest) {
  const code     = request.nextUrl.searchParams.get('code');
  const state    = request.nextUrl.searchParams.get('state') || '';
  const returnTo = (state && state !== 'line_login') ? decodeURIComponent(state) : '/';
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL!;
  const secureCookie = appUrl.startsWith('https://');

  if (!code) {
    return NextResponse.redirect(`${appUrl}/login?error=line_cancelled`);
  }

  try {
    // 1. Exchange code for token
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${appUrl}/api/auth/line/callback`,
        client_id:     process.env.LINE_CHANNEL_ID!,
        client_secret: process.env.LINE_CHANNEL_SECRET!,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      const err = tokenData.error_description || tokenData.error || 'No access token';
      throw new Error(`LINE token: ${err}`);
    }

    // 2. Get LINE profile
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profile.userId) throw new Error('LINE profile: no userId');

    // 3. Email
    let email = `line_${profile.userId}@line.khonklang.app`;
    if (tokenData.id_token) {
      try {
        const payload = JSON.parse(Buffer.from(tokenData.id_token.split('.')[1], 'base64url').toString()) as LineIdTokenPayload;
        if (payload.email) email = payload.email;
      } catch { /* synthetic */ }
    }

    // 4. Deterministic Supabase user id + password (same derivation pattern as the old
    //    Appwrite version — re-running this flow for the same LINE account always
    //    resolves to the same Supabase auth user).
    const userId = lineUserUuid(profile.userId);
    const password = crypto.createHmac('sha256', process.env.LINE_CHANNEL_SECRET!).update(profile.userId).digest('hex');

    const admin = getAdminClient();

    // 5. Upsert the auth user (id is caller-specified — this is the documented
    //    pattern for migrating users with pre-existing ids into Supabase Auth).
    const { error: createErr } = await admin.auth.admin.createUser({
      id: userId,
      email,
      password,
      email_confirm: true,
      user_metadata: { displayName: profile.displayName, pictureUrl: profile.pictureUrl || null },
    });
    if (createErr && !/already.*registered|already exists/i.test(createErr.message)) {
      throw new Error(`Create user: ${createErr.message}`);
    }
    if (createErr) {
      // already exists — make sure the password still matches our deterministic
      // derivation (in case LINE_CHANNEL_SECRET ever rotates, this resyncs it)
      // + refresh ชื่อ/รูปโปรไฟล์ LINE ล่าสุดลง metadata ทุกครั้งที่ล็อกอิน
      await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { displayName: profile.displayName, pictureUrl: profile.pictureUrl || null },
      }).catch(() => {});
    }

    // 6. Sign in as that user (anon-key client call) to mint a real session.
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
    if (signInErr || !signInData.session) throw new Error(`Sign in: ${signInErr?.message || 'no session'}`);

    // 7. Redirect to bridge page — bridge page calls supabase.auth.setSession()
    //    which the browser SDK needs to persist the session into localStorage.
    const safeReturn = returnTo.startsWith('/') ? returnTo : '/';
    const response = NextResponse.redirect(
      `${appUrl}/auth/line/complete?returnTo=${encodeURIComponent(safeReturn)}`,
    );

    response.cookies.set('line_session_pending', JSON.stringify({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    }), {
      httpOnly: false, secure: secureCookie, sameSite: 'lax', path: '/', maxAge: 300, // 5 min TTL
    });

    return response;
  } catch (error: unknown) {
    console.error('LINE login error:', error);
    const msg = encodeURIComponent(error instanceof Error ? error.message : 'unknown');
    return NextResponse.redirect(`${appUrl}/login?error=line_failed&msg=${msg}`);
  }
}
