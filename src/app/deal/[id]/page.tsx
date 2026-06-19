'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useRef, useCallback } from 'react';
import { account, storage } from '@/lib/appwrite';
import { ID, Permission, Role } from 'appwrite';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ReviewPanel } from '@/components/ReviewPanel';
import { NotifyBell } from '@/components/NotifyBell';
import { AddressPicker, EMPTY_ADDRESS, ThaiAddress, addressLabel } from '@/components/AddressPicker';
import { PaymentMethods } from '@/components/PaymentMethods';
import { InAppBanner } from '@/components/InAppBanner';
import { withExternalBrowserParam } from '@/lib/inApp';
import { distanceKm, midpointProvince } from '@/lib/provinceGeo';
import { compressImage } from '@/lib/imageCompress';
import { readDealPriceState } from '@/lib/dealPriceState';
import { FeeConfig, FEE_DEFAULTS, computeDealFees } from '@/lib/fees';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Jitsi Meet via External API ──────────────────────────────────────────
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
  $id: string; sellerId: string; sellerName: string; middlemanId: string; middlemanName: string;
  buyerId: string; buyerName: string; title: string; description: string; price: number; category: string;
  status: string; rejectReason: string;
  sellerAcceptedTerms: boolean; middlemanAcceptedTerms: boolean; buyerAcceptedTerms: boolean;
  middlemanConfirmedPayment: boolean; buyerConfirmedCheck: boolean;
  paymentSlipFileId: string; evidenceData: string; trackingToMiddleman: string; trackingToBuyer: string;
  dealType?: string; meetupData?: string; priceData?: string; feePayer?: string;
}

