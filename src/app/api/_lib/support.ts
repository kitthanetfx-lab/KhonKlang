// Shared helpers — ระบบแชทศูนย์ช่วยเหลือ (customer care) + คำขอโทร
import { createHmac } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export type CallStatus = 'idle' | 'customer_requesting' | 'staff_ringing' | 'connecting' | 'active' | 'ended';

export interface SupportThreadDoc {
  customer_id: string;
  customer_name: string;
  status: 'open' | 'closed';
  last_message: string;
  last_at: string;
  last_sender: 'customer' | 'staff' | '';
  unread_customer: boolean;
  unread_staff: boolean;
  assigned_staff_id: string;
  assigned_staff_name: string;
  call_status: CallStatus;
  call_id: string;
  call_initiator: 'customer' | 'staff' | '';
  call_staff_id: string;
  call_staff_name: string;
  call_updated_at: string;
  last_read_by_customer_at: string;
  last_read_by_staff_at: string;
  created_at: string;
  updated_at: string;
}

export interface SupportMessageDoc {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'customer' | 'staff' | 'system';
  content: string;
  image_url?: string;
  mime_type?: string;
  created_at: string;
}

/** ดึงห้องแชทของลูกค้า (สร้างใหม่ถ้ายังไม่มี — ใช้ customerId เป็น primary key ของ support_threads ตรง) */
export async function getOrCreateThread(db: SupabaseClient, customerId: string, customerName: string): Promise<SupportThreadDoc> {
  const { data: existing } = await db.from('support_threads').select('*').eq('customer_id', customerId).maybeSingle();
  if (existing) return existing as SupportThreadDoc;

  const { data: created, error } = await db.from('support_threads').insert({
    customer_id: customerId,
    customer_name: customerName.slice(0, 200) || 'ลูกค้า',
    status: 'open',
  }).select().single();
  if (created) return created as SupportThreadDoc;

  // race: อีก request สร้างไปแล้วพอดี
  if (error) {
    const { data: refetched } = await db.from('support_threads').select('*').eq('customer_id', customerId).maybeSingle();
    if (refetched) return refetched as SupportThreadDoc;
  }
  throw new Error(error?.message || 'failed to create support thread');
}

export function newCallId() {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function splitCsv(value?: string | null) {
  return String(value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export function buildSupportIceServers(identity: string): RTCIceServer[] {
  const stunUrls = splitCsv(process.env.WEBRTC_STUN_URLS) || [];
  const turnUrls = splitCsv(process.env.WEBRTC_TURN_URLS);
  const servers: RTCIceServer[] = [
    { urls: stunUrls.length ? stunUrls : ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  if (!turnUrls.length) return servers;

  const turnSecret = String(process.env.WEBRTC_TURN_SECRET || '').trim();
  if (turnSecret) {
    const ttlSec = Math.max(300, Number(process.env.WEBRTC_TURN_TTL_SECONDS || 3600) || 3600);
    const expires = Math.floor(Date.now() / 1000) + ttlSec;
    const username = `${expires}:${identity || 'support'}`;
    const credential = createHmac('sha1', turnSecret).update(username).digest('base64');
    servers.push({ urls: turnUrls, username, credential });
    return servers;
  }

  const username = String(process.env.WEBRTC_TURN_USERNAME || '').trim();
  const credential = String(process.env.WEBRTC_TURN_CREDENTIAL || '').trim();
  if (username && credential) servers.push({ urls: turnUrls, username, credential });
  return servers;
}

export async function listSignalsSince(db: SupabaseClient, callId: string, sinceIso: string) {
  let query = db.from('call_signals').select('*').eq('call_id', callId).order('created_at', { ascending: true }).limit(200);
  if (sinceIso) query = query.gt('created_at', sinceIso);
  const { data } = await query;
  return data || [];
}
