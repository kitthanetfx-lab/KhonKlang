// Push notification helper — ยิง FCM (Android) และ APNs (iOS ผ่าน FCM) สู่แอปมือถือ (กลางฮับ)
//
// env ที่ต้องมี: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
import type { SupabaseClient } from '@supabase/supabase-js';
import { getApp, getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging, type BatchResponse, type Message } from 'firebase-admin/messaging';

// v2 = channel ใหม่ที่มีเสียง (Android จำการตั้งค่า channel ครั้งแรก — เปลี่ยน id เพื่อ reset)
export const PUSH_CHANNEL_ALERTS = 'glanghub_alerts_v2';
export const PUSH_CHANNEL_CALL = 'glanghub_incoming_call_v2';

let cached: { messaging: Messaging } | null = null;

export function pushConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY,
  );
}

function getClient(): Messaging {
  if (cached) return cached.messaging;
  const app: App = getApps().length ? getApp() : initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
  cached = { messaging: getMessaging(app) };
  return cached.messaging;
}

export interface PushPayload {
  title: string;
  body: string;
  link?: string;
  kind?: 'normal' | 'call';
  data?: Record<string, string>;
}

function buildMessage(
  token: string,
  platform: string,
  p: PushPayload,
): Message {
  const isCall = p.kind === 'call';
  const dataPayload: Record<string, string> = {
    link: p.link || '/',
    kind: isCall ? 'call' : 'normal',
    ...(p.data || {}),
  };

  const base: Message = {
    token,
    notification: {
      title: p.title.slice(0, 100),
      body: p.body.slice(0, 200),
    },
    data: dataPayload,
  };

  if (platform === 'ios') {
    return {
      ...base,
      apns: {
        payload: {
          aps: {
            alert: { title: p.title.slice(0, 100), body: p.body.slice(0, 200) },
            sound: isCall ? 'default' : 'default',
            'interruption-level': isCall ? 'time-sensitive' : 'active',
          },
        },
        headers: {
          'apns-push-type': 'alert',
          'apns-priority': isCall ? '10' : '5',
        },
      },
    };
  }

  // Android — แยก config ไม่ปน apns voip (เคยทำให้สายเรียกเข้า fail เงียบ ๆ)
  return {
    ...base,
    android: {
      priority: 'high',
      ttl: isCall ? 60_000 : 86_400_000,
      notification: {
        channelId: isCall ? PUSH_CHANNEL_CALL : PUSH_CHANNEL_ALERTS,
        priority: isCall ? 'max' : 'high',
        defaultSound: true,
        defaultVibrateTimings: true,
        visibility: 'public',
        tag: isCall ? 'glanghub_incoming_call' : undefined,
        notificationCount: isCall ? 1 : undefined,
      },
    },
  };
}

export async function sendPush(db: SupabaseClient, userIds: string[], p: PushPayload): Promise<void> {
  if (!pushConfigured()) return;
  try {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (!unique.length) return;

    const { data: tokens, error } = await db.from('device_tokens')
      .select('token, platform')
      .in('user_id', unique);
    if (error || !tokens?.length) return;

    const tokenRows = tokens as { token: string; platform: string }[];
    const messages = tokenRows.map(t => buildMessage(t.token, t.platform || 'android', p));

    const result: BatchResponse = await getClient().sendEach(messages);

    const dead: string[] = [];
    result.responses.forEach((r, i) => {
      if (r.success) return;
      const msg = r.error?.message || '';
      if (/UNREGISTERED|invalid registration|NotRegistered|registration-token-not-registered/i.test(msg)) {
        dead.push(tokenRows[i].token);
      } else if (p.kind === 'call') {
        console.warn('[push] call notification failed:', msg, 'token=', tokenRows[i].token.slice(0, 12));
      }
    });
    if (dead.length) {
      await db.from('device_tokens').delete().in('token', dead);
    }
  } catch (err) {
    console.warn('[push] sendPush error:', err);
  }
}
