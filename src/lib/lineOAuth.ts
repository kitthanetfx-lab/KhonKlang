type LineProfile = {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
};

export async function fetchLineProfileFromCode(code: string): Promise<LineProfile> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
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
  if (!tokenData.access_token) {
    const err = tokenData.error_description || tokenData.error || 'No access token';
    throw new Error(`LINE token: ${err}`);
  }

  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileRes.json();
  if (!profile.userId) throw new Error('LINE profile: no userId');
  return profile as LineProfile;
}
