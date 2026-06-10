import { NextRequest, NextResponse } from 'next/server';
import { Client, Users } from 'node-appwrite';
import crypto from 'crypto';

type AppwriteLikeError = { code?: number; message?: string };
type LineIdTokenPayload = { email?: string };

export async function GET(request: NextRequest) {
  const code    = request.nextUrl.searchParams.get('code');
  const state   = request.nextUrl.searchParams.get('state') || '';
  const returnTo = (state && state !== 'line_login') ? decodeURIComponent(state) : '/';
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL!;
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

    // 4. Admin client
    const adminClient = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);
    const users   = new Users(adminClient);
    const userId  = `line${profile.userId.slice(0, 28)}`;
    const password = crypto.createHmac('sha256', process.env.LINE_CHANNEL_SECRET!).update(profile.userId).digest('hex');

    // 5. Upsert user
    try {
      await users.create(userId, email, undefined, password, profile.displayName);
    } catch (error: unknown) {
      const appwriteError = error as AppwriteLikeError;
      if (appwriteError.code !== 409) throw new Error(`Create user: ${appwriteError.message}`);
    }

    // 6. Create session
    const session = await users.createSession(userId);
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;

    // 7. Redirect to bridge page — bridge page calls client.setSession() which the SDK needs
    const safeReturn = returnTo.startsWith('/') ? returnTo : '/';
    const response = NextResponse.redirect(
      `${appUrl}/auth/line/complete?returnTo=${encodeURIComponent(safeReturn)}`
    );

    const yr = 60 * 60 * 24 * 365;
    // line_session_pending: httpOnly=false so bridge page JS can read it
    response.cookies.set('line_session_pending', session.secret, {
      httpOnly: false, secure: secureCookie, sameSite: 'lax', path: '/', maxAge: 300, // 5 min TTL
    });
    // Also set standard Appwrite cookies for any server-side use
    response.cookies.set(`a_session_${projectId}`, session.secret, {
      httpOnly: false, secure: secureCookie, sameSite: 'lax', path: '/', maxAge: yr,
    });
    response.cookies.set(`a_session_${projectId}_legacy`, session.secret, {
      httpOnly: false, secure: false, sameSite: 'lax', path: '/', maxAge: yr,
    });

    return response;

  } catch (error: unknown) {
    console.error('LINE login error:', error);
    const msg = encodeURIComponent(error instanceof Error ? error.message : 'unknown');
    return NextResponse.redirect(`${appUrl}/login?error=line_failed&msg=${msg}`);
  }
}
