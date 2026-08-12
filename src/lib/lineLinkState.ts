import crypto from 'crypto';

export type LineLinkPayload = {
  userId: string;
  returnTo: string;
  exp: number;
};

function secret(): string {
  const s = process.env.LINE_CHANNEL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('Missing LINE link signing secret');
  return s;
}

function safeReturnTo(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return '/profile';
  return path;
}

export function signLineLinkState(payload: Omit<LineLinkPayload, 'exp'> & { exp?: number }): string {
  const body: LineLinkPayload = {
    userId: payload.userId,
    returnTo: safeReturnTo(payload.returnTo),
    exp: payload.exp ?? Date.now() + 10 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyLineLinkState(raw: string): LineLinkPayload | null {
  const [encoded, sig] = raw.split('.');
  if (!encoded || !sig) return null;
  const expected = crypto.createHmac('sha256', secret()).update(encoded).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as LineLinkPayload;
    if (!payload.userId || !payload.returnTo || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    return { ...payload, returnTo: safeReturnTo(payload.returnTo) };
  } catch {
    return null;
  }
}

export function buildLineAuthorizeUrl(state: string, scope = 'profile openid'): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINE_CHANNEL_ID!,
    redirect_uri: `${appUrl}/api/auth/line/callback`,
    state,
    scope,
  });
  return `https://access.line.me/oauth2/v2.1/authorize?${params}`;
}
