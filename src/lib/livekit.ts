// LiveKit server helper — ออก access token สำหรับห้องโทร (ดีล + support)
// ใช้ LiveKit Server ที่โฮสต์เองบน VPS (ดูโปรเจกต์ glangCoturn)
// env ที่ต้องมี: LIVEKIT_URL (wss://livekit.glanghub.com), LIVEKIT_API_KEY, LIVEKIT_API_SECRET
import { AccessToken } from 'livekit-server-sdk';

export function livekitConfigured() {
  return Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
}

export const LIVEKIT_NOT_READY = 'ระบบโทรกำลังเตรียมการ — เปิดให้ใช้เร็ว ๆ นี้';

/** สร้าง token เข้าห้อง — ผู้ถือ token เข้าได้เฉพาะห้องที่ระบุเท่านั้น */
export async function createCallToken(opts: { room: string; identity: string; name?: string; ttl?: string }) {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
    identity: opts.identity,
    name: opts.name || undefined,
    ttl: opts.ttl || '4h',
  });
  at.addGrant({ roomJoin: true, room: opts.room, canPublish: true, canSubscribe: true });
  return {
    token: await at.toJwt(),
    url: String(process.env.LIVEKIT_URL || ''),
  };
}
