'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ReviewPanel } from '@/components/ReviewPanel';
import { NotifyBell } from '@/components/NotifyBell';
import { AsyncButton } from '@/components/AsyncButton';
import { AddressPicker, EMPTY_ADDRESS, ThaiAddress, addressLabel } from '@/components/AddressPicker';
import { PaymentMethods } from '@/components/PaymentMethods';
import { InAppBanner } from '@/components/InAppBanner';
import { withExternalBrowserParam } from '@/lib/inApp';
import { distanceKm, midpointProvince } from '@/lib/provinceGeo';
import { compressImage } from '@/lib/imageCompress';
import { FeeConfig, FEE_DEFAULTS, computeDealFees } from '@/lib/fees';
import { dealCode } from '@/lib/dealNumber';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Jitsi Meet via External API ─────────────────────────────────────────
function JitsiMeet({ roomName, displayName }: { roomName: string; displayName: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  useEffect(() => {
    if (!containerRef.current || apiRef.current) return;
    let api: any;
    function initJitsi() {
      if (!containerRef.current) return;
      const h = Math.max(window.innerHeight - 120, 400);
      api = new (window as any).JitsiMeetExternalAPI('meet.jit.si', {
        roomName, parentNode: containerRef.current, width: '100%', height: h,
        userInfo: { displayName },
        configOverwrite: { startWithAudioMuted: false, startWithVideoMuted: false, disableDeepLinking: true, prejoinPageEnabled: false },
        interfaceConfigOverwrite: { SHOW_JITSI_WATERMARK: false, SHOW_BRAND_WATERMARK: false, MOBILE_APP_PROMO: false, TOOLBAR_BUTTONS: ['microphone', 'camera', 'hangup', 'tileview', 'raisehand'] },
      });
      apiRef.current = api;
    }
    if ((window as any).JitsiMeetExternalAPI) initJitsi();
    else {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js'; script.async = true; script.onload = initJitsi;
      document.head.appendChild(script);
    }
    return () => { try { apiRef.current?.dispose(); } catch {} apiRef.current = null; };
  }, [roomName, displayName]);
  return <div ref={containerRef} style={{ width: '100%', overflow: 'hidden' }} />;
}

// ─── บันทึกวิดีโอคอล (อัดหน้าจอ+เสียงแท็บ แล้วเซฟลงเครื่องเป็น .webm) ───────
function CallRecorder({ dealId, onSaveEvidence }: { dealId: string; onSaveEvidence?: (blob: Blob) => Promise<void> }) {
  const [recording, setRecording] = useState(false);
  const [sec, setSec] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  function cleanupStreams() {
    try { displayStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    try { micStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    displayStreamRef.current = null; micStreamRef.current = null; audioCtxRef.current = null;
  }

  useEffect(() => () => { try { recRef.current?.stop(); } catch {} cleanupStreams(); if (timerRef.current) clearInterval(timerRef.current); }, []);

  async function start() {
    try {
      const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: (c: MediaStreamConstraints) => Promise<MediaStream> };
      if (!md.getDisplayMedia) { alert('เบราว์เซอร์นี้ไม่รองรับการบันทึกหน้าจอ — แนะนำ Chrome/Edge บนคอมพิวเตอร์ (มือถือใช้ปุ่มอัดหน้าจอของเครื่องแทน)'); return; }
      const display = await md.getDisplayMedia({ video: true, audio: true });
      displayStreamRef.current = display;

      // ผสมเสียงไมโครโฟน (เสียงเรา) เข้ากับเสียงหน้าจอ/แท็บ (เสียงอีกฝ่าย) ด้วย Web Audio API
      // มิฉะนั้นวิดีโอที่อัดจะไม่มีเสียงเราเอง หรือเงียบทั้งหมดหากไม่ได้แชร์เสียงแท็บ
      let mixedAudio: MediaStreamTrack[] = display.getAudioTracks();
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        micStreamRef.current = mic;
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        audioCtxRef.current = ctx;
        const dest = ctx.createMediaStreamDestination();
        if (display.getAudioTracks().length) ctx.createMediaStreamSource(display).connect(dest);
        ctx.createMediaStreamSource(mic).connect(dest);
        mixedAudio = dest.stream.getAudioTracks();
      } catch { /* ไม่มีไมค์/ไม่ให้สิทธิ์ → ใช้เฉพาะเสียงหน้าจอเท่าที่มี */ }

      if (mixedAudio.length === 0) {
        alert('⚠️ ไม่พบเสียงสำหรับบันทึก — ตอนเลือกหน้าจอโปรดเลือก "แท็บ Chrome" และติ๊ก "แชร์เสียงแท็บ" และอนุญาตให้ใช้ไมโครโฟน เพื่อให้วิดีโอมีเสียง');
      }

      const stream = new MediaStream([...display.getVideoTracks(), ...mixedAudio]);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        cleanupStreams();
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false); setSec(0);
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        if (blob.size === 0) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        a.href = url; a.download = `khonklang-call-${dealId.slice(0, 8)}-${stamp}.webm`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        // เก็บวิดีโอคอลนี้เป็นหลักฐานในระบบด้วยหรือไม่
        if (onSaveEvidence && window.confirm('บันทึกวิดีโอคอลนี้เป็นหลักฐานในดีลด้วยไหม? (จะแสดงในแท็บหลักฐาน)')) {
          onSaveEvidence(blob).catch(() => alert('เก็บวิดีโอคอลเป็นหลักฐานไม่สำเร็จ'));
        }
      };
      // ผู้ใช้กด "หยุดแชร์" ของเบราว์เซอร์ → หยุดบันทึกและเซฟให้เลย
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (mr.state !== 'inactive') mr.stop(); });
      mr.start(1000);
      recRef.current = mr;
      setRecording(true); setSec(0);
      timerRef.current = setInterval(() => setSec(s => s + 1), 1000);
    } catch { /* ผู้ใช้กดยกเลิกการเลือกหน้าจอ */ }
  }

  function stop() { try { recRef.current?.stop(); } catch {} }

  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return (
    <button type="button" className={`rec-btn ${recording ? 'on' : ''}`} onClick={recording ? stop : start}
      title={recording ? 'หยุดและบันทึกลงเครื่อง' : 'อัดวิดีโอคอลเก็บเป็นหลักฐาน — เลือก "แท็บ Chrome" + ติ๊กแชร์เสียงแท็บ และอนุญาตไมโครโฟน เพื่อให้มีเสียงครบ'}>
      {recording ? <><span className="rec-dot" /> {mm}:{ss} หยุด & เซฟ</> : <>⏺ บันทึกวิดีโอ</>}
    </button>
  );
}

interface Deal {
  id: string; seller_id: string; seller_name: string; middleman_id: string; middleman_name: string;
  buyer_id: string; buyer_name: string; title: string; description: string; price: number; category: string;
  status: string; reject_reason: string;
  seller_accepted_terms: boolean; middleman_accepted_terms: boolean; buyer_accepted_terms: boolean;
  middleman_confirmed_payment: boolean; buyer_confirmed_check: boolean;
  payment_slip_file_id: string; tracking_to_middleman: string; tracking_to_buyer: string;
  deal_type?: string; fee_payer?: string;
}

interface BankInfo { bankName: string; bankAcct: string; bankOwner: string; }
function bankLine(b?: BankInfo | null) {
  if (!b || (!b.bankName && !b.bankAcct)) return 'ยังไม่ได้บันทึกบัญชีรับเงิน';
  return `${b.bankName || '-'} · ${b.bankAcct || '-'} · ${b.bankOwner || '-'}`;
}

/** ข้อมูลรับประกันเดินทาง — มาจาก deal_meetup row โดยตรง (ไม่ต้อง JSON.parse แล้ว) */
interface MeetupData {
  deal_id?: string;
  buyer_loc?: ThaiAddress; seller_loc?: ThaiAddress;
  meet_label?: string; pending_meet_label?: string;
  pending_price?: number; pending_fee_payer?: 'buyer' | 'seller' | 'split'; // ข้อเสนอจุดนัดที่แนบการปรับราคา/ค่าบริการ
  deposit?: number;
  buyer_departed_at?: string; seller_departed_at?: string;
  buyer_departed_ack_at?: string; seller_departed_ack_at?: string; // ข้อ5: อีกฝ่ายรับทราบการออกเดินทาง (buyer_*=ผู้ขายรับทราบของผู้ซื้อ)
  buyer_pos?: { lat: number; lng: number; at: string }; seller_pos?: { lat: number; lng: number; at: string };
  pending_deposit?: number; pending_by?: 'buyer' | 'seller';
  buyer_fee?: number; seller_fee?: number;
  buyer_slip?: string; seller_slip?: string; buyer_met?: boolean; seller_met?: boolean;
  buyer_slip_verified_at?: string; seller_slip_verified_at?: string; // ข้อ4/5: ศูนย์กลางตรวจสลิปเงินประกันรายฝ่าย
  refunded_at?: string; refund_note?: string;
  refund_outcome?: 'buyer_all' | 'seller_all' | 'both' | 'frozen';
  buyer_refund_slip?: string; seller_refund_slip?: string;
  refund_decision_note?: string;
  seller_agreed_at?: string; buyer_agreed_at?: string;
}
interface DealPriceState {
  proposed_price?: number; proposed_fee_payer?: 'buyer' | 'seller' | 'split';
  proposed_by?: 'seller' | 'buyer' | 'middleman'; proposal_kind?: 'current' | 'reprice';
  agreed?: boolean; seller_agreed?: boolean; buyer_agreed?: boolean; middleman_agreed?: boolean;
  mm_deposit_held?: number;
  evidence_done_seller?: boolean; evidence_done_buyer?: boolean; evidence_done_middleman?: boolean;
  seller_fee_slip?: string;
  payout_slip_file_id?: string; refund_slip_file_id?: string;
}
interface EvidenceItem { id: string; deal_id: string; type: string; file_id: string; file_name: string; content?: string; uploaded_by?: string; uploader_name?: string; created_at: string; }
interface Msg { id: string; sender_id: string; sender_name: string; role: string; type: string; content: string; file_id: string; file_name: string; created_at: string; }
interface Middleman { userId: string; code: string; name: string; tier: string; workProvince: string; phone: string; categories?: string; reviewScore: number; reviewCount: number; }

function fileUrl(id: string) { return fileViewUrl(DEAL_BUCKET, id); }

const STEP_LABEL: Record<string, string> = {
  posted: 'รอผู้ซื้อ', waiting_seller: 'รอผู้ขาย', waiting_buyer: 'รอผู้ซื้อ', buyer_joined: 'รอเลือกคนกลาง',
  terms_pending: 'รอยอมรับเงื่อนไข', payment_pending: 'รอโอนเงิน', payment_uploaded: 'รอคนกลางยืนยัน',
  packing: 'ผู้ขายแพ็คของ', shipped_to_middleman: 'รอคนกลางรับ', middleman_received: 'คนกลางรับแล้ว',
  middleman_checking: 'คนกลางตรวจ', shipped_to_buyer: 'จัดส่งให้ผู้ซื้อ', delivered: 'รอยืนยันรับ',
  completed: 'เสร็จสมบูรณ์', cancelled: 'ยกเลิก', disputed: 'มีปัญหา',
  meetup_ready: 'พร้อมนัดเจอ',
};
const STEP_ORDER = ['posted', 'buyer_joined', 'terms_pending', 'payment_pending', 'payment_uploaded', 'packing', 'shipped_to_middleman', 'middleman_received', 'middleman_checking', 'shipped_to_buyer', 'delivered', 'meetup_ready', 'completed'];
const MEETUP_TIMELINE = [
  { key: 'terms_pending', label: 'ยอมรับเงื่อนไข' },
  { key: 'payment_pending', label: 'วางเงินประกันทั้งสองฝ่าย' },
  { key: 'meetup_ready', label: 'นัดเจอกันตามนัด' },
  { key: 'completed', label: 'คืนเงินประกัน + เสร็จสมบูรณ์' },
];
const TIMELINE = [
  { key: 'terms_pending', label: 'รอยอมรับเงื่อนไข' }, { key: 'payment_pending', label: 'รอโอนเงิน' },
  { key: 'payment_uploaded', label: 'รอยืนยันเงิน' }, { key: 'packing', label: 'ผู้ขายแพ็คของ' },
  { key: 'shipped_to_middleman', label: 'รอคนกลางรับ' }, { key: 'middleman_received', label: 'คนกลางรับแล้ว' },
  { key: 'middleman_checking', label: 'คนกลางตรวจสอบ' }, { key: 'shipped_to_buyer', label: 'จัดส่งให้ผู้ซื้อ' },
  { key: 'delivered', label: 'รอยืนยันรับ' }, { key: 'completed', label: 'เสร็จสมบูรณ์' },
];
// โหมดง่าย: ไม่มีคนกลางบุคคล ผู้ขายส่งตรงถึงผู้ซื้อ
const SIMPLE_TIMELINE = [
  { key: 'terms_pending', label: 'รอยอมรับเงื่อนไข' }, { key: 'payment_pending', label: 'ผู้ซื้อโอนเงินเข้าศูนย์กลาง' },
  { key: 'payment_uploaded', label: 'รอศูนย์กลางยืนยันรับเงิน' }, { key: 'packing', label: 'ผู้ขายแพ็ค+ถ่ายวิดีโอ' },
  { key: 'shipped_to_buyer', label: 'ส่งตรงถึงผู้ซื้อ' }, { key: 'completed', label: 'ผู้ซื้อรับของ → ศูนย์กลางโอนเงิน' },
];
// ป้ายสถานะที่ต่างจากปกติเมื่อเป็นโหมดง่าย
const SIMPLE_STATUS_LABEL: Record<string, string> = {
  buyer_joined: 'รอยอมรับเงื่อนไข', payment_uploaded: 'รอศูนย์กลางยืนยัน', packing: 'ผู้ขายแพ็ค+ส่งตรง', shipped_to_buyer: 'จัดส่งถึงผู้ซื้อ',
};
function statusText(d: { status: string; deal_type?: string }) {
  if (d.deal_type === 'simple' && SIMPLE_STATUS_LABEL[d.status]) return SIMPLE_STATUS_LABEL[d.status];
  return STEP_LABEL[d.status];
}

// ข้อตกลงความคุ้มครองของแต่ละบริการ — แสดงในป๊อปอัพก่อนยอมรับเงื่อนไข
const SERVICE_TERMS: Record<string, { name: string; covers: string[]; excludes: string[] }> = {
  simple: {
    name: 'ซื้อขายผ่านกลางแบบง่าย (ส่งตรง)',
    covers: [
      'ผู้ขายไม่ส่งสินค้า — ผู้ซื้อได้รับเงินคืนเต็มจำนวน',
      'ส่งของไม่ตรงปก / ผิดรุ่น / ผิดสเปกจากที่ตกลงกันไว้',
      'สินค้าเสียหายชัดเจน ที่เห็นได้จากวิดีโอตอนผู้ซื้อแกะกล่อง',
    ],
    excludes: [
      'สินค้าที่ต้องตรวจเชิงลึก เช่น ชิ้นส่วนภายใน หรือความสมบูรณ์เชิงเทคนิคที่ไม่เห็นจากภายนอก',
      'ปัญหาที่ผู้ซื้อไม่ได้ถ่ายวิดีโอก่อนแกะกล่อง',
      'ความเสียหายหรือความผิดปกติที่เกิดหลังผู้ซื้อรับและใช้งานสินค้า',
    ],
  },
  '': {
    name: 'ซื้อขายผ่านกลาง (ออนไลน์)',
    covers: [
      'ผู้ขายไม่ส่งสินค้า — ผู้ซื้อได้รับเงินคืนเต็มจำนวน',
      'คนกลางตรวจสอบสินค้าก่อนส่งต่อให้ผู้ซื้อ',
      'ของไม่ตรงปก / ชำรุด / ของปลอม ที่คนกลางตรวจพบก่อนส่ง',
      'มีคนกลางเป็นพยานกลาง และถ่ายวิดีโอหลักฐานทุกขั้นตอน',
    ],
    excludes: [
      'ตำหนิเล็กน้อยที่ทั้งสองฝ่ายตกลงรับได้ไว้ก่อนหน้า',
      'ความเสียหายที่เกิดหลังผู้ซื้อรับและใช้งานสินค้า',
    ],
  },
  meetup: {
    name: 'รับประกันเดินทาง (นัดเจอ)',
    covers: [
      'คุ้มครองการผิดนัด — ฝ่ายที่ไม่มาตามนัดถูกหักเงินประกัน',
      'วางเงินประกันทั้งสองฝ่าย คืนเต็มจำนวนเมื่อเจอกันสำเร็จ',
      'ผู้ซื้อตรวจสินค้าต่อหน้า ณ จุดนัดพบก่อนตัดสินใจ',
    ],
    excludes: [
      'คุณภาพสินค้าหลังตกลงซื้อต่อหน้า (ผู้ซื้อต้องตรวจให้พอใจ ณ จุดนัด)',
      'เหตุสุดวิสัยหรือข้อตกลงพิเศษที่คุยกันเอง',
    ],
  },
};
function termsFor(dealType?: string) {
  return SERVICE_TERMS[dealType === 'meetup' ? 'meetup' : dealType === 'simple' ? 'simple' : ''];
}

type DealTab = 'steps' | 'chat' | 'evidence';
type DealRole = 'seller' | 'middleman' | 'buyer' | 'guest' | '';

function readDealTab(input: string | null): DealTab {
  return input === 'chat' || input === 'evidence' || input === 'steps' ? input : 'steps';
}

function isFinishedStatus(status?: string) {
  return status === 'completed' || status === 'cancelled' || status === 'disputed';
}

function isDealParty(deal: Deal | null, userId: string) {
  if (!deal || !userId) return false;
  return [deal.seller_id, deal.middleman_id, deal.buyer_id].includes(userId);
}

