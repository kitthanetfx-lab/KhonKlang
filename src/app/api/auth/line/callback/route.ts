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

    // 3. Derive synthetic credentials
    const email = `line_${profile.userId}@line.khonklang.app`;
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

    // 5. Create user if not exists
    try {
      await users.create(userId, email, undefined, password, profile.displayName);
    } catch (e: any) {
      if (e?.code !== 409) throw e; // 409 = already exists, fine
    }

    // 6. Create session
    const session = await users.createSession(userId);

    // 7. Set Appwrite session cookie and redirect
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
    const response = NextResponse.redirect(`${appUrl}/register`);

    // httpOnly ต้องเป็น false เพื่อให้ Appwrite Web SDK อ่าน cookie ได้ด้วย document.cookie
    response.cookies.set(`a_session_${projectId}`, session.secret, {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    response.cookies.set(`a_session_${projectId}_legacy`, session.secret, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;

  } catch (error) {
    console.error('LINE login error:', error);
    return NextResponse.redirect(`${appUrl}/login?error=line_failed`);
  }
}
