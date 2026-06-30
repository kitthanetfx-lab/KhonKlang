// Browser Supabase client — replaces src/lib/appwrite.ts (Appwrite is being
// fully removed; see supabase/SCHEMA_DESIGN.md for the schema this targets).
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Storage buckets — all three are PUBLIC (matches the old Appwrite setup,
// where every file URL was a plain `${endpoint}/storage/.../view?project=...`
// with no auth header, i.e. access control was "unguessable file id", not
// real per-user permission checks). Ported as-is, not a new regression.
export const DEAL_BUCKET = 'deal-files';
export const KYC_BUCKET = 'kyc-docs';
export const REPORT_BUCKET = 'report-files';

/** URL สำหรับดูไฟล์จาก Supabase Storage (bucket ต้อง public) */
export function fileViewUrl(bucket: string, fileId: string) {
  if (!fileId) return '';
  return supabase.storage.from(bucket).getPublicUrl(fileId).data.publicUrl;
}

/** เผื่อโค้ดเดิมที่ import fileViewUrl(fileId) แบบ bucket เดียว (kyc) */
export function kycFileUrl(fileId: string) {
  return fileViewUrl(KYC_BUCKET, fileId);
}

const SESSION_EVENT = 'khonklang:session-changed';

/** ดึง access token ของผู้ใช้ปัจจุบัน เพื่อส่งเป็น Authorization header ไปยัง API routes
 *  (แทนที่ pattern เดิม: const jwt = (await account.createJWT()).jwt) */
export async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

/** Header object พร้อมใช้กับ fetch() — แทนที่ { 'x-session-jwt': jwt } เดิม */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function onSessionChange(cb: () => void) {
  const { data } = supabase.auth.onAuthStateChange(() => cb());
  return () => data.subscription.unsubscribe();
}

export { SESSION_EVENT };
