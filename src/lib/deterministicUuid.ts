// Deterministic UUID v5 (RFC 4122) — used to derive a stable Supabase
// auth.users id from a LINE userId, so re-running the LINE login flow always
// resolves to the same account (mirrors the old Appwrite pattern of
// `'line' + lineUserId.slice(0,28)` as a deterministic Appwrite user id).
import { createHash } from 'node:crypto';

// A fixed, made-up namespace UUID for this app — must never change once
// any real user has logged in, or every LINE user's id will shift.
const KHONKLANG_NAMESPACE = 'b6f9b3b0-6a3e-5e2a-9b7a-6a8f2c2e6b41';

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32),
  ].join('-');
}

export function uuidV5(name: string, namespace = KHONKLANG_NAMESPACE): string {
  const hash = createHash('sha1')
    .update(uuidToBytes(namespace))
    .update(Buffer.from(name, 'utf8'))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  return bytesToUuid(bytes);
}

/** Stable Supabase auth user id for a given LINE userId. */
export function lineUserUuid(lineUserId: string): string {
  return uuidV5(`line:${lineUserId}`);
}
