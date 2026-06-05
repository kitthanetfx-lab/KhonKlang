import { NextRequest, NextResponse } from 'next/server';
import { Client, Users } from 'node-appwrite';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (!code) {
    return NextResponse.redirect(`${appUrl}/login?error=line_cancelled`);
  }

  try {
    // 1. Exchange code for LINE access token
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${appUrl}/api/auth/line/callback`,
        client_id: process.env.LINE_CHANNEL_ID!,
        client_secret: process.env.LINE_CHANNEL_SECRET!,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No access token');

    // 2. Get LINE profile
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    // profile: { userId, displayName, pictureUrl }

    // 3. ดึง email จาก LINE ID token (ถ้ามี) หรือใช้ synthetic
    let lineEmail = `line_${profile.userId}@line.khonklang.app`;
    if (tokenData.id_token) {
      try {
        const payload = JSON.parse(
          Buffer.from(tokenData.id_token.split('.')[1], 'base64url').toString()
        );
        if (payload.email) lineEmail = payload.email;
      } catch { /* ใช้ synthetic แทน */ }
    }
    const email = lineEmail;
    const password = crypto
      .createHmac('sha256', process.env.LINE_CHANNEL_SECRET!)
      .update(profile.userId)
      .digest('hex');

    // 4. Create Appwrite admin client
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const users = new Users(client);
    const userId = `line${profile.userId.slice(0, 28)}`; // Appwrite userId max 36 chars

    // 5. Create user if not exists, อัปเดต email ถ้า login ซ้ำ
    try {
      await users.create(userId, email, undefined, password, profile.displayName);
    } catch (e: any) {
      if (e?.code !== 409) throw e;
      // user มีแล้ว — อัปเดต email ถ้าได้ email จริงจาก LINE
      if (!email.includes('@line.khonklang.app')) {
        try { await users.updateEmail(userId, email); } catch { /* ignore */ }
      }
    }

    // 6. Create session
    const session = await users.createSession(userId);

    // 7. Set Appwrite session cookie and redirect to bridge page
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
    const response = NextResponse.redirect(`${appUrl}/auth/line/complete`);

    // Session cookies สำหรับ Appwrite SDK
    const cookieOpts = { httpOnly: false, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 365 };
    response.cookies.set(`a_session_${projectId}`, session.secret, cookieOpts);
    response.cookies.set(`a_session_${projectId}_legacy`, session.secret, { ...cookieOpts, secure: false });

    // Cookie พิเศษสำหรับ bridge page เรียก client.setSession() โดยตรง (5 นาที)
    response.cookies.set('line_session_pending', session.secret, {
      httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 5,
    });

    return response;

  } catch (error: any) {
    const msg = encodeURIComponent(error?.message || 'unknown');
    console.error('LINE login error:', error);
    return NextResponse.redirect(`${appUrl}/login?error=line_failed&msg=${msg}`);
  }
}