/** ข้อมูลรับประกันเดินทาง (เก็บเป็น JSON ใน deal.meetupData) */
interface MeetupData {
  v?: number;
  buyerLoc?: ThaiAddress; sellerLoc?: ThaiAddress; // ที่อยู่ระดับ ต/อ/จ ของแต่ละฝ่าย (v2)
  meetLabel?: string; pendingMeetLabel?: string;   // จุดนัดพบที่ตกลง/ที่เสนอ
  buyerProvince?: string; sellerProvince?: string; meetProvince?: string; // ดีลเก่า v1
  buyerKm?: number; sellerKm?: number; ratePerKm?: number;
  deposit?: number; // เงินประกันเท่ากันทั้งสองฝ่าย (ตกลงกันในห้องดีล)
  buyerDepartedAt?: string; sellerDepartedAt?: string; // เวลาเริ่มออกเดินทาง
  buyerPos?: { lat: number; lng: number; at: string }; sellerPos?: { lat: number; lng: number; at: string }; // ตำแหน่งล่าสุดระหว่างเดินทาง
  pendingDeposit?: number; pendingBy?: 'buyer' | 'seller'; // ข้อเสนอที่รออีกฝ่ายยอมรับ
  buyerDeposit?: number; sellerDeposit?: number; // รองรับดีลเก่า
  fee?: number; feeWho?: string; buyerFee?: number; sellerFee?: number;
  buyerSlip?: string; sellerSlip?: string; buyerMet?: boolean; sellerMet?: boolean;
}
function parseMeetup(s?: string): MeetupData {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}
interface Msg { $id: string; senderId: string; senderName: string; role: string; type: string; content: string; fileId: string; fileName: string; createdAt: string; }
interface Middleman { userId: string; code: string; name: string; tier: string; workProvince: string; phone: string; categories?: string; reviewScore: number; reviewCount: number; }

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const BUCKET = 'deal_files';
function fileUrl(id: string) { return `${ENDPOINT}/storage/buckets/${BUCKET}/files/${id}/view?project=${PROJECT}`; }

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
function statusText(d: { status: string; dealType?: string }) {
  if (d.dealType === 'simple' && SIMPLE_STATUS_LABEL[d.status]) return SIMPLE_STATUS_LABEL[d.status];
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

export default function DealRoom() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const dealId = params.id as string;
  const requestedTab = searchParams.get('tab');
  const requestedCall = searchParams.get('call') === '1';

  const [deal, setDeal] = useState<Deal | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [middlemen, setMiddlemen] = useState<Middleman[]>([]);
  const [myId, setMyId] = useState('');
  const [myName, setMyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [trackingInput, setTrackingInput] = useState('');
  const [showJitsi, setShowJitsi] = useState(requestedCall);
  const [tab, setTab] = useState<DealTab>(readDealTab(requestedTab));
  const [evidenceType, setEvidenceType] = useState('packing');
  const [copied, setCopied] = useState(false);
  const [jwt, setJwt] = useState('');
  const [dealError, setDealError] = useState('');
  const [showSelectMM, setShowSelectMM] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<{ url: string; name: string } | null>(null);
  const [meetAddr, setMeetAddr] = useState<ThaiAddress>(EMPTY_ADDRESS); // ที่อยู่ของฉัน (ดีลนัดรับ)
  const [payOpen, setPayOpen] = useState(false); // เปิดกล่องช่องทางชำระเงินก่อนอัปสลิป
  const [sharingLoc, setSharingLoc] = useState(false); // กำลังแชร์ตำแหน่งระหว่างเดินทาง
  const shareLocTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ส่งตำแหน่งแบบเงียบ (ไม่ลงแชท/ไม่แจ้งเตือน) — อีกฝ่ายเห็นในแผงนัดรับผ่านรอบโพลปกติ
  const sendPosition = useCallback(async () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const j = (await account.createJWT()).jwt;
        await fetch(`/api/deals/${dealId}`, {
          method: 'PATCH',
          headers: { 'x-session-jwt': j, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'meetup_position', lat: pos.coords.latitude, lng: pos.coords.longitude }),
        });
      } catch { /* เงียบ */ }
    }, () => { /* ผู้ใช้ไม่อนุญาต */ }, { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 });
  }, [dealId]);

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
  const buyerEvidInputRef = useRef<HTMLInputElement>(null);
  const sellerFeeInputRef = useRef<HTMLInputElement>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [callChatOpen, setCallChatOpen] = useState(true);
  const [feeConfig, setFeeConfig] = useState<FeeConfig>(FEE_DEFAULTS);
  const [priceInput, setPriceInput] = useState('');
  const [feePayerInput, setFeePayerInput] = useState<'buyer' | 'seller' | 'split' | ''>('');
  const [showPriceProposal, setShowPriceProposal] = useState(false);
  const callFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0'); r.style.setProperty('--accent-strong', '#1f54d6'); r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTab(readDealTab(requestedTab));
      if (requestedCall) setShowJitsi(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [requestedCall, requestedTab]);

  const fetchDeal = useCallback(async (j?: string) => {
    const headers: Record<string, string> = {};
    if (j) headers['x-session-jwt'] = j;
    try {
      const r = await fetch(`/api/deals/${dealId}`, { headers });
      const d = await r.json();
      if (r.ok) { setDeal(d.deal); setDealError(''); } else setDealError(d.error || `Error ${r.status}`);
    } catch (e: any) { setDealError(e?.message || 'Network error'); }
  }, [dealId, setDeal, setDealError]);

  const fetchMsgs = useCallback(async (j: string) => {
    const r = await fetch(`/api/messages?dealId=${dealId}`, { headers: { 'x-session-jwt': j } }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setMsgs(d.messages || []); }
  }, [dealId, setMsgs]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    (async () => {
      await fetchDeal();
      try {
        const user = await account.get();
        setMyId(user.$id); setMyName(user.name || '');
        const j = (await account.createJWT()).jwt;
        setJwt(j); fetchMsgs(j);
        timer = setInterval(async () => {
          const j2 = (await account.createJWT().catch(() => ({ jwt: '' }))).jwt;
          if (j2) { setJwt(j2); fetchMsgs(j2); fetchDeal(j2); }
        }, 4000);
      } catch { /* guest */ }
      finally { setLoading(false); }
    })();
    return () => clearInterval(timer);
  }, [dealId, fetchDeal, fetchMsgs]);

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
        const j = (await account.createJWT()).jwt;
        await fetch(`/api/deals/${dealId}`, {
          method: 'PATCH',
          headers: { 'x-session-jwt': j, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'visit' }),
        });
      } catch { /* ไม่กระทบการใช้งาน */ }
    })();
  }, [deal, myId, dealId]);

  const loadMiddlemen = useCallback(async (j: string, f = mmFilter) => {
    setMmLoading(true);
    try {
      const p = new URLSearchParams();
      if (f.q) p.set('q', f.q);
      if (f.province) p.set('province', f.province);
      if (f.tier) p.set('tier', f.tier);
      if (f.need) p.set('need', f.need);
      const r = await fetch(`/api/middlemen?${p}`, { headers: { 'x-session-jwt': j } });
      const d = await r.json();
      setMiddlemen(d.middlemen || []);
    } catch {} finally { setMmLoading(false); }
  }, [mmFilter, setMiddlemen, setMmLoading]);

  useEffect(() => {
    if (!showSelectMM || !jwt) return;
    const timer = window.setTimeout(() => { void loadMiddlemen(jwt); }, 0);
    return () => window.clearTimeout(timer);
  }, [jwt, showSelectMM, loadMiddlemen]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  useEffect(() => { fetch('/api/fees').then(r => r.json()).then(d => { if (d.fees) setFeeConfig(d.fees); }).catch(() => {}); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  async function getJwt() { const j = (await account.createJWT()).jwt; setJwt(j); return j; }

  async function doAction(action: string, extra: Record<string, unknown> = {}) {
    setActing(true);
    try {
      const j = await getJwt();
      const r = await fetch(`/api/deals/${dealId}`, { method: 'PATCH', headers: { 'x-session-jwt': j, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
      const d = await r.json();
      if (r.ok) { setDeal(d.deal); fetchMsgs(j); } else alert(d.error || 'เกิดข้อผิดพลาด');
    } finally { setActing(false); }
  }

  async function sendMsg(text: string, type = 'text', fileId = '', fileName = '') {
    if (!text && !fileId) return;
    setSending(true);
    try {
      const j = await getJwt();
      await fetch('/api/messages', { method: 'POST', headers: { 'x-session-jwt': j, 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId, content: text, type, fileId, fileName, role: myRole }) });
      setChatInput(''); await fetchMsgs(j);
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
        // วิดีโอมักใหญ่เกินลิมิต body ของ API route บน Vercel (~4.5MB) → อัปโหลดตรงเข้า Appwrite Storage
        await fetch('/api/storage/ensure-deal-bucket', { method: 'POST' }).catch(() => {});
        const perms = myId
          ? [Permission.read(Role.any()), Permission.update(Role.user(myId)), Permission.delete(Role.user(myId))]
          : [Permission.read(Role.any())];
        const created = await storage.createFile(BUCKET, ID.unique(), file, perms);
        fileId = created.$id;
      } else {
        const j = await getJwt();
        const prepared = await compressImage(file); // บีบอัดเฉพาะรูป
        const form = new FormData(); form.append('file', prepared);
        const r = await fetch('/api/upload-deal', { method: 'POST', headers: { 'x-session-jwt': j }, body: form });
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
      await doAction('add_evidence', { evidenceType: 'chat', fileId: m.fileId, fileName: m.fileName, content: m.senderName ? `จาก ${m.senderName}` : '' });
    } else {
      await doAction('add_evidence', { evidenceType: 'chat_text', content: `${m.senderName || ''}: ${m.content}` });
    }
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
    const opening = !showJitsi;
    setShowJitsi(opening);
    // แจ้งเตือนทุกครั้งที่มีคนล็อกอินเปิดคอล — รวมถึงผู้สนใจที่มาจากลิงก์แชร์ (guest ที่ล็อกอินแล้ว)
    if (opening && myId && Date.now() - callNotifyAt.current > 120000) {
      callNotifyAt.current = Date.now();
      (async () => {
        try {
          const j = await getJwt();
          await fetch(`/api/deals/${dealId}`, {
            method: 'PATCH',
            headers: { 'x-session-jwt': j, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'start_call' }),
          });
          fetchMsgs(j);
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
  const isMeetup = deal.dealType === 'meetup';
  const isSimple = deal.dealType === 'simple';
  const myRole: DealRole = !deal || !myId
    ? (myId ? 'guest' : '')
    : deal.sellerId === myId
      ? 'seller'
      : deal.middlemanId === myId
        ? 'middleman'
        : deal.buyerId === myId
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
  const callLive = !!lastCallMsg && (nowTs - new Date(lastCallMsg.createdAt).getTime() < 3 * 60 * 1000);
  const stepIdx = STEP_ORDER.indexOf(deal.status);
  const pct = stepIdx >= 0 ? Math.round((stepIdx / (STEP_ORDER.length - 1)) * 100) : 0;
  const isFinished = ['completed', 'cancelled', 'disputed'].includes(deal.status);

  // ─── Guest / not-logged-in join panel ───────────────────────────────────
  if (myRole === 'guest' || myRole === '') {
    const canBeBuyer = !deal.buyerId, canBeSeller = !deal.sellerId, notLoggedIn = !myId;
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
              {deal.sellerName && <span>ผู้ขาย: {deal.sellerName}</span>}
              {deal.buyerName && <span>ผู้ซื้อ: {deal.buyerName}</span>}
            </div>
          </div>
          {notLoggedIn && <div style={{ background: '#fef5e3', border: '1px solid #fbe6bf', borderRadius: 'var(--r-md)', padding: '12px 16px', fontSize: 13, color: '#9a6209', textAlign: 'center' }}>⚠️ กรุณาเข้าสู่ระบบก่อนเข้าร่วมดีล</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {canBeBuyer && <button onClick={() => handleJoin('buyer')} disabled={acting} className="btn btn-primary btn-block btn-lg">{acting ? '...' : notLoggedIn ? '🔑 เข้าสู่ระบบเพื่อเป็นผู้ซื้อ' : '🛍️ เข้าร่วมเป็นผู้ซื้อ'}</button>}
            {canBeSeller && <button onClick={() => handleJoin('seller')} disabled={acting} className="btn btn-block btn-lg" style={{ background: '#6841d9', color: '#fff' }}>{acting ? '...' : notLoggedIn ? '🔑 เข้าสู่ระบบเพื่อเป็นผู้ขาย' : '🛒 เข้าร่วมเป็นผู้ขาย'}</button>}
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
      .filter(m => m.userId !== currentDeal.buyerId && m.userId !== currentDeal.sellerId)
      .filter(m => (mmFilter.minRating === 0 || m.reviewScore >= mmFilter.minRating));
    const TIER_COLOR: Record<string, string> = { Bronze: '#cd7f32', Silver: '#a0a0a0', Gold: '#f5b13d', Platinum: '#9db5c9' };

    return (
      <div className="dr-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div>
            <div className="dr-card-title" style={{ marginBottom: 6 }}>{currentDeal.middlemanId ? 'เปลี่ยนคนกลาง' : 'เลือกคนกลาง'}</div>
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
            <button onClick={() => { if (jwt) loadMiddlemen(jwt, mmFilter); }} disabled={mmLoading} className="btn btn-primary btn-block">{mmLoading ? 'กำลังค้นหา...' : '🔍 ค้นหาคนกลาง'}</button>
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
      const j = await getJwt();
      const prepared = await compressImage(f);
      const form = new FormData(); form.append('file', prepared);
      const r = await fetch('/api/upload-deal', { method: 'POST', headers: { 'x-session-jwt': j }, body: form });
      const d = await r.json();
      if (r.ok) await doAction('meetup_deposit', { fileId: d.fileId });
      else alert(d.error || 'อัปโหลดสลิปไม่สำเร็จ');
    } finally { endUploadPreview(purl); }
  }

  function renderMeetupPanel() {
    if (deal!.dealType !== 'meetup') return null;
    const md = parseMeetup(deal!.meetupData);
    // เงินประกันเท่ากันทั้งสองฝ่าย (fallback รองรับดีลเก่าที่แยกยอด)
    const depositEach = md.deposit ?? Math.max(md.buyerDeposit || 0, md.sellerDeposit || 0);
    const rows: { side: 'buyer' | 'seller'; label: string; prov?: string; km?: number; fee?: number; slip?: string; met?: boolean; departedAt?: string; pos?: { lat: number; lng: number; at: string } }[] = [
      { side: 'buyer', label: '🛍️ ผู้ซื้อ', prov: md.buyerProvince, km: md.buyerKm, fee: md.buyerFee, slip: md.buyerSlip, met: md.buyerMet, departedAt: md.buyerDepartedAt, pos: md.buyerPos },
      { side: 'seller', label: '🛒 ผู้ขาย', prov: md.sellerProvince, km: md.sellerKm, fee: md.sellerFee, slip: md.sellerSlip, met: md.sellerMet, departedAt: md.sellerDepartedAt, pos: md.sellerPos },
    ];
    const s = deal!.status;
    const depositStage = s === 'payment_pending';
    const meetStage = s === 'meetup_ready';
    const isParty = myRole === 'buyer' || myRole === 'seller';
    const noSlipsYet = !md.buyerSlip && !md.sellerSlip;
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
    const myLoc = myRole === 'buyer' ? md.buyerLoc : myRole === 'seller' ? md.sellerLoc : undefined;
    const bothLocs = !!(md.buyerLoc?.province && md.sellerLoc?.province);
    const provDist = bothLocs ? distanceKm(md.buyerLoc!.province, md.sellerLoc!.province) : 0;
    const suggestAmount = Math.max(100, Math.ceil((provDist * 2 * (md.ratePerKm || 5)) / 50) * 50);
    const meetOptions = bothLocs ? [
      { label: `ผู้ซื้อเดินทางไปหาผู้ขาย (${addressLabel(md.sellerLoc)})`, sub: 'ผู้ขายไม่ต้องเดินทาง' },
      { label: `ผู้ขายเดินทางมาหาผู้ซื้อ (${addressLabel(md.buyerLoc)})`, sub: 'ผู้ซื้อไม่ต้องเดินทาง' },
      { label: `เจอกันครึ่งทาง (~จ.${midpointProvince(md.buyerLoc!.province, md.sellerLoc!.province)})`, sub: 'แบ่งกันเดินทางคนละครึ่ง' },
    ] : [];

    return (
      <div className="dr-card">
        <div className="dr-card-title">🚗 รับประกันเดินทาง (ไม่ใช้คนกลาง)</div>
        {/* สรุปข้อตกลงปัจจุบัน */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 12 }}>
          {md.deposit ? (
            <>
              <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>📍 <b>{md.meetLabel || md.meetProvince || 'จุดนัดตามตกลง'}</b> · เงินประกัน<b>เท่ากันทั้งคู่</b>:</span>
              <b style={{ fontSize: 17, color: 'var(--accent-strong)', fontFamily: 'var(--font-display)' }}>฿{depositEach.toLocaleString()} / ฝ่าย</b>
              {canNegotiate && !md.pendingDeposit && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => proposeDeposit()}>✏️ ขอเปลี่ยนยอด</button>
              )}
            </>
          ) : (
            <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>⏳ <b>ยังไม่ตกลงจุดนัดพบและยอดประกัน</b> — ระบุที่อยู่ทั้งสองฝ่าย แล้วเสนอข้อตกลงด้านล่าง (คุยรายละเอียดในแชทได้)</span>
          )}
        </div>

        {/* ที่อยู่ของสองฝ่าย (ต/อ/จ) */}
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          {([['buyer', '🛍️ ผู้ซื้อ', md.buyerLoc], ['seller', '🛒 ผู้ขาย', md.sellerLoc]] as const).map(([side, label, loc]) => (
            <div key={side} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>{label}:</b>
              {loc?.province
                ? <span style={{ color: 'var(--green-600)' }}>📍 {addressLabel(loc)}</span>
                : <span style={{ color: 'var(--faint)' }}>ยังไม่ระบุที่อยู่</span>}
            </div>
          ))}
        </div>
        {isParty && !myLoc?.province && !md.buyerSlip && !md.sellerSlip && (
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
        {bothLocs && !md.deposit && !md.pendingDeposit && canNegotiate && (
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
        {md.pendingDeposit && (
          md.pendingBy === myRole ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, background: '#fef5e3', border: '1px solid #fbe6bf', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 12, fontSize: 13.5, color: '#9a6209' }}>
              ⏳ คุณเสนอ{md.pendingMeetLabel ? <>จุดนัด <b>{md.pendingMeetLabel}</b> + </> : 'เปลี่ยน'}เงินประกัน <b>฿{Number(md.pendingDeposit).toLocaleString()}/ฝ่าย</b> — รออีกฝ่ายตอบรับ
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} disabled={acting} onClick={() => doAction('meetup_respond', { accept: false })}>ยกเลิกข้อเสนอ</button>
            </div>
          ) : isParty ? (
            <div style={{ background: '#fef5e3', border: '1.5px solid var(--amber-400)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 12 }}>
              <p style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                💰 {md.pendingBy === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}เสนอ{md.pendingMeetLabel ? `จุดนัด "${md.pendingMeetLabel}" + ` : 'เปลี่ยน'}เงินประกัน ฿{Number(md.pendingDeposit).toLocaleString()}/ฝ่าย
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
                <span style={{ color: 'var(--muted)' }}>ไป-กลับ {((r.km || 0) * 2).toLocaleString()} กม.</span>
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
                {depositStage && myRole === r.side && !r.slip && !md.pendingDeposit && !!md.deposit && (
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
                        เปิดดูแผนที่
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
        {depositStage && payOpen && isParty && !md.pendingDeposit && !!md.deposit && (() => {
          const myFee = myRole === 'buyer' ? (md.buyerFee || 0) : (md.sellerFee || 0);
          const mySlip = myRole === 'buyer' ? md.buyerSlip : md.sellerSlip;
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
          <p style={{ fontSize: 12.5, color: 'var(--green-600)', marginTop: 12 }}>✅ เงินประกันครบทั้งสองฝ่าย — นัดเจอกันที่ {md.meetProvince} เมื่อเจอกันแล้วให้กดยืนยันทั้งคู่</p>
        )}
        {s === 'completed' && (
          <p style={{ fontSize: 12.5, color: 'var(--green-600)', marginTop: 12 }}>🎉 นัดเจอสำเร็จ — บริษัท คนกลาง จำกัด จะโอนเงินประกันคืนทั้งสองฝ่ายเต็มจำนวน (เก็บเฉพาะค่าธรรมเนียม)</p>
        )}
      </div>
    );
  }

  // ─── Price + fee-payer agreement ─────────────────────────────────────────
  function renderPricePanel() {
    if (deal!.dealType === 'meetup') return null;
    // แสดงเฉพาะช่วงก่อนชำระเงิน
    if (!['posted', 'waiting_seller', 'waiting_buyer', 'buyer_joined', 'terms_pending', 'payment_pending'].includes(deal!.status)) return null;
    if (myRole === 'guest' || myRole === '') return null;
    const pd = readDealPriceState({ priceData: deal!.priceData, meetupData: deal!.meetupData });
    const hasMm = !!deal!.middlemanId;
    const fpName = (fp?: string) => fp === 'seller' ? 'ผู้ขายจ่าย' : fp === 'split' ? 'หารครึ่ง' : 'ผู้ซื้อจ่าย';
    const meAgreed = (myRole === 'seller' && pd.sellerAgreed) || (myRole === 'buyer' && pd.buyerAgreed) || (myRole === 'middleman' && pd.middlemanAgreed);
    const canProposeNewPrice = myRole === 'buyer' || myRole === 'seller';
    const isRepriceFlow = pd.proposalKind === 'reprice' && !!pd.proposedPrice;
    const currentFeePayer = pd.proposedFeePayer || pd.feePayer || deal!.feePayer || 'buyer';
    const selectedFeePayer = feePayerInput || currentFeePayer;
    const proposerLabel = pd.proposedBy === 'buyer' ? 'ผู้ซื้อ' : pd.proposedBy === 'seller' ? 'ผู้ขาย' : pd.proposedBy === 'middleman' ? 'คนกลาง' : 'มีผู้เสนอ';
    return (
      <div className="dr-card">
        <div className="dr-card-title">💬 ตกลงราคา & ค่าบริการ</div>
        {pd.agreed ? (
          <div style={{ fontSize: 14, color: 'var(--green-700)', background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 'var(--r-md)', padding: '10px 14px' }}>
            ✅ ตกลงราคาแล้ว <b>฿{Number(pd.proposedPrice || deal!.price).toLocaleString()}</b> · ค่าบริการ: {fpName(pd.feePayer || selectedFeePayer)}
            {hasMm && pd.mmDepositHeld ? ` · คนกลางวางเครดิตประกัน ฿${Number(pd.mmDepositHeld).toLocaleString()}` : ''}
          </div>
        ) : isRepriceFlow ? (
          <div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>{proposerLabel}เสนอราคาใหม่: <b>฿{Number(pd.proposedPrice).toLocaleString()}</b> · ค่าบริการ: {fpName(pd.proposedFeePayer)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              {[['ผู้ขาย', pd.sellerAgreed], ['ผู้ซื้อ', pd.buyerAgreed], ...(hasMm ? [['คนกลาง', pd.middlemanAgreed] as [string, boolean]] : [])].map(([l, ok]) => (
                <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--muted)' }}>{l}</span><span style={{ color: ok ? 'var(--green-600)' : 'var(--faint)' }}>{ok ? '✅ ตกลงแล้ว' : '⏳ รอ'}</span></div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {(['buyer', 'seller', 'split'] as const).map(fp => (
                <button key={fp} type="button" onClick={() => setFeePayerInput(fp)} className={`btn btn-sm ${selectedFeePayer === fp ? 'btn-primary' : 'btn-ghost'}`}>{fpName(fp)}</button>
              ))}
            </div>
            {!meAgreed && (
              <button className="btn btn-green btn-block" disabled={acting} onClick={() => doAction('price_agree')}>
                {myRole === 'middleman' ? '✅ อนุมัติดีล + วางเครดิตประกัน' : '✅ ตกลงราคานี้'}
              </button>
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
              {[['ผู้ขาย', pd.sellerAgreed], ['ผู้ซื้อ', pd.buyerAgreed], ...(hasMm ? [['คนกลาง', pd.middlemanAgreed] as [string, boolean]] : [])].map(([l, ok]) => (
                <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--muted)' }}>{l}</span><span style={{ color: ok ? 'var(--green-600)' : 'var(--faint)' }}>{ok ? '✅ รับรู้/ยืนยันแล้ว' : '⏳ รอ'}</span></div>
              ))}
            </div>
            {!meAgreed ? (
              <button className="btn btn-green btn-block" disabled={acting} onClick={() => doAction('price_agree', { feePayer: selectedFeePayer })}>
                {myRole === 'middleman' ? '✅ รับรู้ราคาเดิมและอนุมัติดีล' : '✅ ใช้ราคาเดิมนี้'}
              </button>
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
    if (deal!.dealType === 'meetup') return null;
    if (!['buyer_joined', 'terms_pending', 'payment_pending'].includes(deal!.status)) return null;
    if (myRole === 'guest' || myRole === '') return null;
    const pd = readDealPriceState({ priceData: deal!.priceData, meetupData: deal!.meetupData });
    if (!pd.agreed) return null; // ต้องตกลงราคาก่อน
    const hasMm = !!deal!.middlemanId;
    const allDone = !!(pd.evidenceDoneBuyer && pd.evidenceDoneSeller && (!hasMm || pd.evidenceDoneMiddleman));
    if (allDone) return null;
    const meDone = (myRole === 'seller' && pd.evidenceDoneSeller) || (myRole === 'buyer' && pd.evidenceDoneBuyer) || (myRole === 'middleman' && pd.evidenceDoneMiddleman);
    return (
      <div className="dr-card">
        <div className="dr-card-title">📁 เก็บหลักฐานก่อนโอนเงิน</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>คุยรายละเอียด ดูสินค้า เก็บหลักฐานในแชต/วิดีโอคอลให้เรียบร้อย แล้วกดยืนยัน — ทุกฝ่ายต้องยืนยันก่อนเข้าขั้นโอนเงิน</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          {[['ผู้ขาย', pd.evidenceDoneSeller], ['ผู้ซื้อ', pd.evidenceDoneBuyer], ...(hasMm ? [['คนกลาง', pd.evidenceDoneMiddleman] as [string, boolean]] : [])].map(([l, ok]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--muted)' }}>{l}</span><span style={{ color: ok ? 'var(--green-600)' : 'var(--faint)' }}>{ok ? '✅ เก็บหลักฐานแล้ว' : '⏳ รอ'}</span></div>
          ))}
        </div>
        {!meDone
          ? <button className="btn btn-primary btn-block" disabled={acting} onClick={() => doAction('evidence_done')}>✅ เก็บหลักฐานเสร็จสิ้น</button>
          : <p style={{ fontSize: 13, color: 'var(--green-600)', textAlign: 'center' }}>✅ คุณยืนยันแล้ว — รอฝ่ายอื่น</p>}
      </div>
    );
  }

  // ─── Payment section ─────────────────────────────────────────────────────
  function renderPaymentSection() {
    if (deal!.dealType === 'meetup') return null;
    if (!['payment_pending', 'payment_uploaded'].includes(deal!.status)) return null;
    return (
      <div className="dr-card dr-pay-card">
        <div className="dr-card-title">💳 ชำระเงินค่าสินค้า</div>
        <div className="dr-pay-amount">฿{deal!.price.toLocaleString()}</div>
        {(() => {
          const pd = readDealPriceState({ priceData: deal!.priceData, meetupData: deal!.meetupData });
          const fb = computeDealFees(feeConfig, deal!.price, deal!.dealType);
          const fp = String(deal!.feePayer || pd.feePayer || 'buyer');
          const sellerShare = fp === 'seller' ? fb.total : fp === 'split' ? (fb.total - Math.round(fb.total / 2)) : 0;
          const buyerShare = fb.total - sellerShare;
          const buyerTotal = deal!.price + buyerShare;
          const priceAgreed = !!pd.agreed;
          const hasMm = !!deal!.middlemanId;
          const evidenceDone = !!(pd.evidenceDoneBuyer && pd.evidenceDoneSeller && (!hasMm || pd.evidenceDoneMiddleman));
          const fpName = fp === 'seller' ? 'ผู้ขายจ่าย' : fp === 'split' ? 'หารครึ่ง' : 'ผู้ซื้อจ่าย';
          return (
            <>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '10px 14px', margin: '4px 0 12px', fontSize: 13 }}>
                <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>📋 สรุปยอด · ค่าบริการ: {fpName}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', padding: '2px 0' }}><span>ราคาสินค้า</span><span>฿{deal!.price.toLocaleString()}</span></div>
                {fb.lines.map(l => (<div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', padding: '2px 0' }}><span>{l.label}</span><span>฿{l.amount.toLocaleString()}</span></div>))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--ink)', borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}><span>ผู้ซื้อต้องโอน</span><span>฿{buyerTotal.toLocaleString()}</span></div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>= ราคาสินค้า ฿{deal!.price.toLocaleString()} + ค่าบริการส่วนผู้ซื้อ ฿{buyerShare.toLocaleString()}</div>
                {sellerShare > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8a5a00', marginTop: 4 }}><span>ผู้ขายโอนค่าบริการ (แยกทันที)</span><span>฿{sellerShare.toLocaleString()}</span></div>}
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
                pd.sellerFeeSlip
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
          onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const purl = beginUploadPreview(f); try { const j = await getJwt(); const prepared = await compressImage(f); const form = new FormData(); form.append('file', prepared); const r = await fetch('/api/upload-deal', { method: 'POST', headers: { 'x-session-jwt': j }, body: form }); const d = await r.json(); if (r.ok) await doAction('upload_payment', { fileId: d.fileId }); else alert(d.error || 'อัปโหลดสลิปไม่สำเร็จ'); } finally { endUploadPreview(purl); } e.target.value = ''; }} />
        <input ref={sellerFeeInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
          onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const purl = beginUploadPreview(f); try { const j = await getJwt(); const prepared = await compressImage(f); const form = new FormData(); form.append('file', prepared); const r = await fetch('/api/upload-deal', { method: 'POST', headers: { 'x-session-jwt': j }, body: form }); const d = await r.json(); if (r.ok) await doAction('seller_fee_paid', { fileId: d.fileId }); else alert(d.error || 'อัปโหลดสลิปไม่สำเร็จ'); } finally { endUploadPreview(purl); } e.target.value = ''; }} />
      </div>
    );
  }

  // ─── Action panel ────────────────────────────────────────────────────────
  function renderActionPanel() {
    if (acting) return <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '12px 0', fontSize: 13 }}>กำลังดำเนินการ...</div>;
    const s = deal!.status;
    const btns: { label: string; cls: string; fn: () => void }[] = [];
    if (['buyer_joined', 'terms_pending'].includes(s)) {
      const accepted = (myRole === 'seller' && deal!.sellerAcceptedTerms) || (myRole === 'middleman' && deal!.middlemanAcceptedTerms) || (myRole === 'buyer' && deal!.buyerAcceptedTerms);
      if (!accepted) btns.push({ label: '✅ ยอมรับเงื่อนไขข้อตกลง', cls: 'btn-primary', fn: () => setShowTerms(true) });
      else return <p style={{ color: 'var(--green-600)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>✅ คุณยอมรับเงื่อนไขแล้ว — รอฝ่ายอื่น</p>;
    }
    if (s === 'payment_uploaded' && myRole === 'middleman') btns.push({ label: '✅ ยืนยันรับเงิน — เริ่มขั้นตอนแพ็คของ', cls: 'btn-green', fn: () => doAction('confirm_payment') });
    if (s === 'packing' && myRole === 'seller') btns.push({ label: isSimple ? '📦 แพ็คเสร็จ — จัดส่งให้ผู้ซื้อโดยตรง' : '📦 แพ็คของเสร็จ — จัดส่งให้คนกลาง', cls: 'btn-primary', fn: () => { if (trackingInput) doAction('seller_done_packing', { trackingNumber: trackingInput }); else alert('กรอกเลขพัสดุ'); } });
    if (s === 'shipped_to_middleman' && myRole === 'middleman') btns.push({ label: '📬 รับสินค้าแล้ว', cls: 'btn-primary', fn: () => doAction('middleman_received') });
    if (s === 'middleman_checking' && myRole === 'buyer' && !deal!.buyerConfirmedCheck) btns.push({ label: '✅ ยืนยันสินค้าไม่มีปัญหา', cls: 'btn-green', fn: () => doAction('buyer_confirm_check') });
    if (s === 'middleman_checking' && myRole === 'middleman' && deal!.buyerConfirmedCheck) btns.push({ label: '🚚 จัดส่งให้ผู้ซื้อแล้ว', cls: 'btn-primary', fn: () => { if (trackingInput) doAction('middleman_ship_to_buyer', { trackingNumber: trackingInput }); else alert('กรอกเลขพัสดุ'); } });
    if (s === 'shipped_to_buyer' && myRole === 'buyer') btns.push({ label: '🎉 ได้รับสินค้าแล้ว — ดีลเสร็จสมบูรณ์', cls: 'btn-green', fn: () => doAction('buyer_received') });
    if (myRole === 'buyer' && s === 'buyer_joined' && !deal!.middlemanId && !isMeetup && !isSimple) btns.push({ label: showSelectMM ? 'ซ่อนการเลือกคนกลาง' : '🔎 เลือกคนกลาง', cls: 'btn-ghost', fn: () => setShowSelectMM(v => !v) });
    if (myRole === 'buyer' && !isSimple && deal!.middlemanId && ['terms_pending', 'payment_pending'].includes(s)) btns.push({ label: showSelectMM ? 'ซ่อนรายการคนกลาง' : '🔄 เลือกคนกลางใหม่', cls: 'btn-ghost', fn: () => setShowSelectMM(v => !v) });
    if (!isFinished && myRole !== 'guest') btns.push({ label: '❌ ยกเลิก', cls: 'btn-danger', fn: () => { const r = prompt('เหตุผล'); doAction('cancel', { reason: r || '' }); } });

    if (btns.length === 0) return <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>ไม่มีการกระทำในขั้นตอนนี้</p>;
    return (
      <div className="dr-actions">
        {(['packing', 'middleman_checking'].includes(s) && (myRole === 'seller' || (myRole === 'middleman' && deal!.buyerConfirmedCheck))) && (
          <input type="text" className="dr-select" value={trackingInput} onChange={e => setTrackingInput(e.target.value)} placeholder="เลขพัสดุ / Tracking number" />
        )}
        {btns.map(b => <button key={b.label} onClick={b.fn} className={`btn ${b.cls} btn-block`}>{b.label}</button>)}
      </div>
    );
  }

  // ─── Evidence panel ──────────────────────────────────────────────────────
  function renderEvidencePanel() {
    const canUp = (myRole === 'seller' && ['packing', 'shipped_to_middleman'].includes(deal!.status)) || (myRole === 'middleman' && ['middleman_received', 'middleman_checking'].includes(deal!.status));
    // โหมดง่าย: ผู้ซื้อต้องถ่ายวิดีโอก่อนแกะกล่องเมื่อของมาถึง
    const canBuyerUnbox = isSimple && myRole === 'buyer' && deal!.status === 'shipped_to_buyer';
    const typeLabel: Record<string, string> = { packing: '📦 แพ็คของ', testing: '🔧 ทดสอบ', receive: isSimple ? '📬 วิดีโอก่อนแกะกล่อง (ผู้ซื้อ)' : '📬 รับสินค้า (คนกลาง)', check: '🔍 ตรวจสินค้า (คนกลาง)', chat: '💬 หลักฐานจากแชท', chat_text: '💬 ข้อความแชท', call: '📹 วิดีโอคอลที่บันทึก' };
    const items: { type: string; fileId: string; fileName: string; content?: string; uploaderName?: string }[] = (() => { try { return JSON.parse(deal!.evidenceData || '[]'); } catch { return []; } })();
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
            const url = item.fileId ? fileUrl(item.fileId) : '';
            const isVid = item.fileName?.match(/\.(mp4|mov|avi|webm)$/i);
            const isImg = item.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
            return (
              <div key={i} className="dr-card" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{typeLabel[item.type] || item.type}{item.uploaderName ? ` · ${item.uploaderName}` : ''}</div>
                {!item.fileId
                  ? <div style={{ fontSize: 14, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{item.content || '(ไม่มีข้อความ)'}</div>
                  : isVid ? <video src={url} controls style={{ width: '100%', maxHeight: 220, borderRadius: 'var(--r-md)', background: '#000' }} />
                  : isImg ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={item.fileName} style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 'var(--r-md)' }} /></a>
                  : <a href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', fontSize: 14 }}>📎 {item.fileName || 'เปิดไฟล์'}</a>}
                {item.fileId && item.content ? <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{item.content}</div> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────
  return (
    <div className="dr-root">
      <InAppBanner />
      <header className="dr-header">
        <button onClick={() => router.back()} className="dr-back"><Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} /></button>
        <div className="dr-header-info"><div className="dr-htitle">{deal.title}</div><div className="dr-hsub">{statusText(deal)} · ฿{deal.price.toLocaleString()}</div></div>
        <div className="dr-hctas">
          {myId && <NotifyBell />}
          <button className="dr-cta-link" onClick={copyLink}>{copied ? '✅ คัดลอกแล้ว' : '🔗 แชร์'}</button>
          <button className="dr-cta-green" onClick={toggleCall}>📹 Video</button>
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
                  const isMe = m.senderId === myId;
                  return (
                    <div key={m.$id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                      {!isMe && <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{m.senderName}</div>}
                      <div style={{ background: isMe ? 'var(--accent)' : 'var(--surface-2)', color: isMe ? '#fff' : 'var(--ink)', padding: '6px 10px', borderRadius: 10, fontSize: 13, wordBreak: 'break-word' }}>
                        {m.type === 'image' ? <a href={fileUrl(m.fileId)} target="_blank" rel="noreferrer"><img src={fileUrl(m.fileId)} alt={m.fileName} style={{ maxWidth: 160, borderRadius: 8 }} /></a>
                          : m.type === 'file' ? <a href={fileUrl(m.fileId)} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>📎 {m.fileName}</a>
                          : m.content}
                      </div>
                      {(m.content || m.fileId) && (
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
          <div className="dr-progress-wrap">
            <div className="dr-prog-meta"><span className="dr-prog-status">{statusText(deal)}</span><span className="dr-prog-pct">{pct}%</span></div>
            <div className="dr-prog-track"><div className="dr-prog-fill" style={{ width: `${pct}%`, background: deal.status === 'completed' ? 'var(--green-500)' : 'var(--accent)' }} /></div>
          </div>

          {/* แถบ "ถึงตาคุณ" — เด้งไปแท็บขั้นตอนเมื่อมีงานรอผู้ใช้คนนี้ทำ (กันหลงว่าไม่มีปุ่มให้ไปต่อ) */}
          {(() => {
            const s = deal.status;
            let label: string | null = null;
            if (['buyer_joined', 'terms_pending'].includes(s)) {
              const accepted = (myRole === 'seller' && deal.sellerAcceptedTerms) || (myRole === 'middleman' && deal.middlemanAcceptedTerms) || (myRole === 'buyer' && deal.buyerAcceptedTerms);
              if (!accepted) label = 'ยอมรับเงื่อนไขข้อตกลง';
            } else if (s === 'payment_pending' && myRole === 'buyer') label = 'ชำระเงิน — โอน + อัปโหลดสลิป';
            else if (s === 'payment_uploaded' && myRole === 'middleman') label = 'ยืนยันรับเงิน';
            else if (s === 'packing' && myRole === 'seller') label = 'แพ็ค + จัดส่งสินค้า';
            else if (s === 'shipped_to_middleman' && myRole === 'middleman') label = 'รับสินค้า';
            else if (s === 'middleman_checking' && myRole === 'buyer' && !deal.buyerConfirmedCheck) label = 'ยืนยันสินค้าไม่มีปัญหา';
            else if (s === 'middleman_checking' && myRole === 'middleman' && deal.buyerConfirmedCheck) label = 'จัดส่งให้ผู้ซื้อ';
            else if (s === 'shipped_to_buyer' && myRole === 'buyer') label = 'ยืนยันรับสินค้า';
            if (!label || tab === 'steps') return null;
            return (
              <button onClick={() => setTab('steps')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', padding: '11px 14px', margin: '4px 0 8px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                <span>👉 ถึงตาคุณ: {label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, opacity: .95 }}>ไปที่ขั้นตอน →</span>
              </button>
            );
          })()}

          <nav className="dr-tabs">
            {(['steps', 'chat', 'evidence'] as const).map(k => (
              <button key={k} className={`dr-tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
                {k === 'steps' ? 'ขั้นตอน' : k === 'chat' ? `แชท (${msgs.filter(m => m.role !== 'system').length})` : 'หลักฐาน'}
              </button>
            ))}
          </nav>

          <main className="dr-body">
            {tab === 'steps' && (
              <div className="dr-inner">
                <div className="dr-card">
                  <div className="dr-card-title">ผู้เกี่ยวข้อง</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {[
                      ['ผู้ขาย', deal.sellerName || '(รอผู้ขาย)'],
                      ['ผู้ซื้อ', deal.buyerName || '(รอผู้ซื้อ)'],
                      ['คนกลาง', isMeetup ? 'ไม่ต้องใช้ (รับประกันเดินทาง)' : isSimple ? 'ไม่ต้องใช้ (ศูนย์กลางดูแลเอง)' : (deal.middlemanName || '(ยังไม่ได้เลือก)')],
                      ['ศูนย์กลาง', 'บริษัท คนกลาง จำกัด'],
                    ].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--line-2)', fontSize: 14 }}><span style={{ color: 'var(--muted)' }}>{l}</span><span style={{ fontWeight: 600, color: 'var(--ink)' }}>{v}</span></div>
                    ))}
                  </div>
                  {!isMeetup && !isSimple && myRole === 'buyer' && ['buyer_joined', 'terms_pending', 'payment_pending'].includes(deal.status) && (
                    <div style={{ marginTop: 14 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowSelectMM(v => !v)}>
                        {showSelectMM ? 'ซ่อนแผงเลือกคนกลาง' : deal.middlemanId ? 'เปลี่ยนคนกลาง' : 'เลือกคนกลาง'}
                      </button>
                    </div>
                  )}
                </div>

                {!isMeetup && !isSimple && myRole === 'buyer' && ['buyer_joined', 'terms_pending', 'payment_pending'].includes(deal.status) && showSelectMM && renderMiddlemanPickerPanel()}

                {(deal.sellerAcceptedTerms || deal.buyerAcceptedTerms || deal.middlemanAcceptedTerms) && (
                  <div className="dr-card">
                    <div className="dr-card-title">ยอมรับเงื่อนไข</div>
                    {[['ผู้ขาย', deal.sellerAcceptedTerms], ...(deal.middlemanId ? [['คนกลาง', deal.middlemanAcceptedTerms] as [string, boolean]] : []), ['ผู้ซื้อ', deal.buyerAcceptedTerms]].map(([l, ok]) => (
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

                {deal.paymentSlipFileId && (
                  <div className="dr-card">
                    <div className="dr-card-title">หลักฐานการโอนเงิน</div>
                    <a href={fileUrl(deal.paymentSlipFileId)} target="_blank" rel="noreferrer"><img src={fileUrl(deal.paymentSlipFileId)} alt="slip" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 'var(--r-md)' }} /></a>
                  </div>
                )}
                {deal.trackingToMiddleman && <div className="dr-card"><div className="dr-card-title">📦 เลขพัสดุ ผู้ขาย → คนกลาง</div><div className="dr-track-code">{deal.trackingToMiddleman}</div></div>}
                {deal.trackingToBuyer && <div className="dr-card"><div className="dr-card-title">📦 เลขพัสดุ {isSimple ? 'ผู้ขาย' : 'คนกลาง'} → ผู้ซื้อ</div><div className="dr-track-code">{deal.trackingToBuyer}</div></div>}

                {deal.status === 'completed' && (
                  <>
                    <div className="dr-card dr-done-card"><div className="dr-done-emoji">🎉</div><div className="dr-done-title">ดีลเสร็จสมบูรณ์!</div><div className="dr-done-sub">{isMeetup ? 'บริษัท คนกลาง จำกัด จะโอนเงินประกันคืนทั้งสองฝ่าย' : isSimple ? 'ศูนย์กลางจะโอนเงินให้ผู้ขายเรียบร้อยแล้ว (ดำเนินการโดยทีมงาน)' : 'เงินถูกโอนให้ผู้ขายเรียบร้อยแล้ว'}</div></div>
                    <ReviewPanel deal={deal} myRole={myRole as 'buyer' | 'seller' | 'middleman'} jwt={jwt} />
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
                    if (m.role === 'system') return <div key={m.$id} className="dr-sys-msg"><span>{m.content}</span></div>;
                    const isMe = m.senderId === myId;
                    return (
                      <div key={m.$id} className={`dr-bubble-row${isMe ? ' mine' : ''}`}>
                        {!isMe && <div className="dr-bubble-av" style={{ background: '#6841d9' }}>{(m.senderName || '?').slice(0, 1)}</div>}
                        <div className="dr-bubble-col">
                          {!isMe && <span className="dr-bubble-sender">{m.senderName}</span>}
                          <div className={`dr-bubble${isMe ? ' dr-bubble-mine' : ''}`}>
                            {m.type === 'image' ? <a href={fileUrl(m.fileId)} target="_blank" rel="noreferrer"><img src={fileUrl(m.fileId)} alt={m.fileName} style={{ maxWidth: 200, borderRadius: 10 }} /></a>
                              : m.type === 'file' ? <a href={fileUrl(m.fileId)} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', fontSize: 14 }}>📎 {m.fileName}</a>
                                : m.content}
                          </div>
                          <span className="dr-bubble-t">
                            {new Date(m.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            {(m.content || m.fileId) && (
                              <button type="button" onClick={() => saveMsgEvidence(m)} disabled={acting}
                                style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                title="เก็บข้อความ/ไฟล์นี้เป็นหลักฐาน">📌 เก็บเป็นหลักฐาน</button>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatBottomRef} />
                </div>
                <div className="dr-chat-bar">
                  <button className="dr-attach" onClick={() => fileInputRef.current?.click()} disabled={sending}>🖼️</button>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (f.size > 10 * 1024 * 1024) { alert('ไฟล์ใหญ่เกิน 10MB'); return; } await uploadFile(f); }} />
                  <input className="dr-chat-input" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="พิมพ์ข้อความ..." onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (chatInput.trim()) sendMsg(chatInput); } }} />
                  <button className="dr-chat-send" onClick={() => { if (chatInput.trim()) sendMsg(chatInput); }} disabled={!chatInput.trim() || sending}><Icon name="arrowRight" size={16} /></button>
                </div>
              </div>
            )}

            {tab === 'evidence' && renderEvidencePanel()}
          </main>
        </>
      )}
      {showTerms && (() => { const t = termsFor(deal.dealType); return (
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
            {(() => { const fb = computeDealFees(feeConfig, deal.price, deal.dealType); return (
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