export default function DealRoom() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const dealId = params.id as string;
  const requestedTab = searchParams.get('tab');
  const requestedCall = searchParams.get('call') === '1';

  const [deal, setDeal] = useState<Deal | null>(null);
  const [meetup, setMeetup] = useState<MeetupData | null>(null);
  const [priceState, setPriceState] = useState<DealPriceState | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [buyerBank, setBuyerBank] = useState<BankInfo | null>(null);
  const [sellerBank, setSellerBank] = useState<BankInfo | null>(null);
  const [middlemanBank, setMiddlemanBank] = useState<BankInfo | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [middlemen, setMiddlemen] = useState<Middleman[]>([]);
  const [myId, setMyId] = useState('');
  const [myName, setMyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [trackingInput, setTrackingInput] = useState('');
  const [showJitsi, setShowJitsi] = useState(false);
  // ข้อ3: ระหว่างวิดีโอคอล ซ่อนปุ่มลอย "กลับหน้าหลัก" + "บริการลูกค้า" (ผ่าน body.in-call)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('in-call', showJitsi);
    return () => { document.body.classList.remove('in-call'); };
  }, [showJitsi]);
  const [tab, setTab] = useState<DealTab>(readDealTab(requestedTab));
  const [evidenceType, setEvidenceType] = useState('packing');
  const [copied, setCopied] = useState(false);
  const [authHdrs, setAuthHdrs] = useState<Record<string, string>>({});
  const [dealError, setDealError] = useState('');
  const [showSelectMM, setShowSelectMM] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<{ url: string; name: string } | null>(null);
  const [meetAddr, setMeetAddr] = useState<ThaiAddress>(EMPTY_ADDRESS); // ที่อยู่ของฉัน (ดีลนัดรับ)
  const [payOpen, setPayOpen] = useState(false); // เปิดกล่องช่องทางชำระเงินก่อนอัปสลิป
  const [sharingLoc, setSharingLoc] = useState(false); // กำลังแชร์ตำแหน่งระหว่างเดินทาง
  const shareLocTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const headersRef = useRef<Record<string, string>>({});

  const getAuthHeaders = useCallback(async (forceFresh = false) => {
    if (!forceFresh && Object.keys(headersRef.current).length) return headersRef.current;
    const h = await authHeaders();
    headersRef.current = h;
    setAuthHdrs(h);
    return h;
  }, []);

  // ส่งตำแหน่งแบบเงียบ (ไม่ลงแชท/ไม่แจ้งเตือน) — อีกฝ่ายเห็นในแผงนัดรับผ่านรอบโพลปกติ
  const sendPosition = useCallback(async () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const headers = await getAuthHeaders();
        await fetch(`/api/deals/${dealId}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'meetup_position', lat: pos.coords.latitude, lng: pos.coords.longitude }),
        });
      } catch { /* เงียบ */ }
    }, () => { /* ผู้ใช้ไม่อนุญาต */ }, { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 });
  }, [dealId, getAuthHeaders]);

  const stopShareLoc = useCallback(() => {
    if (shareLocTimer.current) { clearInterval(shareLocTimer.current); shareLocTimer.current = null; }
    setSharingLoc(false);
  }, []);

  const startShareLoc = useCallback(() => {
    if (!navigator.geolocation) { alert('เบราว์เซอร์นี้ไม่รองรับการแชร์ตำแหน่ง'); return; }
    if (shareLocTimer.current) return;
    sendPosition(); // ส่งทันทีครั้งแรก (เบราว์เซอร์จะถามสิทธิ์ตำแหน่ง)
    shareLocTimer.current = setInterval(sendPosition, 45000);
    setSharingLoc(true);
  }, [sendPosition]);

  useEffect(() => () => { if (shareLocTimer.current) clearInterval(shareLocTimer.current); }, []);
  useEffect(() => {
    if (deal?.status !== 'completed' && deal?.status !== 'cancelled') return;
    const timer = window.setTimeout(() => { stopShareLoc(); }, 0);
    return () => window.clearTimeout(timer);
  }, [deal?.status, stopShareLoc]);
  const [mmFilter, setMmFilter] = useState({ q: '', province: '', tier: '', minRating: 0, need: '' });
  const [mmLoading, setMmLoading] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const callNotifyAt = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const evidInputRef = useRef<HTMLInputElement>(null);
  const meetupSlipInputRef = useRef<HTMLInputElement>(null);
  const buyerEvidInputRef = useRef<HTMLInputElement>(null);
  const sellerFeeInputRef = useRef<HTMLInputElement>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [callChatOpen, setCallChatOpen] = useState(true);
  const [feeConfig, setFeeConfig] = useState<FeeConfig>(FEE_DEFAULTS);
  const [priceInput, setPriceInput] = useState('');
  const [feePayerInput, setFeePayerInput] = useState<'buyer' | 'seller' | 'split' | ''>('');
  const [showPriceProposal, setShowPriceProposal] = useState(false);
  const callFileInputRef = useRef<HTMLInputElement>(null);
  // wizard แบบง่าย: สถานะ local อย่างเดียว (ไม่บันทึกลง DB) ว่าฉันกด "คุยกันจบแล้ว" ไปดูหน้าหลักฐานหรือยัง
  const [chatReviewReady, setChatReviewReady] = useState(false);
  const chatBundledRef = useRef(false); // กัน bundleChatTranscriptAsEvidence ถูกเรียกซ้ำ
  // wizard แบบง่าย: ขั้นที่กำลังดูอยู่ (ปุ่มย้อนกลับ/ถัดไป) — null แปลว่าให้ตามขั้นจริงปัจจุบันเสมอ
  const [wzViewStep, setWzViewStep] = useState<number | null>(null);
  const [meetupEvidReady, setMeetupEvidReady] = useState(false);
  const [savedEvidIds, setSavedEvidIds] = useState<Set<string>>(new Set());
  const [meetupPropLabel, setMeetupPropLabel] = useState<string | null>(null); // null=hidden ''=custom label
  const [meetupPropAmt, setMeetupPropAmt] = useState('');
  // Pop-Up ตกลงจุดนัด (รวมสถานที่+เงินประกัน+ปรับราคา+ค่าบริการ)
  const [meetupPopOpen, setMeetupPopOpen] = useState(false);
  const [meetupPropPrice, setMeetupPropPrice] = useState('');           // ราคาสินค้าใหม่ ('' = ไม่เปลี่ยน)
  const [meetupPropFeePayer, setMeetupPropFeePayer] = useState<'buyer' | 'seller' | 'split' | ''>(''); // '' = ไม่เปลี่ยน
  // รีเซ็ตกลับไปดูขั้นปัจจุบันเมื่อสถานะดีลเปลี่ยน หรือ meetup ตกลงยอดประกันแล้ว (ขยับไปขั้นวางเงินอัตโนมัติ)
  useEffect(() => { setWzViewStep(null); }, [deal?.status, meetup?.deposit]);

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0'); r.style.setProperty('--accent-strong', '#1f54d6'); r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTab(readDealTab(requestedTab));
      if (requestedCall && isDealParty(deal, myId)) setShowJitsi(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [deal, myId, requestedCall, requestedTab]);

  const fetchDeal = useCallback(async (headers: Record<string, string> = {}) => {
    try {
      const r = await fetch(`/api/deals/${dealId}`, { headers });
      const d = await r.json();
      if (r.ok) {
        const nextDeal = d.deal as Deal;
        setDeal(nextDeal); setDealError('');
        setMeetup(d.meetup || null); setPriceState(d.priceState || null); setEvidence(d.evidence || []);
        setBuyerBank(d.buyerBank || null); setSellerBank(d.sellerBank || null); setMiddlemanBank(d.middlemanBank || null);
        return nextDeal;
      } else setDealError(d.error || `Error ${r.status}`);
    } catch (e: any) { setDealError(e?.message || 'Network error'); }
    return null;
  }, [dealId, setDeal, setDealError]);

  const fetchMsgs = useCallback(async (headers: Record<string, string>, currentDeal: Deal | null = deal, currentUserId = myId) => {
    if (!headers.Authorization || !isDealParty(currentDeal, currentUserId)) return;
    const r = await fetch(`/api/messages?dealId=${dealId}`, { headers }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setMsgs(d.messages || []); }
    else if (r?.status === 401) {
      // token หมดอายุ — ล้าง cache ให้ poll รอบถัดไปขอ token ใหม่จาก Supabase
      headersRef.current = {};
    }
  }, [deal, dealId, myId, setMsgs]);

  useEffect(() => {
    (async () => {
      const loadedDeal = await fetchDeal();
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('guest');
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
        setMyId(user.id); setMyName(profile?.display_name || '');
        const headers = await getAuthHeaders();
        if ((readDealTab(requestedTab) === 'chat' || requestedCall) && isDealParty(loadedDeal, user.id)) {
          await fetchMsgs(headers, loadedDeal, user.id);
        }
      } catch { /* guest */ }
      finally { setLoading(false); }
    })();
  }, [dealId, fetchDeal, fetchMsgs, getAuthHeaders, requestedCall, requestedTab]);

  useEffect(() => {
    if (!dealId) return;
    const timer = window.setInterval(() => { void fetchDeal(headersRef.current); }, isFinishedStatus(deal?.status) ? 45000 : 15000);
    return () => window.clearInterval(timer);
  }, [deal?.status, dealId, fetchDeal]);

  useEffect(() => {
    // poll chat เสมอสำหรับดีล meetup (แชทฝังใน wizard) หรือเมื่ออยู่ tab chat / jitsi
    // หยุด poll เมื่อ meetup เสร็จแล้ว (step 9) — ไม่จำเป็นต้องโหลดแชทใน done screen
    const isMeetupDeal = deal?.deal_type === 'meetup' && deal?.status !== 'completed';
    if (!isDealParty(deal, myId)) return;
    if (tab !== 'chat' && !showJitsi && !isMeetupDeal) return;
    let stopped = false;
    const poll = async () => {
      try {
        const headers = await getAuthHeaders();
        if (!stopped) await fetchMsgs(headers, deal, myId);
      } catch { /* เงียบ */ }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, showJitsi ? 4000 : 5000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [deal, fetchMsgs, getAuthHeaders, myId, showJitsi, tab]);

  // แจ้งผู้ร่วมดีลว่ามีคนเข้ามาดูห้องนี้ — ครั้งเดียวต่อ session ต่อดีล กันสแปม
  const visitSent = useRef(false);
  useEffect(() => {
    if (!deal || !myId || visitSent.current) return;
    visitSent.current = true;
    try {
      const key = `kk.visit.${dealId}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* sessionStorage ใช้ไม่ได้ก็ยังแจ้งได้ */ }
    (async () => {
      try {
        const headers = await getAuthHeaders();
        await fetch(`/api/deals/${dealId}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'visit' }),
        });
      } catch { /* ไม่กระทบการใช้งาน */ }
    })();
  }, [deal, myId, dealId, getAuthHeaders]);

  const loadMiddlemen = useCallback(async (headers: Record<string, string>, f = mmFilter) => {
    setMmLoading(true);
    try {
      const p = new URLSearchParams();
      if (f.q) p.set('q', f.q);
      if (f.province) p.set('province', f.province);
      if (f.tier) p.set('tier', f.tier);
      if (f.need) p.set('need', f.need);
      const r = await fetch(`/api/middlemen?${p}`, { headers });
      const d = await r.json();
      setMiddlemen(d.middlemen || []);
    } catch {} finally { setMmLoading(false); }
  }, [mmFilter, setMiddlemen, setMmLoading]);

  useEffect(() => {
    if (!showSelectMM || !authHdrs.Authorization) return;
    const timer = window.setTimeout(() => { void loadMiddlemen(authHdrs); }, 0);
    return () => window.clearTimeout(timer);
  }, [authHdrs, showSelectMM, loadMiddlemen]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  useEffect(() => { fetch('/api/fees').then(r => r.json()).then(d => { if (d.fees) setFeeConfig(d.fees); }).catch(() => {}); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  async function doAction(action: string, extra: Record<string, unknown> = {}) {
    setActing(true);
    try {
      // ดึง token ใหม่ก่อนทุก action — ป้องกัน cached token หมดอายุ
      const headers = await getAuthHeaders(true);
      if (!headers.Authorization) { alert('กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง'); return; }
      const r = await fetch(`/api/deals/${dealId}`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
      const d = await r.json();
      if (r.ok) {
        // re-fetch ทั้งดีล+meetup+priceState+evidence ให้ตรงกัน (PATCH คืนแค่ deal row)
        const nextDeal = await fetchDeal(headers);
        if ((tab === 'chat' || showJitsi) && isDealParty(nextDeal ?? deal, myId)) await fetchMsgs(headers, nextDeal ?? deal, myId);
      } else if (r.status === 401) {
        headersRef.current = {}; // ล้าง cache
        alert('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่');
      } else {
        alert(d.error || 'เกิดข้อผิดพลาด');
      }
    } finally { setActing(false); }
  }

  async function sendMsg(text: string, type = 'text', fileId = '', fileName = '') {
    if (!text && !fileId) return;
    if (!isDealParty(deal, myId) || !chatIsOpen()) return;
    setSending(true);
    try {
      const headers = await getAuthHeaders();
      await fetch('/api/messages', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId, content: text, type, fileId, fileName, role: myRole }) });
      setChatInput(''); await fetchMsgs(headers, deal, myId);
    } finally { setSending(false); }
  }

  /** โชว์รูปที่เพิ่งเลือกทันทีระหว่างรออัปโหลด — ผู้ใช้เห็นรูปเสมอ ไม่ใช่แค่ชื่อไฟล์ */
  function beginUploadPreview(f: File) {
    const url = f.type.startsWith('image/') ? URL.createObjectURL(f) : '';
    setUploadPreview({ url, name: f.name });
    return url;
  }
  function endUploadPreview(url: string) {
    if (url) URL.revokeObjectURL(url);
    setUploadPreview(null);
  }

  async function uploadFile(file: File, isEvidence = false, evidenceTypeOverride?: string) {
    const purl = beginUploadPreview(file);
    try {
      let fileId = '', fileName = file.name;
      if (file.type.startsWith('video/')) {
        // วิดีโอมักใหญ่เกินลิมิต body ของ API route บน Vercel (~4.5MB) → อัปโหลดตรงเข้า Supabase Storage จากเบราว์เซอร์
        const ext = (file.name.split('.').pop() || 'webm').toLowerCase();
        // โฟลเดอร์ตาม user id — กันชื่อไฟล์ของคนละคนไปกองรวมกันจนแยกไม่ออกในหน้า Storage
        const path = `${myId || 'guest'}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from(DEAL_BUCKET).upload(path, file, { contentType: file.type || 'video/webm' });
        if (error) { alert(`อัปโหลดวิดีโอไม่สำเร็จ: ${error.message}`); return; }
        fileId = path;
      } else {
        const headers = await getAuthHeaders();
        const prepared = await compressImage(file); // บีบอัดเฉพาะรูป
        const form = new FormData(); form.append('file', prepared);
        const r = await fetch('/api/upload-deal', { method: 'POST', headers, body: form });
        const d = await r.json();
        if (!r.ok) { alert(d.error || 'Upload failed'); return; }
        fileId = d.fileId; fileName = d.fileName;
      }
      if (isEvidence) await doAction('add_evidence', { evidenceType: evidenceTypeOverride || evidenceType, fileId, fileName });
      else await sendMsg('', file.type.startsWith('image/') ? 'image' : 'file', fileId, fileName);
    } finally { endUploadPreview(purl); }
  }

  // เก็บข้อความ/รูป/ไฟล์จากแชทเป็นหลักฐาน (บันทึกลงดีลใน database และแสดงในแท็บหลักฐาน)
  async function saveMsgEvidence(m: Msg) {
    if (m.type === 'image' || m.type === 'file') {
      await doAction('add_evidence', { evidenceType: 'chat', fileId: m.file_id, fileName: m.file_name, content: m.sender_name ? `จาก ${m.sender_name}` : '' });
    } else {
      await doAction('add_evidence', { evidenceType: 'chat_text', content: `${m.sender_name || ''}: ${m.content}` });
    }
    setSavedEvidIds(prev => new Set([...prev, m.id]));
  }

  // เก็บวิดีโอคอลที่บันทึกไว้เป็นหลักฐาน (อัปโหลดตรงเข้า Storage ผ่าน uploadFile)
  async function saveCallEvidence(blob: Blob) {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const file = new File([blob], `call-${dealId.slice(0, 8)}-${stamp}.webm`, { type: 'video/webm' });
    await uploadFile(file, true, 'call');
  }

  // ลิงก์แชร์พ่วง openExternalBrowser=1 — ผู้รับที่เปิดจาก LINE จะเด้งไปเบราว์เซอร์หลักอัตโนมัติ
  async function copyLink() { await navigator.clipboard.writeText(withExternalBrowserParam(window.location.href)).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  /** เปิด/ปิดวิดีโอคอล — ตอนเปิดจะแจ้งเตือนทุกฝ่ายในดีล (กันสแปม: แจ้งซ้ำได้ทุก 2 นาที) */
  function toggleCall() {
    if (!isDealParty(deal, myId)) return;
    const opening = !showJitsi;
    setShowJitsi(opening);
    // แจ้งเตือนทุกครั้งที่มีคนล็อกอินเปิดคอล — รวมถึงผู้สนใจที่มาจากลิงก์แชร์ (guest ที่ล็อกอินแล้ว)
    if (opening && myId && Date.now() - callNotifyAt.current > 120000) {
      callNotifyAt.current = Date.now();
      (async () => {
        try {
          const headers = await getAuthHeaders();
          await fetch(`/api/deals/${dealId}`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'start_call' }),
          });
          fetchMsgs(headers, deal, myId);
        } catch { /* แจ้งเตือนไม่สำเร็จ ไม่กระทบการเข้าคอล */ }
      })();
    }
  }

  if (loading) return (
    <div className="dr-root" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'dashSpin .8s linear infinite' }} />
    </div>
  );
  if (!deal) return (
    <div className="dr-root" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 14, padding: 24 }}>
      <p style={{ fontSize: 22 }}>❌ ไม่พบ Deal</p>
      {dealError && <p style={{ fontSize: 13, color: '#b22441', background: '#fdeef1', border: '1px solid #fbd5dd', borderRadius: 'var(--r-md)', padding: '8px 14px' }}>{dealError}</p>}
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>Deal อาจถูกลบหรือลิงก์ไม่ถูกต้อง</p>
      <Link href="/deal/create" className="btn btn-primary">สร้าง Deal ใหม่</Link>
    </div>
  );

  const jitsiRoom = `khonklang-${dealId.slice(0, 10)}`;
  const isMeetup = deal.deal_type === 'meetup';
  const isSimple = deal.deal_type === 'simple';
  const myRole: DealRole = !deal || !myId
    ? (myId ? 'guest' : '')
    : deal.seller_id === myId
      ? 'seller'
      : deal.middleman_id === myId
        ? 'middleman'
        : deal.buyer_id === myId
          ? 'buyer'
          : 'guest';
  // มีคอลกำลังดำเนินอยู่หรือไม่ — ดูจาก system message ล่าสุดที่เป็นวิดีโอคอล (ภายใน 3 นาที)
  let lastCallMsg: Msg | null = null;
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const msg = msgs[i];
    if (msg.role === 'system' && msg.content.includes('วิดีโอคอล')) {
      lastCallMsg = msg;
      break;
    }
  }
  const callLive = !!lastCallMsg && (nowTs - new Date(lastCallMsg.created_at).getTime() < 3 * 60 * 1000);
  const stepIdx = STEP_ORDER.indexOf(deal.status);
  const pct = stepIdx >= 0 ? Math.round((stepIdx / (STEP_ORDER.length - 1)) * 100) : 0;
  const isFinished = ['completed', 'cancelled', 'disputed'].includes(deal.status);

  // ─── Guest / not-logged-in join panel ───────────────────────────────────
  if (myRole === 'guest' || myRole === '') {
    const canBeBuyer = !deal.buyer_id, canBeSeller = !deal.seller_id, notLoggedIn = !myId;
    const dealUrl = typeof window !== 'undefined' ? window.location.href : '';
    function handleJoin(role: 'buyer' | 'seller') {
      if (notLoggedIn) router.push(`/login?returnTo=${encodeURIComponent(dealUrl || `/deal/${dealId}`)}`);
      else doAction(role === 'buyer' ? 'join_as_buyer' : 'join_as_seller');
    }
    return (
      <div className="dr-root">
        <InAppBanner />
        <header className="dr-header">
          <Link href="/" className="dr-back"><Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} /></Link>
          <div className="dr-header-info"><div className="dr-htitle">{deal.title}</div></div>
        </header>
        <div style={{ maxWidth: 440, margin: '0 auto', padding: '40px 16px', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="dr-card">
            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)' }}>{deal.title}</div>
            {deal.description && <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>{deal.description}</p>}
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green-600)', fontFamily: 'var(--font-display)', marginTop: 10 }}>฿{deal.price.toLocaleString()}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
              {deal.seller_name && <span>ผู้ขาย: {deal.seller_name}</span>}
              {deal.buyer_name && <span>ผู้ซื้อ: {deal.buyer_name}</span>}
            </div>
          </div>
          {notLoggedIn && <div style={{ background: '#fef5e3', border: '1px solid #fbe6bf', borderRadius: 'var(--r-md)', padding: '12px 16px', fontSize: 13, color: '#9a6209', textAlign: 'center' }}>⚠️ กรุณาเข้าสู่ระบบก่อนเข้าร่วมดีล</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {canBeBuyer && <AsyncButton onClick={() => handleJoin('buyer')} className="btn btn-primary btn-block btn-lg">{notLoggedIn ? '🔑 เข้าสู่ระบบเพื่อเป็นผู้ซื้อ' : '🛍️ เข้าร่วมเป็นผู้ซื้อ'}</AsyncButton>}
            {canBeSeller && <AsyncButton onClick={() => handleJoin('seller')} className="btn btn-block btn-lg" style={{ background: '#6841d9', color: '#fff' }}>{notLoggedIn ? '🔑 เข้าสู่ระบบเพื่อเป็นผู้ขาย' : '🛒 เข้าร่วมเป็นผู้ขาย'}</AsyncButton>}
            {!canBeBuyer && !canBeSeller && <p style={{ textAlign: 'center', color: 'var(--muted)' }}>ดีลนี้มีผู้ซื้อและผู้ขายครบแล้ว</p>}
          </div>
          <button onClick={copyLink} className="btn btn-ghost btn-block">{copied ? '✅ คัดลอกลิงก์แล้ว' : '🔗 คัดลอกลิงก์แชร์'}</button>
        </div>
      </div>
    );
  }

  function renderMiddlemanPickerPanel(compact = false) {
    const currentDeal = deal!;
    const TIERS = ['', 'Bronze', 'Silver', 'Gold', 'Platinum'];
    const filtered = middlemen
      // คนกลางต้องไม่ใช่ผู้ซื้อหรือผู้ขายในดีลนี้ (3 บทบาทต้องเป็นคนละคน)
      .filter(m => m.userId !== currentDeal.buyer_id && m.userId !== currentDeal.seller_id)
      .filter(m => (mmFilter.minRating === 0 || m.reviewScore >= mmFilter.minRating));
    const TIER_COLOR: Record<string, string> = { Bronze: '#cd7f32', Silver: '#a0a0a0', Gold: '#f5b13d', Platinum: '#9db5c9' };

    return (
      <div className="dr-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div>
            <div className="dr-card-title" style={{ marginBottom: 6 }}>{currentDeal.middleman_id ? 'เปลี่ยนคนกลาง' : 'เลือกคนกลาง'}</div>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>ค้นหาจากชื่อคนกลาง, รหัส, จังหวัด, เทียร์ หรือประเภทงานที่ต้องการ</p>
          </div>
          <button onClick={() => setShowSelectMM(v => !v)} className="btn btn-ghost btn-sm">
            {showSelectMM ? 'ซ่อนรายการ' : compact ? 'เลือกคนกลาง' : 'ปิด'}
          </button>
        </div>

        {showSelectMM && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1.2fr .8fr' }}>
              <input className="dr-select" value={mmFilter.q} onChange={e => setMmFilter(f => ({ ...f, q: e.target.value }))} placeholder="ค้นหาชื่อคนกลางหรือรหัส" />
              <input className="dr-select" value={mmFilter.need} onChange={e => setMmFilter(f => ({ ...f, need: e.target.value }))} placeholder="ความต้องการ เช่น มือถือ รถ" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <input className="dr-select" value={mmFilter.province} onChange={e => setMmFilter(f => ({ ...f, province: e.target.value }))} placeholder="จังหวัด" />
              <select className="dr-select" value={mmFilter.tier} onChange={e => setMmFilter(f => ({ ...f, tier: e.target.value }))}>{TIERS.map(t => <option key={t} value={t}>{t || 'ทุกเทียร์'}</option>)}</select>
              <select className="dr-select" value={mmFilter.minRating} onChange={e => setMmFilter(f => ({ ...f, minRating: parseFloat(e.target.value) }))}>
                <option value={0}>ทุกคะแนน</option><option value={3}>★★★ ขึ้นไป</option><option value={4}>★★★★ ขึ้นไป</option><option value={4.5}>★★★★½ ขึ้นไป</option>
              </select>
            </div>
            <button onClick={() => { if (authHdrs.Authorization) loadMiddlemen(authHdrs, mmFilter); }} disabled={mmLoading} className="btn btn-primary btn-block">{mmLoading ? 'กำลังค้นหา...' : '🔍 ค้นหาคนกลาง'}</button>
            {mmLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><div style={{ width: 28, height: 28, border: '3px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'dashSpin .8s linear infinite' }} /></div>}
            {!mmLoading && filtered.length === 0 && <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)' }}><p>ไม่พบคนกลางที่ตรงกับเงื่อนไข</p></div>}
            {!mmLoading && filtered.map(m => (
              <div key={m.userId} className="dr-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 3 }}>รหัส: {m.code}</div>
                    {m.workProvince && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>📍 {m.workProvince}</div>}
                    {m.categories && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>📦 {m.categories}</div>}
                  </div>
                  <span className="dr-party-tier" style={{ background: TIER_COLOR[m.tier] || 'var(--muted)', alignSelf: 'flex-start' }}>{m.tier}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--amber-500)' }}>{m.reviewCount === 0 ? <span style={{ color: 'var(--faint)' }}>ยังไม่มีรีวิว</span> : <>★ {m.reviewScore.toFixed(1)} <span style={{ color: 'var(--muted)' }}>({m.reviewCount})</span></>}</div>
                {m.phone && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 'var(--r-md)', padding: '10px 14px' }}><span style={{ fontSize: 13, color: 'var(--ink-2)' }}>📞 เบอร์โทร</span><a href={`tel:${m.phone}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-600)' }}>{m.phone}</a></div>}
                <button onClick={() => { doAction('select_middleman', { middlemanId: m.userId, middlemanName: m.name }); setShowSelectMM(false); }} disabled={acting} className="btn btn-green btn-block">{acting ? '...' : '✅ เลือกคนกลางนี้'}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Meetup guarantee panel (รับประกันเดินทาง — ไม่ใช้คนกลาง) ─────────────
  async function uploadMeetupSlip(f: File) {
    const purl = beginUploadPreview(f);
    try {
      const headers = await getAuthHeaders();
      const prepared = await compressImage(f);
      const form = new FormData(); form.append('file', prepared);
      const r = await fetch('/api/upload-deal', { method: 'POST', headers, body: form });
      const d = await r.json();
      if (r.ok) await doAction('meetup_deposit', { fileId: d.fileId });
      else alert(d.error || 'อัปโหลดสลิปไม่สำเร็จ');
    } finally { endUploadPreview(purl); }
  }

  function renderMeetupPanel() {
    if (deal!.deal_type !== 'meetup') return null;
    const md: MeetupData = meetup || {};
    const depositEach = md.deposit || 0;
    const rows: { side: 'buyer' | 'seller'; label: string; prov?: string; fee?: number; slip?: string; met?: boolean; departedAt?: string; pos?: { lat: number; lng: number; at: string } }[] = [
      { side: 'buyer', label: '🛍️ ผู้ซื้อ', prov: md.buyer_loc?.province, fee: md.buyer_fee, slip: md.buyer_slip, met: md.buyer_met, departedAt: md.buyer_departed_at, pos: md.buyer_pos },
      { side: 'seller', label: '🛒 ผู้ขาย', prov: md.seller_loc?.province, fee: md.seller_fee, slip: md.seller_slip, met: md.seller_met, departedAt: md.seller_departed_at, pos: md.seller_pos },
    ];
    const s = deal!.status;
    const depositStage = s === 'payment_pending';
    const meetStage = s === 'meetup_ready';
    const isParty = myRole === 'buyer' || myRole === 'seller';
    const noSlipsYet = !md.buyer_slip && !md.seller_slip;
    const canNegotiate = isParty && noSlipsYet && ['posted', 'waiting_seller', 'waiting_buyer', 'buyer_joined', 'terms_pending', 'payment_pending'].includes(s);

    function proposeDeposit(meetLabel?: string, suggested?: number) {
      const v = prompt(
        `${meetLabel ? `จุดนัด: ${meetLabel}\n` : ''}เสนอยอดเงินประกัน (บาท/ฝ่าย — เท่ากันทั้งคู่)`,
        String(suggested || depositEach || 500),
      );
      if (v === null) return;
      const amount = Math.round(Number(v));
      if (!(amount >= 50)) { alert('กรอกตัวเลขขั้นต่ำ ฿50'); return; }
      doAction('meetup_propose', meetLabel ? { amount, meetLabel } : { amount });
    }

    // ข้อมูลที่อยู่สองฝ่าย + ตัวเลขแนะนำ (จากระยะระดับจังหวัด — ของจริงตกลงกันเอง)
    const myLoc = myRole === 'buyer' ? md.buyer_loc : myRole === 'seller' ? md.seller_loc : undefined;
    const bothLocs = !!(md.buyer_loc?.province && md.seller_loc?.province);
    const provDist = bothLocs ? distanceKm(md.buyer_loc!.province, md.seller_loc!.province) : 0;
    const suggestAmount = Math.max(100, Math.ceil((provDist * 2 * 5) / 50) * 50);
    const meetOptions = bothLocs ? [
      { label: `ผู้ซื้อเดินทางไปหาผู้ขาย (${addressLabel(md.seller_loc)})`, sub: 'ผู้ขายไม่ต้องเดินทาง' },
      { label: `ผู้ขายเดินทางมาหาผู้ซื้อ (${addressLabel(md.buyer_loc)})`, sub: 'ผู้ซื้อไม่ต้องเดินทาง' },
      { label: `เจอกันครึ่งทาง (~จ.${midpointProvince(md.buyer_loc!.province, md.seller_loc!.province)})`, sub: 'แบ่งกันเดินทางคนละครึ่ง' },
    ] : [];

    return (
      <div className="dr-card">
        <div className="dr-card-title">🚗 รับประกันเดินทาง (ไม่ใช้คนกลาง)</div>
        {/* สรุปข้อตกลงปัจจุบัน */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 12 }}>
          {md.deposit ? (
            <>
              <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>📍 <b>{md.meet_label || 'จุดนัดตามตกลง'}</b> · เงินประกัน<b>เท่ากันทั้งคู่</b>:</span>
              <b style={{ fontSize: 17, color: 'var(--accent-strong)', fontFamily: 'var(--font-display)' }}>฿{depositEach.toLocaleString()} / ฝ่าย</b>
              {canNegotiate && !md.pending_deposit && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => proposeDeposit()}>✏️ ขอเปลี่ยนยอด</button>
              )}
            </>
          ) : (
            <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>⏳ <b>ยังไม่ตกลงจุดนัดพบและยอดประกัน</b> — ระบุที่อยู่ทั้งสองฝ่าย แล้วเสนอข้อตกลงด้านล่าง (คุยรายละเอียดในแชทได้)</span>
          )}
        </div>

        {/* ที่อยู่ของสองฝ่าย (ต/อ/จ) */}
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          {([['buyer', '🛍️ ผู้ซื้อ', md.buyer_loc], ['seller', '🛒 ผู้ขาย', md.seller_loc]] as const).map(([side, label, loc]) => (
            <div key={side} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>{label}:</b>
              {loc?.province
                ? <span style={{ color: 'var(--green-600)' }}>📍 {addressLabel(loc)}</span>
                : <span style={{ color: 'var(--faint)' }}>ยังไม่ระบุที่อยู่</span>}
            </div>
          ))}
        </div>
        {isParty && !myLoc?.province && !md.buyer_slip && !md.seller_slip && (
          <div style={{ border: '1.5px dashed color-mix(in srgb, var(--accent) 40%, var(--line))', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 12, background: 'var(--surface-2)' }}>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-display)', marginBottom: 8 }}>📍 ระบุที่อยู่ของคุณ (ถึงระดับตำบล)</p>
            <AddressPicker value={meetAddr} onChange={setMeetAddr} compact />
            <button type="button" className="btn btn-primary btn-sm btn-block" style={{ marginTop: 10 }}
              disabled={acting || !meetAddr.tambon}
              onClick={() => doAction('meetup_set_location', { loc: meetAddr })}>
              บันทึกที่อยู่ของฉัน
            </button>
          </div>
        )}

        {/* ข้อเสนอจุดนัด + ยอดประกัน (เมื่อรู้ที่อยู่ครบสองฝ่าย) */}
        {bothLocs && !md.deposit && !md.pending_deposit && canNegotiate && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', fontFamily: 'var(--font-display)', marginBottom: 8 }}>
              เสนอข้อตกลง (ระยะห่างโดยประมาณ ~{provDist.toLocaleString()} กม. · แนะนำ ฿{suggestAmount.toLocaleString()}/ฝ่าย — แก้ตัวเลขได้)
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {meetOptions.map(o => (
                <button key={o.label} type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: 'space-between', textAlign: 'left' }}
                  onClick={() => proposeDeposit(o.label, suggestAmount)}>
                  <span>{o.label}<br /><small style={{ color: 'var(--muted)', fontWeight: 400 }}>{o.sub}</small></span>
                  <span style={{ color: 'var(--accent-strong)', fontWeight: 700 }}>เสนอ →</span>
                </button>
              ))}
              <button type="button" className="btn btn-soft btn-sm" onClick={() => {
                const place = prompt('ระบุจุดนัดพบเอง เช่น "ปั๊ม ปตท. อ.วังน้อย" หรือ "ห้างเซ็นทรัล อยุธยา"');
                if (place && place.trim()) proposeDeposit(`นัดเจอที่ ${place.trim()}`, suggestAmount);
              }}>📌 กำหนดจุดนัดพบเอง</button>
            </div>
          </div>
        )}

        {/* ข้อเสนอที่รอการตอบรับ — เด้งให้อีกฝ่ายกดยอมรับ/ไม่ยอมรับ */}
        {md.pending_deposit && (
          md.pending_by === myRole ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, background: '#fef5e3', border: '1px solid #fbe6bf', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 12, fontSize: 13.5, color: '#9a6209' }}>
              ⏳ คุณเสนอ{md.pending_meet_label ? <>จุดนัด <b>{md.pending_meet_label}</b> + </> : 'เปลี่ยน'}เงินประกัน <b>฿{Number(md.pending_deposit).toLocaleString()}/ฝ่าย</b> — รออีกฝ่ายตอบรับ
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} disabled={acting} onClick={() => doAction('meetup_respond', { accept: false })}>ยกเลิกข้อเสนอ</button>
            </div>
          ) : isParty ? (
            <div style={{ background: '#fef5e3', border: '1.5px solid var(--amber-400)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 12 }}>
              <p style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                💰 {md.pending_by === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}เสนอ{md.pending_meet_label ? `จุดนัด "${md.pending_meet_label}" + ` : 'เปลี่ยน'}เงินประกัน ฿{Number(md.pending_deposit).toLocaleString()}/ฝ่าย
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" className="btn btn-green btn-sm" disabled={acting} onClick={() => doAction('meetup_respond', { accept: true })}>✅ ยอมรับ</button>
                <button type="button" className="btn btn-danger btn-sm" disabled={acting} onClick={() => doAction('meetup_respond', { accept: false })}>❌ ไม่ยอมรับ</button>
              </div>
            </div>
          ) : null
        )}
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map(r => (
            <div key={r.side} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px', background: 'var(--surface-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontSize: 13.5 }}>
                <b style={{ color: 'var(--ink)' }}>{r.label} ({r.prov || '-'})</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
                <span style={{ color: 'var(--muted)' }}>เงินประกัน (ได้คืน) + ค่าธรรมเนียม</span>
                <b style={{ color: 'var(--green-600)' }}>฿{depositEach.toLocaleString()} + ฿{(r.fee || 0).toLocaleString()}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, color: r.slip ? 'var(--green-600)' : 'var(--faint)' }}>
                  {r.slip ? '✅ วางเงินประกันแล้ว' : '⏳ ยังไม่วางเงินประกัน'}
                  {meetStage || s === 'completed'
                    ? (r.met ? ' · ✅ เจอกันแล้ว' : r.departedAt ? ' · 🚗 กำลังเดินทาง' : ' · ⏳ ยังไม่ออกเดินทาง')
                    : ''}
                </span>
                {depositStage && myRole === r.side && !r.slip && !md.pending_deposit && !!md.deposit && (
                  <button type="button" className="btn btn-green btn-sm" onClick={() => setPayOpen(v => !v)}>
                    💳 ชำระเงินประกัน ฿{(depositEach + (r.fee || 0)).toLocaleString()}
                  </button>
                )}
                {/* ลำดับ: เริ่มออกเดินทางก่อน → ค่อยยืนยันนัดเจอ (โอนเสร็จไม่ได้แปลว่าออกเดินทางทันที) */}
                {meetStage && myRole === r.side && !r.departedAt && (
                  <button className="btn btn-primary btn-sm" disabled={acting} onClick={() => {
                    if (!confirm('เริ่มออกเดินทางตอนนี้? อีกฝ่ายจะได้รับแจ้งเตือนทันที')) return;
                    doAction('meetup_depart');
                    if (confirm('แชร์ตำแหน่งให้คู่ดีลเห็นระหว่างเดินทางไหม?\n(อัปเดตทุก ~45 วินาที เฉพาะตอนเปิดหน้านี้ — ปิดได้ตลอด)')) startShareLoc();
                  }}>🚗 เริ่มออกเดินทาง</button>
                )}
                {meetStage && myRole === r.side && !!r.departedAt && !r.met && (
                  <>
                    <button className="btn btn-green btn-sm" disabled={acting} onClick={() => { if (confirm('ยืนยันว่านัดเจอกันสำเร็จแล้ว?')) { stopShareLoc(); doAction('meetup_met'); } }}>
                      ✅ ยืนยันนัดเจอสำเร็จ
                    </button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => (sharingLoc ? stopShareLoc() : startShareLoc())}>
                      {sharingLoc ? '🛰️ กำลังแชร์ตำแหน่ง — กดเพื่อหยุด' : '🛰️ แชร์ตำแหน่งให้อีกฝ่าย'}
                    </button>
                  </>
                )}
                {r.slip && <a href={fileUrl(r.slip)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent-strong)', textDecoration: 'underline' }}>ดูสลิป</a>}
              </div>
              {/* สถานะการเดินทาง: เวลาออกเดินทาง + ตำแหน่งล่าสุด (เปิดดูแผนที่ได้) */}
              {(meetStage || s === 'completed') && r.departedAt && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--line)' }}>
                  🚗 ออกเดินทางเมื่อ {new Date(r.departedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  {r.pos && !r.met && (
                    <>
                      {' '}· 🛰️ ตำแหน่งล่าสุด {Math.max(0, Math.floor((nowTs - new Date(r.pos.at).getTime()) / 60000))} นาทีที่แล้ว —{' '}
                      <a href={`https://www.google.com/maps?q=${r.pos.lat},${r.pos.lng}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-strong)', textDecoration: 'underline' }}>
                        ตำแหน่งปัจจุบัน
                      </a>
                    </>
                  )}
                  {!r.pos && !r.met && myRole !== r.side && ' · อีกฝ่ายยังไม่ได้แชร์ตำแหน่ง'}
                </div>
              )}
            </div>
          ))}
        </div>
        {/* กล่องชำระเงิน: เด้ง QR/บัญชีบริษัทก่อน แล้วค่อยปุ่มอัปสลิป */}
        {depositStage && payOpen && isParty && !md.pending_deposit && !!md.deposit && (() => {
          const myFee = myRole === 'buyer' ? (md.buyer_fee || 0) : (md.seller_fee || 0);
          const mySlip = myRole === 'buyer' ? md.buyer_slip : md.seller_slip;
          if (mySlip) return null;
          return (
            <div style={{ marginTop: 12 }}>
              <PaymentMethods
                amount={depositEach + myFee}
                note={`เงินประกัน ฿${depositEach.toLocaleString()} + ค่าธรรมเนียม ฿${myFee.toLocaleString()} — มาตามนัดได้เงินประกันคืน ฿${depositEach.toLocaleString()} เต็มจำนวน`}
              />
              <label className="btn btn-green btn-block" style={{ cursor: 'pointer', marginTop: 10 }}>
                📎 โอนแล้ว — อัปโหลดสลิปวางประกัน
                <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadMeetupSlip(f); e.target.value = ''; }} />
              </label>
            </div>
          );
        })()}
        {meetStage && (
          <p style={{ fontSize: 12.5, color: 'var(--green-600)', marginTop: 12 }}>✅ เงินประกันครบทั้งสองฝ่าย — นัดเจอกันที่ {md.meet_label || 'จุดที่ตกลงกัน'} เมื่อเจอกันแล้วให้กดยืนยันทั้งคู่</p>
        )}
        {s === 'completed' && (
          <p style={{ fontSize: 12.5, color: 'var(--green-600)', marginTop: 12 }}>🎉 นัดเจอสำเร็จ — บริษัท คนกลาง จำกัด จะโอนเงินประกันคืนทั้งสองฝ่ายเต็มจำนวน (เก็บเฉพาะค่าธรรมเนียม)</p>
        )}
      </div>
    );
  }

  // ─── Price + fee-payer agreement ─────────────────────────────────────────
  function renderPricePanel() {
    if (deal!.deal_type === 'meetup') return null;
    // แสดงเฉพาะช่วงก่อนชำระเงิน
    if (!['posted', 'waiting_seller', 'waiting_buyer', 'buyer_joined', 'terms_pending', 'payment_pending'].includes(deal!.status)) return null;
    if (myRole === 'guest' || myRole === '') return null;
    const pd: DealPriceState = priceState || {};
    const hasMm = !!deal!.middleman_id;
    const fpName = (fp?: string) => fp === 'seller' ? 'ผู้ขายจ่าย' : fp === 'split' ? 'หารครึ่ง' : 'ผู้ซื้อจ่าย';
    const meAgreed = (myRole === 'seller' && pd.seller_agreed) || (myRole === 'buyer' && pd.buyer_agreed) || (myRole === 'middleman' && pd.middleman_agreed);
    const canProposeNewPrice = myRole === 'buyer' || myRole === 'seller';
    const isRepriceFlow = pd.proposal_kind === 'reprice' && !!pd.proposed_price;
    const currentFeePayer = pd.proposed_fee_payer || deal!.fee_payer || 'split';
    const selectedFeePayer = feePayerInput || currentFeePayer;
    const proposerLabel = pd.proposed_by === 'buyer' ? 'ผู้ซื้อ' : pd.proposed_by === 'seller' ? 'ผู้ขาย' : pd.proposed_by === 'middleman' ? 'คนกลาง' : 'มีผู้เสนอ';
    return (
      <div className="dr-card">
        <div className="dr-card-title">💬 ตกลงราคา & ค่าบริการ</div>
        {pd.agreed ? (
          <div style={{ fontSize: 14, color: 'var(--green-700)', background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 'var(--r-md)', padding: '10px 14px' }}>
            ✅ ตกลงราคาแล้ว <b>฿{Number(pd.proposed_price || deal!.price).toLocaleString()}</b> · ค่าบริการ: {fpName(selectedFeePayer)}
            {hasMm && pd.mm_deposit_held ? ` · คนกลางวางเครดิตประกัน ฿${Number(pd.mm_deposit_held).toLocaleString()}` : ''}
          </div>
        ) : isRepriceFlow ? (
          <div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>{proposerLabel}เสนอราคาใหม่: <b>฿{Number(pd.proposed_price).toLocaleString()}</b> · ค่าบริการ: {fpName(pd.proposed_fee_payer)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              {[['ผู้ขาย', pd.seller_agreed], ['ผู้ซื้อ', pd.buyer_agreed], ...(hasMm ? [['คนกลาง', pd.middleman_agreed] as [string, boolean]] : [])].map(([l, ok]) => (
                <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--muted)' }}>{l}</span><span style={{ color: ok ? 'var(--green-600)' : 'var(--faint)' }}>{ok ? '✅ ตกลงแล้ว' : '⏳ รอ'}</span></div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {(['buyer', 'seller', 'split'] as const).map(fp => (
                <button key={fp} type="button" onClick={() => setFeePayerInput(fp)} className={`btn btn-sm ${selectedFeePayer === fp ? 'btn-primary' : 'btn-ghost'}`}>{fpName(fp)}</button>
              ))}
            </div>
            {!meAgreed && (
              <AsyncButton className="btn btn-green btn-block" onClick={() => doAction('price_agree', { feePayer: selectedFeePayer })}>
                {myRole === 'middleman' ? '✅ อนุมัติดีล + วางเครดิตประกัน' : '✅ ตกลงราคานี้'}
              </AsyncButton>
            )}
            {meAgreed && <p style={{ fontSize: 13, color: 'var(--green-600)', textAlign: 'center' }}>✅ คุณตกลงแล้ว — รอฝ่ายอื่น</p>}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 14, color: 'var(--ink)', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '10px 14px' }}>
              ใช้ราคาเดิมจากสินค้านี้: <b>฿{deal!.price.toLocaleString()}</b>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
              {(['buyer', 'seller', 'split'] as const).map(fp => (
                <button key={fp} type="button" onClick={() => setFeePayerInput(fp)} className={`btn btn-sm ${selectedFeePayer === fp ? 'btn-primary' : 'btn-ghost'}`}>{fpName(fp)}</button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[['ผู้ขาย', pd.seller_agreed], ['ผู้ซื้อ', pd.buyer_agreed], ...(hasMm ? [['คนกลาง', pd.middleman_agreed] as [string, boolean]] : [])].map(([l, ok]) => (
                <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--muted)' }}>{l}</span><span style={{ color: ok ? 'var(--green-600)' : 'var(--faint)' }}>{ok ? '✅ รับรู้/ยืนยันแล้ว' : '⏳ รอ'}</span></div>
              ))}
            </div>
            {!meAgreed ? (
              <AsyncButton className="btn btn-green btn-block" onClick={() => doAction('price_agree', { feePayer: selectedFeePayer })}>
                {myRole === 'middleman' ? '✅ รับรู้ราคาเดิมและอนุมัติดีล' : '✅ ใช้ราคาเดิมนี้'}
              </AsyncButton>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--green-600)', textAlign: 'center' }}>✅ คุณยืนยันราคาเดิมแล้ว — รอฝ่ายอื่น</p>
            )}
            <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>ถ้าไม่มีใครกดเสนอราคาใหม่ ระบบจะใช้ราคานี้เป็นราคาปัจจุบันของดีล</p>
          </div>
        )}

        {!pd.agreed && canProposeNewPrice && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            {!showPriceProposal ? (
              <button type="button" className="btn btn-ghost btn-block" onClick={() => { setShowPriceProposal(true); setPriceInput(String(deal!.price || '')); }}>
                💬 เสนอราคาใหม่
              </button>
            ) : (
              <>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 6 }}>เสนอราคาใหม่ (ผู้ซื้อหรือผู้ขายเป็นผู้เสนอได้)</div>
                <input type="number" className="dr-select" value={priceInput} onChange={e => setPriceInput(e.target.value)} placeholder={`ราคา (บาท) — ปัจจุบัน ฿${deal!.price.toLocaleString()}`} style={{ marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  {(['buyer', 'seller', 'split'] as const).map(fp => (
                    <button key={fp} type="button" onClick={() => setFeePayerInput(fp)} className={`btn btn-sm ${selectedFeePayer === fp ? 'btn-primary' : 'btn-ghost'}`}>{fpName(fp)}</button>
                  ))}
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <button className="btn btn-primary btn-block" disabled={acting} onClick={() => { const p = Math.round(Number(priceInput)); if (!(p >= 1)) { alert('กรอกราคาให้ถูกต้อง'); return; } doAction('price_propose', { price: p, feePayer: selectedFeePayer }); setShowPriceProposal(false); setPriceInput(''); }}>
                    💬 เสนอราคาใหม่ ค่าบริการ: {fpName(selectedFeePayer)}
                  </button>
                  <button type="button" className="btn btn-ghost btn-block" onClick={() => { setShowPriceProposal(false); setPriceInput(''); }}>
                    ปิดการเสนอราคาใหม่
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Evidence-done step (ก่อนโอนเงิน) ────────────────────────────────────
  function renderEvidenceDonePanel() {
    if (deal!.deal_type === 'meetup') return null;
    if (!['buyer_joined', 'terms_pending', 'payment_pending'].includes(deal!.status)) return null;
    if (myRole === 'guest' || myRole === '') return null;
    const pd: DealPriceState = priceState || {};
    if (!pd.agreed) return null; // ต้องตกลงราคาก่อน
    const hasMm = !!deal!.middleman_id;
    const allDone = !!(pd.evidence_done_buyer && pd.evidence_done_seller && (!hasMm || pd.evidence_done_middleman));
    if (allDone) return null;
    const meDone = (myRole === 'seller' && pd.evidence_done_seller) || (myRole === 'buyer' && pd.evidence_done_buyer) || (myRole === 'middleman' && pd.evidence_done_middleman);
    return (
      <div className="dr-card">
        <div className="dr-card-title">📁 เก็บหลักฐานก่อนโอนเงิน</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>คุยรายละเอียด ดูสินค้า เก็บหลักฐานในแชต/วิดีโอคอลให้เรียบร้อย แล้วกดยืนยัน — ทุกฝ่ายต้องยืนยันก่อนเข้าขั้นโอนเงิน</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          {[['ผู้ขาย', pd.evidence_done_seller], ['ผู้ซื้อ', pd.evidence_done_buyer], ...(hasMm ? [['คนกลาง', pd.evidence_done_middleman] as [string, boolean]] : [])].map(([l, ok]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--muted)' }}>{l}</span><span style={{ color: ok ? 'var(--green-600)' : 'var(--faint)' }}>{ok ? '✅ เก็บหลักฐานแล้ว' : '⏳ รอ'}</span></div>
          ))}
        </div>
        {!meDone
          ? <AsyncButton className="btn btn-primary btn-block" onClick={() => doAction('evidence_done')}>✅ เก็บหลักฐานเสร็จสิ้น</AsyncButton>
          : <p style={{ fontSize: 13, color: 'var(--green-600)', textAlign: 'center' }}>✅ คุณยืนยันแล้ว — รอฝ่ายอื่น</p>}
      </div>
    );
  }

  // ─── Payment section ─────────────────────────────────────────────────────
  function renderPaymentSection() {
    if (deal!.deal_type === 'meetup') return null;
    if (!['payment_pending', 'payment_uploaded'].includes(deal!.status)) return null;
    return (
        <div className="dr-card dr-pay-card">
        {(() => {
          const pd: DealPriceState = priceState || {};
          const fb = computeDealFees(feeConfig, deal!.price, deal!.deal_type);
          const fp = String(deal!.fee_payer || pd.proposed_fee_payer || 'split');
          const sellerShare = fp === 'seller' ? fb.total : fp === 'split' ? (fb.total - Math.round(fb.total / 2)) : 0;
          const buyerShare = fb.total - sellerShare;
          const buyerTotal = deal!.price + buyerShare;
          const sellerNet = Math.max(deal!.price, 0);
          const priceAgreed = !!pd.agreed;
          const hasMm = !!deal!.middleman_id;
          const evidenceDone = !!(pd.evidence_done_buyer && pd.evidence_done_seller && (!hasMm || pd.evidence_done_middleman));
          const fpName = fp === 'seller' ? 'ผู้ขายจ่าย' : fp === 'split' ? 'หารครึ่ง' : 'ผู้ซื้อจ่าย';
          const payTitle = myRole === 'buyer'
            ? '💳 ยอดที่คุณต้องโอน'
            : myRole === 'seller'
              ? '💳 ค่าบริการฝั่งผู้ขาย'
              : '💳 สรุปการชำระเงิน';
          const payAmount = myRole === 'buyer'
            ? buyerTotal
            : myRole === 'seller'
              ? sellerShare
              : buyerTotal;
          return (
            <>
              <div className="dr-card-title">{payTitle}</div>
              <div className="dr-pay-amount">฿{payAmount.toLocaleString()}</div>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '10px 14px', margin: '4px 0 12px', fontSize: 13 }}>
                <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>📋 สรุปยอด · ค่าบริการ: {fpName}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', padding: '2px 0' }}><span>ราคาสินค้า</span><span>฿{deal!.price.toLocaleString()}</span></div>
                {fb.lines.map(l => (<div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', padding: '2px 0' }}><span>{l.label}</span><span>฿{l.amount.toLocaleString()}</span></div>))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--ink)', borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}><span>ผู้ซื้อโอนเข้าศูนย์กลาง</span><span>฿{buyerTotal.toLocaleString()}</span></div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>= ราคาสินค้า ฿{deal!.price.toLocaleString()} + ค่าบริการส่วนผู้ซื้อ ฿{buyerShare.toLocaleString()}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: sellerShare > 0 ? '#8a5a00' : 'var(--muted)', marginTop: 4 }}><span>ผู้ขายชำระค่าบริการแยก</span><span>{sellerShare > 0 ? `฿${sellerShare.toLocaleString()}` : '฿0'}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', marginTop: 4 }}><span>ยอดสุทธิที่ผู้ขายได้รับเมื่อดีลสำเร็จ</span><span>฿{sellerNet.toLocaleString()}</span></div>
              </div>

              {deal!.status === 'payment_pending' && myRole === 'buyer' && (
                !priceAgreed ? <p style={{ fontSize: 13, color: '#b22441' }}>⚠️ ต้องตกลงราคาในขั้นตอน &quot;ตกลงราคา&quot; ให้ครบทุกฝ่ายก่อน จึงจะโอนเงินได้</p>
                : !evidenceDone ? <p style={{ fontSize: 13, color: '#b22441' }}>⚠️ ทุกฝ่ายต้องกด &quot;เก็บหลักฐานเสร็จสิ้น&quot; ก่อน จึงจะโอนเงินได้</p>
                : (<>
                    <PaymentMethods amount={buyerTotal} note={`เงินจะพักไว้กับ บริษัท คนกลาง จำกัด และโอนให้ผู้ขายเมื่อคุณยืนยันรับสินค้าแล้วเท่านั้น`} />
                    <button onClick={() => evidInputRef.current?.click()} className="btn btn-green btn-block" style={{ marginTop: 12 }}>📎 โอนแล้ว — อัปโหลดสลิป</button>
                  </>)
              )}
              {deal!.status === 'payment_pending' && myRole !== 'buyer' && myRole !== 'seller' && (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>รอผู้ซื้อโอนเงินเข้าระบบพักเงินของบริษัท</div>
              )}

              {/* ผู้ขายโอนค่าบริการส่วนของตน — ทันที แยกจากยอดสินค้า */}
              {myRole === 'seller' && sellerShare > 0 && priceAgreed && ['payment_pending', 'payment_uploaded'].includes(deal!.status) && (
                pd.seller_fee_slip
                  ? <div className="dr-slip-status">✅ คุณโอนค่าบริการ ฿{sellerShare.toLocaleString()} แล้ว — รอศูนย์กลางตรวจสอบ</div>
                  : <div style={{ background: '#fff8ef', border: '1px solid #ffe0b2', borderRadius: 'var(--r-md)', padding: '12px 14px', marginTop: 12 }}>
                      <div style={{ fontWeight: 700, color: '#8a5a00', marginBottom: 6 }}>⚡ ค่าบริการส่วนของคุณ ฿{sellerShare.toLocaleString()} — โอนทันที</div>
                      <PaymentMethods amount={sellerShare} note="โอนค่าบริการส่วนของผู้ขายเข้าศูนย์กลาง แล้วอัปโหลดสลิป (แยกจากยอดสินค้า)" />
                      <button onClick={() => sellerFeeInputRef.current?.click()} className="btn btn-green btn-block" style={{ marginTop: 12 }}>📎 โอนค่าบริการแล้ว — อัปโหลดสลิป</button>
                    </div>
              )}
              {deal!.status === 'payment_uploaded' && myRole === 'buyer' && <div className="dr-slip-status">✅ ส่งสลิปแล้ว — {isSimple ? 'รอศูนย์กลางยืนยันรับเงิน' : 'รอคนกลางยืนยัน'}</div>}
            </>
          );
        })()}
        <input ref={evidInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
          onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const purl = beginUploadPreview(f); try { const headers = await getAuthHeaders(); const prepared = await compressImage(f); const form = new FormData(); form.append('file', prepared); const r = await fetch('/api/upload-deal', { method: 'POST', headers, body: form }); const d = await r.json(); if (r.ok) await doAction('upload_payment', { fileId: d.fileId }); else alert(d.error || 'อัปโหลดสลิปไม่สำเร็จ'); } finally { endUploadPreview(purl); } e.target.value = ''; }} />
        <input ref={sellerFeeInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
          onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const purl = beginUploadPreview(f); try { const headers = await getAuthHeaders(); const prepared = await compressImage(f); const form = new FormData(); form.append('file', prepared); const r = await fetch('/api/upload-deal', { method: 'POST', headers, body: form }); const d = await r.json(); if (r.ok) await doAction('seller_fee_paid', { fileId: d.fileId }); else alert(d.error || 'อัปโหลดสลิปไม่สำเร็จ'); } finally { endUploadPreview(purl); } e.target.value = ''; }} />
      </div>
    );
  }

  // ─── สลิปทั้งหมดในดีล — ทุกฝ่าย (ผู้ซื้อ/ผู้ขาย/คนกลาง/แอดมิน) ต้องเห็นเหมือนกัน ───
  function renderAllSlipsCard() {
    const md: MeetupData = meetup || {};
    const pd: DealPriceState = priceState || {};
    const slips: { label: string; fileId: string }[] = [];
    if (deal!.payment_slip_file_id) slips.push({ label: 'สลิปโอนเงินค่าสินค้า (ผู้ซื้อ)', fileId: deal!.payment_slip_file_id });
    if (pd.seller_fee_slip) slips.push({ label: 'สลิปค่าบริการ (ผู้ขาย)', fileId: pd.seller_fee_slip });
    if (pd.payout_slip_file_id) slips.push({ label: 'สลิปโอนเงินจากศูนย์กลางถึงผู้ขาย', fileId: pd.payout_slip_file_id });
    if (pd.refund_slip_file_id) slips.push({ label: 'สลิปคืนเงินจากศูนย์กลางถึงผู้ซื้อ', fileId: pd.refund_slip_file_id });
    if (md.buyer_slip) slips.push({ label: 'สลิปเงินประกันนัดเจอ (ผู้ซื้อ)', fileId: md.buyer_slip });
    if (md.seller_slip) slips.push({ label: 'สลิปเงินประกันนัดเจอ (ผู้ขาย)', fileId: md.seller_slip });
    if (slips.length === 0) return null;
    return (
      <div className="dr-card">
        <div className="dr-card-title">📎 สลิปทั้งหมดในดีล (ผู้ซื้อ/ผู้ขาย/คนกลาง/แอดมินเห็นเหมือนกัน)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {slips.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 4 }}>{s.label}</div>
              <a href={fileUrl(s.fileId)} target="_blank" rel="noreferrer">
                <img src={fileUrl(s.fileId)} alt={s.label} style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }} />
              </a>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── สรุปการเงิน: เลขดีล + บัญชีรับเงินทุกฝ่าย + ยอดที่ต้องคืน/โอนเมื่อจบดีล ──
  function renderFinanceSummaryCard() {
    const pd: DealPriceState = priceState || {};
    const md: MeetupData = meetup || {};
    const isMt = deal!.deal_type === 'meetup';
    const fb = computeDealFees(feeConfig, deal!.price, deal!.deal_type);
    const fp = String(deal!.fee_payer || pd.proposed_fee_payer || 'split');
    const sellerShare = fp === 'seller' ? fb.total : fp === 'split' ? (fb.total - Math.round(fb.total / 2)) : 0;
    const buyerShare = fb.total - sellerShare;
    const sellerNet = Math.max(deal!.price, 0);
    const finished = deal!.status === 'completed';

    const rows: { who: string; bank?: BankInfo | null; note: string }[] = [
      { who: 'ผู้ขาย', bank: sellerBank, note: isMt
          ? `รับเงินประกันคืน ฿${Number(md.deposit || 0).toLocaleString()} เมื่อนัดเจอสำเร็จ`
          : finished ? `ได้รับแล้ว ฿${sellerNet.toLocaleString()}` : `จะได้รับสุทธิ ฿${sellerNet.toLocaleString()} เมื่อดีลสำเร็จ` },
      { who: 'ผู้ซื้อ', bank: buyerBank, note: isMt
          ? `รับเงินประกันคืน ฿${Number(md.deposit || 0).toLocaleString()} เมื่อนัดเจอสำเร็จ`
          : 'ผู้โอนเงินเข้าระบบ (ไม่มีเงินคืน เว้นแต่ยกเลิก/ข้อพิพาท)' },
    ];
    if (deal!.middleman_id) rows.push({ who: 'คนกลาง', bank: middlemanBank, note: 'รับค่าบริการคนกลางตามรอบจ่ายของระบบ' });

    return (
      <div className="dr-card">
        <div className="dr-card-title">🧾 สรุปการเงิน — เลขดีล {dealCode(deal!.id)}</div>
        {!isMt && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 10, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}><span>ราคาสินค้า</span><span>฿{deal!.price.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}><span>ค่าบริการรวม</span><span>฿{fb.total.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--ink)', borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}><span>ผู้ขายได้รับสุทธิ{finished ? '' : ' (เมื่อดีลสำเร็จ)'}</span><span>฿{sellerNet.toLocaleString()}</span></div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {rows.map(r => (
            <div key={r.who} style={{ padding: '9px 0', borderBottom: '1px solid var(--line-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--muted)' }}>{r.who}</span>
                <span style={{ fontWeight: 600, color: 'var(--ink)', textAlign: 'right' }}>{bankLine(r.bank)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{r.note}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Action panel ────────────────────────────────────────────────────────
  function renderActionPanel() {
    const s = deal!.status;
    const btns: { label: string; cls: string; fn: () => void | Promise<unknown> }[] = [];
    if (['buyer_joined', 'terms_pending'].includes(s)) {
      const accepted = (myRole === 'seller' && deal!.seller_accepted_terms) || (myRole === 'middleman' && deal!.middleman_accepted_terms) || (myRole === 'buyer' && deal!.buyer_accepted_terms);
      if (!accepted) btns.push({ label: '✅ ยอมรับเงื่อนไขข้อตกลง', cls: 'btn-primary', fn: () => setShowTerms(true) });
      else return <p style={{ color: 'var(--green-600)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>✅ คุณยอมรับเงื่อนไขแล้ว — รอฝ่ายอื่น</p>;
    }
    if (s === 'payment_uploaded' && myRole === 'middleman') btns.push({ label: '✅ ยืนยันรับเงิน — เริ่มขั้นตอนแพ็คของ', cls: 'btn-green', fn: () => doAction('confirm_payment') });
    if (s === 'packing' && myRole === 'seller') btns.push({ label: isSimple ? '📦 แพ็คเสร็จ — จัดส่งให้ผู้ซื้อโดยตรง' : '📦 แพ็คของเสร็จ — จัดส่งให้คนกลาง', cls: 'btn-primary', fn: () => { if (trackingInput) return doAction('seller_done_packing', { trackingNumber: trackingInput }); alert('กรอกเลขพัสดุ'); } });
    if (s === 'shipped_to_middleman' && myRole === 'middleman') btns.push({ label: '📬 รับสินค้าแล้ว', cls: 'btn-primary', fn: () => doAction('middleman_received') });
    if (s === 'middleman_checking' && myRole === 'buyer' && !deal!.buyer_confirmed_check) btns.push({ label: '✅ ยืนยันสินค้าไม่มีปัญหา', cls: 'btn-green', fn: () => doAction('buyer_confirm_check') });
    if (s === 'middleman_checking' && myRole === 'middleman' && deal!.buyer_confirmed_check) btns.push({ label: '🚚 จัดส่งให้ผู้ซื้อแล้ว', cls: 'btn-primary', fn: () => { if (trackingInput) return doAction('middleman_ship_to_buyer', { trackingNumber: trackingInput }); alert('กรอกเลขพัสดุ'); } });
    if (s === 'shipped_to_buyer' && myRole === 'buyer') btns.push({ label: '🎉 ได้รับสินค้าแล้ว — ดีลเสร็จสมบูรณ์', cls: 'btn-green', fn: () => doAction('buyer_received') });
    if (myRole === 'buyer' && s === 'buyer_joined' && !deal!.middleman_id && !isMeetup && !isSimple) btns.push({ label: showSelectMM ? 'ซ่อนการเลือกคนกลาง' : '🔎 เลือกคนกลาง', cls: 'btn-ghost', fn: () => setShowSelectMM(v => !v) });
    if (myRole === 'buyer' && !isSimple && deal!.middleman_id && ['terms_pending', 'payment_pending'].includes(s)) btns.push({ label: showSelectMM ? 'ซ่อนรายการคนกลาง' : '🔄 เลือกคนกลางใหม่', cls: 'btn-ghost', fn: () => setShowSelectMM(v => !v) });
    if (!isFinished && myRole !== 'guest') btns.push({ label: '❌ ยกเลิก', cls: 'btn-danger', fn: () => { const r = prompt('เหตุผล'); return doAction('cancel', { reason: r || '' }); } });

    if (btns.length === 0) return <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>ไม่มีการกระทำในขั้นตอนนี้</p>;
    return (
      <div className="dr-actions">
        {(['packing', 'middleman_checking'].includes(s) && (myRole === 'seller' || (myRole === 'middleman' && deal!.buyer_confirmed_check))) && (
          <input type="text" className="dr-select" value={trackingInput} onChange={e => setTrackingInput(e.target.value)} placeholder="เลขพัสดุ / Tracking number" />
        )}
        {btns.map(b => <AsyncButton key={b.label} onClick={b.fn} disabled={acting} className={`btn ${b.cls} btn-block`}>{b.label}</AsyncButton>)}
      </div>
    );
  }

  // ─── Evidence panel ──────────────────────────────────────────────────────
  function renderEvidencePanel() {
    const canUp = (myRole === 'seller' && ['packing', 'shipped_to_middleman'].includes(deal!.status)) || (myRole === 'middleman' && ['middleman_received', 'middleman_checking'].includes(deal!.status));
    // โหมดง่าย: ผู้ซื้อต้องถ่ายวิดีโอก่อนแกะกล่องเมื่อของมาถึง
    const canBuyerUnbox = isSimple && myRole === 'buyer' && deal!.status === 'shipped_to_buyer';
    const typeLabel: Record<string, string> = { packing: '📦 แพ็คของ', testing: '🔧 ทดสอบ', receive: isSimple ? '📬 วิดีโอก่อนแกะกล่อง (ผู้ซื้อ)' : '📬 รับสินค้า (คนกลาง)', check: '🔍 ตรวจสินค้า (คนกลาง)', chat: '💬 หลักฐานจากแชท', chat_text: '💬 ข้อความแชท', call: '📹 วิดีโอคอลที่บันทึก' };
    const items = evidence;
    return (
      <div className="dr-evid-inner">
        {isSimple && myRole === 'seller' && ['packing', 'shipped_to_middleman'].includes(deal!.status) && (
          <div className="dr-card" style={{ background: '#fff8ef', borderColor: '#ffe0b2' }}>
            <div style={{ fontSize: 13, color: '#8a5a00', lineHeight: 1.6 }}>⚡ ถ่ายวิดีโอทุกขั้นตอน เก็บจุดสำคัญ เช่น Serial Number และเลขชิป หากมีผลเทสต้องถ่ายประกอบ และเลขซีเรียลบนตัวสินค้ากับกล่อง/เอกสารต้องตรงกัน</div>
          </div>
        )}
        {canBuyerUnbox && (
          <div className="dr-card" style={{ background: '#fff8ef', borderColor: '#ffe0b2' }}>
            <div className="dr-card-title">📹 ถ่ายวิดีโอก่อนแกะกล่อง</div>
            <div style={{ fontSize: 13, color: '#8a5a00', lineHeight: 1.6, marginBottom: 12 }}>⚠️ ต้องถ่ายวิดีโอตอนแกะกล่องทุกครั้ง หากไม่มีวิดีโอก่อนแกะ จะถือว่าสินค้าถูกต้องและเรียกร้องกับผู้ขายไม่ได้</div>
            <button onClick={() => buyerEvidInputRef.current?.click()} className="btn btn-soft btn-block"><Icon name="upload" size={16} /> อัปโหลดวิดีโอก่อนแกะ</button>
            <input ref={buyerEvidInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, true, 'receive'); e.target.value = ''; }} />
          </div>
        )}
        {canUp && (
          <div className="dr-card">
            <div className="dr-card-title">อัปโหลดหลักฐาน</div>
            <select className="dr-select" style={{ marginBottom: 12 }} value={evidenceType} onChange={e => setEvidenceType(e.target.value)}>
              {myRole === 'seller' && <><option value="packing">วิดีโอแพ็คของ</option><option value="testing">วิดีโอทดสอบ</option></>}
              {myRole === 'middleman' && <><option value="receive">วิดีโอรับสินค้า</option><option value="check">วิดีโอตรวจ</option></>}
            </select>
            <button onClick={() => evidInputRef.current?.click()} className="btn btn-soft btn-block"><Icon name="upload" size={16} /> เลือกไฟล์ (รูป/วิดีโอ)</button>
            <input ref={evidInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, true); e.target.value = ''; }} />
          </div>
        )}
        {items.length === 0 && !canUp && <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>ยังไม่มีหลักฐาน</p>}
        <div className="dr-evid-list">
          {items.map((item, i) => {
            const url = item.file_id ? fileUrl(item.file_id) : '';
            const isVid = item.file_name?.match(/\.(mp4|mov|avi|webm)$/i);
            const isImg = item.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
            return (
              <div key={item.id || i} className="dr-card" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{typeLabel[item.type] || item.type}{item.uploader_name ? ` · ${item.uploader_name}` : ''}</div>
                {!item.file_id
                  ? <div style={{ fontSize: 14, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{item.content || '(ไม่มีข้อความ)'}</div>
                  : isVid ? <video src={url} controls style={{ width: '100%', maxHeight: 220, borderRadius: 'var(--r-md)', background: '#000' }} />
                  : isImg ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={item.file_name} style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 'var(--r-md)' }} /></a>
                  : <a href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', fontSize: 14 }}>📎 {item.file_name || 'เปิดไฟล์'}</a>}
                {item.file_id && item.content ? <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{item.content}</div> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Wizard ขั้นตอนดีล — เฉพาะ "ซื้อขายผ่านกลางแบบง่าย" (deal_type === 'simple')
  // โฟกัสทีละขั้นตอน (การ์ดเดียว) แทนการแสดงทุกการ์ดพร้อมกันแบบเดิม — ลดความสับสน
  // ═══════════════════════════════════════════════════════════════════════
  const WIZARD_STEP_TITLES = [
    'ยอมรับเงื่อนไข', 'ตกลงราคา', 'คุย/วิดีโอคอล', 'ตรวจหลักฐาน', 'โอนเงิน',
    'ตรวจสอบ', 'แพ็ค+จัดส่ง', 'รับสินค้า', 'โอนเงินให้ผู้ขาย', 'เสร็จสมบูรณ์',
  ];
  const WZ_TOTAL = WIZARD_STEP_TITLES.length;

  /** คำนวณว่าตอนนี้อยู่ขั้นไหนของ wizard (1-10) จากสถานะที่มีอยู่จริง — ไม่เพิ่ม status ใหม่ในฐานข้อมูล */
  function getSimpleStep(): { step: number; outcome?: 'success' | 'cancelled' | 'disputed' } {
    const s = deal!.status;
    const pd: DealPriceState = priceState || {};
    if (['posted', 'waiting_seller', 'waiting_buyer'].includes(s)) return { step: 0 };
    const bothAcceptedTerms = !!deal!.seller_accepted_terms && !!deal!.buyer_accepted_terms;
    if (['buyer_joined', 'terms_pending'].includes(s)) return { step: bothAcceptedTerms ? 2 : 1 };
    if (s === 'payment_pending') {
      if (!pd.agreed) return { step: 2 }; // ยังไม่ตกลงราคา/ค่าบริการ
      const evReady = !!pd.evidence_done_buyer && !!pd.evidence_done_seller;
      if (evReady) return { step: 5 }; // ทั้งคู่ยืนยันหลักฐานแล้ว → โอนเงินได้
      return { step: chatReviewReady ? 4 : 3 }; // คุย/วิดีโอคอล หรือ กำลังตรวจหลักฐาน
    }
    if (s === 'payment_uploaded') {
      // บั๊กที่เจอ: ถ้าผู้ขายต้องโอนค่าบริการส่วนของตนเองด้วย (fee_payer = seller/split) แต่ยังไม่ได้โอน
      // ห้ามข้ามไปขั้น "ทีมงานตรวจสอบ" ทันทีที่ผู้ซื้ออัปโหลดสลิป — ต้องรอผู้ขายโอนค่าบริการก่อน ไม่งั้นปุ่มผู้ขายจะหายไปเฉยๆ
      const fb = computeDealFees(feeConfig, deal!.price, deal!.deal_type);
      const fp = String(deal!.fee_payer || pd.proposed_fee_payer || 'split');
      const sellerShare = fp === 'seller' ? fb.total : fp === 'split' ? (fb.total - Math.round(fb.total / 2)) : 0;
      if (sellerShare > 0 && !pd.seller_fee_slip) return { step: 5 };
      return { step: 6 };
    }
    if (s === 'packing') return { step: 7 };
    if (s === 'shipped_to_buyer') return { step: 8 };
    if (s === 'completed') return { step: pd.payout_slip_file_id ? 10 : 9, outcome: 'success' };
    if (s === 'cancelled') return { step: pd.refund_slip_file_id ? 10 : 9, outcome: 'cancelled' };
    if (s === 'disputed') return { step: 9, outcome: 'disputed' };
    return { step: 1 };
  }

  function renderWizardProgress(step: number) {
    const clamped = Math.max(1, Math.min(WZ_TOTAL, step));
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <b style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>ขั้นที่ {clamped} จาก {WZ_TOTAL} · {WIZARD_STEP_TITLES[clamped - 1]}</b>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{Math.round((clamped / WZ_TOTAL) * 100)}%</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {WIZARD_STEP_TITLES.map((t, i) => (
            <div key={t} style={{ flex: 1, height: 6, borderRadius: 4, background: i + 1 < clamped ? 'var(--green-500)' : i + 1 === clamped ? 'var(--accent)' : 'var(--line)', transition: 'background .3s' }} />
          ))}
        </div>
      </div>
    );
  }

  /** การ์ดแสดงคู่ดีล (เพื่อนเป็นใคร) — ใช้ซ้ำได้ในหลายขั้น */
  function renderWizardPartiesMini() {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
        <span>🛒 ผู้ขาย: <b style={{ color: 'var(--ink)' }}>{deal!.seller_name || '-'}</b></span>
        <span>🛍️ ผู้ซื้อ: <b style={{ color: 'var(--ink)' }}>{deal!.buyer_name || '-'}</b></span>
      </div>
    );
  }

  // ─── ขั้น 0: รออีกฝ่ายเข้าร่วมดีล ────────────────────────────────────────
  function renderWizardStep0() {
    const waitingFor = !deal!.buyer_id ? 'ผู้ซื้อ' : 'ผู้ขาย';
    return (
      <div className="dr-card" style={{ textAlign: 'center', padding: '34px 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>
        <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>รอ{waitingFor}เข้าร่วมดีล</div>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 18 }}>ส่งลิงก์นี้ให้{waitingFor}เพื่อเข้าร่วม — wizard จะเริ่มขั้นที่ 1 ทันทีที่ทั้งสองฝ่ายอยู่ในดีลครบ</p>
        <button onClick={copyLink} className="btn btn-primary btn-block">{copied ? '✅ คัดลอกลิงก์แล้ว' : '🔗 คัดลอกลิงก์แชร์'}</button>
      </div>
    );
  }

  // ─── ขั้น 1: ยอมรับเงื่อนไข ───────────────────────────────────────────────
  function renderWizardStep1() {
    const t = termsFor(deal!.deal_type);
    const fb = computeDealFees(feeConfig, deal!.price, deal!.deal_type);
    const meAccepted = (myRole === 'seller' && deal!.seller_accepted_terms) || (myRole === 'buyer' && deal!.buyer_accepted_terms);
    return (
      <div className="dr-card">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 38, marginBottom: 6 }}>📋</div>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>อ่านและยอมรับเงื่อนไขก่อนเริ่มดีล</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{t.name}</p>
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green-600)', marginBottom: 6 }}>✅ บริการนี้ครอบคลุม</div>
        <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink)' }}>
          {t.covers.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#b22441', marginBottom: 6 }}>⚠️ ไม่ครอบคลุม</div>
        <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7, color: 'var(--muted)' }}>
          {t.excludes.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>💸 ค่าบริการโดยประมาณ (มูลค่า ฿{deal!.price.toLocaleString()})</div>
          {fb.lines.map(l => (<div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', padding: '2px 0' }}><span>{l.label}</span><span>฿{l.amount.toLocaleString()}</span></div>))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--ink)', borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}><span>รวมค่าบริการ</span><span>฿{fb.total.toLocaleString()}</span></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
          {[['ผู้ขาย', deal!.seller_accepted_terms], ['ผู้ซื้อ', deal!.buyer_accepted_terms]].map(([l, ok]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}><span style={{ color: 'var(--muted)' }}>{l}</span><span style={{ color: ok ? 'var(--green-600)' : 'var(--faint)' }}>{ok ? '✅ ยอมรับแล้ว' : '⏳ รอ'}</span></div>
          ))}
        </div>
        {!meAccepted
          ? <AsyncButton className="btn btn-primary btn-block btn-lg" onClick={() => doAction('accept_terms')}>✅ ยอมรับเงื่อนไข</AsyncButton>
          : <p style={{ fontSize: 13.5, color: 'var(--green-600)', textAlign: 'center' }}>✅ คุณยอมรับเงื่อนไขแล้ว — รออีกฝ่าย</p>}
      </div>
    );
  }

  // ─── ขั้น 2: ตกลงราคา-สินค้าและค่าบริการ (เฉพาะส่วนราคา ไม่รวมแชท) ─────────
  function renderWizardStepPrice() {
    const pd: DealPriceState = priceState || {};
    const fpName = (fp?: string) => fp === 'seller' ? 'ผู้ขายจ่าย' : fp === 'split' ? 'หารครึ่ง' : 'ผู้ซื้อจ่าย';
    const currentPrice = pd.proposed_price || deal!.price;
    const currentFeePayer = (pd.proposed_fee_payer || deal!.fee_payer || 'split') as 'buyer' | 'seller' | 'split';
    const selectedFeePayer = feePayerInput || currentFeePayer;
    const sellerReady = !!pd.seller_agreed;
    const buyerReady = !!pd.buyer_agreed;
    const meReady = myRole === 'seller' ? sellerReady : buyerReady;

    return (
      <div className="dr-card">
        <div className="dr-card-title">💰 ตกลงราคาสินค้าและค่าบริการ</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>ยืนยันราคาและผู้จ่ายค่าบริการก่อนเริ่มคุยรายละเอียดสินค้า</p>

        <div style={{ background: 'var(--accent-soft)', border: '1px solid #d7e3ff', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}><span>ราคาปัจจุบัน</span><span>฿{currentPrice.toLocaleString()}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', marginTop: 2 }}><span>ค่าบริการ</span><span>{fpName(currentFeePayer)}</span></div>
        </div>

        {!showPriceProposal ? (
          <button type="button" className="btn btn-ghost btn-block btn-sm" onClick={() => { setShowPriceProposal(true); setPriceInput(String(currentPrice)); setFeePayerInput(currentFeePayer); }}>✏️ เสนอราคาหรือค่าบริการใหม่</button>
        ) : (
          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 12, marginBottom: 4 }}>
            <input type="number" className="dr-select" value={priceInput} onChange={e => setPriceInput(e.target.value)} placeholder="ราคา (บาท)" style={{ marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {(['buyer', 'seller', 'split'] as const).map(fp => (
                <button key={fp} type="button" onClick={() => setFeePayerInput(fp)} className={`btn btn-sm ${selectedFeePayer === fp ? 'btn-primary' : 'btn-ghost'}`}>{fpName(fp)}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <button className="btn btn-primary btn-block btn-sm" disabled={acting} onClick={() => { const p = Math.round(Number(priceInput)); if (!(p >= 1)) { alert('กรอกราคาให้ถูกต้อง'); return; } doAction('price_propose', { price: p, feePayer: selectedFeePayer }); setShowPriceProposal(false); }}>ส่งข้อเสนอ</button>
              <button type="button" className="btn btn-ghost btn-block btn-sm" onClick={() => setShowPriceProposal(false)}>ยกเลิก</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '12px 0' }}>
          {[['ผู้ขาย', sellerReady], ['ผู้ซื้อ', buyerReady]].map(([l, ok]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}><span style={{ color: 'var(--muted)' }}>{l}</span><span style={{ color: ok ? 'var(--green-600)' : 'var(--faint)' }}>{ok ? '✅ ตกลงแล้ว' : '⏳ รอ'}</span></div>
          ))}
        </div>

        {!meReady
          ? <AsyncButton className="btn btn-green btn-block btn-lg" onClick={() => doAction('price_agree', { feePayer: selectedFeePayer })}>✅ ตกลงราคานี้ — ไปคุยรายละเอียดสินค้า</AsyncButton>
          : <p style={{ fontSize: 13.5, color: 'var(--green-600)', textAlign: 'center' }}>✅ คุณตกลงแล้ว — รออีกฝ่ายยืนยัน</p>}
      </div>
    );
  }

  function bubbleClass(m: Msg, isMe: boolean): string {
    if (isMe) return 'dr-bubble dr-bubble-mine';
    if (m.role === 'seller') return 'dr-bubble dr-bubble-seller';
    if (m.role === 'middleman') return 'dr-bubble dr-bubble-middleman';
    if (m.role === 'admin') return 'dr-bubble dr-bubble-admin';
    return 'dr-bubble'; // buyer หรือ unknown
  }

  function bubbleAvColor(m: Msg): string {
    if (m.role === 'seller') return '#16a34a';
    if (m.role === 'middleman') return '#7c3aed';
    if (m.role === 'admin') return '#dc2626';
    return '#2f6bf0'; // buyer
  }

  function pinBtn(m: Msg, small = false): React.ReactNode {
    const saved = savedEvidIds.has(m.id);
    if (!(m.content || m.file_id)) return null;
    return (
      <button type="button" onClick={() => !saved && saveMsgEvidence(m)} disabled={acting || saved}
        style={{ fontSize: small ? 10 : 10.5, color: saved ? 'var(--green-600)' : 'var(--accent)', background: 'none', border: 'none', cursor: saved ? 'default' : 'pointer', padding: '2px 0 0', display: 'block', opacity: saved ? 1 : undefined }}>
        {saved ? '✅ เก็บหลักฐานแล้ว' : '📌 เก็บเป็นหลักฐาน'}
      </button>
    );
  }

  function renderChatPresenceBar() {
    if (!deal) return null;
    const d = deal;
    const isMM = !!d.middleman_id;
    const isDispute = ['disputed'].includes(d.status);
    const parties: { label: string; id: string | null; color: string }[] = [
      { label: '🛍️ ผู้ซื้อ', id: d.buyer_id || null, color: '#2f6bf0' },
      { label: '🛒 ผู้ขาย', id: d.seller_id || null, color: '#16a34a' },
      ...(isMM ? [{ label: '🤝 คนกลาง', id: d.middleman_id!, color: '#7c3aed' }] : []),
      ...(isDispute ? [{ label: '🛡️ แอดมิน', id: 'admin', color: '#dc2626' }] : []),
    ];
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
        {parties.map(p => (
          <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: p.id ? p.color : 'var(--faint)', fontWeight: p.id ? 600 : 400 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.id ? p.color : 'var(--faint)' }} />
            {p.label}
          </div>
        ))}
      </div>
    );
  }

  function chatIsOpen(): boolean {
    if (!deal) return false;
    // ต้องมีทั้ง buyer และ seller join ถึงจะแชทได้
    return !!(deal.buyer_id && deal.seller_id);
  }

  /** รวมประวัติแชท (ข้อความล้วน ไม่รวมรูป/ไฟล์ที่ดูได้จากแท็บแชทอยู่แล้ว) เป็นหลักฐาน "ชิ้นเดียว" — ไม่เก็บทีละข้อความ */
  async function bundleChatTranscriptAsEvidence() {
    const lines = msgs.filter(m => m.role !== 'system' && m.type === 'text' && m.content?.trim());
    if (lines.length === 0) return;
    let transcript = lines.map(m => `${m.sender_name || '-'} (${new Date(m.created_at).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}): ${m.content}`).join('\n');
    if (transcript.length > 4000) transcript = `…(ตัดข้อความเก่าบางส่วน)\n${transcript.slice(-4000)}`;
    await doAction('add_evidence', { evidenceType: 'chat_text', content: transcript });
  }

  // ─── ขั้น 3: คุย/วิดีโอคอลรายละเอียดสินค้า ────────────────────────────────
  function renderWizardStepChat(nextStep = 4) {
    const chatMsgs = msgs.filter(m => m.role !== 'system').slice(-30);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dr-card" style={{ background: '#fff8ef', borderColor: '#ffe0b2' }}>
          <div style={{ fontSize: 13, color: '#8a5a00', lineHeight: 1.6 }}>💬 คุยรายละเอียดสินค้า ส่งรูปหรือเริ่มวิดีโอคอลให้พอใจทั้งสองฝ่าย (วิดีโอคอลถูกบันทึกเป็นหลักฐานได้) แล้วกด &quot;คุยกันจบแล้ว&quot; ด้านล่างเพื่อไปตรวจหลักฐานและยืนยัน</div>
        </div>
        <div className="dr-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="dr-card-title" style={{ margin: 0 }}>💬 แชทคุยกัน</div>
            <button type="button" className="btn btn-green btn-sm" onClick={toggleCall}>📹 เริ่มวิดีโอคอล</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', marginBottom: 10, padding: '4px 2px' }}>
            {chatMsgs.length === 0 && <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12.5, padding: '14px 0' }}>ยังไม่มีข้อความ — เริ่มคุยกับอีกฝ่ายได้เลย</p>}
            {chatMsgs.map(m => {
              const isMe = m.sender_id === myId;
              const isMedia = m.type === 'image' || m.type === 'file';
              return (
                <div key={m.id} className={`dr-bubble-row${isMe ? ' mine' : ''}`}>
                  {!isMe && <div className="dr-bubble-av" style={{ background: bubbleAvColor(m) }}>{(m.sender_name || '?').slice(0, 1)}</div>}
                  <div className="dr-bubble-col">
                    {!isMe && <span className="dr-bubble-sender">{m.sender_name}</span>}
                    <div className={bubbleClass(m, isMe)}>
                      {m.type === 'image' ? <a href={fileUrl(m.file_id)} target="_blank" rel="noreferrer"><img src={fileUrl(m.file_id)} alt={m.file_name} style={{ maxWidth: 180, borderRadius: 8 }} /></a>
                        : m.type === 'file' ? <a href={fileUrl(m.file_id)} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>📎 {m.file_name}</a>
                        : m.content}
                    </div>
                    {isMedia && <span style={{ marginLeft: isMe ? 'auto' : 0 }}>{pinBtn(m, true)}</span>}
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>
          {renderChatPresenceBar()}
          <div style={{ display: 'flex', gap: 6, padding: '0 2px' }}>
            <button className="dr-attach" onClick={() => fileInputRef.current?.click()} disabled={sending || !chatIsOpen()}>🖼️</button>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (f.size > 10 * 1024 * 1024) { alert('ไฟล์ใหญ่เกิน 10MB'); return; } await uploadFile(f); }} />
            <input className="dr-chat-input" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder={chatIsOpen() ? 'พิมพ์ข้อความ...' : 'รอบุคคลที่เกี่ยวข้องเข้าร่วมก่อน...'} disabled={!chatIsOpen()} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (chatInput.trim() && chatIsOpen()) sendMsg(chatInput); } }} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', fontSize: 13.5, minWidth: 0 }} />
            <button className="dr-chat-send" onClick={() => { if (chatInput.trim() && chatIsOpen()) sendMsg(chatInput); }} disabled={!chatInput.trim() || sending || !chatIsOpen()}><Icon name="arrowRight" size={16} /></button>
          </div>
        </div>
        <AsyncButton className="btn btn-primary btn-block btn-lg" onClick={async () => { if (!chatBundledRef.current) { chatBundledRef.current = true; await bundleChatTranscriptAsEvidence(); } await doAction('progress_ping', { stage: 'to_evidence' }); setChatReviewReady(true); setWzViewStep(nextStep); }}>✅ คุยกันจบแล้ว — ไปตรวจหลักฐาน</AsyncButton>
      </div>
    );
  }

  // ─── ขั้น 4: ตรวจหลักฐาน + ยืนยัน ─────────────────────────────────────────
  function renderWizardStepEvidenceReview(nextStep = 5) {
    const pd: DealPriceState = priceState || {};
    const meDone = myRole === 'seller' ? !!pd.evidence_done_seller : !!pd.evidence_done_buyer;
    const sellerDone = !!pd.evidence_done_seller;
    const buyerDone = !!pd.evidence_done_buyer;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dr-card">
          <div className="dr-card-title">📁 ตรวจหลักฐานก่อนโอนเงิน</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4, lineHeight: 1.6 }}>ตรวจดูประวัติการคุย รูป และวิดีโอคอลที่บันทึกไว้ด้านล่าง ถ้าครบถ้วนถูกต้องแล้วให้กดยืนยัน</p>
        </div>
        {renderEvidencePanel()}
        <div className="dr-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            {[['ผู้ขาย', sellerDone], ['ผู้ซื้อ', buyerDone]].map(([l, ok]) => (
              <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}><span style={{ color: 'var(--muted)' }}>{l}</span><span style={{ color: ok ? 'var(--green-600)' : 'var(--faint)' }}>{ok ? '✅ ยืนยันถูกต้องแล้ว' : '⏳ รอ'}</span></div>
            ))}
          </div>
          {!meDone
            ? <AsyncButton className="btn btn-green btn-block btn-lg" onClick={() => doAction('evidence_done')}>✅ ตรวจแล้ว ถูกต้อง — ยืนยัน</AsyncButton>
            : sellerDone && buyerDone
              ? <button className="btn btn-primary btn-block btn-lg" onClick={() => setWzViewStep(nextStep)}>✅ ทุกฝ่ายยืนยันแล้ว — ดำเนินการต่อ →</button>
              : <p style={{ fontSize: 13.5, color: 'var(--green-600)', textAlign: 'center', marginBottom: 10 }}>✅ คุณยืนยันแล้ว — รออีกฝ่ายยืนยัน</p>}
          <button type="button" className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 8 }} onClick={() => setChatReviewReady(false)}>⬅ ย้อนกลับไปคุยต่อ</button>
        </div>
      </div>
    );
  }

  // ─── ขั้น 4: ส่วนกลางตรวจสอบและอนุมัติ (รอ — ไม่มีปุ่มฝั่งผู้ใช้) ──────────
  function renderWizardStep4() {
    const pd: DealPriceState = priceState || {};
    return (
      <div className="dr-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
        <div style={{ fontSize: 38, marginBottom: 10 }}>🔍</div>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>ทีมงานกำลังตรวจสอบการโอนเงิน</div>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 16 }}>ศูนย์กลางกำลังตรวจสลิปที่อัปโหลดไว้ — เมื่อยืนยันรับเงินแล้ว ผู้ขายจะเริ่มแพ็คสินค้าได้ทันที</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {deal!.payment_slip_file_id && (
            <a href={fileUrl(deal!.payment_slip_file_id)} target="_blank" rel="noreferrer"><img src={fileUrl(deal!.payment_slip_file_id)} alt="สลิปผู้ซื้อ" style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }} /></a>
          )}
          {pd.seller_fee_slip && (
            <a href={fileUrl(pd.seller_fee_slip)} target="_blank" rel="noreferrer"><img src={fileUrl(pd.seller_fee_slip)} alt="สลิปผู้ขาย" style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }} /></a>
          )}
        </div>
      </div>
    );
  }

  // ─── ขั้น 5: ผู้ขายแพ็ค + วิดีโอ + เลขพัสดุ ───────────────────────────────
  /** แกลเลอรีย่อรูป/วิดีโอหลักฐาน — ใช้ซ้ำให้ทั้งสองฝ่ายเห็นหลักฐานแพ็ค/แกะกล่องชุดเดียวกัน */
  function renderWizardEvidenceThumbs(items: EvidenceItem[]) {
    if (items.length === 0) return null;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginTop: 10 }}>
        {items.map((item, i) => {
          const url = item.file_id ? fileUrl(item.file_id) : '';
          const isVid = item.file_name?.match(/\.(mp4|mov|avi|webm)$/i);
          return (
            <a key={item.id || i} href={url} target="_blank" rel="noreferrer" style={{ display: 'block', position: 'relative' }}>
              {isVid
                ? <video src={url} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8, background: '#000' }} />
                : <img src={url} alt={item.file_name} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8 }} />}
              {isVid && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 20, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.6)' }}>▶</span>}
            </a>
          );
        })}
      </div>
    );
  }

  // ─── ขั้น 7: ผู้ขายแพ็ค + วิดีโอ + เลขพัสดุ ───────────────────────────────
  function renderWizardStep5() {
    const packingEvidence = evidence.filter(e => e.type === 'packing');
    if (myRole !== 'seller') {
      return (
        <div className="dr-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>📦</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>รอผู้ขายแพ็คสินค้าและจัดส่ง</div>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>ผู้ขายกำลังถ่ายวิดีโอแพ็คของและจัดส่งตรงถึงคุณ — ระบบจะแจ้งเลขพัสดุให้ทันทีที่ส่งแล้ว</p>
          {packingEvidence.length > 0
            ? renderWizardEvidenceThumbs(packingEvidence)
            : <p style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 10 }}>ยังไม่มีรูป/วิดีโอแพ็คของ</p>}
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dr-card" style={{ background: '#fff8ef', borderColor: '#ffe0b2' }}>
          <div style={{ fontSize: 13, color: '#8a5a00', lineHeight: 1.6 }}>⚡ ถ่ายวิดีโอทุกขั้นตอน เก็บจุดสำคัญ เช่น Serial Number และเลขชิป หากมีผลเทสต้องถ่ายประกอบ และเลขซีเรียลบนตัวสินค้ากับกล่อง/เอกสารต้องตรงกัน</div>
        </div>
        <div className="dr-card">
          <div className="dr-card-title">อัปโหลดวิดีโอแพ็คของ</div>
          <button onClick={() => evidInputRef.current?.click()} className="btn btn-soft btn-block"><Icon name="upload" size={16} /> เลือกไฟล์ (รูป/วิดีโอ)</button>
          <input ref={evidInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, true, 'packing'); e.target.value = ''; }} />
          {packingEvidence.length > 0 && <p style={{ fontSize: 12.5, color: 'var(--green-600)', marginTop: 10 }}>✅ อัปโหลดแล้ว {packingEvidence.length} ไฟล์ — ผู้ซื้อเห็นชุดนี้ด้วย</p>}
          {renderWizardEvidenceThumbs(packingEvidence)}
        </div>
        <div className="dr-card">
          <div className="dr-card-title">เลขพัสดุ</div>
          <input type="text" className="dr-select" value={trackingInput} onChange={e => setTrackingInput(e.target.value)} placeholder="กรอกเลขพัสดุ" style={{ marginBottom: 12 }} />
          <AsyncButton className="btn btn-primary btn-block btn-lg" onClick={() => { if (!trackingInput) { alert('กรอกเลขพัสดุ'); return; } return doAction('seller_done_packing', { trackingNumber: trackingInput }); }}>📦 แพ็คเสร็จ — ส่งให้ผู้ซื้อโดยตรง</AsyncButton>
        </div>
      </div>
    );
  }

  // ─── ขั้น 8: ผู้ซื้อแกะกล่อง + ถ่ายวิดีโอ + ยืนยันรับ/แจ้งปัญหา ───────────
  function renderWizardStep6() {
    const unboxEvidence = evidence.filter(e => e.type === 'receive');
    if (myRole !== 'buyer') {
      return (
        <div className="dr-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>🚚</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>ส่งสินค้าแล้ว — รอผู้ซื้อยืนยันรับ</div>
          {deal!.tracking_to_buyer && <div className="dr-track-code" style={{ marginBottom: 8 }}>📦 {deal!.tracking_to_buyer}</div>}
          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>ผู้ซื้อต้องถ่ายวิดีโอก่อนแกะกล่อง แล้วกดยืนยันรับสินค้า ดีลจะเสร็จสมบูรณ์อัตโนมัติ</p>
          {unboxEvidence.length > 0
            ? renderWizardEvidenceThumbs(unboxEvidence)
            : <p style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 10 }}>ยังไม่มีรูป/วิดีโอแกะกล่องจากผู้ซื้อ</p>}
        </div>
      );
    }
    const hasUnboxEvidence = unboxEvidence.length > 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {deal!.tracking_to_buyer && <div className="dr-card"><div className="dr-card-title">📦 เลขพัสดุ</div><div className="dr-track-code">{deal!.tracking_to_buyer}</div></div>}
        <div className="dr-card" style={{ background: '#fff8ef', borderColor: '#ffe0b2' }}>
          <div className="dr-card-title">📹 ถ่ายวิดีโอก่อนแกะกล่อง</div>
          <div style={{ fontSize: 13, color: '#8a5a00', lineHeight: 1.6, marginBottom: 12 }}>⚠️ ต้องถ่ายวิดีโอตอนแกะกล่องทุกครั้ง หากไม่มีวิดีโอก่อนแกะ จะถือว่าสินค้าถูกต้องและเรียกร้องกับผู้ขายไม่ได้</div>
          <button onClick={() => buyerEvidInputRef.current?.click()} className="btn btn-soft btn-block"><Icon name="upload" size={16} /> อัปโหลดวิดีโอก่อนแกะ</button>
          <input ref={buyerEvidInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, true, 'receive'); e.target.value = ''; }} />
          {hasUnboxEvidence && <p style={{ fontSize: 12.5, color: 'var(--green-600)', marginTop: 10 }}>✅ อัปโหลดแล้ว {unboxEvidence.length} ไฟล์ — ผู้ขายเห็นชุดนี้ด้วย</p>}
          {renderWizardEvidenceThumbs(unboxEvidence)}
        </div>
        <div className="dr-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AsyncButton className="btn btn-green btn-block btn-lg" disabled={acting} onClick={() => { if (!hasUnboxEvidence && !confirm('ยังไม่ได้อัปโหลดวิดีโอก่อนแกะกล่อง — ยืนยันรับสินค้าต่อไหม?')) return; return doAction('buyer_received'); }}>🎉 ยืนยันรับสินค้า — ดีลเสร็จสมบูรณ์</AsyncButton>
          <AsyncButton className="btn btn-ghost btn-block" disabled={acting} onClick={() => { const r = prompt('อธิบายปัญหาที่พบ (เช่น สินค้าไม่ตรงปก/ชำรุด/ไม่ได้รับสินค้า):'); if (r === null || !r.trim()) return; return doAction('dispute', { reason: r.trim() }); }} style={{ color: '#b22441' }}>⚠️ แจ้งปัญหากับสินค้า</AsyncButton>
        </div>
      </div>
    );
  }

  // ─── ขั้น 7: ส่วนกลางโอน/คืน/อายัด (รอทีมงาน) ────────────────────────────
  function renderWizardStep7(outcome?: 'success' | 'cancelled' | 'disputed') {
    if (outcome === 'disputed') {
      return (
        <div className="dr-card" style={{ textAlign: 'center', padding: '30px 20px', borderColor: '#fbd5dd' }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: '#b22441', marginBottom: 8 }}>มีข้อพิพาท — เงินถูกอายัดไว้</div>
          {deal!.reject_reason && <p style={{ fontSize: 13.5, color: 'var(--ink)', background: '#fdeef1', border: '1px solid #fbd5dd', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 12, textAlign: 'left' }}>{deal!.reject_reason}</p>}
          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>ทีมงานกำลังตรวจสอบข้อพิพาทนี้ — คุยรายละเอียดเพิ่มเติมกับอีกฝ่ายในแชตได้ ผลการตัดสินจะแจ้งให้ทราบเมื่อเสร็จสิ้น</p>
        </div>
      );
    }
    const isCancelled = outcome === 'cancelled';
    return (
      <div className="dr-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
        <div style={{ fontSize: 38, marginBottom: 10 }}>💸</div>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>
          {isCancelled ? 'ดีลถูกยกเลิก — กำลังคืนเงินให้ผู้ซื้อ' : 'ยืนยันรับสินค้าแล้ว 🎉 — กำลังโอนเงินให้ผู้ขาย'}
        </div>
        {isCancelled && deal!.reject_reason && <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>เหตุผล: {deal!.reject_reason}</p>}
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>ทีมงานกำลังโอนเงินและจะอัปโหลดสลิปยืนยันให้เห็นที่นี่ภายในไม่นาน</p>
      </div>
    );
  }

  // ─── ขั้น 8: เสร็จสมบูรณ์ + รีวิว ─────────────────────────────────────────
  function renderWizardStep8(outcome?: 'success' | 'cancelled' | 'disputed') {
    const pd: DealPriceState = priceState || {};
    const isCancelled = outcome === 'cancelled';
    const slipId = isCancelled ? pd.refund_slip_file_id : pd.payout_slip_file_id;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dr-card dr-done-card">
          <div className="dr-done-emoji">{isCancelled ? '↩️' : '🎉'}</div>
          <div className="dr-done-title">{isCancelled ? 'ดีลถูกยกเลิก — คืนเงินผู้ซื้อแล้ว' : 'ดีลเสร็จสมบูรณ์!'}</div>
          <div className="dr-done-sub">{isCancelled ? 'ศูนย์กลางโอนเงินคืนผู้ซื้อเรียบร้อยแล้ว' : 'ศูนย์กลางโอนเงินให้ผู้ขายเรียบร้อยแล้ว (ดำเนินการโดยทีมงาน)'}</div>
        </div>
        {slipId && (
          <div className="dr-card">
            <div className="dr-card-title">📎 {isCancelled ? 'สลิปคืนเงินให้ผู้ซื้อ' : 'สลิปโอนเงินให้ผู้ขาย'}</div>
            <a href={fileUrl(slipId)} target="_blank" rel="noreferrer"><img src={fileUrl(slipId)} alt="สลิป" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }} /></a>
          </div>
        )}
        {!isCancelled && <ReviewPanel deal={deal!} myRole={myRole as 'buyer' | 'seller' | 'middleman'} headers={authHdrs} />}
      </div>
    );
  }


  // ═══════════════════════════════════════════════════════════════════════
  // Wizard ขั้นตอน "ประกันการเดินทาง" (deal_type === 'meetup') — 7 ขั้น
  // ═══════════════════════════════════════════════════════════════════════
  const MEETUP_WZ_TITLES = [
    'ยอมรับเงื่อนไข', 'แชทและ Video Call', 'ตรวจหลักฐาน', 'ตกลงจุดนัด',
    'วางเงินประกัน', 'รอยืนยันรับเงิน', 'เดินทาง+นัดพบ', 'รอคืนเงินประกัน', 'เสร็จสมบูรณ์',
  ];
  const MWZ_TOTAL = MEETUP_WZ_TITLES.length;

  function getMeetupStep(): { step: number; outcome?: 'completed' | 'cancelled' } {
    const s = deal!.status;
    const md: MeetupData = meetup || {};
    if (['posted', 'waiting_seller', 'waiting_buyer'].includes(s)) return { step: 0 };
    const bothTerms = !!deal!.seller_accepted_terms && !!deal!.buyer_accepted_terms;
    if (['buyer_joined', 'terms_pending'].includes(s)) return { step: bothTerms ? 2 : 1 };
    if (s === 'payment_pending') return { step: md.deposit ? 5 : 4 };
    if (s === 'payment_uploaded') return { step: 6 };
    if (s === 'meetup_ready') return { step: 7 };
    if (s === 'completed') {
      if (md.refund_outcome) return { step: 9, outcome: 'completed' };
      return { step: 8, outcome: 'completed' };
    }
    if (s === 'cancelled') return { step: 8, outcome: 'cancelled' };
    return { step: 1 };
  }

  function renderMeetupWizardProgress(step: number) {
    const clamped = Math.max(1, Math.min(MWZ_TOTAL, step));
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <b style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>ขั้นที่ {clamped} จาก {MWZ_TOTAL} · {MEETUP_WZ_TITLES[clamped - 1]}</b>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{Math.round((clamped / MWZ_TOTAL) * 100)}%</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {MEETUP_WZ_TITLES.map((t, i) => (
            <div key={t} style={{ flex: 1, height: 6, borderRadius: 4, background: i + 1 < clamped ? 'var(--green-500)' : i + 1 === clamped ? 'var(--accent)' : 'var(--line)', transition: 'background .3s' }} />
          ))}
        </div>
      </div>
    );
  }

  function renderMeetupWizardStepNegotiate() {
    const md: MeetupData = meetup || {};
    const isParty = myRole === 'buyer' || myRole === 'seller';
    const myLoc = myRole === 'buyer' ? md.buyer_loc : myRole === 'seller' ? md.seller_loc : undefined;
    const bothLocs = !!(md.buyer_loc?.province && md.seller_loc?.province);
    const provDist = bothLocs ? distanceKm(md.buyer_loc!.province, md.seller_loc!.province) : 0;
    const suggestAmount = Math.max(100, Math.ceil((provDist * 2 * 5) / 50) * 50);
    const meetOptions = bothLocs ? [
      { label: `ผู้ซื้อเดินทางไปหาผู้ขาย (${addressLabel(md.seller_loc)})`, sub: 'ผู้ขายไม่ต้องเดินทาง' },
      { label: `ผู้ขายเดินทางมาหาผู้ซื้อ (${addressLabel(md.buyer_loc)})`, sub: 'ผู้ซื้อไม่ต้องเดินทาง' },
      { label: `เจอกันครึ่งทาง (~จ.${midpointProvince(md.buyer_loc!.province, md.seller_loc!.province)})`, sub: 'แบ่งกันเดินทางคนละครึ่ง' },
    ] : [];
    // pending = มีข้อเสนอรอตอบ; iProposed = ฉันเป็นคนเสนอ
    const hasPending = !!(md.pending_deposit && md.pending_by);
    const iProposed = hasPending && md.pending_by === myRole;
    const proposerLabel = md.pending_by === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย';
    const feeLabel = (fp: 'buyer' | 'seller' | 'split') => fp === 'buyer' ? 'ผู้ซื้อจ่าย' : fp === 'seller' ? 'ผู้ขายจ่าย' : 'หารครึ่ง';
    function openPop(label: string) {
      setMeetupPropLabel(label);
      setMeetupPropAmt(String(suggestAmount));
      setMeetupPropPrice(''); setMeetupPropFeePayer('');
      setMeetupPopOpen(true);
    }
    async function submitPropose() {
      const amount = Math.round(Number(meetupPropAmt));
      if (!(amount >= 50)) { alert('เงินประกันขั้นต่ำ ฿50'); return; }
      const label = (meetupPropLabel || '').trim();
      if (!label) { alert('กรอกจุดนัด/รายละเอียดสถานที่'); return; }
      const payload: Record<string, unknown> = { amount, meetLabel: label };
      if (meetupPropPrice.trim()) { const p = Math.round(Number(meetupPropPrice)); if (p >= 1) payload.price = p; }
      if (meetupPropFeePayer) payload.feePayer = meetupPropFeePayer;
      await doAction('meetup_propose', payload);
      setMeetupPopOpen(false);
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* --- ส่วน 1: ที่อยู่ของฉัน --- */}
        <div className="dr-card">
          <div className="dr-card-title">📍 ที่อยู่ของคุณ</div>
          {myLoc?.province
            ? <p style={{ fontSize: 13.5, color: 'var(--green-600)', marginBottom: 4 }}>✅ {addressLabel(myLoc)}</p>
            : <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>ยังไม่ได้ระบุที่อยู่ — กรอกด้านล่างเพื่อให้ระบบแนะนำจุดนัด</p>}
          {isParty && !myLoc?.province && (
            <AddressPicker value={meetAddr} onChange={(a: ThaiAddress) => { setMeetAddr(a); if (a.tambon) doAction('meetup_set_location', { loc: a }); }} />
          )}
        </div>
        {/* --- ส่วน 2: สถานะ ตกลงแล้ว / รอตอบ / เลือกวิธีนัด --- */}
        {md.deposit && !hasPending ? (
          <div className="dr-card" style={{ background: 'var(--accent-soft)', borderColor: 'color-mix(in srgb,var(--accent) 25%,transparent)' }}>
            <div className="dr-card-title">✅ ตกลงจุดนัด + เงินประกันแล้ว</div>
            {md.meet_label && <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>📍 {md.meet_label}</p>}
            <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 10 }}>เงินประกัน: <b>฿{Number(md.deposit).toLocaleString()} / ฝ่าย</b></p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => setWzViewStep(5)}>ไปวางเงินประกัน →</button>
            {isParty && <button type="button" className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 8 }} onClick={() => openPop(md.meet_label || '')}>✏️ เสนอแก้จุดนัด/ยอด</button>}
          </div>
        ) : hasPending ? (
          iProposed ? (
            <div className="dr-card">
              <div className="dr-card-title">⏳ รออีกฝ่ายตอบรับข้อเสนอ</div>
              <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 12, display: 'grid', gap: 4, fontSize: 13 }}>
                {md.pending_meet_label && <div style={{ fontWeight: 600 }}>📍 {md.pending_meet_label}</div>}
                <div>เงินประกัน: ฿{Number(md.pending_deposit).toLocaleString()}/ฝ่าย</div>
                {md.pending_price ? <div>ราคาสินค้าใหม่: ฿{Number(md.pending_price).toLocaleString()}</div> : null}
                {md.pending_fee_payer ? <div>ค่าบริการ: {feeLabel(md.pending_fee_payer)}</div> : null}
              </div>
              <button type="button" className="btn btn-ghost btn-block btn-sm" disabled={acting} onClick={() => doAction('meetup_respond', { accept: false })}>↩️ ยกเลิกข้อเสนอของฉัน</button>
            </div>
          ) : (
            <div className="dr-card" style={{ borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>
              <div className="dr-card-title">📋 ข้อเสนอจาก{proposerLabel}</div>
              <div style={{ display: 'grid', gap: 4, fontSize: 13.5, marginBottom: 14 }}>
                {md.pending_meet_label && <div style={{ fontWeight: 700 }}>📍 {md.pending_meet_label}</div>}
                <div>เงินประกัน: <b style={{ color: 'var(--accent-strong)' }}>฿{Number(md.pending_deposit).toLocaleString()}/ฝ่าย</b></div>
                {md.pending_price ? <div>ราคาสินค้าใหม่: <b>฿{Number(md.pending_price).toLocaleString()}</b></div> : null}
                {md.pending_fee_payer ? <div>ค่าบริการ: <b>{feeLabel(md.pending_fee_payer)}</b></div> : null}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <AsyncButton type="button" className="btn btn-green flex-1" disabled={acting} onClick={() => doAction('meetup_respond', { accept: true })}>✅ ยอมรับ</AsyncButton>
                <AsyncButton type="button" className="btn btn-ghost flex-1 btn-sm" disabled={acting} onClick={() => doAction('meetup_respond', { accept: false })}>❌ ปฏิเสธ</AsyncButton>
              </div>
            </div>
          )
        ) : (
          <div className="dr-card">
            <div className="dr-card-title">🗺️ เลือกวิธีนัดพบ</div>
            {isParty && meetOptions.length > 0 ? (
              <>
                <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>กดเลือกวิธีนัด แล้วกรอกรายละเอียดในหน้าต่างที่เด้งขึ้นมา — อีกฝ่ายจะกดยอมรับ/ปฏิเสธได้</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  {meetOptions.map(opt => (
                    <button key={opt.label} type="button" className="btn btn-soft btn-block" style={{ textAlign: 'left', flexDirection: 'column', alignItems: 'flex-start', height: 'auto', padding: '10px 14px' }}
                      disabled={acting} onClick={() => openPop(opt.label)}>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{opt.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{opt.sub}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="btn btn-ghost btn-block btn-sm" onClick={() => openPop('')}>✏️ กำหนดจุดนัดเอง</button>
              </>
            ) : isParty && !bothLocs ? (
              <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '10px 0' }}>รอทั้งสองฝ่ายระบุที่อยู่ก่อน — ระบบจะแนะนำจุดนัดให้อัตโนมัติ</p>
            ) : null}
            {!isParty && <p style={{ fontSize: 13.5, color: 'var(--muted)', textAlign: 'center', padding: '14px 0' }}>รอทั้งสองฝ่ายตกลงวิธีนัดพบ</p>}
          </div>
        )}

        {/* POP-UP กรอกรายละเอียดข้อเสนอจุดนัด (สถานที่ + เงินประกัน + ปรับราคา + ค่าบริการ) */}
        {meetupPopOpen && (
          <div className="meetup-ack-pop" role="dialog" aria-label="ตกลงรายละเอียดจุดนัด" onClick={() => setMeetupPopOpen(false)}>
            <div className="meetup-ack-card" style={{ textAlign: 'left', width: 'min(94vw, 400px)' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 12, textAlign: 'center' }}>📍 ตกลงรายละเอียดจุดนัด</div>
              <label style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>จุดนัด / รายละเอียดสถานที่</label>
              <input type="text" value={meetupPropLabel || ''} onChange={e => setMeetupPropLabel(e.target.value)} placeholder="เช่น โลตัส สาขาลพบุรี ชั้น 1 หน้าร้านกาแฟ"
                style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', fontSize: 13.5, marginBottom: 10 }} />
              <label style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>เงินประกัน (บาท/ฝ่าย)</label>
              <input type="number" min={50} value={meetupPropAmt} onChange={e => setMeetupPropAmt(e.target.value)} placeholder="500"
                style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', fontSize: 13.5, marginBottom: 10 }} />
              <label style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>ปรับราคาสินค้า? (เว้นว่าง = ใช้ราคาเดิม ฿{Number(deal!.price || 0).toLocaleString()})</label>
              <input type="number" min={1} value={meetupPropPrice} onChange={e => setMeetupPropPrice(e.target.value)} placeholder={`฿${Number(deal!.price || 0).toLocaleString()}`}
                style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', fontSize: 13.5, marginBottom: 10 }} />
              <label style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>ค่าบริการ</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                {([['', 'ไม่เปลี่ยน'], ['buyer', 'ผู้ซื้อ'], ['seller', 'ผู้ขาย'], ['split', 'หารครึ่ง']] as const).map(([v, l]) => (
                  <button key={v || 'none'} type="button" className={`btn btn-sm ${meetupPropFeePayer === v ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMeetupPropFeePayer(v)}>{l}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <AsyncButton type="button" className="btn btn-primary flex-1" onClick={submitPropose}>✅ ส่งข้อเสนอ</AsyncButton>
                <button type="button" className="btn btn-ghost flex-1" onClick={() => setMeetupPopOpen(false)}>ยกเลิก</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderMeetupWizardStepChat() {
    const md: MeetupData = meetup || {};
    const isParty = myRole === 'buyer' || myRole === 'seller';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* จุดนัดที่ตกลงแล้ว */}
        <div className="dr-card" style={{ background: 'var(--accent-soft)', borderColor: 'color-mix(in srgb,var(--accent) 25%,transparent)' }}>
          <div className="dr-card-title">✅ ตกลงวิธีนัดพบแล้ว</div>
          {md.meet_label && <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>📍 {md.meet_label}</p>}
          <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>เงินประกันที่จะวาง: <b>฿{Number(md.deposit || 0).toLocaleString()} / ฝ่าย</b></p>
          {isParty && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}
              onClick={() => { setMeetupPropLabel(md.meet_label || ''); setMeetupPropAmt(String(md.deposit || 500)); }}>
              ✏️ เสนอเปลี่ยนยอดเงินประกัน
            </button>
          )}
          {isParty && meetupPropLabel !== null && (
            <div style={{ marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 12 }}>
              <label style={{ fontSize: 12.5, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>ยอดใหม่ (บาท/ฝ่าย)</label>
              <input type="number" className="input input-bordered" min={50} value={meetupPropAmt}
                onChange={e => setMeetupPropAmt(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <AsyncButton type="button" className="btn btn-primary flex-1"
                  onClick={async () => { const a = Math.round(Number(meetupPropAmt)); if (!(a >= 50)) { alert('ขั้นต่ำ ฿50'); return; } await doAction('meetup_propose', { amount: a, meetLabel: meetupPropLabel || md.meet_label }); setMeetupPropLabel(null); }}>
                  ส่งข้อเสนอ
                </AsyncButton>
                <button type="button" className="btn btn-ghost flex-1" onClick={() => setMeetupPropLabel(null)}>ยกเลิก</button>
              </div>
            </div>
          )}
        </div>
        {/* สิ่งที่ต้องทำก่อนวางเงิน */}
        <div className="dr-card">
          <div className="dr-card-title">📋 ทำก่อนวางเงินประกัน</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '💬', label: 'แชทตกลงรายละเอียด', sub: 'ตกลงค่าเดินทาง ค่าบริการ และสิ่งที่แต่ละฝ่ายต้องรับผิดชอบ' },
              { icon: '📹', label: 'Video Call (ถ้าจำเป็น)', sub: 'ยืนยันตัวตน ดูสินค้า หรือคุยรายละเอียดเพิ่มเติม' },
              { icon: '📷', label: 'เก็บหลักฐาน', sub: 'ถ่ายรูป/วิดีโอ รายละเอียดสินค้า ก่อนนัดพบ' },
            ].map(item => (
              <div key={item.label} style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '10px 14px' }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>{item.icon} {item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>
          เมื่อทุกอย่างตกลงกันเรียบร้อยแล้ว กด <b>ถัดไป →</b> เพื่อวางเงินประกัน
        </p>
      </div>
    );
  }

  function renderMeetupWizardStepDeposit() {
    const md: MeetupData = meetup || {};
    const depositEach = md.deposit || 0;
    const isParty = myRole === 'buyer' || myRole === 'seller';
    const buyerFee = md.buyer_fee || 0;
    const sellerFee = md.seller_fee || 0;
    const myFee = myRole === 'buyer' ? buyerFee : sellerFee;
    const myTotal = depositEach + myFee;
    const mySlip = myRole === 'buyer' ? md.buyer_slip : md.seller_slip;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* สรุปยอดแต่ละฝ่าย */}
        <div className="dr-card" style={{ background: '#fff8ef', borderColor: '#ffe0b2' }}>
          <div className="dr-card-title" style={{ color: '#8a5a00' }}>💰 สรุปยอดที่ต้องวางประกัน</div>
          {md.meet_label && (() => {
            const destLoc = md.meet_label.startsWith('ผู้ซื้อเดินทาง') ? md.seller_loc
              : md.meet_label.startsWith('ผู้ขายเดินทาง') ? md.buyer_loc
              : null;
            const query = destLoc
              ? `${destLoc.tambon} ${destLoc.amphoe} ${destLoc.province}`
              : md.meet_label;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <p style={{ fontSize: 12.5, color: '#8a5a00', margin: 0, flex: 1 }}>📍 {md.meet_label}</p>
                <a href={`https://www.google.com/maps/search/${encodeURIComponent(query)}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent-strong)', textDecoration: 'underline', whiteSpace: 'nowrap' }}>🗺️ ดูแผนที่</a>
              </div>
            );
          })()}
          <div style={{ display: 'grid', gap: 8 }}>
            {([['🛍️ ผู้ซื้อ', depositEach, buyerFee], ['🛒 ผู้ขาย', depositEach, sellerFee]] as [string, number, number][]).map(([label, dep, fee]) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 'var(--r-md)', padding: '10px 14px', border: '1px solid #ffe0b2' }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 6, fontFamily: 'var(--font-display)' }}>{label}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)' }}>
                  <span>เงินประกัน <span style={{ fontSize: 11, color: 'var(--muted)' }}>(ได้คืนหลังนัดพบ)</span></span>
                  <span>฿{dep.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>
                  <span>ค่าบริการ</span>
                  <span>{fee > 0 ? `฿${fee.toLocaleString()}` : <span style={{ color: 'var(--green-600)' }}>ฟรี</span>}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, marginTop: 8, paddingTop: 8, borderTop: '1px solid #ffe0b2', color: 'var(--accent-strong)' }}>
                  <span>รวมโอน</span>
                  <span>฿{(dep + fee).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: '#9a6209', marginTop: 8 }}>⚠️ เงินประกันจะถูกคืนให้ทั้งสองฝ่ายเต็มจำนวนหลังนัดพบสำเร็จ — ระบบเก็บเฉพาะค่าบริการ</p>
        </div>
        {/* ช่องทางชำระ — แสดงเฉพาะฝ่ายที่ยังไม่ได้วาง */}
        {isParty && !mySlip && (
          <div className="dr-card">
            <div className="dr-card-title">🏦 ช่องทางชำระเงิน</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
              โอนยอด <b style={{ color: 'var(--accent-strong)', fontSize: 15 }}>฿{myTotal.toLocaleString()}</b> เข้าบัญชีศูนย์กลาง
              {myFee > 0 && <span style={{ fontSize: 11.5 }}> (ประกัน ฿{depositEach.toLocaleString()} + บริการ ฿{myFee.toLocaleString()})</span>}
            </p>
            <PaymentMethods
              amount={myTotal}
              note={`เงินประกัน ฿${depositEach.toLocaleString()} + ค่าบริการ ฿${myFee.toLocaleString()} — มาตามนัดได้เงินประกันคืน ฿${depositEach.toLocaleString()} เต็มจำนวน`}
            />
          </div>
        )}
        {/* สถานะสลิปของแต่ละฝ่าย */}
        {[{ side: 'buyer', label: '🛍️ ผู้ซื้อ', slip: md.buyer_slip }, { side: 'seller', label: '🛒 ผู้ขาย', slip: md.seller_slip }].map(r => (
          <div key={r.side} className="dr-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b style={{ fontSize: 13.5 }}>{r.label}</b>
              <span style={{ fontSize: 12.5, color: r.slip ? 'var(--green-600)' : 'var(--faint)' }}>{r.slip ? '✅ ส่งสลิปแล้ว' : '⏳ รอ'}</span>
            </div>
            {r.slip
              ? <a href={fileUrl(r.slip)} target="_blank" rel="noreferrer"><img src={fileUrl(r.slip)} alt="สลิปเงินประกัน" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }} /></a>
              : isParty && r.side === myRole && (
                <button onClick={() => meetupSlipInputRef.current?.click()} className="btn btn-green btn-block"><Icon name="upload" size={16} /> อัปโหลดสลิปเงินประกัน</button>
              )}
          </div>
        ))}
        <input ref={meetupSlipInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; await uploadMeetupSlip(f); }} />
      </div>
    );
  }

  function renderMeetupWizardStepAdminCheck() {
    const md: MeetupData = meetup || {};
    // ถ้าดีลเลยขั้นตรวจไปแล้ว (นัดเจอ/เสร็จ) ถือว่าผ่านการตรวจแล้ว — กันสภาพ "ขั้น 7 แต่สลิปยังรอตรวจ"
    const passedCheck = deal!.status === 'meetup_ready' || deal!.status === 'completed';
    const slipRows = [
      { side: 'buyer', label: '🛍️ สลิปผู้ซื้อ', slip: md.buyer_slip, verified: !!md.buyer_slip_verified_at || passedCheck },
      { side: 'seller', label: '🛒 สลิปผู้ขาย', slip: md.seller_slip, verified: !!md.seller_slip_verified_at || passedCheck },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dr-card" style={{ textAlign: 'center', padding: '24px 20px' }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>ศูนย์กลางกำลังตรวจสอบสลิปเงินประกัน</div>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>เมื่อตรวจสลิปครบทั้งสองฝ่ายแล้ว ระบบจะแจ้งและเริ่มขั้นตอนนัดพบทันที</p>
        </div>
        {/* ข้อ2: โชว์สลิปจริง + ผลตรวจรายฝ่าย */}
        <div className="dr-card">
          <div className="dr-card-title">🧾 สลิปเงินประกัน + ผลตรวจ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {slipRows.map(r => (
              <div key={r.side} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{r.label}</div>
                {r.slip
                  ? <a href={fileUrl(r.slip)} target="_blank" rel="noreferrer"><img src={fileUrl(r.slip)} alt={r.label} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }} /></a>
                  : <div style={{ height: 120, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--faint)', border: '1px dashed var(--line)', borderRadius: 'var(--r-sm)' }}>ยังไม่อัปสลิป</div>}
                <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: r.verified ? 'var(--green-600)' : 'var(--muted)' }}>
                  {r.verified ? '✅ ตรวจแล้ว — ถูกต้อง' : r.slip ? '⏳ รอศูนย์กลางตรวจ' : '⏳ รอวางเงินประกัน'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderMeetupWizardStepMeet() {
    const md: MeetupData = meetup || {};
    const isParty = myRole === 'buyer' || myRole === 'seller';
    const myDepartedAt = myRole === 'buyer' ? md.buyer_departed_at : md.seller_departed_at;
    const myMet = myRole === 'buyer' ? md.buyer_met : md.seller_met;
    // ข้อ5: สถานะรับทราบการออกเดินทาง (buyer_departed_ack_at = ผู้ขายรับทราบของผู้ซื้อ)
    const otherDepartedAt = myRole === 'buyer' ? md.seller_departed_at : md.buyer_departed_at;
    const iAckedOther = !!(myRole === 'buyer' ? md.seller_departed_ack_at : md.buyer_departed_ack_at);
    const myDepartAcked = !!(myRole === 'buyer' ? md.buyer_departed_ack_at : md.seller_departed_ack_at);
    const showAckPopup = isParty && !!otherDepartedAt && !iAckedOther && !myMet;
    const allRows = [
      { side: 'buyer', label: '🛍️ ผู้ซื้อ', met: md.buyer_met, departedAt: md.buyer_departed_at, pos: md.buyer_pos },
      { side: 'seller', label: '🛒 ผู้ขาย', met: md.seller_met, departedAt: md.seller_departed_at, pos: md.seller_pos },
    ];
    // ผู้ซื้อ/ผู้ขายเห็นแค่ตำแหน่ง "ฝ่ายตรงข้าม" พอ (คนกลาง/แอดมินเห็นทั้งคู่)
    const rows = isParty ? allRows.filter(r => r.side !== myRole) : allRows;
    // คำนวณจุดหมายปลายทาง (สำหรับ navigation link)
    const destLoc = md.meet_label?.startsWith('ผู้ซื้อเดินทาง') ? md.seller_loc
      : md.meet_label?.startsWith('ผู้ขายเดินทาง') ? md.buyer_loc
      : null;
    const destQuery = destLoc
      ? `${destLoc.tambon} ${destLoc.amphoe} ${destLoc.province}`
      : md.meet_label || '';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dr-card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-700)', marginBottom: 4 }}>📍 จุดนัดพบ: {md.meet_label || 'ตามที่ตกลง'}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>เงินประกัน ฿{(md.deposit || 0).toLocaleString()} / ฝ่าย ถูกล็อกไว้ที่ศูนย์กลางแล้ว</div>
          {destQuery && (
            <a href={`https://www.google.com/maps/search/${encodeURIComponent(destQuery)}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">🗺️ ดูจุดนัดพบบนแผนที่</a>
          )}
        </div>
        {/* ข้อ5: Pop-up รับทราบ — เด้งเมื่ออีกฝ่ายออกเดินทางแล้วและเรายังไม่ได้กดรับทราบ */}
        {showAckPopup && (
          <div className="meetup-ack-pop" role="alertdialog" aria-label="อีกฝ่ายออกเดินทางแล้ว">
            <div className="meetup-ack-card">
              <div style={{ fontSize: 34, marginBottom: 6 }}>🚗</div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 4 }}>อีกฝ่ายออกเดินทางแล้ว!</div>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 14 }}>
                {myRole === 'buyer' ? 'ผู้ขาย' : 'ผู้ซื้อ'}เริ่มออกเดินทางมุ่งหน้าสู่จุดนัดพบแล้ว — กดรับทราบเพื่อให้อีกฝ่ายรู้ว่าคุณรับทราบ
              </p>
              <AsyncButton className="btn btn-green btn-block btn-lg" onClick={() => doAction('meetup_ack_departure')}>✅ รับทราบ</AsyncButton>
            </div>
          </div>
        )}
        {/* สถานะการรับทราบของการเดินทางของฉัน */}
        {isParty && myDepartedAt && !myMet && (
          <div className="dr-card" style={{ background: myDepartAcked ? '#f0fdf4' : 'var(--surface-2)', borderColor: myDepartAcked ? '#bbf7d0' : 'var(--line)', fontSize: 13, color: myDepartAcked ? 'var(--green-700)' : 'var(--muted)', textAlign: 'center' }}>
            {myDepartAcked ? '🤝 อีกฝ่ายรับทราบว่าคุณออกเดินทางแล้ว' : '⏳ รออีกฝ่ายกดรับทราบว่าคุณออกเดินทาง'}
          </div>
        )}
        {rows.map(r => (
          <div key={r.side} className="dr-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b style={{ fontSize: 13.5 }}>{r.label}</b>
              <span style={{ fontSize: 12, color: r.met ? 'var(--green-600)' : r.departedAt ? 'var(--accent)' : 'var(--faint)' }}>
                {r.met ? '✅ เจอแล้ว' : r.departedAt ? '🚗 กำลังเดินทาง' : '⏳ ยังไม่ออกเดินทาง'}
              </span>
            </div>
            {r.pos && !r.met && (
              <div style={{ display: 'grid', gap: 6 }}>
                {/* ตำแหน่งปัจจุบัน (GPS สด ของผู้เดินทาง) */}
                <a href={`https://maps.google.com/?q=${r.pos.lat},${r.pos.lng}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm btn-block">
                  🛰️ ตำแหน่งปัจจุบัน — {Math.max(0, Math.floor((nowTs - new Date(r.pos.at).getTime()) / 60000))} นาทีที่แล้ว
                </a>
                {/* นำทาง: จากตำแหน่งปัจจุบัน → จุดนัดพบ */}
                {destQuery && (
                  <a href={`https://www.google.com/maps/dir/${r.pos.lat},${r.pos.lng}/${encodeURIComponent(destQuery)}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm btn-block">
                    🧭 นำทางจากตำแหน่งนี้ → จุดนัดพบ
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
        {isParty && !myMet && (
          <div className="dr-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!myDepartedAt && (
              <AsyncButton className="btn btn-primary btn-block" onClick={() => { startShareLoc(); return doAction('meetup_depart'); }}>🚗 ออกเดินทางแล้ว — แชร์ตำแหน่ง</AsyncButton>
            )}
            {myDepartedAt && (
              <AsyncButton className="btn btn-green btn-block btn-lg" onClick={() => { if (!confirm('ยืนยันว่านัดเจอกันสำเร็จแล้ว?')) return; stopShareLoc(); return doAction('meetup_met'); }}>✅ เจอกันแล้ว — ยืนยัน</AsyncButton>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderMeetupWizardStepWaitRefund(outcome?: 'completed' | 'cancelled') {
    if (outcome === 'cancelled') {
      return (
        <div className="dr-card" style={{ textAlign: 'center', padding: '30px 20px', borderColor: '#fbd5dd' }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>↩️</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: '#b22441', marginBottom: 8 }}>ดีลถูกยกเลิก</div>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>ศูนย์กลางกำลังดำเนินการคืนเงินประกันให้ทั้งสองฝ่าย</p>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dr-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>⏳</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>นัดพบสำเร็จ! 🎉 — ศูนย์กลางกำลังคืนเงินประกัน</div>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>ทีมงานกำลังตัดสินและโอนเงินประกันคืน — จะแจ้งให้ทราบเมื่อโอนแล้ว</p>
        </div>
        {/* ให้รีวิว+ดาว ตรงนี้เลย — ส่วนใหญ่ผู้ใช้ไม่กลับเข้าดีลอีกหลังได้เงินคืน */}
        <ReviewPanel deal={deal!} myRole={myRole as 'buyer' | 'seller' | 'middleman'} headers={authHdrs} />
      </div>
    );
  }

  function renderMeetupWizardStepDone() {
    const md: MeetupData = meetup || {};
    const OUTCOME_LABEL: Record<string, string> = {
      buyer_all: 'โอนให้ผู้ซื้อทั้งหมด', seller_all: 'โอนให้ผู้ขายทั้งหมด',
      both: 'คืนให้ทั้งสองฝ่าย', frozen: 'อายัดไว้ชั่วคราว',
    };
    const outcomeLabel = md.refund_outcome ? OUTCOME_LABEL[md.refund_outcome] : '';
    const slips = [
      md.buyer_refund_slip && { label: 'สลิปคืนเงินผู้ซื้อ', id: md.buyer_refund_slip },
      md.seller_refund_slip && { label: 'สลิปคืนเงินผู้ขาย', id: md.seller_refund_slip },
    ].filter(Boolean) as { label: string; id: string }[];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dr-card dr-done-card">
          <div className="dr-done-emoji">🎉</div>
          <div className="dr-done-title">ดีลประกันการเดินทางเสร็จสมบูรณ์!</div>
          {outcomeLabel && <div className="dr-done-sub">ผลการคืนเงินประกัน: {outcomeLabel}</div>}
          {md.refund_decision_note && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>{md.refund_decision_note}</div>}
        </div>
        {slips.length > 0 && (
          <div className="dr-card">
            <div className="dr-card-title">📎 สลิปคืนเงินประกัน</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {slips.map(s => (
                <div key={s.id}>
                  <a href={fileUrl(s.id)} target="_blank" rel="noreferrer"><img src={fileUrl(s.id)} alt={s.label} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }} /></a>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <ReviewPanel deal={deal!} myRole={myRole as 'buyer' | 'seller' | 'middleman'} headers={authHdrs} />
      </div>
    );
  }

  function renderMeetupWizard() {
    const { step: actualStep, outcome } = getMeetupStep();
    const md: MeetupData = meetup || {};
    // ก่อนตกลงจุดนัด (ยังไม่มี deposit) actualStep=4 — เดิน แชท(2)→ตรวจหลักฐาน(3)→ตกลงจุดนัด(4) เป็น pre-flow
    const negotiatePreFlow = actualStep === 4 && !md.deposit;
    const defaultStep = negotiatePreFlow ? 2 : actualStep;
    const step = Math.min(wzViewStep ?? defaultStep, actualStep);
    const chatPreFlow = negotiatePreFlow; // ใช้ชื่อเดิมในส่วนปุ่มถัดไปด้านล่าง
    const isReviewing = negotiatePreFlow ? step < 2 : step < actualStep;
    return (
      <div className="dr-inner">
        {step > 0 && renderMeetupWizardProgress(step)}
        {step > 0 && step < 7 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
            <span>🛒 ผู้ขาย: <b style={{ color: 'var(--ink)' }}>{deal!.seller_name || '-'}</b></span>
            <span>🛍️ ผู้ซื้อ: <b style={{ color: 'var(--ink)' }}>{deal!.buyer_name || '-'}</b></span>
          </div>
        )}
        {isReviewing && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '8px 12px', marginBottom: 12, fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>
            👀 กำลังดูขั้นตอนที่ผ่านมาแล้ว (ดูอย่างเดียว)
          </div>
        )}
        <div style={isReviewing ? { pointerEvents: 'none', opacity: .55 } : undefined}>
          {step === 0 && renderWizardStep0()}
          {step === 1 && renderWizardStep1()}
          {step === 2 && renderWizardStepChat(3)}
          {step === 3 && renderWizardStepEvidenceReview(4)}
          {step === 4 && renderMeetupWizardStepNegotiate()}
          {step === 5 && renderMeetupWizardStepDeposit()}
          {step === 6 && renderMeetupWizardStepAdminCheck()}
          {step === 7 && renderMeetupWizardStepMeet()}
          {step === 8 && renderMeetupWizardStepWaitRefund(outcome)}
          {step === 9 && renderMeetupWizardStepDone()}
        </div>
        {step >= 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18 }}>
            {step > 1
              ? <button type="button" className="btn btn-ghost" onClick={() => setWzViewStep(Math.max(1, step - 1))}>← ย้อนกลับ</button>
              : <span />}
            {/* ซ่อนปุ่มถัดไปใน pre-flow (แชท/ตรวจหลักฐาน/ตกลงจุดนัด) — ต้องกดปุ่มหลักในแต่ละขั้น */}
            {step < actualStep && !(chatPreFlow && step >= 2) && (
              <button type="button" className="btn btn-primary" onClick={() => setWzViewStep(Math.min(actualStep, step + 1))}>ถัดไป →</button>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderSimpleWizard() {
    const { step: actualStep, outcome } = getSimpleStep();
    const step = Math.min(wzViewStep ?? actualStep, actualStep); // กันดูล้ำหน้ากว่าความเป็นจริง
    const isReviewing = step < actualStep; // กำลังย้อนดูขั้นที่ผ่านมาแล้ว — ปิดปฏิสัมพันธ์ กันกดซ้ำย้อนสถานะดีล
    return (
      <div className="dr-inner">
        {step > 0 && renderWizardProgress(step)}
        {step > 0 && step < 9 && renderWizardPartiesMini()}
        {isReviewing && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '8px 12px', marginBottom: 12, fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>
            👀 กำลังดูขั้นตอนที่ผ่านมาแล้ว (ดูอย่างเดียว) — กด &quot;ถัดไป&quot; เพื่อกลับไปขั้นตอนปัจจุบัน
          </div>
        )}
        <div style={isReviewing ? { pointerEvents: 'none', opacity: .55 } : undefined}>
          {step === 0 && renderWizardStep0()}
          {step === 1 && renderWizardStep1()}
          {step === 2 && renderWizardStepPrice()}
          {step === 3 && renderWizardStepChat()}
          {step === 4 && renderWizardStepEvidenceReview()}
          {step === 5 && renderPaymentSection()}
          {step === 6 && renderWizardStep4()}
          {step === 7 && renderWizardStep5()}
          {step === 8 && renderWizardStep6()}
          {step === 9 && renderWizardStep7(outcome)}
          {step === 10 && renderWizardStep8(outcome)}
        </div>
        {step >= 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18 }}>
            {step > 1
              ? <button type="button" className="btn btn-ghost" onClick={() => setWzViewStep(Math.max(1, step - 1))}>← ย้อนกลับ</button>
              : <span />}
            {step < actualStep && (
              <button type="button" className="btn btn-primary" onClick={() => setWzViewStep(Math.min(actualStep, step + 1))}>ถัดไป →</button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────
  return (
    <div className="dr-root">
      <InAppBanner />
      <header className="dr-header">
        <button onClick={() => router.back()} className="dr-back"><Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} /></button>
        <div className="dr-header-info"><div className="dr-htitle">{deal.title}</div><div className="dr-hsub">{dealCode(deal.id)} · {statusText(deal)} · ฿{deal.price.toLocaleString()}</div></div>
        <div className="dr-hctas">
          {myId && <NotifyBell />}
          <button className="dr-cta-link" onClick={copyLink}>{copied ? '✅ คัดลอกแล้ว' : '🔗 แชร์'}</button>
          {/* ดีลแบบง่าย: ปุ่มวิดีโอคอลอยู่ในขั้นตอน "คุย/วิดีโอคอล" ของ wizard อยู่แล้ว ไม่ต้องมีซ้ำที่นี่ */}
          {!isSimple && !isMeetup && <button className="dr-cta-green" onClick={toggleCall}>📹 Video</button>}
        </div>
      </header>

      {showJitsi ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0d1117', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,.4)', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>📹 วิดีโอคอล กำลังดำเนินการ...</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <CallRecorder dealId={dealId} onSaveEvidence={saveCallEvidence} />
              <button onClick={() => setShowJitsi(false)} className="btn btn-danger btn-sm">✕ วางสาย</button>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: '60vh' }}><JitsiMeet roomName={jitsiRoom} displayName={myName || 'ผู้ใช้'} /></div>
          {/* กล่องแชทลอยซ้อนบนวิดีโอคอล (ย่อ/ขยายได้) */}
          {callChatOpen ? (
            <div style={{ position: 'fixed', right: 16, bottom: 16, width: 320, maxWidth: '90vw', height: '55vh', maxHeight: 460, background: 'var(--surface)', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,.4)', display: 'flex', flexDirection: 'column', zIndex: 60, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--accent)', color: '#fff' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>💬 แชทระหว่างคอล</span>
                <button onClick={() => setCallChatOpen(false)} title="ย่อ" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>—</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {msgs.filter(m => m.role !== 'system').length === 0 && <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 12 }}>ยังไม่มีข้อความ</p>}
                {msgs.filter(m => m.role !== 'system').map(m => {
                  const isMe = m.sender_id === myId;
                  return (
                    <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                      {!isMe && <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{m.sender_name}</div>}
                      <div style={{ background: isMe ? 'var(--accent)' : 'var(--surface-2)', color: isMe ? '#fff' : 'var(--ink)', padding: '6px 10px', borderRadius: 10, fontSize: 13, wordBreak: 'break-word' }}>
                        {m.type === 'image' ? <a href={fileUrl(m.file_id)} target="_blank" rel="noreferrer"><img src={fileUrl(m.file_id)} alt={m.file_name} style={{ maxWidth: 160, borderRadius: 8 }} /></a>
                          : m.type === 'file' ? <a href={fileUrl(m.file_id)} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>📎 {m.file_name}</a>
                          : m.content}
                      </div>
                      {(m.content || m.file_id) && (
                        <button onClick={() => saveMsgEvidence(m)} disabled={acting} style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}>📌 เก็บเป็นหลักฐาน</button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid var(--line)' }}>
                <button className="dr-attach" onClick={() => callFileInputRef.current?.click()} disabled={sending} title="ส่งรูป/ไฟล์">🖼️</button>
                <input ref={callFileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (f.size > 10 * 1024 * 1024) { alert('ไฟล์ใหญ่เกิน 10MB'); return; } await uploadFile(f); }} />
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="พิมพ์ข้อความ..." onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (chatInput.trim()) sendMsg(chatInput); } }} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 13, minWidth: 0 }} />
                <button onClick={() => { if (chatInput.trim()) sendMsg(chatInput); }} disabled={!chatInput.trim() || sending} className="btn btn-primary btn-sm">ส่ง</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setCallChatOpen(true)} style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60, borderRadius: 24, padding: '10px 16px', background: 'var(--accent)', color: '#fff', border: 'none', boxShadow: '0 6px 20px rgba(0,0,0,.4)', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>💬 แชท ({msgs.filter(m => m.role !== 'system').length})</button>
          )}
        </div>
      ) : (
        <>
          {callLive && (
            <div className="dr-call-banner" role="status">
              <span className="dr-call-dot" />
              <span className="dr-call-tx">📹 มีวิดีโอคอลกำลังดำเนินอยู่ในดีลนี้</span>
              <button type="button" onClick={toggleCall}>เข้าร่วมเลย</button>
            </div>
          )}
          {!isSimple && !isMeetup && (
          <div className="dr-progress-wrap">
            <div className="dr-prog-meta"><span className="dr-prog-status">{statusText(deal)}</span><span className="dr-prog-pct">{pct}%</span></div>
            <div className="dr-prog-track"><div className="dr-prog-fill" style={{ width: `${pct}%`, background: deal.status === 'completed' ? 'var(--green-500)' : 'var(--accent)' }} /></div>
          </div>
          )}

          {/* แถบ "ถึงตาคุณ" — เด้งไปแท็บขั้นตอนเมื่อมีงานรอผู้ใช้คนนี้ทำ (กันหลงว่าไม่มีปุ่มให้ไปต่อ) — ซ่อนสำหรับ simple wizard เพราะมีปุ่มในแต่ละขั้นแล้ว */}
          {!isSimple && !isMeetup && (() => {
            const s = deal.status;
            let label: string | null = null;
            if (['buyer_joined', 'terms_pending'].includes(s)) {
              const accepted = (myRole === 'seller' && deal.seller_accepted_terms) || (myRole === 'middleman' && deal.middleman_accepted_terms) || (myRole === 'buyer' && deal.buyer_accepted_terms);
              if (!accepted) label = 'ยอมรับเงื่อนไขข้อตกลง';
            } else if (s === 'payment_pending' && myRole === 'buyer') label = 'ชำระเงิน — โอน + อัปโหลดสลิป';
            else if (s === 'payment_uploaded' && myRole === 'middleman') label = 'ยืนยันรับเงิน';
            else if (s === 'packing' && myRole === 'seller') label = 'แพ็ค + จัดส่งสินค้า';
            else if (s === 'shipped_to_middleman' && myRole === 'middleman') label = 'รับสินค้า';
            else if (s === 'middleman_checking' && myRole === 'buyer' && !deal.buyer_confirmed_check) label = 'ยืนยันสินค้าไม่มีปัญหา';
            else if (s === 'middleman_checking' && myRole === 'middleman' && deal.buyer_confirmed_check) label = 'จัดส่งให้ผู้ซื้อ';
            else if (s === 'shipped_to_buyer' && myRole === 'buyer') label = 'ยืนยันรับสินค้า';
            if (!label || tab === 'steps') return null;
            return (
              <button onClick={() => setTab('steps')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', padding: '11px 14px', margin: '4px 0 8px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                <span>👉 ถึงตาคุณ: {label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, opacity: .95 }}>ไปที่ขั้นตอน →</span>
              </button>
            );
          })()}

          {/* ดีลแบบง่าย: แชทและหลักฐานถูกฝังอยู่ในขั้นตอนของ wizard แล้ว ไม่ต้องมีแท็บแยก */}
          {!isSimple && !isMeetup && (
          <nav className="dr-tabs">
            {(['steps', 'chat', 'evidence'] as const).map(k => (
              <button key={k} className={`dr-tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
                {k === 'steps' ? 'ขั้นตอน' : k === 'chat' ? `แชท (${msgs.filter(m => m.role !== 'system').length})` : 'หลักฐาน'}
              </button>
            ))}
          </nav>
          )}

          <main className="dr-body">
            {tab === 'steps' && isSimple && renderSimpleWizard()}
            {tab === 'steps' && isMeetup && renderMeetupWizard()}
            {tab === 'steps' && !isSimple && !isMeetup && (
              <div className="dr-inner">
                <div className="dr-card">
                  <div className="dr-card-title">ผู้เกี่ยวข้อง</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {[
                      ['ผู้ขาย', deal.seller_name || '(รอผู้ขาย)'],
                      ['ผู้ซื้อ', deal.buyer_name || '(รอผู้ซื้อ)'],
                      ['คนกลาง', isMeetup ? 'ไม่ต้องใช้ (รับประกันเดินทาง)' : isSimple ? 'ไม่ต้องใช้ (ศูนย์กลางดูแลเอง)' : (deal.middleman_name || '(ยังไม่ได้เลือก)')],
                      ['ศูนย์กลาง', 'บริษัท คนกลาง จำกัด'],
                    ].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--line-2)', fontSize: 14 }}><span style={{ color: 'var(--muted)' }}>{l}</span><span style={{ fontWeight: 600, color: 'var(--ink)' }}>{v}</span></div>
                    ))}
                  </div>
                  {!isMeetup && !isSimple && myRole === 'buyer' && ['buyer_joined', 'terms_pending', 'payment_pending'].includes(deal.status) && (
                    <div style={{ marginTop: 14 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowSelectMM(v => !v)}>
                        {showSelectMM ? 'ซ่อนแผงเลือกคนกลาง' : deal.middleman_id ? 'เปลี่ยนคนกลาง' : 'เลือกคนกลาง'}
                      </button>
                    </div>
                  )}
                </div>

                {!isMeetup && !isSimple && myRole === 'buyer' && ['buyer_joined', 'terms_pending', 'payment_pending'].includes(deal.status) && showSelectMM && renderMiddlemanPickerPanel()}

                {(deal.seller_accepted_terms || deal.buyer_accepted_terms || deal.middleman_accepted_terms) && (
                  <div className="dr-card">
                    <div className="dr-card-title">ยอมรับเงื่อนไข</div>
                    {[['ผู้ขาย', deal.seller_accepted_terms], ...(deal.middleman_id ? [['คนกลาง', deal.middleman_accepted_terms] as [string, boolean]] : []), ['ผู้ซื้อ', deal.buyer_accepted_terms]].map(([l, ok]) => (
                      <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--line-2)', fontSize: 14 }}><span style={{ color: 'var(--muted)' }}>{l}</span><span style={{ color: ok ? 'var(--green-600)' : 'var(--faint)' }}>{ok ? '✅ ยอมรับแล้ว' : '⏳ รอ'}</span></div>
                    ))}
                  </div>
                )}

                {/* Timeline */}
                <div className="dr-card">
                  <div className="dr-card-title">{isMeetup ? 'ขั้นตอนรับประกันเดินทาง' : isSimple ? 'ขั้นตอน Escrow (ส่งตรง)' : 'ขั้นตอน Escrow'}</div>
                  <div className="dr-timeline">
                    {(isMeetup ? MEETUP_TIMELINE : isSimple ? SIMPLE_TIMELINE : TIMELINE).map(st => {
                      const si = STEP_ORDER.indexOf(deal.status);
                      const ti = STEP_ORDER.indexOf(st.key);
                      const d = ti < si, a = ti === si;
                      return (
                        <div key={st.key} className={`dr-tl-item${d ? ' done' : ''}${a ? ' active' : ''}`}>
                          <div className="dr-tl-dot">{d ? <Icon name="check" size={10} /> : a ? <div className="dr-tl-pulse" /> : null}</div>
                          <span className="dr-tl-label">{st.label}</span>
                          {a && <span className="dr-tl-now">กำลังดำเนินการ</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {renderMeetupPanel()}
                {renderPricePanel()}
                {renderEvidenceDonePanel()}
                {renderPaymentSection()}

                {renderAllSlipsCard()}
                {renderFinanceSummaryCard()}

                {deal.tracking_to_middleman && <div className="dr-card"><div className="dr-card-title">📦 เลขพัสดุ ผู้ขาย → คนกลาง</div><div className="dr-track-code">{deal.tracking_to_middleman}</div></div>}
                {deal.tracking_to_buyer && <div className="dr-card"><div className="dr-card-title">📦 เลขพัสดุ {isSimple ? 'ผู้ขาย' : 'คนกลาง'} → ผู้ซื้อ</div><div className="dr-track-code">{deal.tracking_to_buyer}</div></div>}

                {deal.status === 'completed' && (
                  <>
                    <div className="dr-card dr-done-card"><div className="dr-done-emoji">🎉</div><div className="dr-done-title">ดีลเสร็จสมบูรณ์!</div><div className="dr-done-sub">{isMeetup ? 'บริษัท คนกลาง จำกัด จะโอนเงินประกันคืนทั้งสองฝ่าย' : isSimple ? 'ศูนย์กลางจะโอนเงินให้ผู้ขายเรียบร้อยแล้ว (ดำเนินการโดยทีมงาน)' : 'เงินถูกโอนให้ผู้ขายเรียบร้อยแล้ว'}</div></div>
                    <ReviewPanel deal={deal} myRole={myRole as 'buyer' | 'seller' | 'middleman'} headers={authHdrs} />
                  </>
                )}

                <div className="dr-card"><div className="dr-card-title">การกระทำ</div>{renderActionPanel()}</div>
              </div>
            )}

            {tab === 'chat' && (
              <div className="dr-chat-root">
                <div className="dr-chat-feed">
                  {msgs.length === 0 && <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0', fontSize: 14 }}>ยังไม่มีข้อความ</p>}
                  {msgs.map(m => {
                    if (m.role === 'system') return <div key={m.id} className="dr-sys-msg"><span>{m.content}</span></div>;
                    const isMe = m.sender_id === myId;
                    return (
                      <div key={m.id} className={`dr-bubble-row${isMe ? ' mine' : ''}`}>
                        {!isMe && <div className="dr-bubble-av" style={{ background: bubbleAvColor(m) }}>{(m.sender_name || '?').slice(0, 1)}</div>}
                        <div className="dr-bubble-col">
                          {!isMe && <span className="dr-bubble-sender">{m.sender_name}</span>}
                          <div className={bubbleClass(m, isMe)}>
                            {m.type === 'image' ? <a href={fileUrl(m.file_id)} target="_blank" rel="noreferrer"><img src={fileUrl(m.file_id)} alt={m.file_name} style={{ maxWidth: 200, borderRadius: 10 }} /></a>
                              : m.type === 'file' ? <a href={fileUrl(m.file_id)} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', fontSize: 14 }}>📎 {m.file_name}</a>
                                : m.content}
                          </div>
                          <span className="dr-bubble-t">
                            {new Date(m.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            <span style={{ marginLeft: 8 }}>{pinBtn(m)}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatBottomRef} />
                </div>
                {renderChatPresenceBar()}
                {!chatIsOpen() && (
                  <div style={{ padding: '10px 16px', background: '#fff8ef', borderBottom: '1px solid #ffe0b2', fontSize: 12.5, color: '#8a5a00', textAlign: 'center' }}>
                    ⏳ รอบุคคลที่เกี่ยวข้องเข้าร่วมดีลก่อนจึงจะแชทได้
                  </div>
                )}
                <div className="dr-chat-bar">
                  <button className="dr-attach" onClick={() => fileInputRef.current?.click()} disabled={sending || !chatIsOpen()}>🖼️</button>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (f.size > 10 * 1024 * 1024) { alert('ไฟล์ใหญ่เกิน 10MB'); return; } await uploadFile(f); }} />
                  <input className="dr-chat-input" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder={chatIsOpen() ? 'พิมพ์ข้อความ...' : 'รอบุคคลที่เกี่ยวข้องเข้าร่วมก่อน...'} disabled={!chatIsOpen()} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (chatInput.trim() && chatIsOpen()) sendMsg(chatInput); } }} />
                  <button className="dr-chat-send" onClick={() => { if (chatInput.trim() && chatIsOpen()) sendMsg(chatInput); }} disabled={!chatInput.trim() || sending || !chatIsOpen()}><Icon name="arrowRight" size={16} /></button>
                </div>
              </div>
            )}

            {tab === 'evidence' && renderEvidencePanel()}
          </main>
        </>
      )}
      {showTerms && (() => { const t = termsFor(deal.deal_type); return (
        <div onClick={() => setShowTerms(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', maxWidth: 460, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '22px 20px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--ink)', marginBottom: 4 }}>📋 ข้อตกลงบริการ</div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 16 }}>{t.name}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green-600)', marginBottom: 8 }}>✅ บริการนี้ครอบคลุม</div>
            <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink)' }}>
              {t.covers.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#b22441', marginBottom: 8 }}>⚠️ ไม่ครอบคลุม</div>
            <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7, color: 'var(--muted)' }}>
              {t.excludes.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
            {(() => { const fb = computeDealFees(feeConfig, deal.price, deal.deal_type); return (
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 8 }}>💸 ค่าบริการของดีลนี้ (มูลค่า ฿{deal.price.toLocaleString()})</div>
                {fb.lines.map(l => (
                  <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', padding: '2px 0' }}>
                    <span>{l.label}</span><span>฿{l.amount.toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}>
                  <span>รวมค่าบริการ</span><span>฿{fb.total.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>* {fb.note}</div>
              </div>
            ); })()}
            <div style={{ background: '#fff8ef', border: '1px solid #ffe0b2', borderRadius: 'var(--r-md)', padding: '12px 14px', fontSize: 13, color: '#8a5a00', lineHeight: 1.6, marginBottom: 18 }}>
              📹 สำคัญ: โปรดเข้าหน้าแชทและวิดีโอคอล เพื่อพูดคุย ดูสภาพสินค้า และตกลงรายละเอียดให้เรียบร้อยก่อน — บันทึกบทสนทนา / วิดีโอคอล / รูปภาพไว้เป็นหลักฐาน โดยกดปุ่ม “📌 เก็บเป็นหลักฐาน” ที่แต่ละข้อความ
            </div>
            <button className="btn btn-primary btn-block" onClick={() => { setShowTerms(false); setTab('chat'); doAction('accept_terms'); }}>✅ ยอมรับข้อตกลงและดำเนินการต่อ</button>
            <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setShowTerms(false)}>ยกเลิก</button>
          </div>
        </div>
      ); })()}
      {uploadPreview && (
        <div className="up-toast" role="status" aria-live="polite">
          {uploadPreview.url
            ? <img src={uploadPreview.url} alt={`พรีวิว ${uploadPreview.name}`} />
            : <span className="up-ic">📎</span>}
          <div className="up-tx"><b>กำลังอัปโหลด...</b><span>{uploadPreview.name}</span></div>
          <span className="up-spin" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
