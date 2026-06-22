// Server-only Supabase helpers — replaces src/app/api/admin/_lib.ts's
// Appwrite getAdminClient()/verifyAdmin(). Import only from API routes
// (route.ts files), never from client components — this uses the service
// role key, which bypasses RLS entirely.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** Service-role client — full read/write, bypasses RLS. Equivalent of the
 *  old getAdminClient() + new Databases(client). */
export function getAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function bearerToken(req: Request): string {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  // legacy header name, kept temporarily while client pages are converted one by one
  return req.headers.get('x-session-jwt') || '';
}

export interface CurrentUser {
  id: string;
  email: string | null;
  role: 'user' | 'seller' | 'middleman' | 'admin';
}

/** Verifies the caller's Supabase access token and loads their profile row.
 *  Equivalent of the old Account.get() + Users.get(id) + prefs.role check,
 *  but reading from the `profiles` table instead of Users.prefs. */
export async function verifyUser(req: Request): Promise<CurrentUser> {
  const token = bearerToken(req);
  if (!token) throw new HttpError('Unauthorized', 401);

  const admin = getAdminClient();
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes.user) throw new HttpError('Unauthorized', 401);

  const { data: existingProfile, error: profileErr } = await admin
    .from('profiles')
    .select('id, email, role')
    .eq('id', userRes.user.id)
    .maybeSingle();
  if (profileErr) throw new HttpError('Unauthorized', 401);

  let profile = existingProfile;
  if (!profile) {
    // ปกติแล้วจะมี trigger สร้างแถว profiles ให้อัตโนมัติตอนสมัคร (migration 0004_profile_on_signup.sql)
    // แต่เผื่อ migration นั้นยังไม่ได้รันบน DB จริง หรือเป็นผู้ใช้เก่าก่อนมี trigger — สร้างแถวให้ตรงนี้เลย
    // กันไม่ให้ติด 401 Unauthorized ทั้งที่ login ผ่านแล้วจริง ๆ
    await admin
      .from('profiles')
      .insert({ id: userRes.user.id, email: userRes.user.email || null })
      .select('id')
      .maybeSingle();
    const { data: refetched, error: refetchErr } = await admin
      .from('profiles')
      .select('id, email, role')
      .eq('id', userRes.user.id)
      .maybeSingle();
    if (refetchErr || !refetched) throw new HttpError('Unauthorized', 401);
    profile = refetched;
  }

  return { id: profile.id, email: profile.email, role: profile.role };
}

/** Equivalent of the old verifyAdmin(req) — returns the admin's user id. */
export async function verifyAdmin(req: Request): Promise<string> {
  const user = await verifyUser(req);
  if (user.role !== 'admin') throw new HttpError('Forbidden', 403);
  return user.id;
}
