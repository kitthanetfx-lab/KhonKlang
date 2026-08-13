// Push notification helper — ยิง FCM (Android) และ APNs (iOS ผ่าน FCM) สู่แอปมือถือ (กลางฮับ)
//
// ทำไมต้อง Firebase: มือถือไม่รับ push โดยตรงจากเซิร์ฟเวอร์เรา ต้องผ่าน FCM/APNs เสมอ
// (ดูเอกสาร glangApp/docs/04 ข้อ 2)
//
// env ที่ต้องมี: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// ค่าทั้ง 3 มาจาก Firebase Console → Project settings → Service accounts → generate new private key
// หากยังไม่ใส่ env: push จะเงียบข้ามไป (pushConfigured() = false) ไม่ทำให้งานหลักพัง
import type { SupabaseClient } from '@supabase/supabase-js';
import { getApp, getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging, type BatchResponse, type Message } from 'firebase-admin/messaging';

// ชื่อ channel ต้องตรงกับฝั่งแอป (nativePush.ts) และ AndroidManifest meta-data
export const PUSH_CHANNEL_ALERTS = 'glanghub_alerts';
export const PUSH_CHANNEL_CALL = 'glanghub_incoming_call';

let cached: { messaging: Messaging } | null = null;

/** Firebase env ครบไหม — ถ้าไม่ครบ push จะเงียบข้ามไป (เหมือน livekitConfigured()) */
export function pushConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY,
  );
}

function getClient(): Messaging {
  if (cached) return cached.messaging;
  // ป้องกัน double-init ใน Next.js hot-reload
  const app: App = getApps().length ? getApp() : initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      // private key ใน env มักมี \n เป็น literal สองตัว → แปลงกลับเป็นบรรทัดใหม่จริง
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
  cached = { messaging: getMessaging(app) };
  return cached.messaging;
}

export interface PushPayload {
  title: string;
  body: string;
  /** deep link เช่น /deal/<id>?call=1 */
  link?: string;
  /**
   * 'call' = สายเรียกเข้าแบบ high-priority (Android priority:high + APNs push-type:voip)
   * 'normal' (default) = แจ้งเตือนทั่วไป
   */
  kind?: 'normal' | 'call';
  /** custom data payload — ฝั่ง native ใช้สร้าง full-screen call UI (dealId, mode, callerName) */
  data?: Record<string, string>;
}

/**
 * ยิง push หาผู้รับหลายคน (รวมหลายเครื่องต่อคน) — best-effort ไม่ทำให้ action หลักล้ม
 * ลบ token ที่ invalid (UNREGISTERED ฯลฯ) ออกจาก DB อัตโนมัติเพื่อกันสะสมขยะ
 */
export async function sendPush(db: SupabaseClient, userIds: string[], p: PushPayload): Promise<void> {
  if (!pushConfigured()) return;
  try {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (!unique.length) return;

    // ดึง token ทั้งหมดของผู้รับ (1 user อาจมีหลายเครื่อง)
    const { data: tokens, error } = await db.from('device_tokens')
      .select('token, platform')
      .in('user_id', unique);
    if (error || !tokens?.length) return;

    const isCall = p.kind === 'call';
    const dataPayload: Record<string, string> = {
      link: p.link || '/',
      kind: isCall ? 'call' : 'normal',
      ...(p.data || {}),
    };

    // ใช้ sendEach (ไม่ใช่ sendEachForMulticast) เพราะต้องการ per-token config
    // (call/normal มี android.priority + apns.push-type ต่างกัน)
    const tokenRows = (tokens as { token: string; platform: string }[]);
    const messages: Message[] = tokenRows.map(t => ({
      token: t.token,
      notification: { title: p.title.slice(0, 100), body: p.body.slice(0, 200) },
      data: dataPayload,
      android: {
        priority: isCall ? 'high' : 'high',
        notification: {
          channel_id: isCall ? PUSH_CHANNEL_CALL : PUSH_CHANNEL_ALERTS,
          priority: isCall ? 'max' : 'high',
          sound: 'default',
          default_sound: true,
          default_vibrate_timings: true,
          visibility: isCall ? 'public' : 'private',
        },
      },
      apns: {
        payload: {
          aps: {
            'content-available': 1,
            sound: isCall ? 'ringtone.caf' : 'default',
            // critical alert สำหรับสายเรียกเข้า (ต้องขอ critical notification entitlement ที่ Apple)
            ...(isCall ? { 'interruption-level': 'critical' } : {}),
          },
        },
        headers: isCall
          ? { 'apns-push-type': 'voip', 'apns-priority': '10' }
          : { 'apns-push-type': 'alert', 'apns-priority': '5' },
      },
    }));

    const result: BatchResponse = await getClient().sendEach(messages);

    // ลบ token ที่ invalid ออกจาก DB (UNREGISTERED หมายถึงแอปถูกถอนการติดตั้ง หรือ token หมดอายุ)
    // เก็บ token คู่ขนานกับ message (ส่งคืนแบบ same-index) — กัน union narrowing ของ Message
    const dead: string[] = [];
    result.responses.forEach((r, i) => {
      if (!r.success && /UNREGISTERED|invalid registration|NotRegistered|registration-token-not-registered/i.test(r.error?.message || '')) {
        dead.push(tokenRows[i].token);
      }
    });
    if (dead.length) {
      // ลำดับ: delete() ก่อน → แล้ว filter .in() (PostgrestFilterBuilder มาจาก delete)
      await db.from('device_tokens').delete().in('token', dead);
    }
  } catch {
    // best effort — ไม่ทำให้ action หลักล้ม (เหมือน notifyUsers)
  }
}
