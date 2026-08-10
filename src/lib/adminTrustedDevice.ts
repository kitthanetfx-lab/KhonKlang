import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

export const ADMIN_TRUST_COOKIE = 'admin_panel_trust';
export const ADMIN_TRUST_DAYS = 30;
export const ADMIN_DEVICE_STORAGE_KEY = 'kk_admin_device_id';

type TrustPayload = {
  uid: string;
  did: string;
  exp: number;
};

function trustSecret(): string {
  return (
    (process.env.ADMIN_TRUST_SECRET || '').trim()
    || (process.env.ADMIN_PANEL_PASSWORD || '').trim()
    || (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  );
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

function sign(data: string): string {
  const secret = trustSecret();
  if (!secret) return '';
  return b64url(createHmac('sha256', secret).update(data).digest());
}

export function createAdminTrustToken(userId: string, deviceId: string, days = ADMIN_TRUST_DAYS): string | null {
  const secret = trustSecret();
  if (!secret || !userId || !deviceId) return null;
  const payload: TrustPayload = {
    uid: userId,
    did: deviceId,
    exp: Date.now() + days * 24 * 60 * 60 * 1000,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = sign(body);
  if (!sig) return null;
  return `${body}.${sig}`;
}

export function verifyAdminTrustToken(
  token: string | undefined | null,
  userId: string,
  deviceId: string,
): boolean {
  if (!token || !userId || !deviceId) return false;
  const secret = trustSecret();
  if (!secret) return false;
  const [body, sig] = token.split('.');
  if (!body || !sig) return false;
  const expected = sign(body);
  if (!expected) return false;
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as TrustPayload;
    if (!payload?.uid || !payload?.did || !payload?.exp) return false;
    if (payload.uid !== userId) return false;
    if (payload.did !== deviceId) return false;
    if (Date.now() > Number(payload.exp)) return false;
    return true;
  } catch {
    return false;
  }
}

export function adminTrustCookieOptions(maxAgeSec = ADMIN_TRUST_DAYS * 24 * 60 * 60) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSec,
  };
}

export function setAdminTrustCookie(res: NextResponse, token: string) {
  res.cookies.set(ADMIN_TRUST_COOKIE, token, adminTrustCookieOptions());
}

export function clearAdminTrustCookie(res: NextResponse) {
  res.cookies.set(ADMIN_TRUST_COOKIE, '', {
    ...adminTrustCookieOptions(0),
    maxAge: 0,
  });
}
