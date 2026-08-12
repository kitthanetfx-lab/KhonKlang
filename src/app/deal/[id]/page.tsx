'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useRef, useCallback, useMemo, type RefObject, type CSSProperties } from 'react';
import { supabase, authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { DealFlowBrand } from '@/components/DealFlowBrand';
import { AppHeaderBar } from '@/components/mobile/AppHeaderBar';
import { AppHeaderActions } from '@/components/mobile/AppHeaderActions';
import { ReviewPanel } from '@/components/ReviewPanel';
import { AsyncButton } from '@/components/AsyncButton';
import { AddressPicker, EMPTY_ADDRESS, ThaiAddress, addressLabel } from '@/components/AddressPicker';
import { PaymentMethods } from '@/components/PaymentMethods';
import { InAppBanner } from '@/components/InAppBanner';
import { withExternalBrowserParam } from '@/lib/inApp';
import { distanceKm, midpointProvince } from '@/lib/provinceGeo';
import { compressImage } from '@/lib/imageCompress';
import { compressVideo, isVideoFile, VIDEO_UPLOAD_HINT } from '@/lib/videoCompress';
import { FeeConfig, FEE_DEFAULTS, computeDealFees, type SimpleDealShareBreakdown } from '@/lib/fees';
import { dealCode } from '@/lib/dealNumber';
import { TH_LOGISTICS_PROVIDERS, buildTrackingUrl, getLogisticsProviderLabel } from '@/lib/logistics';
import { MarketplacePaymentSection } from '@/components/marketplace/MarketplacePaymentSection';
import { isDirectShipOrder, isMarketplaceOrder, isListingCheckoutOrder, isMarketplaceCheckoutActive } from '@/lib/marketplaceOrder';
import { useUser } from '@/lib/useUser';
import DealVideoCall from '@/components/DealVideoCall';
import { DealProductGallery } from '@/components/deal/DealProductGallery';
import { DealPackingEvidenceStrip } from '@/components/deal/DealPackingEvidenceStrip';
import { DealPackingUploadGrid } from '@/components/deal/DealPackingUploadGrid';
import { DealEvidenceThumbs } from '@/components/deal/DealEvidenceThumbs';
import { DealClickableMedia, DealMediaOpenLink, DealMediaThumbGallery, isDealImageFile, isDealVideoFile } from '@/components/deal/DealClickableMedia';
import { SimpleDealPreJoinScreen } from '@/components/deal/SimpleDealPreJoinScreen';
import { DealCommFloatbar, DealCommOrb } from '@/components/deal/DealCommFloatbar';
import { DealOthersReviewsSummary } from '@/components/deal/DealOthersReviewsSummary';
import { SimpleDealShell } from '@/components/deal/SimpleDealShell';
import { DealRoomApp } from '@/components/mobile/DealRoomApp';

/* eslint-disable @typescript-eslint/no-explicit-any */

const REGULAR_DEAL_STEP1_SLIDES = [
  '/Trade/Buyer1.webp',
  '/Trade/Buyer2.webp',
  '/Trade/Buyer3.webp',
  '/Trade/Buyer4.webp',
  '/Trade/Buyer5.webp',
  '/Trade/no1.webp',
  '/Trade/no2.webp',
  '/Trade/no3.webp',
];
const SIMPLE_DEAL_STEP1_SLIDES = [
  '/Eazy/St1.webp',
  '/Eazy/St2.webp',
];

interface Msg { id: string; sender_id: string; sender_name: string; role: string; type: string; content: string; file_id: string; file_name: string; created_at: string; }

// ─── parser สำหรับ system message ของสายเรียก (format: 📞|caller=X|mode=Y|ข้อความ หรือ 📞|end|ข้อความ) ───
interface ParsedCallMsg {
  isCall: boolean;
  kind: 'start' | 'end' | null;
  callerId?: string;
  mode?: 'voice' | 'video';
  text?: string; // ข้อความส่วนที่อ่านได้ (ตัด prefix ออก) สำหรับแสดงในแชท
}
function parseCallMsg(content: string): ParsedCallMsg {
  if (!content || !content.startsWith('📞|')) return { isCall: false, kind: null };
  const parts = content.slice('📞|'.length).split('|');
  // รูปแบบเริ่มสาย: 📞|caller=<id>|mode=<voice|video>|<ข้อความ>
  // รูปแบบวางสาย: 📞|end|<ข้อความ>
  if (parts[0] === 'end') {
    return { isCall: true, kind: 'end', text: parts.slice(1).join('|') };
  }
  let callerId: string | undefined;
  let mode: 'voice' | 'video' | undefined;
  let textStart = 0;
  for (let i = 0; i < Math.min(parts.length, 2); i++) {
    const kv = parts[i].split('=');
    if (kv[0] === 'caller') { callerId = kv[1]; textStart = i + 1; }
    else if (kv[0] === 'mode') { mode = kv[1] === 'voice' ? 'voice' : 'video'; textStart = i + 1; }
    else break; // เจอข้อความแล้ว หยุด parse
  }
  return { isCall: true, kind: 'start', callerId, mode, text: parts.slice(textStart).join('|') };
}

/** แปลง system message สายเรียกให้เป็นข้อความที่อ่านง่ายในแชท (ซ่อน prefix ฝั่ง user) */
function friendlyCallText(content: string): string {
  const parsed = parseCallMsg(content);
  if (!parsed.isCall) return content;
  return parsed.text || (parsed.kind === 'end' ? 'วางสายแล้ว' : 'เริ่มคอล');
}

/** ฟอร์แมตวินาทีเป็น M:SS สำหรับแสดงตัวนับเวลา voice background บนปุ่ม 📞 */
function fmtVoiceDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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

// ─── กล่องแชทลอย (เรียกจากปุ่ม 💬 ในแถบปุ่มลอยด้านล่าง) — ใช้ได้ทั้งตอนคอลและตอนปกติ ───
interface FloatingChatBoxProps {
  msgs: Msg[];
  myId: string;
  chatInput: string;
  setChatInput: (v: string) => void;
  sending: boolean;
  acting: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSend: () => void;
  onUpload: (files: File[]) => Promise<void>;
  onClose: () => void;
  onPin: (m: Msg) => Promise<void>;
  onAutoScroll: () => void;
  title: string;
  closedHint?: string;
}
function FloatingChatBox({ msgs, myId, chatInput, setChatInput, sending, acting, fileInputRef, onSend, onUpload, onClose, onPin, onAutoScroll, title, closedHint }: FloatingChatBoxProps) {
  const list = msgs.filter(m => m.role !== 'system');
  useEffect(() => { onAutoScroll(); }, [msgs, onAutoScroll]);
  return (
    <div style={{ position: 'fixed', right: 16, bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', width: 320, maxWidth: '90vw', height: 'min(55vh, 460px)', background: 'var(--surface)', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,.4)', display: 'flex', flexDirection: 'column', zIndex: 134, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--accent)', color: '#fff' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{title} ({list.length})</span>
        <button onClick={onClose} title="ปิด" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {list.length === 0 && <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 12 }}>ยังไม่มีข้อความ</p>}
        {list.map(m => {
          const isMe = m.sender_id === myId;
          return (
            <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
              {!isMe && <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{m.sender_name}</div>}
              <div style={{ background: isMe ? 'var(--accent)' : 'var(--surface-2)', color: isMe ? '#fff' : 'var(--ink)', padding: '6px 10px', borderRadius: 10, fontSize: 13, wordBreak: 'break-word' }}>
                {m.type === 'image' ? <DealClickableMedia url={fileUrl(m.file_id)} alt={m.file_name} label={m.file_name} maxHeight={160} style={{ maxWidth: 160 }} />
                  : m.type === 'file' ? <a href={fileUrl(m.file_id)} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>📎 {m.file_name}</a>
                  : m.content}
              </div>
              {(m.content || m.file_id) && (
                <button onClick={() => onPin(m)} disabled={acting} style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}>📌 เก็บเป็นหลักฐาน</button>
              )}
            </div>
          );
        })}
      </div>
      {closedHint && (
        <div style={{ padding: '6px 10px', background: '#fff8ef', borderTop: '1px solid #ffe0b2', fontSize: 11, color: '#8a5a00', textAlign: 'center' }}>{closedHint}</div>
      )}
      <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid var(--line)' }}>
        <button className="dr-attach" onClick={() => fileInputRef.current?.click()} disabled={sending} title="ส่งรูป/ไฟล์">🖼️</button>
        <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf" multiple style={{ display: 'none' }} onChange={async e => { const files = Array.from(e.target.files || []); e.target.value = ''; await onUpload(files); }} />
        <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="พิมพ์ข้อความ..." onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 13, minWidth: 0 }} />
        <button onClick={onSend} disabled={!chatInput.trim() || sending} className="btn btn-primary btn-sm">ส่ง</button>
      </div>
    </div>
  );
}

interface Deal {
  id: string; seller_id: string; seller_name: string; middleman_id: string; middleman_name: string;
  buyer_id: string; buyer_name: string; creator_id?: string; created_at?: string;
  title: string; description: string; price: number; category: string;
  status: string; reject_reason: string;
  images?: string[];
  warranty_years?: number;
  warranty_months?: number;
  warranty_days?: number;
  seller_accepted_terms: boolean; middleman_accepted_terms: boolean; buyer_accepted_terms: boolean;
  middleman_confirmed_payment: boolean; buyer_confirmed_check: boolean;
  payment_slip_file_id: string; tracking_to_middleman: string; tracking_to_middleman_provider?: string; tracking_to_buyer: string; tracking_to_buyer_provider?: string;
  deal_type?: string; fee_payer?: string;
  source?: string; shipping_cost?: number; buyer_shipping_provider?: string;
  list_gross_price?: number | null;
}

interface BankInfo { bankName: string; bankAcct: string; bankOwner: string; }
interface BuyerShipping { name: string; phone: string; address: string; }
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
  chat_done_seller?: boolean; chat_done_buyer?: boolean; chat_done_middleman?: boolean;
  chat_back_req_seller?: boolean; chat_back_req_buyer?: boolean; chat_back_req_middleman?: boolean;
  seller_fee_slip?: string;
  payout_slip_file_id?: string; refund_slip_file_id?: string;
  // ค่าบริการที่คนกลางเสนอเอง
  proposed_mm_fee?: number; proposed_inspection_fee?: number;
  mm_fee_accepted_seller?: boolean; mm_fee_accepted_buyer?: boolean;
  // ขั้นตอนที่ 1: เลือกผู้จ่ายค่าบริการ
  fee_payer_selection_buyer?: 'buyer' | 'seller' | 'split';
  fee_payer_selection_seller?: 'buyer' | 'seller' | 'split';
}
interface EvidenceItem { id: string; deal_id: string; type: string; file_id: string; file_name: string; content?: string; uploaded_by?: string; uploader_name?: string; created_at: string; }
interface Middleman { userId: string; code: string; name: string; tier: string; workProvince: string; phone: string; categories?: string; reviewScore: number; reviewCount: number; }

function fileUrl(id: string) { return fileViewUrl(DEAL_BUCKET, id); }

const STEP_LABEL: Record<string, string> = {
  posted: 'รอผู้ซื้อ', waiting_seller: 'รอผู้ขาย', waiting_buyer: 'รอผู้ซื้อ', buyer_joined: 'รอเลือกคนกลาง',
  terms_pending: 'รอยอมรับเงื่อนไข', payment_pending: 'คุย/หลักฐาน/ตกลงราคา', payment_uploaded: 'รอคนกลางยืนยัน',
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
  { key: 'terms_pending', label: 'รอยอมรับเงื่อนไข' }, { key: 'payment_pending', label: 'คุย 3 ฝ่าย/ตรวจหลักฐาน/ตกลงราคา' },
  { key: 'payment_uploaded', label: 'รอยืนยันเงิน' }, { key: 'packing', label: 'ผู้ขายแพ็คของ' },
  { key: 'shipped_to_middleman', label: 'รอคนกลางรับ' }, { key: 'middleman_received', label: 'คนกลางรับแล้ว' },
  { key: 'middleman_checking', label: 'คนกลางตรวจสอบ' }, { key: 'shipped_to_buyer', label: 'จัดส่งให้ผู้ซื้อ' },
  { key: 'delivered', label: 'รอยืนยันรับ' }, { key: 'completed', label: 'เสร็จสมบูรณ์' },
];
// โหมดง่าย: ไม่มีคนกลางบุคคล ผู้ขายส่งตรงถึงผู้ซื้อ
const SIMPLE_TIMELINE = [
  { key: 'terms_pending', label: 'รอยอมรับเงื่อนไข' }, { key: 'payment_pending', label: 'ตกลงราคา/คุย/ตรวจหลักฐาน' },
  { key: 'payment_uploaded', label: 'รอศูนย์กลางยืนยันรับเงิน' }, { key: 'packing', label: 'ผู้ขายแพ็ค+ถ่ายวิดีโอ' },
  { key: 'shipped_to_buyer', label: 'ส่งตรงถึงผู้ซื้อ' }, { key: 'completed', label: 'ผู้ซื้อรับของ → ศูนย์กลางโอนเงิน' },
];
// ป้ายสถานะที่ต่างจากปกติเมื่อเป็นโหมดง่าย
const SIMPLE_STATUS_LABEL: Record<string, string> = {
  buyer_joined: 'รอยอมรับเงื่อนไข', payment_uploaded: 'รอศูนย์กลางยืนยัน', packing: 'ผู้ขายแพ็ค+ส่งตรง', shipped_to_buyer: 'จัดส่งถึงผู้ซื้อ',
};
function statusText(d: { status: string; deal_type?: string; source?: string; buyer_id?: string | null }) {
  if (isMarketplaceOrder(d) && d.status === 'posted' && d.buyer_id) return 'รอโอนเงิน';
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
  const [buyerShipping, setBuyerShipping] = useState<BuyerShipping | null>(null);
  const [sellerBank, setSellerBank] = useState<BankInfo | null>(null);
  const [middlemanBank, setMiddlemanBank] = useState<BankInfo | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [msgsLoaded, setMsgsLoaded] = useState(false); // กัน flash step 2 ก่อน msgs โหลดถึง
  const [middlemen, setMiddlemen] = useState<Middleman[]>([]);
  const [myId, setMyId] = useState('');
  const [myName, setMyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [trackingInput, setTrackingInput] = useState('');
  const [trackingProviderInput, setTrackingProviderInput] = useState('');
  const [showTrackingRequired, setShowTrackingRequired] = useState(false);
  const trackingInputRef = useRef<HTMLInputElement>(null);
  const trackingProviderRef = useRef<HTMLSelectElement>(null);
  // ─── State machine การโทร (ครอบคลุมทุกสถานะ: idle/outgoing/incoming/connecting/active/ended) ───
  // เปลี่ยนจาก state กระจัดกระจาย → state เดียวเพื่อ flow ที่ถูกต้อง (ต้องรอรับสายก่อนถึงจะ active)
  type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  // mode ของคอลปัจจุบัน ('voice' | 'video') — ใช้ตอน mount DealVideoCall
  const [callMode, setCallMode] = useState<'voice' | 'video'>('video');
  // message id ของสายปัจจุบัน (เพื่อ track ว่าอยู่ในคอล msg ไหน + detect end) — state เพื่อ trigger render
  const [activeCallMsgId, setActiveCallMsgId] = useState<string | null>(null);
  // วินาทีที่คุยไป (เริ่มนับหลัง active เท่านั้น) — สำหรับแสดงตัวนับเวลา
  const [callSeconds, setCallSeconds] = useState(0);
  // แจ้งเตือนเมื่อคอลหมดเวลา 10 นาที (กดโทรใหม่เพื่อคุยต่อ)
  const [callTimedOut, setCallTimedOut] = useState(false);
  // แจ้งเตือนเมื่อสายไม่รับ / อีกฝ่ายวางสาย
  const [callEndedReason, setCallEndedReason] = useState<{ title: string; sub: string } | null>(null);
  // กล่องแชทลอยที่เรียกจากปุ่มลอย (แสดงทั้งตอนคอลและไม่คอล)
  const [floatChatOpen, setFloatChatOpen] = useState(false);
  // สายเรียกเข้า — derived value คำนวณจาก msgs ไม่ใช้ setState ใน effect (กัน cascading render)
  // (incomingCall ถูกประกาศเป็น useMemo ด้านล่าง — ต้องมี dismissedCallIds เพื่อ track ว่าเราเคยปฏิเสธ/รับ msg id นี้แล้ว)
  const [dismissedCallIds, setDismissedCallIds] = useState<Set<string>>(new Set());
  // AudioContext สำหรับเล่นเสียงสายเรียกเข้า/ดองดึ๊ด (ปลดล็อกตอน user แตะครั้งแรก)
  const audioCtxRef = useRef<AudioContext | null>(null);
  // ─── เก็บค่า derived จาก callStatus เพื่อใช้ทั่วโค้ด (backward compat) ───
  const isActiveCall = callStatus === 'active';
  const isInCall = callStatus === 'outgoing' || callStatus === 'connecting' || callStatus === 'active';
  const showCall = isActiveCall && callMode === 'video'; // เปิดเต็มจอเฉพาะ video ตอน active
  const voiceBgActive = isActiveCall && callMode === 'voice'; // background เฉพาะ voice ตอน active
  const voiceBgSeconds = callSeconds; // alias สำหรับโค้ดเดิม
  // track message id ของสายที่กำลังคุย — ref สำหรับใช้ใน polling/memo (คู่กับ state)
  const activeCallMsgIdRef = useRef<string | null>(null);
  // ข้อ3: ระหว่างวิดีโอคอล ซ่อนปุ่มลอย "กลับหน้าหลัก" + "บริการลูกค้า" (ผ่าน body.in-call)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('in-call', isInCall);
    return () => { document.body.classList.remove('in-call'); };
  }, [isInCall]);
  const [tab, setTab] = useState<DealTab>(readDealTab(requestedTab));
  const [evidenceType, setEvidenceType] = useState('packing');
  const [copied, setCopied] = useState(false);
  const [authHdrs, setAuthHdrs] = useState<Record<string, string>>({});
  const [completionReviewed, setCompletionReviewed] = useState(false);
  const [completionAllRated, setCompletionAllRated] = useState(false);
  const [completionSubmitTrigger, setCompletionSubmitTrigger] = useState(0);
  const [completionSending, setCompletionSending] = useState(false);
  const [dealError, setDealError] = useState('');
  const [showSelectMM, setShowSelectMM] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<{ url: string; name: string; progress?: number; status?: string } | null>(null);
  const [meetAddr, setMeetAddr] = useState<ThaiAddress>(EMPTY_ADDRESS); // ที่อยู่ของฉัน (ดีลนัดรับ)
  const [payOpen, setPayOpen] = useState(false); // เปิดกล่องช่องทางชำระเงินก่อนอัปสลิป
  const [sharingLoc, setSharingLoc] = useState(false); // กำลังแชร์ตำแหน่งระหว่างเดินทาง
  const shareLocTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const headersRef = useRef<Record<string, string>>({});
  const { user, loading: authLoading } = useUser();

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
  const meetupMeetEvidInputRef = useRef<HTMLInputElement>(null);
  const buyerEvidInputRef = useRef<HTMLInputElement>(null);
  const sellerFeeInputRef = useRef<HTMLInputElement>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [showStep3Warning, setShowStep3Warning] = useState(false);
  // ช่องกรอก "ขอหลักฐานเพิ่ม" — ผู้ซื่อ/คนกลาง ระบุรายละเอียดที่อยากให้ผู้ขายถ่ายเพิ่ม
  const [showRequestEvidence, setShowRequestEvidence] = useState(false);
  const [requestEvidenceDetail, setRequestEvidenceDetail] = useState('');
  const [feeConfig, setFeeConfig] = useState<FeeConfig>(FEE_DEFAULTS);
  const [simpleShare, setSimpleShare] = useState<SimpleDealShareBreakdown & { creatorId?: string | null; creatorName?: string } | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [feePayerInput, setFeePayerInput] = useState<'buyer' | 'seller' | 'split' | ''>('');
  const [showPriceProposal, setShowPriceProposal] = useState(false);
  const callFileInputRef = useRef<HTMLInputElement>(null);
  // ─── เลือกผู้จ่ายค่ากลาง (ขั้น 1) ───
  // myFeePayer = เก็บการเลือกของ "ฉัน" แยกจาก server เพื่อกัน poll เขียนทับ (root cause ของ "เด้ง")
  // feePayerTouched = true เมื่อผู้ใช้เคยเปลี่ยนค่าแล้ว (พอ touched แล้ว จะไม่ให้ server เขียนทับอีก)
  const [myFeePayer, setMyFeePayer] = useState<'buyer' | 'seller' | 'split' | null>(null);
  const feePayerTouched = useRef(false);
  // pendingFeePayer = ตัวเลือกที่ผู้ใช้คลิก รอ popup ยืนยันก่อนส่ง API
  const [pendingFeePayer, setPendingFeePayer] = useState<'buyer' | 'seller' | 'split' | null>(null);
  // wizard แบบง่าย: สถานะ local อย่างเดียว (ไม่บันทึกลง DB) ว่าฉันกด "คุยกันจบแล้ว" ไปดูหน้าหลักฐานหรือยัง
  const [chatReviewReady, setChatReviewReady] = useState(false);
  const chatBundledRef = useRef(false); // กัน bundleChatTranscriptAsEvidence ถูกเรียกซ้ำ
  // wizard แบบง่าย: ขั้นที่กำลังดูอยู่ (ปุ่มย้อนกลับ/ถัดไป) — null แปลว่าให้ตามขั้นจริงปัจจุบันเสมอ
  const [wzViewStep, setWzViewStep] = useState<number | null>(null);
  const [rwzViewRole, setRwzViewRole] = useState<'seller' | 'middleman' | 'buyer'>('seller');
  const step3PendingRef = useRef<number | null>(null);
  const simpleStep2WarnShownRef = useRef(false);
  const simpleActualStepRef = useRef<number | null>(null);
  const regularActualStepRef = useRef<number | null>(null);
  const meetupActualStepRef = useRef<number | null>(null);
  const [meetupEvidReady, setMeetupEvidReady] = useState(false);
  const [savedEvidIds, setSavedEvidIds] = useState<Set<string>>(new Set());
  const [packingUploadStep, setPackingUploadStep] = useState<1 | 2 | 3 | null>(null);
  const [packingCarouselIndex, setPackingCarouselIndex] = useState(0);
  const [isPackingCompactLayout, setIsPackingCompactLayout] = useState(false);
  const [simpleDealIntroSlide, setSimpleDealIntroSlide] = useState(0);
  const [regularDealIntroSlide, setRegularDealIntroSlide] = useState(0);
  const [meetupPropLabel, setMeetupPropLabel] = useState<string | null>(null); // null=hidden ''=custom label
  const [meetupPropAmt, setMeetupPropAmt] = useState('');
  // Pop-Up ตกลงจุดนัด (รวมสถานที่+เงินประกัน+ปรับราคา+ค่าบริการ)
  const [meetupPopOpen, setMeetupPopOpen] = useState(false);
  const [meetupPropPrice, setMeetupPropPrice] = useState('');           // ราคาสินค้าใหม่ ('' = ไม่เปลี่ยน)
  const [meetupPropFeePayer, setMeetupPropFeePayer] = useState<'buyer' | 'seller' | 'split' | ''>(''); // '' = ไม่เปลี่ยน
  // ค่าบริการคนกลาง/ตรวจสินค้า (คนกลางกำหนดเองใน step 2)
  const [mmFeeInput, setMmFeeInput] = useState('');
  const [inspFeeInput, setInspFeeInput] = useState('');
  // รีเซ็ตกลับไปดูขั้นปัจจุบันเมื่อสถานะดีลเปลี่ยน หรือ meetup ตกลงยอดประกันแล้ว (ขยับไปขั้นวางเงินอัตโนมัติ)
  useEffect(() => { setWzViewStep(null); }, [deal?.status, meetup?.deposit]);

  // รีเซ็ต state ที่เก็บไว้เฉพาะฝั่ง client เมื่อเปลี่ยนดีลหรือเปลี่ยนบัญชี
  // เพื่อกันสถานะ "ฉันกดยืนยันแล้ว" จากผู้ใช้ก่อนหน้าติดมาหลอกอีกบัญชี
  useEffect(() => {
    setChatReviewReady(false);
    setMsgsLoaded(false);
    chatBundledRef.current = false;
    setPackingUploadStep(null);
    setPackingCarouselIndex(0);
    setTrackingInput('');
    setTrackingProviderInput('');
    setShowTrackingRequired(false);
    setWzViewStep(null);
    setShowStep3Warning(false);
    step3PendingRef.current = null;
    simpleStep2WarnShownRef.current = false;
    simpleActualStepRef.current = null;
    regularActualStepRef.current = null;
    meetupActualStepRef.current = null;
  }, [dealId, myId]);

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0');
    r.style.setProperty('--accent-strong', '#1f54d6');
    // อย่า override --accent-soft — globals.css ตั้งค่าตาม light/dark แล้ว
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 1024px) and (orientation: portrait)');
    const syncLayout = () => setIsPackingCompactLayout(media.matches);
    syncLayout();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', syncLayout);
      return () => media.removeEventListener('change', syncLayout);
    }
    media.addListener(syncLayout);
    return () => media.removeListener(syncLayout);
  }, []);

  useEffect(() => {
    if (!isPackingCompactLayout) {
      setPackingCarouselIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setPackingCarouselIndex(prev => (prev + 1) % 3);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [isPackingCompactLayout]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSimpleDealIntroSlide(prev => (prev + 1) % SIMPLE_DEAL_STEP1_SLIDES.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRegularDealIntroSlide(prev => (prev + 1) % REGULAR_DEAL_STEP1_SLIDES.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTab(readDealTab(requestedTab));
      // เข้าหน้าดีลด้วย ?call=1 (จาก push notification) → เริ่มวิดีโอคอลเป็น outgoing (รอรับสาย)
      if (requestedCall && isDealParty(deal, myId)) startCall('video');
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal, myId, requestedCall, requestedTab]);

  const fetchDeal = useCallback(async (headers: Record<string, string> = {}) => {
    try {
      const hdrs = headers.Authorization ? headers : await getAuthHeaders();
      const r = await fetch(`/api/deals/${dealId}`, { headers: hdrs, cache: 'no-store' });
      const d = await r.json();
      if (r.ok) {
        const nextDeal = d.deal as Deal;
        setDeal(nextDeal); setDealError('');
        setMeetup(d.meetup || null); setPriceState(d.priceState || null); setEvidence(d.evidence || []);
        setBuyerBank(d.buyerBank || null); setSellerBank(d.sellerBank || null); setMiddlemanBank(d.middlemanBank || null);
        setBuyerShipping(d.buyerShipping || null);
        setSimpleShare(d.simpleShare || null);
        return nextDeal;
      } else setDealError(d.error || `Error ${r.status}`);
    } catch (e: any) { setDealError(e?.message || 'Network error'); }
    return null;
  }, [dealId, getAuthHeaders, setDeal, setDealError]);

  const fetchMsgs = useCallback(async (headers: Record<string, string>, currentDeal: Deal | null = deal, currentUserId = myId) => {
    if (!headers.Authorization || !isDealParty(currentDeal, currentUserId)) return;
    const r = await fetch(`/api/messages?dealId=${dealId}`, { headers, cache: 'no-store' }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setMsgs(d.messages || []); setMsgsLoaded(true); }
    else if (r?.status === 401) {
      // token หมดอายุ — ล้าง cache ให้ poll รอบถัดไปขอ token ใหม่จาก Supabase
      headersRef.current = {};
    }
  }, [deal, dealId, myId, setMsgs]);

  useEffect(() => {
    (async () => {
      await fetchDeal();
      setLoading(false);
    })();
  }, [dealId, fetchDeal]);

  // ผู้ซื้อตลาด/ประมูลชนะ — ไปหน้า checkout แบบ Shopee ไม่ใช่ห้องดีลคนกลาง
  useEffect(() => {
    if (!deal || !myId || loading || authLoading) return;
    if (!isListingCheckoutOrder(deal)) return;
    if (deal.buyer_id !== myId) return;
    router.replace(`/cart/checkout/${deal.id}`);
  }, [deal, myId, loading, authLoading, router]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.$id) {
        if (!active) return;
        setMyId('');
        setMyName('');
        headersRef.current = {};
        setAuthHdrs({});
        return;
      }
      const nextMyId = user.$id;
      const nextMyName = user.prefs.displayName || user.name || '';
      if (!active) return;
      setMyId(nextMyId);
      setMyName(nextMyName);
      const headers = await getAuthHeaders();
      if (!active) return;
      if ((requestedCall) && isDealParty(deal, nextMyId)) {
        await fetchMsgs(headers, deal, nextMyId);
      }
    })();
    return () => { active = false; };
  }, [deal, fetchMsgs, getAuthHeaders, requestedCall, requestedTab, user]);

  useEffect(() => {
    if (deal?.deal_type !== 'simple') {
      simpleActualStepRef.current = null;
      return;
    }
    const nextStep = getSimpleStep().step;
    const prevStep = simpleActualStepRef.current;
    if (prevStep !== null && nextStep > prevStep) {
      setWzViewStep(null);
    }
    simpleActualStepRef.current = nextStep;
  }, [
    deal,
    dealId,
    loading,
    wzViewStep,
    deal?.status,
    deal?.price,
    deal?.fee_payer,
    priceState?.agreed,
    priceState?.seller_fee_slip,
    priceState?.payout_slip_file_id,
    priceState?.refund_slip_file_id,
    feeConfig,
  ]);

  useEffect(() => {
    if (!deal || deal.deal_type === 'simple' || deal.deal_type === 'meetup') {
      regularActualStepRef.current = null;
      return;
    }
    const nextStep = getRegularStep().step;
    const prevStep = regularActualStepRef.current;
    const enteringChat = prevStep !== null && prevStep < 3 && nextStep >= 3;
    if (enteringChat && !showStep3Warning) {
      step3PendingRef.current = 3;
      setWzViewStep(2);
      setShowStep3Warning(true);
    }
    if (prevStep !== null && nextStep > prevStep && !enteringChat) {
      setWzViewStep(null);
    }
    regularActualStepRef.current = nextStep;
  }, [
    deal,
    dealId,
    loading,
    wzViewStep,
    deal?.status,
    deal?.price,
    deal?.fee_payer,
    deal?.seller_accepted_terms,
    deal?.buyer_accepted_terms,
    deal?.middleman_id,
    deal?.middleman_accepted_terms,
    priceState?.agreed,
    priceState?.evidence_done_buyer,
    priceState?.evidence_done_seller,
    priceState?.evidence_done_middleman,
    priceState?.seller_fee_slip,
    priceState?.payout_slip_file_id,
    priceState?.refund_slip_file_id,
    chatReviewReady,
    feeConfig,
    showStep3Warning,
  ]);

  useEffect(() => {
    if (deal?.deal_type !== 'meetup') {
      meetupActualStepRef.current = null;
      return;
    }
    const nextStep = getMeetupStep().step;
    const prevStep = meetupActualStepRef.current;
    const enteringChat = prevStep !== null && prevStep < 2 && nextStep >= 2;
    if (enteringChat && !showStep3Warning) {
      step3PendingRef.current = 2;
      setWzViewStep(1);
      setShowStep3Warning(true);
    }
    if (prevStep !== null && nextStep > prevStep && !enteringChat) {
      setWzViewStep(null);
    }
    meetupActualStepRef.current = nextStep;
  }, [
    deal,
    dealId,
    loading,
    wzViewStep,
    deal?.status,
    deal?.price,
    deal?.fee_payer,
    deal?.seller_accepted_terms,
    deal?.buyer_accepted_terms,
    meetup?.deposit,
    meetup?.refund_outcome,
    priceState?.agreed,
    priceState?.evidence_done_buyer,
    priceState?.evidence_done_seller,
    chatReviewReady,
    feeConfig,
    showStep3Warning,
  ]);

  useEffect(() => {
    if (!dealId) return;
    const simpleStep = deal?.deal_type === 'simple' ? getSimpleStep().step : null;
    const waitSyncFast = deal?.deal_type === 'simple' && (simpleStep === 1 || simpleStep === 2);
    const inTermsStep = deal?.deal_type !== 'simple' && (deal?.status === 'terms_pending' || deal?.status === 'buyer_joined');
    const intervalMs = isFinishedStatus(deal?.status) ? 45000 : (waitSyncFast || inTermsStep) ? 4000 : 15000;
    const timer = window.setInterval(() => { void fetchDeal(headersRef.current); }, intervalMs);
    return () => window.clearInterval(timer);
  }, [
    deal,
    deal?.deal_type,
    deal?.status,
    dealId,
    fetchDeal,
    priceState?.agreed,
    priceState?.evidence_done_buyer,
    priceState?.evidence_done_seller,
    priceState?.evidence_done_middleman,
    priceState?.fee_payer_selection_buyer,
    priceState?.fee_payer_selection_seller,
    chatReviewReady,
  ]);

  // popup เตือนก่อนเข้า step 2 (พูดคุย) — trigger เฉพาะใน goToSimpleStep (step 1 → 2)
  // ไม่ trigger จาก useEffect อีกต่อไป: เพราะ getSimpleStep() ยังไม่รู้ขั้นจริงก่อน msgs โหลด
  // → ป้องกัน popup ยิงตอน reload แล้ว setWzViewStep(2) ทำให้ค้างที่ step 2 ถาวร

  useEffect(() => {
    // poll chat เสมอสำหรับดีล meetup (แชทฝังใน wizard) หรือเมื่ออยู่ tab chat / วิดีโอคอล
    // รวมถึง simple deal ตอนอยู่ขั้นคุย/ตรวจหลักฐาน เพื่อให้อีกฝ่ายเห็นข้อความใหม่ทันที
    // เพิ่มเติม: poll ตลอดเวลาเมื่อสามารถโทรได้ (canCall) เพื่อตรวจจับ "สายเรียกเข้า" จากอีกฝ่ายได้ทัน
    // หยุด poll เมื่ออยู่หน้าจบดีลแล้ว — ไม่จำเป็นต้องโหลดแชทต่อ
    const isMeetupDeal = deal?.deal_type === 'meetup' && deal?.status !== 'completed';
    const isSimpleDeal = deal?.deal_type === 'simple' && !isFinishedStatus(deal?.status);
    const simpleActualStep = isSimpleDeal ? getSimpleStep().step : 0;
    const simpleViewStep = isSimpleDeal ? Math.min(wzViewStep ?? simpleActualStep, simpleActualStep) : 0;
    const isSimpleChatStage = false;
    // canCall = เป็นคู่ดีล มี buyer เข้าแล้ว และดีลยังไม่จบ → poll เพื่อรอสายเรียกเข้า
    const canCallCheck = isDealParty(deal, myId) && !!deal?.buyer_id && !['completed', 'cancelled'].includes(deal?.status || '');
    if (!isDealParty(deal, myId)) return;
    if (tab !== 'chat' && !isInCall && !isMeetupDeal && !isSimpleChatStage && !canCallCheck) return;
    let stopped = false;
    const poll = async () => {
      try {
        const headers = await getAuthHeaders();
        if (!stopped) await fetchMsgs(headers, deal, myId);
      } catch { /* เงียบ */ }
    };
    void poll();
    // ตอนอยู่ในคอล/คุยเร็วหน่อย, ตอนรอสายเรียกเข้า (ยังไม่ได้คุย) ใช้ 3 วิเพื่อตอบสนองเร็ว
    const intervalMs = isInCall ? 4000 : (isSimpleChatStage ? 2500 : canCallCheck ? 3000 : 5000);
    const timer = window.setInterval(() => { void poll(); }, intervalMs);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [deal, fetchMsgs, getAuthHeaders, myId, priceState, isInCall, tab, wzViewStep]);

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

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'auto' }); }, [msgs]);
  useEffect(() => { fetch('/api/fees').then(r => r.json()).then(d => { if (d.fees) setFeeConfig(d.fees); }).catch(() => {}); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  // สายเรียกเข้า — derived value คำนวณจาก msgs ไม่ใช้ setState ใน effect (กัน cascading render)
  // ค้นหา start message ล่าสุดที่ไม่ถูก end ตามหลัง, ภายใน 3 นาที, ไม่ใช่เราโทรเอง, และเรายังไม่ได้ปฏิเสธ/รับ/อยู่ในคอล
  const incomingCall = useMemo<{ callerId: string; callerName: string; mode: 'voice' | 'video'; msgId: string } | null>(() => {
    if (!myId || !deal) return null;
    let latestStart: Msg | null = null;
    let endAfterStart = false;
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      const m = msgs[i];
      if (m.role !== 'system') continue;
      const parsed = parseCallMsg(m.content);
      if (!parsed.isCall) continue;
      if (parsed.kind === 'end') { endAfterStart = true; break; }
      if (parsed.kind === 'start') { latestStart = m; break; }
    }
    if (endAfterStart || !latestStart) return null;
    if (nowTs - new Date(latestStart.created_at).getTime() > 3 * 60 * 1000) return null;
    const parsed = parseCallMsg(latestStart.content);
    if (parsed.kind !== 'start') return null;
    if (parsed.callerId === myId) return null; // เราเป็นคนโทรเอง
    if (activeCallMsgIdRef.current === latestStart.id) return null; // คอลที่เรากำลังคุย
    if (dismissedCallIds.has(latestStart.id)) return null; // เราเคยปฏิเสธ/รับ msg นี้แล้ว
    if (isInCall) return null; // เรากำลังอยู่ในคอลอื่น (outgoing/connecting/active)
    const callerName = (parsed.text || '').replace(/\s*เริ่ม.*$/, '').replace(/\s*\(ผู้สนใจ.*\)$/, '').trim() || 'อีกฝ่าย';
    return { callerId: parsed.callerId || '', callerName, mode: parsed.mode || 'video', msgId: latestStart.id };
  }, [msgs, myId, deal, nowTs, isInCall, dismissedCallIds]);

  // เล่นเสียงปี๊ดสายเรียกเข้าซ้ำทุก 2.5 วินาที นาน 30 วินาที แล้วเคลียร์ incomingCall (เหมือนไม่รับสาย)
  useEffect(() => {
    if (!incomingCall) return;
    playRingBeep();
    const ringIv = window.setInterval(playRingBeep, 2500);
    const stopTimeout = window.setTimeout(() => {
      // หมดเวลารับสาย (30 วิ) → mark ว่าปฏิเสธแล้ว เพื่อซ่อน popup
      if (incomingCall) setDismissedCallIds(prev => new Set(prev).add(incomingCall.msgId));
    }, 30000);
    return () => { window.clearInterval(ringIv); window.clearTimeout(stopTimeout); };
  }, [incomingCall]);

  // ─── ผู้โทรรอสาย (outgoing) — เล่นเสียงดองดึ๊ดทุก 6 วิ + หมดเวลา 30 วิ = ไม่รับสาย ───
  useEffect(() => {
    if (callStatus !== 'outgoing') return;
    playRingback();
    // จังหวะดองดึ๊ดมาตรฐาน: เล่น 2 วิ หยุด 4 วิ → รวม 6 วิ/รอบ
    const ringIv = window.setInterval(playRingback, 6000);
    const stopTimeout = window.setTimeout(() => {
      // รอ 30 วิ ไม่มีคนรับ → สายไม่รับ
      onCallMissed();
    }, 30000);
    return () => { window.clearInterval(ringIv); window.clearTimeout(stopTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus]);

  // ─── นับเวลาตอน active (ทั้ง voice + video) — ใช้ callSeconds ───
  useEffect(() => {
    if (!isActiveCall) return;
    const iv = window.setInterval(() => setCallSeconds(s => s + 1), 1000);
    return () => window.clearInterval(iv);
  }, [isActiveCall]);

  // ─── ตรวจจับ "อีกฝ่ายวางสาย/ปฏิเสธ" — เมื่อเห็น message 📞|end ขณะอยู่ในคอล (active) หรือขณะกำลังรอสาย (outgoing) ───
  // ต้องรวม outgoing ด้วย มิฉะนั้นฝั่งโทรจะไม่รู้ว่าอีกฝ่ายปฏิเสธ (declineIncomingCall ส่ง end_call กลับ) และจะรอจนครบ 30 วิ
  useEffect(() => {
    if ((!isActiveCall && callStatus !== 'outgoing') || !activeCallMsgId) return;
    // ค้นหา end message ที่เกิดหลังจาก start message ของคอลปัจจุบัน
    const startIdx = msgs.findIndex(m => m.id === activeCallMsgId);
    if (startIdx < 0) return;
    for (let i = startIdx + 1; i < msgs.length; i += 1) {
      const m = msgs[i];
      if (m.role === 'system' && m.content.startsWith('📞|end')) {
        // ถ้าตอน active = วางสายกลางคัน, ถ้าตอน outgoing = อีกฝ่ายปฏิเสธสายเรียกเข้า
        const wasRinging = callStatus === 'outgoing';
        setCallEndedReason(wasRinging
          ? { title: '📵 อีกฝ่ายปฏิเสธสาย', sub: 'อีกฝ่ายไม่รับสาย' }
          : { title: '📞 วางสายแล้ว', sub: 'อีกฝ่ายวางสาย' });
        setCallStatus('idle');
        setCallSeconds(0);
        setCallMode('video');
        activeCallMsgIdRef.current = null;
        setActiveCallMsgId(null);
        return;
      }
    }
  }, [msgs, isActiveCall, callStatus, activeCallMsgId]);

  // ปลดล็อก AudioContext ตอน user แตะหน้าจอครั้งแรก (เบราว์เซอร์บล็อกเสียงที่ไม่ได้เริ่มจาก gesture)
  // จำเป็นเพื่อให้เสียงปี๊ดสายเรียกเข้าเล่นได้ในภายหลัง
  useEffect(() => {
    const unlock = () => { unlockAudio(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
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
        // ถ้า PATCH คืน evidence list ล่าสุดมาด้วย → setEvidence ทันที (กัน re-fetch ทับ optimistic จนภาพหาย)
        if (Array.isArray(d.evidence)) setEvidence(d.evidence);
        // re-fetch ทั้งดีล+meetup+priceState+evidence ให้ตรงกัน
        const nextDeal = await fetchDeal(headers);
        if ((tab === 'chat' || isInCall) && isDealParty(nextDeal ?? deal, myId)) await fetchMsgs(headers, nextDeal ?? deal, myId);
        return nextDeal;
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
    setUploadPreview({ url, name: f.name, status: isVideoFile(f) ? 'กำลังเตรียมวิดีโอ...' : 'กำลังอัปโหลด...' });
    return url;
  }
  function endUploadPreview(url: string) {
    if (url) URL.revokeObjectURL(url);
    setUploadPreview(null);
  }

  /** ลบหลักฐานที่ตัวเองอัป — แล้วอัปใหม่ได้ในขั้นที่ยังแก้ไขได้ */
  function canDeleteEvidenceItem(item: EvidenceItem): boolean {
    if (!myId || !item.id || item.uploaded_by !== myId || !deal) return false;
    const st = deal.status;
    if (item.type === 'packing' && myRole === 'seller' && st === 'packing') return true;
    if (item.type === 'receive' && myRole === 'buyer' && st === 'shipped_to_buyer') return true;
    if (myRole === 'middleman' && ['middleman_received', 'middleman_checking'].includes(st)) return true;
    const canUpEvidence = ((myRole === 'seller' || myRole === 'buyer') && ['packing', 'shipped_to_middleman', 'payment_pending', 'payment_uploaded'].includes(st))
      || (myRole === 'middleman' && ['middleman_received', 'middleman_checking'].includes(st));
    return canUpEvidence;
  }

  async function deleteEvidenceItem(item: EvidenceItem) {
    if (!item.id || !canDeleteEvidenceItem(item)) return;
    if (!confirm('ลบหลักฐานนี้แล้วอัปใหม่ได้?')) return;
    await doAction('delete_evidence', { evidenceId: item.id });
  }

  function renderVideoUploadHint(style?: CSSProperties) {
    return <p style={{ fontSize: 12, color: '#8a5a00', lineHeight: 1.55, marginBottom: 10, ...style }}>{VIDEO_UPLOAD_HINT}</p>;
  }

  async function uploadFile(file: File, isEvidence = false, evidenceTypeOverride?: string) {
    const purl = beginUploadPreview(file);
    try {
      let fileId = '', fileName = file.name;
      if (isVideoFile(file)) {
        let prepared: File;
        try {
          prepared = await compressVideo(file, (pct, label) => {
            setUploadPreview((prev) => prev ? { ...prev, progress: pct, status: label || 'กำลังบีบอัดวิดีโอ...' } : prev);
          });
        } catch (err) {
          const code = err instanceof Error ? err.message : '';
          if (code === 'VIDEO_TOO_LONG') alert('วิดีโอยาวเกิน 5 นาที — กรุณาตัดหรือถ่ายใหม่');
          else if (code === 'UNSUPPORTED') alert('เบราว์เซอร์นี้บีบอัดวิดีโอไม่ได้ — ลองอัปเดตแอปหรือใช้ Chrome/Safari เวอร์ชันล่าสุด');
          else alert('บีบอัดวิดีโอไม่สำเร็จ — ลองถ่ายใหม่หรือใช้คลิปที่สั้นกว่า');
          return;
        }
        if (prepared.size > 50 * 1024 * 1024) {
          alert('วิดีโอหลังบีบอัดยังใหญ่เกิน 50MB — กรุณาใช้คลิปที่สั้นกว่า');
          return;
        }
        file = prepared;
        // วิดีโอมักใหญ่เกินลิมิต body ของ API route บน Vercel (~4.5MB) → อัปโหลดตรงเข้า Supabase Storage จากเบราว์เซอร์
        const ext = (file.name.split('.').pop() || 'webm').toLowerCase();
        const path = `${myId || 'guest'}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        setUploadPreview((prev) => prev ? { ...prev, progress: undefined, status: 'กำลังอัปโหลด...' } : prev);
        const { error } = await supabase.storage.from(DEAL_BUCKET).upload(path, file, { contentType: file.type || 'video/webm' });
        if (error) { alert(`อัปโหลดวิดีโอไม่สำเร็จ: ${error.message}`); return; }
        fileId = path;
        fileName = file.name;
      } else {
        const headers = await getAuthHeaders(true); // force-fresh — ป้องกัน cached token หมดอายุ
        if (!headers.Authorization) { alert('กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง'); return; }
        const prepared = await compressImage(file); // บีบอัดเฉพาะรูป
        const form = new FormData(); form.append('file', prepared);
        const r = await fetch('/api/upload-deal', { method: 'POST', headers, body: form });
        const d = await r.json();
        if (r.status === 401) { headersRef.current = {}; alert('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่'); return; }
        if (!r.ok) { alert(d.error || 'Upload failed'); return; }
        fileId = d.fileId; fileName = d.fileName;
      }
      if (isEvidence) {
        const tempType = evidenceTypeOverride || evidenceType;
        // ส่ง add_evidence → doAction re-fetch จะเอา evidence ล่าสุดจาก DB มาแสดงเอง
        // (อย่าทำ optimistic update — doAction re-fetch จะเขียนทับ state ทำให้ item "หาย")
        const nextDeal = await doAction('add_evidence', { evidenceType: tempType, fileId, fileName });
        if (!nextDeal) {
          alert('บันทึกหลักฐานไม่สำเร็จ — กรุณาลองอีกครั้ง');
          return;
        }
        // re-fetch เพิ่มอีกครั้ง (กัน race — บางครั้ง DB commit เสร็จหลัง doAction re-fetch)
        const headers = await getAuthHeaders();
        const r = await fetch(`/api/deals/${dealId}`, { headers, cache: 'no-store' });
        if (r.ok) { const d = await r.json(); if (d.evidence) setEvidence(d.evidence); }
      }
      else await sendMsg('', file.type.startsWith('image/') ? 'image' : 'file', fileId, fileName || file.name);
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

  /** เริ่มคอลในโหมดที่เลือก ('voice' | 'video') — แจ้งเตือนทุกฝ่ายในดีล (กันสแปม: แจ้งซ้ำได้ทุก 2 นาที) */
  /**
   * เริ่มคอลในโหมดที่เลือก — voice ทำงานเป็น background (ไม่ทับหน้าจอ), video เปิดเต็มจอ
   * แจ้งเตือนอีกฝ่ายผ่าน system message start_call (กันสแปม: แจ้งซ้ำได้ทุก 2 นาที)
   */
  function startCall(mode: 'voice' | 'video') {
    if (!isDealParty(deal, myId)) return;
    // State machine: idle → outgoing (ยังไม่ active — รออีกฝ่ายรับสาย)
    setCallMode(mode);
    setCallStatus('outgoing');
    setCallSeconds(0);
    setCallTimedOut(false);
    setCallEndedReason(null);
    // ปลดล็อก AudioContext ทันทีที่ผู้ใช้กด (user gesture) — เพื่อเล่นเสียงดองดึ๊ดได้
    unlockAudio();
    // แจ้งเตือนอีกฝ่าย — ลด throttle เป็น 5 วิ (รองรับกดโทรใหม่รวด ๆ ได้ตาม requirement "ต่อสายได้เสมอ")
    if (myId && Date.now() - callNotifyAt.current > 5000) {
      callNotifyAt.current = Date.now();
      (async () => {
        try {
          const headers = await getAuthHeaders();
          const r = await fetch(`/api/deals/${dealId}`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'start_call', mode }),
          });
          // เก็บ msg id ของสายที่เราเริ่ม เพื่อไม่ให้ตัวเองถูกแจ้งเป็น "สายเรียกเข้า"
          if (r.ok) {
            const fresh = await fetch(`/api/messages?dealId=${dealId}`, { headers, cache: 'no-store' }).then(x => x.json()).catch(() => null);
            const sysMsgs = (fresh?.messages || []).filter((m: Msg) => m.role === 'system' && m.content?.startsWith('📞|') && !m.content.startsWith('📞|end'));
            const latest = sysMsgs[sysMsgs.length - 1];
            if (latest) {
              activeCallMsgIdRef.current = latest.id;
              setActiveCallMsgId(latest.id);
            }
            setMsgs(fresh?.messages || []);
          }
        } catch { /* แจ้งเตือนไม่สำเร็จ ไม่กระทบการเข้าคอล */ }
      })();
    }
  }

  /** วางสาย — ส่ง end_call ให้อีกฝ่ายรู้ แล้วคืนสู่ idle (ไม่ throttle) */
  function endCall() {
    const wasInCall = callStatus !== 'idle';
    setCallStatus('idle');
    setCallSeconds(0);
    setCallMode('video');
    activeCallMsgIdRef.current = null;
    setActiveCallMsgId(null);
    if (wasInCall && myId) {
      (async () => {
        try {
          const headers = await getAuthHeaders();
          await fetch(`/api/deals/${dealId}`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'end_call' }),
          });
          fetchMsgs(headers, deal, myId);
        } catch { /* ไม่สำคัญ */ }
      })();
    }
  }

  /** อีกฝ่ายรับสายแล้ว — เปลี่ยนจาก outgoing → active (เริ่มนับเวลา + หยุดเสียงดองดึ๊ด) */
  function onCallAnswered() {
    if (callStatus === 'outgoing' || callStatus === 'connecting') {
      setCallStatus('active');
      setCallSeconds(0);
    }
  }

  /** หมดเวลารอสาย (30 วิ) — สายไม่รับ */
  function onCallMissed() {
    const callerName = dealTitle();
    setCallEndedReason({ title: '📞 ไม่รับสาย', sub: `${callerName} ไม่รับสายในขณะนี้` });
    endCall();
  }

  /** รับสายเรียกเข้า — เข้าสถานะ connecting (รอ LiveKit เชื่อมต่อ → onConnected เปลี่ยน active) */
  function acceptIncomingCall() {
    if (!incomingCall) return;
    setDismissedCallIds(prev => new Set(prev).add(incomingCall.msgId));
    activeCallMsgIdRef.current = incomingCall.msgId;
    setActiveCallMsgId(incomingCall.msgId);
    unlockAudio();
    setCallMode(incomingCall.mode);
    // ฝั่งรับสายเชื่อมต่อ LiveKit แล้ว remoteParticipants จะเห็น caller → เปลี่ยน active ผ่าน onAnswered
    setCallStatus('connecting');
  }

  /** ปฏิเสธสายเรียกเข้า — mark local + ส่ง 📞|end กลับไปฝั่งโทร เพื่อให้ฝั่งโทรหยุด ringing ทันที (ไม่ต้องรอ 30 วิ) */
  function declineIncomingCall() {
    if (!incomingCall) return;
    setDismissedCallIds(prev => new Set(prev).add(incomingCall.msgId));
    activeCallMsgIdRef.current = incomingCall.msgId;
    // ส่งสัญญาณปฏิเสธกลับ → ฝั่งโทรจะเห็น 📞|end ผ่าน end-detect effect และแสดง "อีกฝ่ายปฏิเสธสาย"
    if (myId) {
      (async () => {
        try {
          const headers = await getAuthHeaders();
          await fetch(`/api/deals/${dealId}`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'end_call' }),
          });
        } catch { /* network — ฝั่งโทรจะ timeout 30 วิ เอง */ }
      })();
    }
  }

  /** ชื่อคู่สาย (ใช้ในหน้า ringing) — ดึงจากฝ่ายตรงข้ามในดีล */
  function dealTitle(): string {
    if (!deal) return 'อีกฝ่าย';
    // ถ้าเราเป็น buyer → คู่สายคือ seller, ฯลฯ
    if (myRole === 'buyer') return deal.seller_name || 'ผู้ขาย';
    if (myRole === 'seller') return deal.buyer_name || 'ผู้ซื้อ';
    return deal.buyer_name || deal.seller_name || 'อีกฝ่าย';
  }

  /** ปลดล็อก AudioContext ตอน user แตะ (เบราว์เซอร์บล็อกเสียงที่ไม่ได้เริ่มจาก gesture) */
  function unlockAudio() {
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) audioCtxRef.current = new AC();
      }
      if (audioCtxRef.current?.state === 'suspended') void audioCtxRef.current.resume();
    } catch { /* ไม่รองรับ — เงียบ */ }
  }

  /** เล่นเสียงปี๊ดสายเรียกเข้า 1 ครั้ง (ต้องปลดล็อก AudioContext ก่อน) */
  function playRingBeep() {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state !== 'running') return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch { /* เงียบ */ }
  }

  /** เล่นเสียงดองดึ๊ด (ringback tone) 1 จังหวะ — 2 tone 440Hz+480Hz พร้อมกัน 2 วิ (ตามมาตรฐานสากล) */
  function playRingback() {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      // 2 oscillators (440 + 480 Hz) เล่นพร้อมกัน = ringback tone อเมริกัน/ไทย
      [440, 480].forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.15, now + 0.05);
        gain.gain.setValueAtTime(0.15, now + 2.0);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.05);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 2.1);
      });
    } catch { /* เงียบ */ }
  }

  if (loading || authLoading) return (
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

  const isMeetup = deal.deal_type === 'meetup';
  const isSimple = deal.deal_type === 'simple';
  const isMarketplaceCheckout = isListingCheckoutOrder(deal);
  const isDirectShipFlow = isSimple || isMarketplaceCheckout || isDirectShipOrder(deal);
  const isAdminUser = user?.prefs?.role === 'admin';
  const myRole: DealRole = !deal || !myId
    ? (myId ? 'guest' : '')
    : deal.seller_id === myId
      ? 'seller'
      : deal.middleman_id === myId
        ? 'middleman'
        : deal.buyer_id === myId
          ? 'buyer'
          : 'guest';

  // (เดิมคำนวณ callLive จาก system message 📞| — ตอนนี้ย้ายไปเป็น derived value incomingCall + voiceBgActive/showCall แทนแล้ว)
  const stepIdx = STEP_ORDER.indexOf(deal.status);
  const pct = stepIdx >= 0 ? Math.round((stepIdx / (STEP_ORDER.length - 1)) * 100) : 0;
  const isFinished = ['completed', 'cancelled', 'disputed'].includes(deal.status);
  // ปุ่มโทรคุย: แสดงทุกขั้นตอนตั้งแต่มีคู่ดีลเข้ามา จนดีลจบ (ยังโทรได้ตอน disputed เพื่อคุยแก้ปัญหา)
  const canCall = isDealParty(deal, myId) && !!deal.buyer_id && !['completed', 'cancelled'].includes(deal.status);

  // ─── Admin observer panel ───────────────────────────────────────────────
  if (isAdminUser && (myRole === 'guest' || myRole === '')) {
    const STAT_LABEL: Record<string, string> = {
      buyer_joined: 'รอยอมรับเงื่อนไข', terms_pending: 'รอยอมรับเงื่อนไข',
      payment_pending: 'คุย/เก็บหลักฐาน/ตกลงราคา', payment_uploaded: 'รอยืนยันสลิป',
      packing: 'แพ็คของ', shipped_to_middleman: 'จัดส่งคนกลาง',
      middleman_received: 'คนกลางรับของ', middleman_checking: 'คนกลางตรวจสอบ',
      shipped_to_buyer: 'จัดส่งผู้ซื้อ', buyer_received: 'ผู้ซื้อยืนยันรับ',
      completed: 'เสร็จสมบูรณ์', cancelled: 'ยกเลิก', disputed: 'ข้อพิพาท',
    };
    return (
      <div className="dr-root">
        <InAppBanner />
        <AppHeaderBar
          className="dr-header app-header-bar"
          title={deal.title}
          titleIcon="package"
          backHref="/admin/deals"
          extraActions={<span style={{ fontSize: 11, background: '#fee2e2', color: '#991b1b', borderRadius: 4, padding: '2px 7px', fontWeight: 700, whiteSpace: 'nowrap' }}>Admin</span>}
        />
        <main style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 60px', display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
          {/* Deal summary */}
          <div className="dr-card">
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{deal.title}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green-600)', fontFamily: 'var(--font-display)', margin: '6px 0' }}>฿{deal.price.toLocaleString()}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
              {deal.seller_name && <span>ผู้ขาย: <strong>{deal.seller_name}</strong></span>}
              {deal.buyer_name && <span>ผู้ซื้อ: <strong>{deal.buyer_name}</strong></span>}
              {deal.middleman_name && <span>คนกลาง: <strong>{deal.middleman_name}</strong></span>}
            </div>
            <div style={{ display: 'inline-block', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>
              สถานะ: {STAT_LABEL[deal.status] || deal.status}
            </div>
          </div>
          {/* Chat (read-only) */}
          <div className="dr-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--line)', fontWeight: 700, fontSize: 13 }}>💬 แชท (อ่านอย่างเดียว)</div>
            <div style={{ maxHeight: 380, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, WebkitOverflowScrolling: 'touch' as const }}>
              {msgs.filter(m => m.role !== 'system').length === 0 && <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>ยังไม่มีข้อความ</p>}
              {msgs.map(m => {
                if (m.role === 'system') return <div key={m.id} className="dr-sys-msg"><span>{friendlyCallText(m.content)}</span></div>;
                return (
                  <div key={m.id} className="dr-bubble-row">
                    <div className="dr-bubble-av" style={{ background: bubbleAvColor(m) }}>{(m.sender_name || '?').slice(0, 1)}</div>
                    <div className="dr-bubble-col">
                      <span className="dr-bubble-sender">{m.sender_name}</span>
                      <div className={bubbleClass(m, false)}>
                        {m.type === 'image' ? <DealClickableMedia url={fileUrl(m.file_id)} alt={m.file_name} label={m.file_name} maxHeight={180} />
                          : m.type === 'file' ? <a href={fileUrl(m.file_id)} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>📎 {m.file_name}</a>
                          : m.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Evidence (read-only) */}
          <div className="dr-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--line)', fontWeight: 700, fontSize: 13 }}>📁 หลักฐาน ({evidence.length} รายการ)</div>
            {evidence.length === 0
              ? <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0', fontSize: 13 }}>ยังไม่มีหลักฐาน</p>
              : <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {evidence.map((item, i) => {
                    const url = item.file_id ? fileUrl(item.file_id) : '';
                    const isVid = item.file_name?.match(/\.(mp4|mov|avi|webm)$/i);
                    const isImg = item.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                    return (
                      <div key={item.id || i} style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                        <div style={{ marginBottom: 4 }}>{item.type}{item.uploader_name ? ` · ${item.uploader_name}` : ''}</div>
                        {!item.file_id ? <div style={{ fontSize: 13, color: 'var(--ink)' }}>{item.content}</div>
                          : isDealVideoFile(item.file_name) ? <DealClickableMedia url={url} alt={item.file_name} label={item.file_name} isVideo maxHeight={200} />
                          : isDealImageFile(item.file_name) ? <DealClickableMedia url={url} alt={item.file_name} label={item.file_name} maxHeight={180} />
                          : <a href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>📎 {item.file_name}</a>}
                      </div>
                    );
                  })}
                </div>}
          </div>
        </main>
      </div>
    );
  }

  // ─── Guest / not-logged-in join panel (regular/meetup — simple ใช้ shell ร่วมกับผู้สร้าง) ───
  if ((myRole === 'guest' || myRole === '') && !isSimple) {
    const canBeBuyer = !deal.buyer_id, canBeSeller = !deal.seller_id, notLoggedIn = !myId;
    const dealUrl = typeof window !== 'undefined' ? window.location.href : '';
    function handleJoin(role: 'buyer' | 'seller') {
      if (notLoggedIn) router.push(`/login?returnTo=${encodeURIComponent(dealUrl || `/deal/${dealId}`)}`);
      else doAction(role === 'buyer' ? 'join_as_buyer' : 'join_as_seller');
    }
    return (
      <div className="dr-root">
        <InAppBanner />
        <AppHeaderBar className="dr-header app-header-bar" title={deal.title} titleIcon="package" backHref="/" />
        <div style={{ maxWidth: 440, margin: '0 auto', padding: '40px 16px', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <DealFlowBrand className="dr-brand-slot" />
          <div className="dr-card">
            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)' }}>{deal.title}</div>
            {deal.description && <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>{deal.description}</p>}
            {deal.deal_type === 'simple' && (
              <div style={{ marginTop: 12 }}>
                <DealProductGallery
                  images={deal.images}
                  warrantyYears={deal.warranty_years}
                  warrantyMonths={deal.warranty_months}
                  warrantyDays={deal.warranty_days}
                />
              </div>
            )}
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--green-600)', fontFamily: 'var(--font-display)', marginTop: 10 }}>฿{deal.price.toLocaleString()}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
              {deal.seller_name && <span>ผู้ขาย: {deal.seller_name}</span>}
              {deal.buyer_name && <span>ผู้ซื้อ: {deal.buyer_name}</span>}
            </div>
          </div>
          {notLoggedIn && <div style={{ background: '#fef5e3', border: '1px solid #fbe6bf', borderRadius: 'var(--r-md)', padding: '12px 16px', fontSize: 13, color: '#9a6209', textAlign: 'center' }}>⚠️ กรุณาเข้าสู่ระบบก่อนเข้าร่วมดีล</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {canBeBuyer && <AsyncButton onClick={() => handleJoin('buyer')} className="btn btn-green btn-block btn-lg">{notLoggedIn ? '🔑 เข้าสู่ระบบเพื่อเป็นผู้ซื้อ' : '🛍️ เข้าร่วมเป็นผู้ซื้อ'}</AsyncButton>}
            {canBeSeller && <AsyncButton onClick={() => handleJoin('seller')} className="btn btn-block btn-lg" style={{ background: '#6841d9', color: '#fff' }}>{notLoggedIn ? '🔑 เข้าสู่ระบบเพื่อเป็นผู้ขาย' : '🛒 เข้าร่วมเป็นผู้ขาย'}</AsyncButton>}
            {!canBeBuyer && !canBeSeller && <p style={{ textAlign: 'center', color: 'var(--muted)' }}>ดีลนี้มีผู้ซื้อและผู้ขายครบแล้ว</p>}
          </div>
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
            <button onClick={() => { if (authHdrs.Authorization) loadMiddlemen(authHdrs, mmFilter); }} disabled={mmLoading} className="btn btn-soft btn-block">{mmLoading ? 'กำลังค้นหา...' : '🔍 ค้นหาคนกลาง'}</button>
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
                <AsyncButton onClick={() => { doAction('select_middleman', { middlemanId: m.userId, middlemanName: m.name }); setShowSelectMM(false); }} disabled={acting} className="btn btn-green btn-block">✅ เลือกคนกลางนี้</AsyncButton>
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
      const headers = await getAuthHeaders(true); // force-fresh — ป้องกัน cached token หมดอายุ
      if (!headers.Authorization) { alert('กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง'); return; }
      const prepared = await compressImage(f);
      const form = new FormData(); form.append('file', prepared);
      const r = await fetch('/api/upload-deal', { method: 'POST', headers, body: form });
      const d = await r.json();
      if (r.status === 401) { headersRef.current = {}; alert('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่'); return; }
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
            <AsyncButton type="button" className="btn btn-green btn-sm btn-block" style={{ marginTop: 10 }}
              disabled={!meetAddr.tambon}
              onClick={() => doAction('meetup_set_location', { loc: meetAddr })}>
              บันทึกที่อยู่ของฉัน
            </AsyncButton>
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
              <AsyncButton type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} disabled={acting} onClick={() => doAction('meetup_respond', { accept: false })}>ยกเลิกข้อเสนอ</AsyncButton>
            </div>
          ) : isParty ? (
            <div style={{ background: '#fef5e3', border: '1.5px solid var(--amber-400)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 12 }}>
              <p style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                💰 {md.pending_by === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}เสนอ{md.pending_meet_label ? `จุดนัด "${md.pending_meet_label}" + ` : 'เปลี่ยน'}เงินประกัน ฿{Number(md.pending_deposit).toLocaleString()}/ฝ่าย
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <AsyncButton type="button" className="btn btn-green btn-sm" disabled={acting} onClick={() => doAction('meetup_respond', { accept: true })}>✅ ยอมรับ</AsyncButton>
                <AsyncButton type="button" className="btn btn-danger btn-sm" disabled={acting} onClick={() => doAction('meetup_respond', { accept: false })}>❌ ไม่ยอมรับ</AsyncButton>
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
                  <AsyncButton className="btn btn-green btn-sm" disabled={acting} onClick={() => {
                    if (!confirm('เริ่มออกเดินทางตอนนี้? อีกฝ่ายจะได้รับแจ้งเตือนทันที')) return;
                    doAction('meetup_depart');
                    if (confirm('แชร์ตำแหน่งให้คู่ดีลเห็นระหว่างเดินทางไหม?\n(อัปเดตทุก ~45 วินาที เฉพาะตอนเปิดหน้านี้ — ปิดได้ตลอด)')) startShareLoc();
                  }}>🚗 เริ่มออกเดินทาง</AsyncButton>
                )}
                {meetStage && myRole === r.side && !!r.departedAt && !r.met && (
                  <>
                    <AsyncButton className="btn btn-green btn-sm" disabled={acting} onClick={() => { if (confirm('ยืนยันว่านัดเจอกันสำเร็จแล้ว?')) { stopShareLoc(); return doAction('meetup_met'); } }}>
                      ✅ ยืนยันนัดเจอสำเร็จ
                    </AsyncButton>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => (sharingLoc ? stopShareLoc() : startShareLoc())}>
                      {sharingLoc ? '🛰️ กำลังแชร์ตำแหน่ง — กดเพื่อหยุด' : '🛰️ แชร์ตำแหน่งให้อีกฝ่าย'}
                    </button>
                  </>
                )}
                {r.slip && (
                  <DealMediaOpenLink url={fileUrl(r.slip)} label="สลิปเงินประกัน">ดูสลิป</DealMediaOpenLink>
                )}
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
          <p style={{ fontSize: 12.5, color: 'var(--green-600)', marginTop: 12 }}>🎉 นัดเจอสำเร็จ — บริษัท กลางฮับ จำกัด จะโอนเงินประกันคืนทั้งสองฝ่ายเต็มจำนวน (เก็บเฉพาะค่าธรรมเนียม)</p>
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
    const fpNameWithAmount = (fp?: string, price?: number) => {
      if (fp === 'split') {
        const _p = price || Number(pd.proposed_price || deal!.price);
        const _fb = computeDealFees(feeConfig, _p, deal!.deal_type);
        const _half = Math.round(_fb.total / 2);
        return `หารครึ่ง (คนละ ฿${_half.toLocaleString()})`;
      }
      return fpName(fp);
    };
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
            ✅ ตกลงราคาแล้ว <b>฿{Number(pd.proposed_price || deal!.price).toLocaleString()}</b> · ค่าบริการ: {fpNameWithAmount(selectedFeePayer, Number(pd.proposed_price || deal!.price))}
            {hasMm && pd.mm_deposit_held ? ` · คนกลางวางเครดิตประกัน ฿${Number(pd.mm_deposit_held).toLocaleString()}` : ''}
          </div>
        ) : isRepriceFlow ? (
          <div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>{proposerLabel}เสนอราคาใหม่: <b>฿{Number(pd.proposed_price).toLocaleString()}</b> · ค่าบริการ: {fpNameWithAmount(pd.proposed_fee_payer, Number(pd.proposed_price))}</div>
            {renderParticipantStatusRows([
              { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: !!pd.seller_agreed, doneText: '✅ ตกลงแล้ว' },
              { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!pd.buyer_agreed, doneText: '✅ ตกลงแล้ว' },
              ...(hasMm ? [{ roleLabel: 'คนกลาง', name: deal!.middleman_name || '-', ok: !!pd.middleman_agreed, doneText: '✅ ตกลงแล้ว' }] : []),
            ], { marginBottom: 10, gap: 5, fontSize: 13 })}
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
            {renderParticipantStatusRows([
              { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: !!pd.seller_agreed, doneText: '✅ รับรู้/ยืนยันแล้ว' },
              { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!pd.buyer_agreed, doneText: '✅ รับรู้/ยืนยันแล้ว' },
              ...(hasMm ? [{ roleLabel: 'คนกลาง', name: deal!.middleman_name || '-', ok: !!pd.middleman_agreed, doneText: '✅ รับรู้/ยืนยันแล้ว' }] : []),
            ], { gap: 5, fontSize: 13 })}
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
                  <AsyncButton className="btn btn-green btn-block" disabled={acting} onClick={() => { const p = Math.round(Number(priceInput)); if (!(p >= 1)) { alert('กรอกราคาให้ถูกต้อง'); return; } doAction('price_propose', { price: p, feePayer: selectedFeePayer }); setShowPriceProposal(false); setPriceInput(''); }}>
                    💬 เสนอราคาใหม่ ค่าบริการ: {fpName(selectedFeePayer)}
                  </AsyncButton>
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
    // สถานะขอกลับแชท
    const myReqBack = (myRole === 'seller' && pd.chat_back_req_seller) || (myRole === 'buyer' && pd.chat_back_req_buyer) || (myRole === 'middleman' && pd.chat_back_req_middleman);
    return (
      <div className="dr-card">
        <div className="dr-card-title">📁 เก็บหลักฐานก่อนโอนเงิน</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>คุยรายละเอียด ดูสินค้า เก็บหลักฐานในแชต/วิดีโอคอลให้เรียบร้อย แล้วกดยืนยัน — ทุกฝ่ายต้องยืนยันก่อนเข้าขั้นโอนเงิน</p>
        {renderParticipantStatusRows([
          { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: !!pd.evidence_done_seller, doneText: '✅ เก็บหลักฐานแล้ว' },
          { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!pd.evidence_done_buyer, doneText: '✅ เก็บหลักฐานแล้ว' },
          ...(hasMm ? [{ roleLabel: 'คนกลาง', name: deal!.middleman_name || '-', ok: !!pd.evidence_done_middleman, doneText: '✅ เก็บหลักฐานแล้ว' }] : []),
        ], { marginBottom: 10, gap: 5, fontSize: 13 })}
        {!meDone
          ? <AsyncButton className="btn btn-green btn-block" onClick={() => doAction('evidence_done')}>✅ เก็บหลักฐานเสร็จสิ้น</AsyncButton>
          : <p style={{ fontSize: 13, color: 'var(--green-600)', textAlign: 'center' }}>✅ คุณยืนยันแล้ว — รอฝ่ายอื่น</p>}
        {/* ปุ่มกลับไปแชทใหม่ — ต้องทั้ง 2 ฝ่ายกดยินยอม */}
        <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
            ↩️ ต้องการกลับไปคุยกันก่อน?
            {(pd.chat_back_req_seller || pd.chat_back_req_buyer || pd.chat_back_req_middleman) && (
              <span style={{ display: 'block', marginTop: 4, color: '#b45309' }}>
                {[pd.chat_back_req_seller && 'ผู้ขาย', pd.chat_back_req_buyer && 'ผู้ซื้อ', pd.chat_back_req_middleman && 'คนกลาง'].filter(Boolean).join(', ')} ขอกลับแล้ว — รอฝ่ายอื่นกดยืนยัน
              </span>
            )}
          </p>
          {!myReqBack
            ? <AsyncButton className="btn btn-ghost btn-block btn-sm" onClick={() => doAction('request_chat_back')}>↩️ ขอกลับไปหน้าแชทใหม่</AsyncButton>
            : <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>✔ คุณขอกลับแล้ว — รอฝ่ายอื่น</p>}
        </div>
      </div>
    );
  }

  // ─── ตลาด — โอนเงิน (flow แยกจากดีลผ่านกลาง) ─────────────────────────────
  function renderMarketplacePaymentSection() {
    if (!isMarketplaceOrder(deal!)) return null;
    const show = isMarketplaceCheckoutActive(deal!) || deal!.status === 'payment_uploaded';
    if (!show) return null;
    const awaitingSlip = !deal!.payment_slip_file_id
      && (deal!.status === 'payment_pending' || isMarketplaceCheckoutActive(deal!));
    return (
      <MarketplacePaymentSection
        deal={{
          price: deal!.price,
          shipping_cost: deal!.shipping_cost,
          buyer_name: deal!.buyer_name,
          seller_name: deal!.seller_name,
          payment_slip_file_id: deal!.payment_slip_file_id,
          status: deal!.status,
          list_gross_price: deal!.list_gross_price,
        }}
        myRole={myRole}
        awaitingSlip={awaitingSlip}
        onUploadSlip={async (file) => {
          const purl = beginUploadPreview(file);
          try {
            const headers = await getAuthHeaders();
            const prepared = await compressImage(file);
            const form = new FormData();
            form.append('file', prepared);
            const r = await fetch('/api/upload-deal', { method: 'POST', headers, body: form });
            const d = await r.json();
            if (r.ok) await doAction('upload_payment', { fileId: d.fileId });
            else alert(d.error || 'อัปโหลดสลิปไม่สำเร็จ');
          } finally {
            endUploadPreview(purl);
          }
        }}
      />
    );
  }

  // ─── Payment section (ดีลผ่านกลาง / simple — ไม่รวมตลาด) ─────────────────
  function renderPaymentSection(opts?: { compact?: boolean }) {
    if (deal!.deal_type === 'meetup' || isMarketplaceOrder(deal!)) return null;
    if (!['payment_pending', 'payment_uploaded'].includes(deal!.status)) return null;
    const compact = opts?.compact ?? false;
    const awaitingBuyerSlip = !deal!.payment_slip_file_id && deal!.status === 'payment_pending';
    return (
        <div className={`dr-card${compact ? ' simple-deal-pay-card' : ' dr-pay-card'}`}>
        {(() => {
          const pd: DealPriceState = priceState || {};
          const fb = computeDealFees(feeConfig, deal!.price, deal!.deal_type);
          const fp = String(deal!.fee_payer || pd.proposed_fee_payer || 'split');
          const sellerShare = fp === 'seller' ? fb.total : fp === 'split' ? Math.round(fb.total / 2) : 0;
          const buyerShare = fb.total - sellerShare;
          const buyerShouldPay = deal!.price + buyerShare;
          const sellerNet = Math.max(deal!.price, 0);
          const sellerPaymentDone = sellerShare <= 0 ? true : !!pd.seller_fee_slip;
          const fpName = fp === 'seller' ? 'ผู้ขายจ่าย' : fp === 'split' ? 'หารครึ่ง' : 'ผู้ซื้อจ่าย';
          const isBuyerPaysAll = fp === 'buyer';
          const isSellerPaysAll = fp === 'seller';
          const isSplit = fp === 'split';
          const sellerShouldPay = sellerShare;
          
          const payTitle = myRole === 'buyer'
            ? 'ยอดที่คุณต้องโอน'
            : myRole === 'seller'
              ? 'ค่าบริการฝั่งผู้ขาย'
              : 'สรุปการชำระเงิน';
          const payAmount = myRole === 'buyer'
            ? buyerShouldPay
            : myRole === 'seller'
              ? sellerShouldPay
              : buyerShouldPay;
          const feeHint = myRole === 'buyer'
            ? `ราคา ฿${deal!.price.toLocaleString()}${buyerShare > 0 ? ` + ค่าบริการ ฿${buyerShare.toLocaleString()}` : ''} · ${fpName}`
            : myRole === 'seller' && sellerShouldPay > 0
              ? `ค่าบริการ ${fpName} · แยกจากยอดสินค้า`
              : `ค่าบริการ: ${fpName}`;
          const statusItems = isBuyerPaysAll
            ? [
                { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: true, doneText: '✅ ไม่ต้องชำระ', waitText: '⏳ รอ' },
                { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!deal!.payment_slip_file_id, doneText: '✅ ส่งสลิปแล้ว', waitText: '⏳ รอส่งสลิป' },
              ]
            : [
                { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: sellerPaymentDone, doneText: sellerShouldPay > 0 ? '✅ ส่งสลิปแล้ว' : '✅ ไม่ต้องชำระ', waitText: sellerShouldPay > 0 ? '⏳ รอส่งสลิป' : '⏳ รอ' },
                { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!deal!.payment_slip_file_id, doneText: '✅ ส่งสลิปแล้ว', waitText: '⏳ รอส่งสลิป' },
              ];

          if (compact) {
            return (
              <>
                <div className="simple-deal-pay-head">
                  <div className="simple-deal-pay-head-text">
                    <div className="simple-deal-pay-deal">{deal!.title}</div>
                    <div className="simple-deal-pay-title">💳 {payTitle}</div>
                    <div className="simple-deal-pay-fee">{feeHint}</div>
                  </div>
                  <div className="simple-deal-pay-amount">฿{payAmount.toLocaleString()}</div>
                </div>
                <div className="simple-deal-pay-status" aria-label="สถานะการชำระเงิน">
                  {statusItems.map(({ roleLabel, ok, doneText, waitText = '⏳ รอ' }) => (
                    <span key={roleLabel} className={`simple-deal-pay-chip${ok ? ' is-done' : ''}`}>
                      {roleLabel}: {ok ? doneText.replace(/^✅\s*/, '') : waitText.replace(/^⏳\s*/, '')}
                    </span>
                  ))}
                </div>
                {awaitingBuyerSlip && myRole === 'buyer' && (
                  <>
                    <PaymentMethods compact amount={buyerShouldPay} note={
                      isSellerPaysAll
                        ? `โอนค่าสินค้า ฿${deal!.price.toLocaleString()} เข้าบัญชีกลาง`
                        : isSplit
                          ? `โอน ฿${buyerShouldPay.toLocaleString()} เข้าบัญชีกลาง`
                          : 'เงินพักกับศูนย์กลางจนกว่าจะยืนยันรับสินค้า'
                    } />
                    <button onClick={() => evidInputRef.current?.click()} className="btn btn-green btn-block simple-deal-pay-upload">📎 โอนแล้ว — อัปโหลดสลิป</button>
                  </>
                )}
                {awaitingBuyerSlip && myRole !== 'buyer' && myRole !== 'seller' && (
                  <p className="simple-deal-pay-wait">รอผู้ซื้อโอนเงินเข้าระบบพักเงิน</p>
                )}
                {myRole === 'seller' && sellerShouldPay > 0 && ['payment_pending', 'payment_uploaded'].includes(deal!.status) && (
                  pd.seller_fee_slip
                    ? <div className="dr-slip-status">✅ โอนค่าบริการ ฿{sellerShouldPay.toLocaleString()} แล้ว — รอตรวจสอบ</div>
                    : <>
                        <PaymentMethods compact amount={sellerShouldPay} note="โอนค่าบริการส่วนผู้ขายเข้าศูนย์กลาง" />
                        <button onClick={() => sellerFeeInputRef.current?.click()} className="btn btn-green btn-block simple-deal-pay-upload">📎 โอนค่าบริการแล้ว — อัปโหลดสลิป</button>
                      </>
                )}
                {deal!.status === 'payment_uploaded' && myRole === 'buyer' && (
                  <div className="dr-slip-status">✅ ส่งสลิปแล้ว — {isDirectShipFlow ? 'รอศูนย์กลางยืนยันรับเงิน' : 'รอคนกลางยืนยัน'}</div>
                )}
              </>
            );
          }

          return (
            <>
              <div className="dr-card-title">💳 {payTitle}</div>
              <div className="dr-pay-amount">฿{payAmount.toLocaleString()}</div>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '10px 14px', margin: '4px 0 12px', fontSize: 13 }}>
                <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>📋 สรุปยอด · ค่าบริการ: {fpName}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', padding: '2px 0' }}><span>ราคาสินค้า</span><span>฿{deal!.price.toLocaleString()}</span></div>
                {fb.lines.map(l => (<div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', padding: '2px 0' }}><span>{l.label}</span><span>฿{l.amount.toLocaleString()}</span></div>))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: myRole === 'buyer' ? 700 : 400, color: myRole === 'buyer' ? 'var(--ink)' : 'var(--muted)', borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}>
                  <span>ผู้ซื้อ {deal!.buyer_name || ''} โอนเงินเข้าศูนย์กลาง</span>
                  <span>฿{buyerShouldPay.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  {`= ราคาสินค้า ฿${deal!.price.toLocaleString()}${buyerShare > 0 ? ` + ค่าบริการส่วนผู้ซื้อ ฿${buyerShare.toLocaleString()}` : ''}`}
                </div>
                {sellerShouldPay > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: myRole === 'seller' ? 700 : 400, color: myRole === 'seller' ? 'var(--ink)' : (sellerShare > 0 ? '#8a5a00' : 'var(--muted)'), marginTop: 4 }}>
                    <span>ผู้ขาย {deal!.seller_name || ''} ชำระค่าบริการแยก</span>
                    <span>฿{sellerShouldPay.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', marginTop: 4 }}>
                  <span>ยอดสุทธิที่ผู้ขาย {deal!.seller_name || ''} ได้รับเมื่อดีลสำเร็จ</span>
                  <span>฿{sellerNet.toLocaleString()}</span>
                </div>
              </div>
              
              {isBuyerPaysAll ? (
                renderParticipantStatusRows([
                  { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: true, doneText: '✅ ไม่ต้องชำระเพิ่ม', waitText: '⏳ รอเงื่อนไขถัดไป' },
                  { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!deal!.payment_slip_file_id, doneText: '✅ ส่งสลิปแล้ว', waitText: '⏳ รอส่งสลิป' },
                ], { marginBottom: 12 })
              ) : (
                renderParticipantStatusRows([
                  { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: sellerPaymentDone, doneText: sellerShouldPay > 0 ? '✅ ส่งสลิปแล้ว' : '✅ ไม่ต้องชำระเพิ่ม', waitText: sellerShouldPay > 0 ? '⏳ รอส่งสลิป' : '⏳ รอเงื่อนไขถัดไป' },
                  { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!deal!.payment_slip_file_id, doneText: '✅ ส่งสลิปแล้ว', waitText: '⏳ รอส่งสลิป' },
                ], { marginBottom: 12 })
              )}

              {awaitingBuyerSlip && myRole === 'buyer' && (
                <div style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: 'var(--r-md)', padding: '12px 14px', marginTop: 12 }}>
                  <div style={{ fontWeight: 700, color: '#075985', marginBottom: 6 }}>🏦 เลขบัญชีกลางสำหรับโอนเงิน</div>
                  <PaymentMethods amount={buyerShouldPay} note={
                    isSellerPaysAll
                      ? `โอนเงินค่าสินค้า ฿${deal!.price.toLocaleString()} เข้าบัญชีกลาง (ผู้ขายจ่ายค่าบริการเอง)`
                      : isSplit
                        ? `โอนเงินค่าสินค้า ฿${deal!.price.toLocaleString()} + ค่าบริการส่วนผู้ซื้อ ฿${buyerShare.toLocaleString()} = ฿${buyerShouldPay.toLocaleString()}`
                        : `เงินจะพักไว้กับ บริษัท กลางฮับ จำกัด และโอนให้ผู้ขายเมื่อคุณยืนยันรับสินค้าแล้วเท่านั้น`
                  } />
                  <button onClick={() => evidInputRef.current?.click()} className="btn btn-green btn-block" style={{ marginTop: 12 }}>📎 โอนแล้ว — อัปโหลดสลิป</button>
                </div>
              )}
              {awaitingBuyerSlip && myRole !== 'buyer' && myRole !== 'seller' && (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>รอผู้ซื้อโอนเงินเข้าระบบพักเงินของบริษัท</div>
              )}

              {myRole === 'seller' && sellerShouldPay > 0 && ['payment_pending', 'payment_uploaded'].includes(deal!.status) && (
                pd.seller_fee_slip
                  ? <div className="dr-slip-status">✅ คุณโอนค่าบริการ ฿{sellerShouldPay.toLocaleString()} แล้ว — รอศูนย์กลางตรวจสอบ</div>
                  : <div style={{ background: '#fff8ef', border: '1px solid #ffe0b2', borderRadius: 'var(--r-md)', padding: '12px 14px', marginTop: 12 }}>
                      <div style={{ fontWeight: 700, color: '#8a5a00', marginBottom: 6 }}>⚡ ค่าบริการส่วนของคุณ ฿{sellerShouldPay.toLocaleString()} — โอนทันที</div>
                      <PaymentMethods amount={sellerShouldPay} note="โอนค่าบริการส่วนของผู้ขายเข้าศูนย์กลาง แล้วอัปโหลดสลิป (แยกจากยอดสินค้า)" />
                      <button onClick={() => sellerFeeInputRef.current?.click()} className="btn btn-green btn-block" style={{ marginTop: 12 }}>📎 โอนค่าบริการแล้ว — อัปโหลดสลิป</button>
                    </div>
              )}
              
              {deal!.status === 'payment_uploaded' && myRole === 'buyer' && <div className="dr-slip-status">✅ ส่งสลิปแล้ว — {isDirectShipFlow ? 'รอศูนย์กลางยืนยันรับเงิน' : 'รอคนกลางยืนยัน'}</div>}
            </>
          );
        })()}
        <input ref={evidInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
          onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const purl = beginUploadPreview(f); try { const headers = await getAuthHeaders(); const prepared = await compressImage(f); const form = new FormData(); form.append('file', prepared); const r = await fetch('/api/upload-deal', { method: 'POST', headers, body: form }); const d = await r.json(); if (r.ok) await doAction('upload_payment', { fileId: d.fileId }); else alert(d.error || 'อัปโหลดสลิปไม่สำเร็จ'); } finally { endUploadPreview(purl); } e.target.value = ''; }} />
        <input ref={sellerFeeInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
          onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const purl = beginUploadPreview(f); try { const headers = await getAuthHeaders(); const prepared = await compressImage(f); const form = new FormData(); form.append('file', prepared); const r = await fetch('/api/upload-deal', { method: 'POST', headers, body: form }); const d = await r.json(); if (r.ok) await doAction('upload_middleman_fee', { fileId: d.fileId }); else alert(d.error || 'อัปโหลดสลิปไม่สำเร็จ'); } finally { endUploadPreview(purl); } e.target.value = ''; }} />
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
              <DealClickableMedia url={fileUrl(s.fileId)} alt={s.label} label={s.label} maxHeight={200} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── สรุปการเงิน: เลขดีล + บัญชีรับเงินทุกฝ่าย + ยอดที่ต้องคืน/โอนเมื่อจบดีล ──
  function canViewSimpleShareBreakdown() {
    if (deal?.deal_type !== 'simple' || !simpleShare) return false;
    return !!myId && myId === deal.creator_id;
  }

  function renderSimpleShareBreakdownCard() {
    if (!canViewSimpleShareBreakdown() || !simpleShare) return null;
    return (
      <div className="dr-card" style={{ borderColor: 'color-mix(in srgb, #f97316 35%, var(--line))' }}>
        <div className="dr-card-title">💼 ค่าสินค้า + คอมมิชชั่น</div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
            <span>ค่าสินค้า</span><span style={{ fontWeight: 700, color: 'var(--ink)' }}>฿{(deal!.price || 0).toLocaleString()}</span>
          </div>
          {simpleShare.creatorEligible ? (
            simpleShare.shareTier > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--green-700)' }}>
                <span>คอมมิชชั่น ชั้น {simpleShare.shareTier} ({simpleShare.shareTierMultiplier}× ค่ากลาง · {simpleShare.sharePercent}%)</span>
                <span style={{ fontWeight: 700 }}>฿{simpleShare.creatorShare.toLocaleString()}</span>
              </div>
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                ค่าบริการ ฿{simpleShare.totalFee.toLocaleString()} ยังไม่ถึงชั้นขั้นต่ำ — ยังไม่ได้คอมมิชชั่น
              </div>
            )
          ) : (
            <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>คอมมิชชั่น: ไม่มีสิทธิ์ (ต้องเป็นผู้สร้างดีลและลงทะเบียนผู้ขาย+คนกลางครบ)</div>
          )}
        </div>
      </div>
    );
  }

  function formatDealCreatedAt(iso?: string) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  function renderCompletionReviewBlock(isCancelled: boolean, opts?: { simple?: boolean }) {
    const simple = opts?.simple ?? false;
    const completionBtnLabel = myRole === 'seller' ? 'ยืนยัน-รับเงินค่าสินค้า' : 'บันทึกหลักฐาน-จบดีล';
    const isNotParty = myRole === 'guest' || myRole === '';
    const alreadyDone = completionReviewed || isCancelled || isNotParty;

    return (
      <div className={`simple-deal-final-review${simple ? ' simple-deal-final-review--simple' : ''}`}>
        {!isCancelled && (
          <ReviewPanel
            deal={deal!}
            myRole={myRole as 'buyer' | 'seller' | 'middleman'}
            headers={authHdrs}
            variant={simple ? 'simple' : 'default'}
            onReviewed={() => { setCompletionReviewed(true); setCompletionSending(false); }}
            onRatedChange={setCompletionAllRated}
            onSubmitError={() => setCompletionSending(false)}
            externalSubmitTrigger={completionSubmitTrigger}
          />
        )}
        {alreadyDone ? (
          <button type="button" className="btn btn-soft btn-block btn-lg simple-deal-final-cta" onClick={() => router.push('/')}>
            🏠 เสร็จสิ้น-กลับหน้าหลัก
          </button>
        ) : (
          <AsyncButton
            type="button"
            className="btn btn-green btn-block btn-lg simple-deal-final-cta"
            disabled={!completionAllRated}
            loading={completionSending}
            onClick={() => { setCompletionSending(true); setCompletionSubmitTrigger(t => t + 1); }}
          >
            {`💾 ${completionBtnLabel}`}
          </AsyncButton>
        )}
        {simple && !isCancelled && (
          <DealOthersReviewsSummary dealId={deal!.id} headers={authHdrs} />
        )}
      </div>
    );
  }

  function renderFinanceSummaryCard() {
    const pd: DealPriceState = priceState || {};
    const md: MeetupData = meetup || {};
    const isMt = deal!.deal_type === 'meetup';
    const fb = computeDealFees(feeConfig, deal!.price, deal!.deal_type);
    const fp = String(deal!.fee_payer || pd.proposed_fee_payer || 'split');
    const sellerShare = fp === 'seller' ? fb.total : fp === 'split' ? Math.round(fb.total / 2) : 0;
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
      if (!accepted) btns.push({ label: '✅ ยอมรับเงื่อนไขข้อตกลง', cls: 'btn-green', fn: () => setShowTerms(true) });
      else return <p style={{ color: 'var(--green-600)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>✅ คุณยอมรับเงื่อนไขแล้ว — รอฝ่ายอื่น</p>;
    }
    if (s === 'payment_uploaded' && myRole === 'middleman') btns.push({ label: '✅ ยืนยันรับเงิน — เริ่มขั้นตอนแพ็คของ', cls: 'btn-green', fn: () => doAction('confirm_payment') });
    if (s === 'packing' && myRole === 'seller') btns.push({
      label: isSimple ? '📦 แพ็คเสร็จ — จัดส่งให้ผู้ซื้อโดยตรง' : '📦 แพ็คของเสร็จ — จัดส่งให้คนกลาง',
      cls: 'btn-green',
      fn: () => {
        const payload = getTrackingPayload();
        if (!payload) return;
        return doAction('seller_done_packing', payload);
      }
    });
    if (s === 'shipped_to_middleman' && myRole === 'middleman') btns.push({ label: '📬 รับสินค้าแล้ว', cls: 'btn-green', fn: () => doAction('middleman_received') });
    if (s === 'middleman_checking' && myRole === 'buyer' && !deal!.buyer_confirmed_check) btns.push({ label: '✅ ยืนยันสินค้าไม่มีปัญหา', cls: 'btn-green', fn: () => doAction('buyer_confirm_check') });
    if (s === 'middleman_checking' && myRole === 'middleman' && deal!.buyer_confirmed_check) btns.push({
      label: '🚚 จัดส่งให้ผู้ซื้อแล้ว',
      cls: 'btn-green',
      fn: () => {
        const payload = getTrackingPayload();
        if (!payload) return;
        return doAction('middleman_ship_to_buyer', payload);
      }
    });
    if (s === 'shipped_to_buyer' && myRole === 'buyer') btns.push({ label: '🎉 ได้รับสินค้าแล้ว — ดีลเสร็จสมบูรณ์', cls: 'btn-green', fn: () => doAction('buyer_received') });
    if (myRole === 'buyer' && s === 'buyer_joined' && !deal!.middleman_id && !isMeetup && !isSimple) btns.push({ label: showSelectMM ? 'ซ่อนการเลือกคนกลาง' : '🔎 เลือกคนกลาง', cls: 'btn-ghost', fn: () => setShowSelectMM(v => !v) });
    if (myRole === 'buyer' && !isSimple && deal!.middleman_id && ['terms_pending', 'payment_pending'].includes(s)) btns.push({ label: showSelectMM ? 'ซ่อนรายการคนกลาง' : '🔄 เลือกคนกลางใหม่', cls: 'btn-ghost', fn: () => setShowSelectMM(v => !v) });
    if (!isFinished && myRole !== 'guest') btns.push({ label: '❌ ยกเลิก', cls: 'btn-danger', fn: () => { const r = prompt('เหตุผล'); return doAction('cancel', { reason: r || '' }); } });

    if (btns.length === 0) return <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>ไม่มีการกระทำในขั้นตอนนี้</p>;
    return (
      <div className="dr-actions">
        {(['packing', 'middleman_checking'].includes(s) && (myRole === 'seller' || (myRole === 'middleman' && deal!.buyer_confirmed_check))) && (
          <div style={{ display: 'grid', gap: 8 }}>
            <select
              ref={trackingProviderRef}
              className="dr-select"
              value={trackingProviderInput}
              onChange={e => {
                setTrackingProviderInput(e.target.value);
                if (e.target.value.trim() && trackingInput.trim()) setShowTrackingRequired(false);
              }}
              style={{ border: `2px solid ${trackingProviderInput.trim() ? 'var(--blue-200)' : '#cf2038'}` }}
            >
              <option value="">เลือกผู้ให้บริการโลจิสติกส์</option>
              {TH_LOGISTICS_PROVIDERS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <input
              ref={trackingInputRef}
              type="text"
              className="dr-select"
              value={trackingInput}
              onChange={e => {
                setTrackingInput(e.target.value);
                if (trackingProviderInput.trim() && e.target.value.trim()) setShowTrackingRequired(false);
              }}
              placeholder="เลขพัสดุ / Tracking number"
              style={{ border: `2px solid ${trackingInput.trim() ? 'var(--blue-200)' : '#cf2038'}` }}
            />
          </div>
        )}
        {btns.map(b => <AsyncButton key={b.label} onClick={b.fn} disabled={acting} className={`btn ${b.cls} btn-block`}>{b.label}</AsyncButton>)}
      </div>
    );
  }

  // ─── Evidence panel ──────────────────────────────────────────────────────
  function renderEvidencePanel() {
    // flow ใหม่: ในขั้น payment_pending ทั้งผู้ซื้อและผู้ขายอัปโหลดหลักฐานได้ (แยกอิสระ)
    // ขั้นอื่น (packing/receive/check) → ตาม role เดิม (regular เท่านั้น)
    const canUp = ((myRole === 'seller' || myRole === 'buyer') && ['packing', 'shipped_to_middleman', 'payment_pending', 'payment_uploaded'].includes(deal!.status) && !(isSimple && ['payment_pending', 'payment_uploaded'].includes(deal!.status))) || (myRole === 'middleman' && ['middleman_received', 'middleman_checking'].includes(deal!.status));
    // โหมดง่าย: ผู้ซื้อต้องถ่ายวิดีโอก่อนแกะกล่องเมื่อของมาถึง
    const canBuyerUnbox = isSimple && myRole === 'buyer' && deal!.status === 'shipped_to_buyer';
    const typeLabel: Record<string, string> = { packing: '📦 แพ็คของ', testing: '🔧 ทดสอบ', receive: isDirectShipFlow ? '📬 วิดีโอก่อนแกะกล่อง (ผู้ซื้อ)' : '📬 รับสินค้า (คนกลาง)', check: '🔍 ตรวจสินค้า (คนกลาง)', chat: '💬 หลักฐานจากแชท', chat_text: '💬 ข้อความแชท', call: '📹 วิดีโอคอลที่บันทึก', other: '📎 หลักฐาน' };
    const items = evidence;
    // simple flow: อัปอะไรก็ได้ ไม่ต้องเลือกประเภท — เลือกประเภทเฉพาะ regular (ผู้ขาย/คนกลาง ในขั้น packing/receive/check)
    const needsTypeSelect = !isSimple && canUp && (myRole === 'seller' || myRole === 'middleman') && ['packing', 'shipped_to_middleman', 'middleman_received', 'middleman_checking'].includes(deal!.status);
    return (
      <div className="dr-evid-inner">
        {isDirectShipFlow && myRole === 'seller' && ['packing', 'shipped_to_middleman'].includes(deal!.status) && (
          <div className="dr-card" style={{ background: '#fff8ef', borderColor: '#ffe0b2' }}>
            <div style={{ fontSize: 13, color: '#8a5a00', lineHeight: 1.6 }}>⚡ ถ่ายวิดีโอทุกขั้นตอน เก็บจุดสำคัญ เช่น Serial Number และเลขชิป หากมีผลเทสต้องถ่ายประกอบ และเลขซีเรียลบนตัวสินค้ากับกล่อง/เอกสารต้องตรงกัน</div>
          </div>
        )}
        {canBuyerUnbox && (
          <div className="dr-card" style={{ background: '#fff8ef', borderColor: '#ffe0b2' }}>
            <div className="dr-card-title">📹 ถ่ายวิดีโอก่อนแกะกล่อง</div>
            <div style={{ fontSize: 13, color: '#8a5a00', lineHeight: 1.6, marginBottom: 8 }}>⚠️ ต้องถ่ายวิดีโอตอนแกะกล่องทุกครั้ง หากไม่มีวิดีโอก่อนแกะ จะถือว่าสินค้าถูกต้องและเรียกร้องกับผู้ขายไม่ได้</div>
            {renderVideoUploadHint({ marginBottom: 12 })}
            <button onClick={() => buyerEvidInputRef.current?.click()} className="btn btn-soft btn-block"><Icon name="upload" size={16} /> อัปโหลดวิดีโอก่อนแกะ</button>
            <input ref={buyerEvidInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={async e => { const files = Array.from(e.target.files || []); e.target.value = ''; for (const f of files) await uploadFile(f, true, 'receive'); }} />
          </div>
        )}
        {canUp && (
          <div className="dr-card">
            <div className="dr-card-title">อัปโหลดหลักฐาน</div>
            {needsTypeSelect && (
              <select className="dr-select" style={{ marginBottom: 12 }} value={evidenceType} onChange={e => setEvidenceType(e.target.value)}>
                {myRole === 'seller' && <><option value="packing">วิดีโอแพ็คของ</option><option value="testing">วิดีโอทดสอบ</option></>}
                {myRole === 'middleman' && <><option value="receive">วิดีโอรับสินค้า</option><option value="check">วิดีโอตรวจ</option></>}
              </select>
            )}
            {renderVideoUploadHint()}
            <button onClick={() => evidInputRef.current?.click()} className="btn btn-soft btn-block"><Icon name="upload" size={16} /> เลือกไฟล์ (รูป/วิดีโอ)</button>
            <input ref={evidInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={async e => { const files = Array.from(e.target.files || []); e.target.value = ''; for (const f of files) await uploadFile(f, true, isSimple ? 'other' : undefined); }} />
          </div>
        )}
        {items.length === 0 && !canUp && <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>ยังไม่มีหลักฐาน</p>}
        <div className="dr-evid-list">
          {items.map((item, i) => {
            const url = item.file_id ? fileUrl(item.file_id) : '';
            const isVid = item.file_name?.match(/\.(mp4|mov|avi|webm)$/i);
            const isImg = item.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
            // ลบได้เฉพาะไอเทมที่ตัวเองอัป และอยู่ในขั้นที่ยังแก้ไขได้
            const canDelete = canDeleteEvidenceItem(item);
            return (
              <div key={item.id || i} className="dr-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{typeLabel[item.type] || item.type}{item.uploader_name ? ` · ${item.uploader_name}` : ''}</span>
                  {canDelete && (
                    <button type="button" onClick={() => deleteEvidenceItem(item)} style={{ background: 'none', border: 'none', color: 'var(--rose-500)', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }} title="ลบและอัปใหม่">✕</button>
                  )}
                </div>
                {!item.file_id
                  ? <div style={{ fontSize: 14, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{item.content || '(ไม่มีข้อความ)'}</div>
                  : isDealVideoFile(item.file_name) ? <DealClickableMedia url={url} alt={item.file_name} label={typeLabel[item.type] || item.type} isVideo maxHeight={220} />
                  : isDealImageFile(item.file_name) ? <DealClickableMedia url={url} alt={item.file_name} label={typeLabel[item.type] || item.type} maxHeight={220} />
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
  // flow ใหม่ (simple 5 ขั้น): รูปสินค้าตอนสร้างดีล · ไม่มียืนยันเงื่อนไข/อัปหลักฐานก่อนโอน
  // 1=โอนเงิน, 2=รอทีมงานยืนยัน, 3=แพ็ค+จัดส่ง, 4=รับสินค้า, 5=จบ (ตัดขั้นรอโอนเงินออก — ไปจบเลยหลังยืนยันรับ)
  const WIZARD_STEP_TITLES = [
    'โอนเงิน', 'รอทีมงานยืนยัน',
    'แพ็ค+จัดส่ง', 'รับสินค้า', 'เสร็จสมบูรณ์',
  ];
  const WZ_TOTAL = WIZARD_STEP_TITLES.length;

  function getSimpleWizardStepTitle(step: number): string {
    const clamped = Math.max(1, Math.min(WZ_TOTAL, step));
    return WIZARD_STEP_TITLES[clamped - 1];
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Wizard ขั้นตอนดีล — "ซื้อขายผ่านกลางปลอดภัย" (deal_type === '' / regular) — 14 ขั้น
  // ═══════════════════════════════════════════════════════════════════════
  const REGULAR_WZ_TITLES = [
    'เลือกคนกลาง', 'ยอมรับเงื่อนไข', 'คุย/วิดีโอคอล', 'ตรวจหลักฐาน', 'ตกลงราคา',
    'โอนเงิน', 'ตรวจสอบการโอน', 'แพ็ค+จัดส่งคนกลาง', 'คนกลางรับสินค้า',
    'คนกลางตรวจสอบ', 'จัดส่งให้ผู้ซื้อ', 'ผู้ซื้อยืนยันรับ', 'โอนเงินให้ผู้ขาย', 'เสร็จสมบูรณ์',
  ];
  const RWZ_TOTAL = REGULAR_WZ_TITLES.length; // 14
  /** ขั้นที่มีศูนย์กลางเข้ามาเกี่ยวข้อง (1-indexed display step) — รับโอนเงิน + จ่ายเงินปลายทาง */
  const HUB_STEPS = new Set([6, 7, 13, 14]);

  /** คำนวณว่าตอนนี้อยู่ขั้นไหนของ wizard (1-10) จากสถานะที่มีอยู่จริง — ไม่เพิ่ม status ใหม่ในฐานข้อมูล */
  function getSimpleStep(): { step: number; outcome?: 'success' | 'cancelled' | 'disputed' } {
    const s = deal!.status;
    const pd: DealPriceState = priceState || {};
    if (['posted', 'waiting_seller', 'waiting_buyer', 'buyer_joined', 'terms_pending'].includes(s)) return { step: 0 };
    if (['payment_pending', 'payment_uploaded'].includes(s)) {
      const fb = computeDealFees(feeConfig, deal!.price, deal!.deal_type);
      const fp = String(deal!.fee_payer || pd.proposed_fee_payer || 'split');
      const sellerShare = fp === 'seller' ? fb.total : fp === 'split' ? Math.round(fb.total / 2) : 0;
      const myHasSlip = myRole === 'buyer' ? !!deal!.payment_slip_file_id
                      : myRole === 'seller' ? (sellerShare <= 0 || !!pd.seller_fee_slip)
                      : true;
      if (myHasSlip) return { step: 2 };
      return { step: 1 };
    }
    if (s === 'packing') return { step: 3 };
    if (s === 'shipped_to_buyer') return { step: 4 };
    if (s === 'completed') return { step: 5, outcome: 'success' };
    if (s === 'cancelled') return { step: 5, outcome: 'cancelled' };
    if (s === 'disputed') return { step: 5, outcome: 'disputed' };
    return { step: 0 };
  }

  const MARKETPLACE_WZ_STEPS = [2, 4, 5, 6, 7, 8] as const;
  const MARKETPLACE_WZ_TITLES = ['โอนเงิน', 'รอทีมงานยืนยัน', 'แพ็ค+จัดส่ง', 'รับสินค้า', 'โอนเงินให้ผู้ขาย', 'เสร็จสมบูรณ์'];

  function getMarketplaceCheckoutStep(): { step: number; outcome?: 'success' | 'cancelled' | 'disputed' } {
    const s = deal!.status;
    const pd: DealPriceState = priceState || {};
    if ((s === 'posted' || s === 'payment_pending') && deal!.buyer_id) {
      if (!deal!.payment_slip_file_id) return { step: 2 };
    }
    if (['payment_pending', 'payment_uploaded'].includes(s)) {
      if (!deal!.payment_slip_file_id) return { step: 2 };
      if (s === 'payment_uploaded') return { step: 4 };
      return { step: 2 };
    }
    if (s === 'packing') return { step: 5 };
    if (s === 'shipped_to_buyer') return { step: 6 };
    if (s === 'completed') return { step: pd.payout_slip_file_id ? 8 : 7, outcome: 'success' };
    if (s === 'cancelled') return { step: pd.refund_slip_file_id ? 8 : 7, outcome: 'cancelled' };
    if (s === 'disputed') return { step: 7, outcome: 'disputed' };
    return { step: 2 };
  }

  function renderMarketplaceProgress(step: number) {
    const idx = MARKETPLACE_WZ_STEPS.indexOf(step as typeof MARKETPLACE_WZ_STEPS[number]);
    const display = Math.max(1, idx >= 0 ? idx + 1 : 1);
    const total = MARKETPLACE_WZ_TITLES.length;
    const title = MARKETPLACE_WZ_TITLES[display - 1] || MARKETPLACE_WZ_TITLES[0];
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <b style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>ขั้นที่ {display} จาก {total} · {title}</b>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{Math.round((display / total) * 100)}%</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {MARKETPLACE_WZ_TITLES.map((t, i) => (
            <div key={t} style={{ flex: 1, height: 6, borderRadius: 4, background: i + 1 < display ? 'var(--green-500)' : i + 1 === display ? 'var(--accent)' : 'var(--line)', transition: 'background .3s' }} />
          ))}
        </div>
      </div>
    );
  }

  function getRegularStep(): { step: number; outcome?: 'success' | 'cancelled' | 'disputed' } {
    const s = deal!.status;
    const pd: DealPriceState = priceState || {};
    if (['posted', 'waiting_seller', 'waiting_buyer'].includes(s)) return { step: 0 };
    if (['buyer_joined', 'terms_pending'].includes(s)) {
      if (!deal!.middleman_id) return { step: 1 }; // ยังไม่เลือกคนกลาง
      const allAccepted = !!deal!.seller_accepted_terms && !!deal!.buyer_accepted_terms && !!deal!.middleman_accepted_terms;
      return { step: allAccepted ? 3 : 2 };
    }
    // regular flow เดิม — ไม่แตะ (focus ที่ simple)
    if (s === 'payment_pending') {
      const sellerRS = !!pd.chat_done_seller || !!pd.evidence_done_seller;
      const buyerRS = !!pd.chat_done_buyer || !!pd.evidence_done_buyer;
      const mmRS = !!pd.chat_done_middleman || !!pd.evidence_done_middleman;
      const reviewStarted = sellerRS && buyerRS && mmRS;
      const evReady = evidence.length > 0 && !!pd.evidence_done_buyer && !!pd.evidence_done_middleman;
      if (!reviewStarted) return { step: 3 };
      if (!evReady) return { step: 4 };
      return { step: 5 };
    }
    if (s === 'payment_uploaded') {
      const fb = computeDealFees(feeConfig, deal!.price, deal!.deal_type);
      const fp = String(deal!.fee_payer || pd.proposed_fee_payer || 'split');
      const sellerShare = fp === 'seller' ? fb.total : fp === 'split' ? Math.round(fb.total / 2) : 0;
      if (sellerShare > 0 && !pd.seller_fee_slip) return { step: 5 };
      return { step: 6 };
    }
    if (s === 'packing') return { step: 7 };
    if (s === 'shipped_to_middleman') return { step: 8 };
    if (['middleman_received', 'middleman_checking'].includes(s)) return { step: 9 };
    if (s === 'shipped_to_buyer') return { step: 10 };
    if (s === 'delivered') return { step: 11 };
    if (s === 'completed') return { step: pd.payout_slip_file_id ? 13 : 12, outcome: 'success' };
    if (s === 'cancelled') return { step: pd.refund_slip_file_id ? 13 : 12, outcome: 'cancelled' };
    if (s === 'disputed') return { step: 12, outcome: 'disputed' };
    return { step: 1 };
  }

  function renderWizardProgress(step: number) {
    const clamped = Math.max(1, Math.min(WZ_TOTAL, step));
    const title = getSimpleWizardStepTitle(clamped);
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <b style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>ขั้นที่ {clamped} จาก {WZ_TOTAL} · {title}</b>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{Math.round((clamped / WZ_TOTAL) * 100)}%</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {WIZARD_STEP_TITLES.map((t, i) => (
            <div key={t + i} title={t} style={{ flex: 1, height: 6, borderRadius: 4, background: i + 1 < clamped ? 'var(--green-500)' : i + 1 === clamped ? 'var(--accent)' : 'var(--line)', transition: 'background .3s' }} />
          ))}
        </div>
      </div>
    );
  }

  function renderRegularWizardProgress(step: number) {
    const clamped = Math.max(1, Math.min(RWZ_TOTAL, step));
    const isHub = HUB_STEPS.has(clamped);
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <b style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
            ขั้นที่ {clamped} จาก {RWZ_TOTAL} · {REGULAR_WZ_TITLES[clamped - 1]}
            {isHub && <span style={{ marginLeft: 6, fontSize: 10.5, background: '#e8f5e9', color: 'var(--green-700)', borderRadius: 99, padding: '1px 7px', fontWeight: 600, verticalAlign: 'middle' }}>🏦 ศูนย์กลาง</span>}
          </b>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{Math.round((clamped / RWZ_TOTAL) * 100)}%</span>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {REGULAR_WZ_TITLES.map((t, i) => (
            <div key={t} style={{ flex: 1, height: 5, borderRadius: 3, background: i + 1 < clamped ? 'var(--green-500)' : i + 1 === clamped ? (HUB_STEPS.has(i + 1) ? 'var(--green-600)' : 'var(--accent)') : 'var(--line)', transition: 'background .3s' }} />
          ))}
        </div>
      </div>
    );
  }

  function renderParticipantStatusRows(
    items: Array<{ roleLabel: string; name: string; ok: boolean; doneText: string; waitText?: string }>,
    opts?: { marginBottom?: number; gap?: number; fontSize?: number }
  ) {
    const marginBottom = opts?.marginBottom ?? 12;
    const gap = opts?.gap ?? 6;
    const fontSize = opts?.fontSize ?? 13.5;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap, marginBottom }}>
        {items.map(({ roleLabel, name, ok, doneText, waitText = '⏳ รอ' }) => (
          <div key={roleLabel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>{roleLabel}</div>
              <div style={{ color: 'var(--ink)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || '-'}</div>
            </div>
            <span style={{ color: ok ? 'var(--green-600)' : 'var(--faint)', flexShrink: 0 }}>{ok ? doneText : waitText}</span>
          </div>
        ))}
      </div>
    );
  }

  function getTrackingPayload(): { trackingNumber: string; trackingProvider: string } | null {
    const trackingNumber = trackingInput.trim();
    const trackingProvider = trackingProviderInput.trim();
    if (!trackingProvider) {
      setShowTrackingRequired(true);
      trackingProviderRef.current?.focus();
      alert('กรุณาเลือกผู้ให้บริการโลจิสติกส์ก่อน');
      return null;
    }
    if (!trackingNumber) {
      setShowTrackingRequired(true);
      trackingInputRef.current?.focus();
      alert('กรุณากรอกเลขพัสดุก่อนกดไปขั้นถัดไป');
      return null;
    }
    return { trackingNumber, trackingProvider };
  }

  function renderBuyerShippingCard(compact = false) {
    if (!buyerShipping) return null;
    const { name, phone, address } = buyerShipping;
    const missingContact = !phone && !address;
    return (
      <div className={`dr-card pack-shipping-card${compact ? ' pack-shipping-compact' : ''}`}>
        <div className="dr-card-title">📦 ที่อยู่ในการจัดส่ง</div>
        {missingContact ? (
          <p className="pack-shipping-empty">
            ผู้ซื้อยังไม่ได้บันทึกที่อยู่หรือเบอร์โทร — แจ้งให้อัปเดตที่หน้าโปรไฟล์ก่อนจัดส่ง
          </p>
        ) : (
          <div className="pack-shipping-fields">
            <div className="pack-shipping-row">
              <span className="pack-shipping-label">ชื่อผู้รับ</span>
              <span className="pack-shipping-value">{name}</span>
            </div>
            {address && (
              <div className={`pack-shipping-address${compact ? ' is-compact' : ''}`}>{address}</div>
            )}
            {phone && (
              <div className="pack-shipping-phone">
                <span className="pack-shipping-label">📞 เบอร์โทร</span>
                <a href={`tel:${phone}`} className="pack-shipping-phone-num">{phone}</a>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderTrackingInfoCard(title: string, trackingNumber?: string, trackingProvider?: string) {
    const cleanTrackingNumber = String(trackingNumber || '').trim();
    if (!cleanTrackingNumber) return null;
    const trackingUrl = buildTrackingUrl(trackingProvider, cleanTrackingNumber);
    return (
      <div className="dr-card">
        <div className="dr-card-title">📦 {title}</div>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>ผู้ให้บริการ</span>
            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{getLogisticsProviderLabel(trackingProvider)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>เลขพัสดุ</span>
            <span className="dr-track-code">{cleanTrackingNumber}</span>
          </div>
          {trackingUrl && (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-sm"
              style={{ width: '100%' }}
            >
              🔎 เช็คพัสดุ
            </a>
          )}
        </div>
      </div>
    );
  }

  function hasProgressPing(role: 'seller' | 'buyer' | 'middleman') {
    const roleLabel = role === 'seller' ? 'ผู้ขาย' : role === 'buyer' ? 'ผู้ซื้อ' : 'คนกลาง';
    return msgs.some(m => m.role === 'system' && typeof m.content === 'string' && m.content.includes(`${roleLabel}คุยรายละเอียดเสร็จแล้ว`));
  }

  // ─── ขั้น 0: รออีกฝ่ายเข้าร่วมดีล ────────────────────────────────────────
  function renderWizardStep0() {
    const waitingFor = !deal!.buyer_id ? 'ผู้ซื้อ' : 'ผู้ขาย';
    const sellerJoined = !!deal!.seller_id;
    const buyerJoined = !!deal!.buyer_id;
    return (
      <div className="dr-card" style={{ textAlign: 'center', padding: '34px 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>
        <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>รอ{waitingFor}เข้าร่วมดีล</div>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 18 }}>
          ส่งลิงก์นี้ให้{waitingFor}เพื่อเข้าร่วม — {isSimple ? 'เมื่อครบทั้งสองฝ่ายจะเข้าหน้าโอนเงินได้ทันที' : 'wizard จะเริ่มขั้นที่ 1 ทันทีที่ทั้งสองฝ่ายอยู่ในดีลครบ'}
        </p>
        {isSimple && deal!.fee_payer && (
          <div style={{ background: 'var(--accent-soft)', border: '1px solid #d7e3ff', borderRadius: 'var(--r-md)', padding: '10px 12px', marginBottom: 14, fontSize: 13, textAlign: 'left' }}>
            💸 ผู้จ่ายค่าบริการ: <strong>{deal!.fee_payer === 'buyer' ? 'ผู้ซื้อ' : deal!.fee_payer === 'seller' ? 'ผู้ขาย' : 'หารครึ่ง'}</strong> (กำหนดตอนสร้างดีล)
          </div>
        )}
        <div style={{ textAlign: 'left', marginBottom: 18 }}>
          {renderParticipantStatusRows([
            { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: sellerJoined, doneText: '✅ เข้าร่วมแล้ว', waitText: '⏳ รอเข้าร่วม' },
            { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: buyerJoined, doneText: '✅ เข้าร่วมแล้ว', waitText: '⏳ รอเข้าร่วม' },
          ], { marginBottom: 0 })}
        </div>
        <button onClick={copyLink} className="btn btn-soft btn-block">{copied ? '✅ คัดลอกลิงก์แล้ว' : '🔗 คัดลอกลิงก์แชร์'}</button>
      </div>
    );
  }

  // ─── ขั้น 1: ยอมรับเงื่อนไข ───────────────────────────────────────────────
  function renderWizardStep1() {
    const t = termsFor(deal!.deal_type);
    const fb = computeDealFees(feeConfig, deal!.price, deal!.deal_type);
    const meAccepted = (myRole === 'seller' && deal!.seller_accepted_terms) || (myRole === 'buyer' && deal!.buyer_accepted_terms);
    const pd: DealPriceState = priceState || {};
    
    // ตรวจสอบว่าทั้งสองฝ่ายเลือกผู้จ่ายค่าบริการตรงกันหรือไม่
    // ถ้า deal.fee_payer มีค่าแสดงว่าตกลงกันได้แล้ว (โชว์ค่าสุดท้าย)
    const isAgreed = !!deal?.fee_payer;
    // ฝั่งตัวเอง (mySelection): ถ้าผู้ใช้เคยเปลี่ยน (touched) ใช้ local state — กัน poll เขียนทับทำให้ highlight "เด้ง"
    //                  ถ้ายังไม่เคยเปลี่ยน ใช้ค่าจาก server (sync ครั้งแรก) หรือ default 'buyer'
    // ฝั่งอีกฝ่าย (otherSelection) ใช้ค่าจาก server (pd) ปกติ
    const serverMine = myRole === 'buyer' ? pd.fee_payer_selection_buyer : myRole === 'seller' ? pd.fee_payer_selection_seller : null;
    const mySelection = isAgreed
      ? (deal!.fee_payer as 'buyer' | 'seller' | 'split')
      : (feePayerTouched.current
          ? myFeePayer
          : (serverMine || 'buyer')) as 'buyer' | 'seller' | 'split';
    const otherSelection = isAgreed
      ? (deal!.fee_payer as 'buyer' | 'seller' | 'split')
      : (myRole === 'buyer' ? pd.fee_payer_selection_seller : myRole === 'seller' ? pd.fee_payer_selection_buyer : pd.fee_payer_selection_buyer);
    const bothSelected = !!mySelection && !!otherSelection;
    const selectionsMatch = !!mySelection && !!otherSelection && mySelection === otherSelection;

    // เปิด popup ยืนยันก่อนเปลี่ยนค่า (กดค่าเดิมไม่ต้อง popup)
    const requestChangeSelection = (selection: 'buyer' | 'seller' | 'split') => {
      if (meAccepted || isAgreed || selection === mySelection) return;
      setPendingFeePayer(selection);
    };
    const confirmChangeSelection = async () => {
      if (!pendingFeePayer) return;
      const next = pendingFeePayer;
      setPendingFeePayer(null);
      feePayerTouched.current = true;     // mark touched — จากนี้ไม่ให้ server เขียนทับ
      setMyFeePayer(next);                // local ทันที — highlight ไม่เด้ง
      await doAction('select_fee_payer', { feePayer: next });
    };

    // ชื่อการเลือก
    const getSelectionLabel = (selection?: string) => {
      if (selection === 'buyer') return 'ผู้ซื้อ';
      if (selection === 'seller') return 'ผู้ขาย';
      if (selection === 'split') return 'หารครึ่ง';
      return '';
    };

    // ปุ่มยอมรับเงื่อนไขจะ enable ก็ต่อเมื่อทั้งสองฝ่ายเลือกตรงกัน
    const canAcceptTerms = bothSelected && selectionsMatch;
    
    return (
      <div className="dr-card">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 38, marginBottom: 6 }}>📋</div>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>อ่านและยอมรับเงื่อนไขก่อนเริ่มดีล</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{t.name}</p>
        </div>
        <div className="simple-step1-slider-frame">
          <img
            key={SIMPLE_DEAL_STEP1_SLIDES[simpleDealIntroSlide]}
            src={SIMPLE_DEAL_STEP1_SLIDES[simpleDealIntroSlide]}
            alt={`ภาพอธิบายเงื่อนไขดีลแบบง่าย ${simpleDealIntroSlide + 1}`}
            className="simple-step1-slider-image"
          />
        </div>
        <div className="svc-simple-slider-dots" aria-label="ตัวเลือกภาพเงื่อนไขดีลแบบง่าย" style={{ marginBottom: 16 }}>
          {SIMPLE_DEAL_STEP1_SLIDES.map((slide, index) => (
            <button
              key={slide}
              type="button"
              className={`svc-simple-slider-dot${index === simpleDealIntroSlide ? ' is-active' : ''}`}
              onClick={() => setSimpleDealIntroSlide(index)}
              aria-label={`ดูภาพเงื่อนไข ${index + 1}`}
              aria-pressed={index === simpleDealIntroSlide}
            />
          ))}
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>💸 ค่าบริการโดยประมาณ (มูลค่า ฿{deal!.price.toLocaleString()})</div>
          {fb.lines.map(l => (<div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', padding: '2px 0' }}><span>{l.label}</span><span>฿{l.amount.toLocaleString()}</span></div>))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--ink)', borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}><span>รวมค่าบริการ</span><span>฿{fb.total.toLocaleString()}</span></div>
        </div>
        
        {/* เลือกผู้จ่ายค่าบริการ */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>🎯 เลือกผู้จ่ายค่าบริการ</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['buyer', 'seller', 'split'] as const).map((option) => {
              const isSelected = mySelection === option;
              return (
              <button
                key={option}
                type="button"
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: 'var(--r-md)',
                  border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--line)'}`,
                  background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: isSelected ? '#fff' : 'var(--ink)',
                  opacity: acting ? 0.5 : 1,
                }}
                onClick={() => requestChangeSelection(option)}
                disabled={meAccepted || isAgreed || acting}
              >
                {getSelectionLabel(option)}
              </button>
            );})}
          </div>
          {/* แสดงสถานะการเลือกของทั้งสองฝ่าย — ฝั่งตัวเองจาก local state, ฝั่งอีกฝ่ายจาก server */}
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>{myRole === 'seller' ? 'ผู้ขาย (คุณ):' : 'ผู้ขาย:'}</span>
              <span style={{ fontWeight: 600 }}>
                {isAgreed
                  ? getSelectionLabel(deal!.fee_payer)
                  : (myRole === 'seller' ? getSelectionLabel(mySelection || undefined) || '⏳ ยังไม่ได้เลือก' : (pd.fee_payer_selection_seller ? getSelectionLabel(pd.fee_payer_selection_seller) : '⏳ ยังไม่ได้เลือก'))}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{myRole === 'buyer' ? 'ผู้ซื้อ (คุณ):' : 'ผู้ซื้อ:'}</span>
              <span style={{ fontWeight: 600 }}>
                {isAgreed
                  ? getSelectionLabel(deal!.fee_payer)
                  : (myRole === 'buyer' ? getSelectionLabel(mySelection || undefined) || '⏳ ยังไม่ได้เลือก' : (pd.fee_payer_selection_buyer ? getSelectionLabel(pd.fee_payer_selection_buyer) : '⏳ ยังไม่ได้เลือก'))}
              </span>
            </div>
            {isAgreed ? (
              <div style={{ marginTop: 8, color: 'var(--success)', fontWeight: 600, fontSize: 12, textAlign: 'center' }}>
                ✅ ทั้งสองฝ่ายตกลงผู้จ่ายค่าบริการตรงกันแล้ว
              </div>
            ) : bothSelected && !selectionsMatch ? (
              <div style={{ marginTop: 8, color: '#b45309', fontWeight: 600, fontSize: 12, textAlign: 'center' }}>
                ⚠️ ทั้งสองฝ่ายเลือกคนละแบบ กรุณาเลือกให้ตรงกันก่อน
              </div>
            ) : (mySelection || otherSelection) ? (
              <div style={{ marginTop: 8, color: 'var(--accent)', fontWeight: 600, fontSize: 12, textAlign: 'center' }}>
                ⏳ รออีกฝ่ายเลือกให้ตรงกัน
              </div>
            ) : null}
          </div>
        </div>

        {/* popup ยืนยันการเปลี่ยนผู้จ่ายค่าบริการ */}
        {pendingFeePayer && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setPendingFeePayer(null)}>
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-lg)', padding: 20, maxWidth: 360, width: '100%', boxShadow: 'var(--sh-lg)' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>ยืนยันการเปลี่ยน</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 16 }}>
                เปลี่ยนผู้จ่ายค่าบริการเป็น <b style={{ color: 'var(--ink)' }}>{getSelectionLabel(pendingFeePayer)}</b> ใช่ไหม?
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-block" style={{ background: 'var(--surface-2)' }} onClick={() => setPendingFeePayer(null)}>ยกเลิก</button>
                <AsyncButton className="btn btn-green btn-block" onClick={confirmChangeSelection}>ยืนยัน</AsyncButton>
              </div>
            </div>
          </div>
        )}
        
        {renderParticipantStatusRows([
          { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: deal!.seller_accepted_terms, doneText: '✅ ยอมรับแล้ว' },
          { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: deal!.buyer_accepted_terms, doneText: '✅ ยอมรับแล้ว' },
        ], { marginBottom: 16 })}
        {!meAccepted
          ? <AsyncButton 
              className="btn btn-green btn-block btn-lg" 
              onClick={() => doAction('accept_terms')}
              disabled={!canAcceptTerms}
            >
              {canAcceptTerms ? '✅ ยอมรับเงื่อนไข' : '⏳ เลือกผู้จ่ายค่าบริการให้ตรงกันก่อน'}
            </AsyncButton>
          : <p style={{ fontSize: 13.5, color: 'var(--green-600)', textAlign: 'center' }}>✅ คุณยอมรับเงื่อนไขแล้ว — รออีกฝ่าย</p>}
      </div>
    );
  }

  // ─── ขั้นตกลงราคา-สินค้าและค่าบริการ (เฉพาะส่วนราคา ไม่รวมแชท) ─────────────
  function renderWizardStepPrice() {
    const pd: DealPriceState = priceState || {};
    const fpName = (fp?: string) => fp === 'seller' ? 'ผู้ขายจ่าย' : fp === 'split' ? 'หารครึ่ง' : 'ผู้ซื้อจ่าย';
    const currentPrice = pd.proposed_price || deal!.price;
    const currentFeePayer = (pd.proposed_fee_payer || deal!.fee_payer || 'split') as 'buyer' | 'seller' | 'split';
    const selectedFeePayer = feePayerInput || currentFeePayer;
    const sellerReady = !!pd.seller_agreed;
    const buyerReady = !!pd.buyer_agreed;
    const middlemanReady = !!pd.middleman_agreed;
    const isRegularDeal = deal!.deal_type !== 'simple';
    const hasMm = !!deal!.middleman_id;
    const meReady = myRole === 'seller' ? sellerReady : myRole === 'buyer' ? buyerReady : middlemanReady;

    return (
      <div className="dr-card">
        <div className="dr-card-title">💰 ตกลงราคาสินค้าและค่าบริการ</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
          {isRegularDeal
            ? 'หลังคุยกันและตรวจหลักฐานครบแล้ว ให้ตกลงราคาและผู้จ่ายค่าบริการก่อนเข้าสู่ขั้นตอนโอนเงิน'
            : 'ยืนยันราคาและผู้จ่ายค่าบริการก่อนเริ่มคุยรายละเอียดสินค้า'}
        </p>

        {(() => {
          const _fb = computeDealFees(feeConfig, currentPrice, deal!.deal_type);
          const _half = Math.round(_fb.total / 2);
          const feeLabel = currentFeePayer === 'split'
            ? `หารครึ่ง (คนละ ฿${_half.toLocaleString()})`
            : fpName(currentFeePayer);
          return (
            <div style={{ background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--line))', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}><span>ราคาปัจจุบัน</span><span>฿{currentPrice.toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', marginTop: 2 }}><span>ค่าบริการรวม ฿{_fb.total.toLocaleString()}</span><span>{feeLabel}</span></div>
            </div>
          );
        })()}

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
              <AsyncButton className="btn btn-green btn-block btn-sm" disabled={acting} onClick={() => { const p = Math.round(Number(priceInput)); if (!(p >= 1)) { alert('กรอกราคาให้ถูกต้อง'); return; } doAction('price_propose', { price: p, feePayer: selectedFeePayer }); setShowPriceProposal(false); }}>ส่งข้อเสนอ</AsyncButton>
              <button type="button" className="btn btn-ghost btn-block btn-sm" onClick={() => setShowPriceProposal(false)}>ยกเลิก</button>
            </div>
          </div>
        )}

        {renderParticipantStatusRows([
          { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: sellerReady, doneText: '✅ ตกลงแล้ว' },
          { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: buyerReady, doneText: '✅ ตกลงแล้ว' },
          ...(isRegularDeal && hasMm ? [{ roleLabel: 'คนกลาง', name: deal!.middleman_name || '-', ok: middlemanReady, doneText: '✅ รับทราบแล้ว' }] : []),
        ], { marginBottom: 12 })}

        {!meReady
          ? <AsyncButton className="btn btn-green btn-block btn-lg" onClick={() => doAction('price_agree', { feePayer: selectedFeePayer })}>✅ ตกลงราคานี้ — ไปขั้นโอนเงิน</AsyncButton>
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
    if (small) {
      // ปุ่มใต้รูป — ดีไซน์เป็น pill button ชัดเจน สวยงาม
      return (
        <button
          type="button"
          onClick={() => !saved && saveMsgEvidence(m)}
          disabled={acting || saved}
          style={{
            marginTop: 5,
            fontSize: 11.5,
            fontWeight: 600,
            color: saved ? '#15803d' : '#fff',
            background: saved ? '#dcfce7' : 'var(--accent)',
            border: saved ? '1.5px solid #86efac' : '1.5px solid transparent',
            borderRadius: 20,
            cursor: saved ? 'default' : 'pointer',
            padding: '4px 12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            boxShadow: saved ? 'none' : '0 1px 4px rgba(47,107,240,.25)',
            letterSpacing: 0.2,
          }}
        >
          {saved ? '✅ บันทึก' : '📌 เก็บหลักฐาน'}
        </button>
      );
    }
    return (
      <button type="button" onClick={() => !saved && saveMsgEvidence(m)} disabled={acting || saved}
        style={{ fontSize: 10.5, color: saved ? 'var(--green-600)' : 'var(--accent)', background: 'none', border: 'none', cursor: saved ? 'default' : 'pointer', padding: '2px 0 0', display: 'block', opacity: saved ? 1 : undefined }}>
        {saved ? '✅ บันทึก' : '📌 เก็บหลักฐาน'}
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

  async function bundleChatTranscriptAsEvidence() {
    const lines = msgs.filter(m => m.role !== 'system' && m.type === 'text' && m.content?.trim());
    if (lines.length === 0) return;
    let transcript = lines.map(m => `${m.sender_name || '-'} (${new Date(m.created_at).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}): ${m.content}`).join('\n');
    if (transcript.length > 4000) transcript = `…(ตัดข้อความเก่าบางส่วน)\n${transcript.slice(-4000)}`;
    await doAction('add_evidence', { evidenceType: 'chat_text', content: transcript });
  }

  // ─── ขั้น 3: คุย/วิดีโอคอลรายละเอียดสินค้า ────────────────────────────────
  function renderWizardStepChat(nextStep = 4) {
    const pd: DealPriceState = priceState || {};
    // ใช้ chat_done_* จาก priceState แทน hasProgressPing (system message เก่าค้างใน DB ทำให้ step ขึ้นเอง)
    const sellerChatReady = !!pd.chat_done_seller || (myRole === 'seller' && chatReviewReady);
    const buyerChatReady = !!pd.chat_done_buyer || (myRole === 'buyer' && chatReviewReady);
    const middlemanChatReady = !!pd.chat_done_middleman || (myRole === 'middleman' && chatReviewReady);
    const isRegularDeal = deal!.deal_type !== 'simple';
    const hasMm = !!deal!.middleman_id;
    const meChatReady = myRole === 'seller' ? sellerChatReady : myRole === 'buyer' ? buyerChatReady : myRole === 'middleman' ? middlemanChatReady : false;
    const allChatReady = sellerChatReady && buyerChatReady && (!isRegularDeal || !hasMm || middlemanChatReady);
    // หลักฐานที่ฝ่ายตัวเองอัพโหลดในขั้นนี้ (type chat/chat_text/call จากทุกฝ่าย + รูป/วิดีโอที่ตัวเองอัพ)
    const myEvidence = evidence.filter(e => e.type === 'chat' || e.type === 'chat_text' || e.type === 'call' || e.uploaded_by === myId);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dr-card" style={{ background: '#fff8ef', borderColor: '#ffe0b2' }}>
          <div style={{ fontSize: 13, color: '#8a5a00', lineHeight: 1.6 }}>
            {isRegularDeal
              ? '💬 ใช้ปุ่ม แชท / โทร / วิดีโอ ด้านล่างจอ คุยรายละเอียดสินค้าแบบ 3 ฝ่าย แล้วอัปโหลดรูป/วิดีโอหลักฐานด้านล่างนี้ — พอครบแล้วกด "แนบหลักฐานครบแล้ว" เพื่อไปตรวจหลักฐาน'
              : '💬 ใช้ปุ่ม แชท / โทร / วิดีโอ ด้านล่างจอ คุยรายละเอียดสินค้า แล้วอัปโหลดรูป/วิดีโอหลักฐานด้านล่างนี้ — พอครบแล้วกด "แนบหลักฐานครบแล้ว" เพื่อไปตรวจหลักฐานและยืนยัน'}
          </div>
        </div>
        {/* พื้นที่อัปโหลดรูป/วิดีโอหลักฐาน (แทนกล่องแชทเดิม) */}
        <div className="dr-card">
          <div className="dr-card-title">📸 อัปโหลดรูป/วิดีโอหลักฐาน</div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
            ถ่ายรูป/วิดีโอสภาพสินค้า จุดสำคัญ (Serial Number, รอย, อุปกรณ์ครบกล่อง) เพื่อใช้ตัดสินกรณีมีปัญหา
          </p>
          <button onClick={() => evidInputRef.current?.click()} className="btn btn-soft btn-block" style={{ marginBottom: 10 }}>
            <Icon name="upload" size={16} /> เลือกรูป/วิดีโอหลักฐาน
          </button>
          <input ref={evidInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={async e => { const files = Array.from(e.target.files || []); e.target.value = ''; for (const f of files) { if (!isVideoFile(f) && f.size > 50 * 1024 * 1024) { alert(`${f.name} ใหญ่เกิน 50MB`); continue; } await uploadFile(f, true, 'chat'); } }} />
          {myEvidence.length > 0 ? (
            <div className="dr-evid-list">
              {myEvidence.map((item, i) => {
                const url = item.file_id ? fileUrl(item.file_id) : '';
                const isVid = item.file_name?.match(/\.(mp4|mov|avi|webm)$/i);
                const isImg = item.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                return (
                  <div key={item.id || i} className="dr-card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                      {item.type === 'chat' ? '💬 หลักฐานจากแชท' : item.type === 'chat_text' ? '💬 ข้อความแชท' : item.type === 'call' ? '📹 วิดีโอคอล' : '📸 หลักฐาน'}{item.uploader_name ? ` · ${item.uploader_name}` : ''}
                    </div>
                    {!item.file_id
                      ? <div style={{ fontSize: 14, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{item.content || '(ไม่มีข้อความ)'}</div>
                      : isDealVideoFile(item.file_name) ? <DealClickableMedia url={url} alt={item.file_name} label={item.type} isVideo maxHeight={200} />
                      : isDealImageFile(item.file_name) ? <DealClickableMedia url={url} alt={item.file_name} label={item.file_name} maxHeight={200} />
                      : <a href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', fontSize: 14 }}>📎 {item.file_name || 'เปิดไฟล์'}</a>}
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 12.5, padding: '14px 0' }}>ยังไม่มีหลักฐาน — แตะปุ่มด้านบนเพื่อเพิ่ม</p>
          )}
        </div>
        <div className="dr-card">
          {renderParticipantStatusRows([
            { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: sellerChatReady, doneText: '✅ ยืนยันแล้ว' },
            { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: buyerChatReady, doneText: '✅ ยืนยันแล้ว' },
            ...(isRegularDeal && hasMm ? [{ roleLabel: 'คนกลาง', name: deal!.middleman_name || '-', ok: middlemanChatReady, doneText: '✅ ยืนยันแล้ว' }] : []),
          ], { marginBottom: 12 })}
          {!meChatReady ? (
            <AsyncButton className="btn btn-green btn-block btn-lg" onClick={async () => {
              const hadBundledChat = chatBundledRef.current;
              if (!hadBundledChat) {
                chatBundledRef.current = true;
                await bundleChatTranscriptAsEvidence();
              }
              const nextDeal = await doAction('progress_ping', { stage: 'to_evidence' });
              if (!nextDeal) {
                if (!hadBundledChat) chatBundledRef.current = false;
                return;
              }
              setChatReviewReady(true);
              // ไม่ setWzViewStep ทันที — รออีกฝ่ายกดยืนยันก่อน
              // เมื่อทั้งคู่กดแล้ว getSimpleStep() จะ return step 3 อัตโนมัติ
            }}>✅ แนบหลักฐานครบแล้ว — ไปตรวจหลักฐาน</AsyncButton>
          ) : allChatReady ? (
            <button className="btn btn-green btn-block btn-lg" onClick={() => setWzViewStep(nextStep)}>✅ ทุกฝ่ายยืนยันแล้ว — ไปขั้นถัดไป</button>
          ) : (
            <p style={{ fontSize: 13.5, color: 'var(--green-600)', textAlign: 'center' }}>✅ คุณยืนยันแล้ว — รออีกฝ่ายยืนยัน</p>
          )}
        </div>
      </div>
    );
  }

  // ─── ขั้น 4: ตรวจหลักฐาน + ยืนยัน ─────────────────────────────────────────
  // logic ใหม่: ผู้ขายอัพโหลดหลักฐาน (รูป/วิดีโอ) / ผู้ซื้อกดยืนยัน / คนกลางยืนยัน (regular)
  // ผู้ซื้อสามารถขอหลักฐานเพิ่มเติมจากผู้ขายได้ (พร้อมระบุรายละเอียด)
  // ─── ขั้น 5 ใหม่: อัปโหลดหลักฐาน (แยกอิสระ — ทั้งผู้ขายและผู้ซื้ออัปได้) ───────────────
  function renderWizardStepEvidenceUpload() {
    const pd: DealPriceState = priceState || {};
    const myHasEvidence = myId ? evidence.some(e => e.uploaded_by === myId) : false;
    const myEvidenceDone = myRole === 'buyer' ? !!pd.evidence_done_buyer : myRole === 'seller' ? !!pd.evidence_done_seller : false;
    const otherRole = myRole === 'buyer' ? 'ผู้ขาย' : myRole === 'seller' ? 'ผู้ซื้อ' : '';
    const otherEvidenceDone = myRole === 'buyer' ? !!pd.evidence_done_seller : myRole === 'seller' ? !!pd.evidence_done_buyer : false;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dr-card">
          <div className="dr-card-title">📁 อัปโหลดหลักฐาน</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4, lineHeight: 1.6 }}>
            {myRole === 'seller'
              ? 'อัปโหลดรูปสินค้า หลักฐานการแชท วิดีโอคอล หรือหลักฐานอื่นๆ ที่เกี่ยวข้องกับดีลนี้'
              : myRole === 'buyer'
                ? 'อัปโหลดหลักฐานการแชท รายละเอียดโพสสินค้าของผู้ขาย หรือหลักฐานอื่นๆ ที่เกี่ยวข้องกับดีลนี้'
                : 'อัปโหลดหลักฐานที่เกี่ยวข้องกับดีลนี้'}
          </p>
        </div>
        {renderEvidencePanel()}
        <div className="dr-card">
          <div style={{ fontSize: 13.5, fontWeight: 600, color: myEvidenceDone ? 'var(--green-600)' : (myHasEvidence ? 'var(--ink)' : 'var(--muted)'), textAlign: 'center', marginBottom: 4 }}>
            {myEvidenceDone ? '✅ คุณยืนยันหลักฐานแล้ว' : myHasEvidence ? '✅ คุณอัปหลักฐานแล้ว — กดยืนยันเพื่อไปขั้นถัดไป' : '⏳ คุณยังไม่ได้อัปหลักฐาน'}
          </div>
          <div style={{ fontSize: 12.5, color: otherEvidenceDone ? 'var(--green-600)' : 'var(--muted)', textAlign: 'center' }}>
            {otherEvidenceDone ? `✅ ${otherRole}ยืนยันหลักฐานแล้ว` : `⏳ รอ${otherRole}อัป+ยืนยันหลักฐาน (ไม่ต้องรอ — ทำฝั่งตัวเองได้เลย)`}
          </div>
        </div>
        {/* ปุ่มยืนยันหลักฐาน — ฝั่งตัวเองอัป ≥1 แล้วกดยืนยัน → ไป step 4 (รอทีมงานยืนยัน) ไม่ต้องรออีกฝ่าย */}
        {!myEvidenceDone && (
          <AsyncButton
            className="btn btn-green btn-block btn-lg"
            disabled={!myHasEvidence}
            onClick={async () => {
              await doAction('evidence_done');
            }}
          >
            {myHasEvidence ? '✅ ยืนยันหลักฐาน — ไปขั้นถัดไป' : '⏳ อัปหลักฐานอย่างน้อย 1 ชิ้นก่อน'}
          </AsyncButton>
        )}
        {myEvidenceDone && (
          <p style={{ fontSize: 13.5, color: 'var(--green-600)', textAlign: 'center' }}>✅ คุณยืนยันหลักฐานแล้ว — รอทีมงานตรวจสอบ</p>
        )}
      </div>
    );
  }

  function renderWizardStepEvidenceReview(nextStep = 5) {
    const pd: DealPriceState = priceState || {};
    const buyerDone = !!pd.evidence_done_buyer;
    const middlemanDone = !!pd.evidence_done_middleman;
    const isRegularDeal = deal!.deal_type !== 'simple';
    const hasMm = !!deal!.middleman_id;
    const hasEvidence = evidence.length > 0;
    // ผู้ขายไม่ต้องกดยืนยัน (เป็นฝ่ายอัปโหลด) → auto-true เมื่อมีหลักฐาน, คนกลาง/ผู้ซื้อต้องกด
    const meIsConfirmer = myRole === 'buyer' || myRole === 'middleman';
    const meDone = myRole === 'seller' ? hasEvidence : (myRole === 'buyer' ? buyerDone : middlemanDone);
    const allConfirmed = hasEvidence && buyerDone && (!isRegularDeal || !hasMm || middlemanDone);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dr-card">
          <div className="dr-card-title">📁 ตรวจหลักฐานก่อนโอนเงิน</div>
          {myRole === 'seller' ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4, lineHeight: 1.6 }}>
              คุณเป็นผู้ขาย → อัปโหลดรูป/วิดีโอสินค้าด้านล่างให้ครบ เพื่อให้ผู้ซื้อ{hasMm ? 'และคนกลาง' : ''}ตรวจและยืนยัน จึงจะไปโอนเงินต่อได้
            </p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4, lineHeight: 1.6 }}>
              ตรวจดูรูป/วิดีโอสินค้าที่ผู้ขายอัปโหลดด้านล่าง ถ้าถูกต้องครบถ้วนให้กดยืนยัน — หรือกด &quot;ขอหลักฐานเพิ่ม&quot; ถ้าอยากดูมุม/จุดเพิ่มเติม
            </p>
          )}
        </div>
        {renderEvidencePanel()}
        <div className="dr-card">
          {renderParticipantStatusRows([
            { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: hasEvidence, doneText: hasEvidence ? '✅ อัปโหลดแล้ว' : '⏳ รออัปโหลด' },
            { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: buyerDone, doneText: '✅ ยืนยันถูกต้องแล้ว' },
            ...(isRegularDeal && hasMm ? [{ roleLabel: 'คนกลาง', name: deal!.middleman_name || '-', ok: middlemanDone, doneText: '✅ ยืนยันถูกต้องแล้ว' }] : []),
          ])}

          {/* ─── ฝั่งผู้ขาย: แค่รอผู้ซื้อยืนยัน (ไม่มีปุ่มยืนยัน) ─── */}
          {myRole === 'seller' && (
            <p style={{ fontSize: 13.5, color: 'var(--muted)', textAlign: 'center', marginBottom: 10 }}>
              {hasEvidence ? '✅ อัปโหลดหลักฐานแล้ว — รอผู้ซื้อ' + (hasMm ? 'และคนกลาง' : '') + 'ยืนยัน' : '⚠️ อัปโหลดหลักฐานอย่างน้อย 1 รายการด้านบน'}
            </p>
          )}

          {/* ─── ฝั่งผู้ซื้อ/คนกลาง: ปุ่มขอหลักฐานเพิ่ม + ปุ่มยืนยัน ─── */}
          {meIsConfirmer && !meDone && (
            <>
              {/* ปุ่ม/ช่อง ขอหลักฐานเพิ่ม */}
              {!showRequestEvidence ? (
                <button type="button" className="btn btn-ghost btn-block" style={{ marginBottom: 10 }}
                  onClick={() => setShowRequestEvidence(true)}>
                  🔍 ขอหลักฐานเพิ่มเติม
                </button>
              ) : (
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 6 }}>ระบุรายละเอียดที่อยากให้ผู้ขายถ่ายเพิ่ม:</div>
                  <textarea
                    value={requestEvidenceDetail}
                    onChange={e => setRequestEvidenceDetail(e.target.value)}
                    placeholder="เช่น ขอวิดีโอเปิดเครื่องทดสอบ, ขอถ่ายซีเรียลชัดๆ, ขอดูกล่องทั้งหมด"
                    rows={2}
                    maxLength={300}
                    style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'vertical', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <AsyncButton className="btn btn-green btn-sm" style={{ flex: 1 }} onClick={async () => {
                      const nextDeal = await doAction('request_evidence', { detail: requestEvidenceDetail.trim() });
                      if (nextDeal) {
                        setShowRequestEvidence(false);
                        setRequestEvidenceDetail('');
                      }
                    }}>📤 ส่งคำขอ</AsyncButton>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowRequestEvidence(false); setRequestEvidenceDetail(''); }}>ยกเลิก</button>
                  </div>
                </div>
              )}

              {/* ปุ่มยืนยันหลักฐาน — disabled ถ้ายังไม่มีหลักฐานเลย */}
              <AsyncButton className="btn btn-green btn-block btn-lg" disabled={!hasEvidence}
                onClick={async () => {
                  const previousPriceState = priceState || {};
                  setPriceState(prev => ({
                    ...(prev || {}),
                    evidence_done_buyer: myRole === 'buyer' ? true : !!prev?.evidence_done_buyer,
                    evidence_done_middleman: myRole === 'middleman' ? true : !!prev?.evidence_done_middleman,
                  }));
                  const nextDeal = await doAction('evidence_done');
                  if (!nextDeal) { setPriceState(previousPriceState); return; }
                  const fresh = await fetch(`/api/deals/${dealId}`, { headers: await getAuthHeaders(true), cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
                  const freshPd: DealPriceState = fresh?.priceState || {};
                  if (hasEvidence && freshPd.evidence_done_buyer && (!isRegularDeal || !hasMm || freshPd.evidence_done_middleman)) {
                    setWzViewStep(nextStep);
                  }
                }}>
                {hasEvidence ? '✅ ตรวจแล้ว ถูกต้อง — ยืนยัน' : '⚠️ ยังไม่มีหลักฐานให้ตรวจ'}
              </AsyncButton>
            </>
          )}

          {/* ─── คนที่ยืนยันแล้ว — แสดงสถานะรอ/ไปต่อ ─── */}
          {meIsConfirmer && meDone && (
            allConfirmed
              ? <button className="btn btn-green btn-block btn-lg" onClick={() => setWzViewStep(nextStep)}>✅ ทุกฝ่ายยืนยันแล้ว — ไปโอนเงิน →</button>
              : <p style={{ fontSize: 13.5, color: 'var(--green-600)', textAlign: 'center', marginBottom: 10 }}>✅ คุณยืนยันแล้ว — รอ{hasMm && myRole === 'buyer' ? 'คนกลาง' : 'ผู้ซื้อ'}ยืนยัน</p>
          )}
        </div>
      </div>
    );
  }

  // ─── ขั้น 4: ส่วนกลางตรวจสอบและอนุมัติ (รอ — ไม่มีปุ่มฝั่งผู้ใช้) ──────────
  function renderWizardStep4() {
    const pd: DealPriceState = priceState || {};
    const fb = computeDealFees(feeConfig, deal!.price, deal!.deal_type);
    const fp = String(deal!.fee_payer || pd.proposed_fee_payer || 'split');
    const sellerShare = fp === 'seller' ? fb.total : fp === 'split' ? Math.round(fb.total / 2) : 0;
    const sellerPaymentDone = sellerShare <= 0 ? true : !!pd.seller_fee_slip;
    return (
      <div className="dr-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
        <div style={{ fontSize: 38, marginBottom: 10 }}>🔍</div>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>ทีมงานกำลังตรวจสอบการโอนเงิน</div>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 16 }}>ศูนย์กลางกำลังตรวจสลิปที่อัปโหลดไว้ — เมื่อยืนยันรับเงินแล้ว ผู้ขายจะเริ่มแพ็คสินค้าได้ทันที</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {deal!.payment_slip_file_id && (
            <DealClickableMedia url={fileUrl(deal!.payment_slip_file_id)} alt="สลิปผู้ซื้อ" label="สลิปผู้ซื้อ" maxHeight={180} />
          )}
          {pd.seller_fee_slip && (
            <DealClickableMedia url={fileUrl(pd.seller_fee_slip)} alt="สลิปผู้ขาย" label="สลิปผู้ขาย" maxHeight={180} />
          )}
        </div>
        <div style={{ textAlign: 'left', marginTop: 16 }}>
          {renderParticipantStatusRows([
            { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: sellerPaymentDone, doneText: sellerShare > 0 ? '✅ ส่งสลิปแล้ว' : '✅ ไม่ต้องชำระเพิ่ม', waitText: sellerShare > 0 ? '⏳ รอส่งสลิป' : '⏳ รอศูนย์กลางตรวจสอบ' },
            { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!deal!.payment_slip_file_id, doneText: '✅ ส่งสลิปแล้ว', waitText: '⏳ รอส่งสลิป' },
          ], { marginBottom: 0 })}
        </div>
      </div>
    );
  }

  // ─── ขั้น 5: ผู้ขายแพ็ค + วิดีโอ + เลขพัสดุ ───────────────────────────────
  /** แกลเลอรีย่อรูป/วิดีโอหลักฐาน — ใช้ซ้ำให้ทั้งสองฝ่ายเห็นหลักฐานแพ็ค/แกะกล่องชุดเดียวกัน */
  function renderWizardEvidenceThumbs(items: EvidenceItem[], deletable = false) {
    return (
      <DealEvidenceThumbs
        items={items}
        deletable={deletable}
        onDelete={item => deleteEvidenceItem(item as EvidenceItem)}
        canDelete={item => canDeleteEvidenceItem(item as EvidenceItem)}
      />
    );
  }

  // ─── ขั้น 7: ผู้ขายแพ็ค + วิดีโอ + เลขพัสดุ ───────────────────────────────
  function renderWizardStep5() {
    const packingEvidence = evidence.filter(e => e.type === 'packing');
    const packingEvidenceSlots = [packingEvidence[0] || null, packingEvidence[1] || null, packingEvidence[2] || null] as Array<EvidenceItem | null>;
    const packingSteps = [
      { step: 1 as const, imageSrc: '/pack.webp', title: 'แพ็คสินค้า' },
      { step: 2 as const, imageSrc: '/Logistic.webp', title: 'โลจิสติกส์' },
      { step: 3 as const, imageSrc: '/Slip.webp', title: 'สลิปและเลขอ้างอิง' },
    ];
    const canUploadPackingStep = (step: 1 | 2 | 3) => step === 1 || !!packingEvidenceSlots[step - 2];
    const hasAllPackingSteps = packingEvidenceSlots.every(Boolean);
    const simplePackingFocus = isSimple;
    const packingHeaderSteps = isPackingCompactLayout && !simplePackingFocus ? [packingSteps[packingCarouselIndex]] : packingSteps;
    const packingHeaderColumns = isPackingCompactLayout && !simplePackingFocus ? '1fr' : 'repeat(3, minmax(0, 1fr))';
    const packingUploadColumns = simplePackingFocus ? 'repeat(3, minmax(0, 1fr))' : (isPackingCompactLayout ? '1fr' : 'repeat(3, minmax(0, 1fr))');
    const sellerPacked = !!deal!.tracking_to_buyer || ['shipped_to_buyer', 'completed', 'cancelled', 'disputed'].includes(deal!.status);
    const wrapClass = simplePackingFocus ? 'simple-deal-packing-focus' : undefined;
    const gapSize = simplePackingFocus ? 8 : 14;
    if (myRole !== 'seller') {
      const packingStepLabels = ['แพ็ค', 'โลจิสติกส์', 'สลิป'];
      return (
        <div className={wrapClass} style={{ display: 'flex', flexDirection: 'column', gap: gapSize }}>
          {!simplePackingFocus && (
          <div className="dr-card">
            <div style={{ display: 'grid', gridTemplateColumns: packingHeaderColumns, gap: 10 }}>
              {packingHeaderSteps.map(item => (
                <div key={item.step} style={{ minWidth: 0 }}>
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                    <DealClickableMedia url={item.imageSrc} alt={item.title} label={item.title} fill objectFit="cover" />
                    <div style={{ position: 'absolute', top: 8, left: 8, minWidth: 26, height: 26, borderRadius: 999, background: 'rgba(15, 23, 42, .72)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, pointerEvents: 'none' }}>
                      {item.step}
                    </div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--ink)', textAlign: 'center' }}>{item.title}</div>
                </div>
              ))}
            </div>
            {isPackingCompactLayout && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
                {packingSteps.map((item, index) => (
                  <span key={item.step} style={{ width: 8, height: 8, borderRadius: '50%', background: index === packingCarouselIndex ? 'var(--accent)' : 'var(--line)' }} />
                ))}
              </div>
            )}
          </div>
          )}
          {simplePackingFocus ? (
            <>
              <div className="dr-card simple-deal-packing-evidence-card">
                <div className="dr-card-title">หลักฐานจากผู้ขาย</div>
                <DealPackingEvidenceStrip slots={packingEvidenceSlots} labels={packingStepLabels} />
              </div>
              <div className="dr-card simple-deal-packing-wait-card">
                <div className="simple-deal-packing-wait-icon" aria-hidden>📦</div>
                <div className="simple-deal-packing-wait-title">รอผู้ขายแพ็คสินค้าและจัดส่ง</div>
                <p className="simple-deal-packing-wait-desc">ผู้ขายกำลังถ่ายวิดีโอแพ็คของและจัดส่งตรงถึงคุณ — ระบบจะแจ้งเลขพัสดุทันทีที่ส่งแล้ว</p>
                <div className="simple-deal-packing-wait-status">
                  {renderParticipantStatusRows([
                    { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: sellerPacked, doneText: '✅ แพ็คและส่งแล้ว', waitText: '⏳ กำลังแพ็ค' },
                    { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!deal!.tracking_to_buyer, doneText: '✅ ได้เลขพัสดุแล้ว', waitText: '⏳ รอเลขพัสดุ' },
                  ], { marginBottom: 0, gap: 4, fontSize: 12 })}
                </div>
                {deal!.tracking_to_buyer && (
                  <div className="simple-deal-packing-wait-tracking">
                    {renderTrackingInfoInline(deal!.tracking_to_buyer, deal!.tracking_to_buyer_provider)}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="dr-card">
                <div className="dr-card-title">หลักฐานจากผู้ขาย</div>
                <div style={{ display: 'grid', gridTemplateColumns: packingUploadColumns, gap: 10 }}>
                  {packingSteps.map(item => {
                    const uploaded = packingEvidenceSlots[item.step - 1];
                    return (
                      <div key={item.step} style={{ minWidth: 0, border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 10, background: 'var(--surface)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, textAlign: 'center' }}>ขั้นตอน {item.step}</div>
                        <div className="pack-upload-slot-media" style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--line)' }}>
                          {uploaded ? (
                            <DealClickableMedia
                              url={fileUrl(uploaded.file_id)}
                              alt={uploaded.file_name || item.title}
                              label={uploaded.file_name || item.title}
                              isVideo={isDealVideoFile(uploaded.file_name)}
                              fill
                              objectFit="cover"
                            />
                          ) : (
                            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'rgba(15, 23, 42, 0.14)', fontSize: 'clamp(34px, 6vw, 54px)', fontWeight: 800, lineHeight: 1 }}>
                              {item.step}
                            </div>
                          )}
                        </div>
                        <div style={{ marginTop: 8, minHeight: 34, fontSize: 11.5, color: uploaded ? 'var(--green-600)' : 'var(--faint)', textAlign: 'center', lineHeight: 1.45 }}>
                          {uploaded ? '✅ ผู้ขายอัปโหลดแล้ว' : '⏳ รอผู้ขายอัปโหลด'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="dr-card" style={{ textAlign: 'center', padding: '24px 20px' }}>
                <div style={{ fontSize: 38, marginBottom: 10 }}>📦</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>รอผู้ขายแพ็คสินค้าและจัดส่ง</div>
                <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>ผู้ขายกำลังถ่ายวิดีโอแพ็คของและจัดส่งตรงถึงคุณ — ระบบจะแจ้งเลขพัสดุให้ทันทีที่ส่งแล้ว</p>
                <div style={{ textAlign: 'left', marginTop: 16 }}>
                  {renderParticipantStatusRows([
                    { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: sellerPacked, doneText: '✅ แพ็คและส่งแล้ว', waitText: '⏳ กำลังแพ็ค' },
                    { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!deal!.tracking_to_buyer, doneText: '✅ ได้เลขพัสดุแล้ว', waitText: '⏳ รอเลขพัสดุ' },
                  ], { marginBottom: 0 })}
                </div>
                <div style={{ marginTop: 12 }}>
                  {renderTrackingInfoCard('พัสดุจากผู้ขายถึงผู้ซื้อ', deal!.tracking_to_buyer, deal!.tracking_to_buyer_provider)}
                </div>
              </div>
            </>
          )}
        </div>
      );
    }
    return (
      <div className={wrapClass} style={{ display: 'flex', flexDirection: 'column', gap: gapSize }}>
        {renderBuyerShippingCard(simplePackingFocus)}
        {!simplePackingFocus && (
        <div className="dr-card">
          <div style={{ display: 'grid', gridTemplateColumns: packingHeaderColumns, gap: 10 }}>
            {packingHeaderSteps.map(item => (
              <div key={item.step} style={{ minWidth: 0 }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                  <DealClickableMedia url={item.imageSrc} alt={item.title} label={item.title} fill objectFit="cover" />
                  <div style={{ position: 'absolute', top: 8, left: 8, minWidth: 26, height: 26, borderRadius: 999, background: 'rgba(15, 23, 42, .72)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, pointerEvents: 'none' }}>
                    {item.step}
                  </div>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--ink)', textAlign: 'center' }}>{item.title}</div>
              </div>
            ))}
          </div>
          {isPackingCompactLayout && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
              {packingSteps.map((item, index) => (
                <span key={item.step} style={{ width: 8, height: 8, borderRadius: '50%', background: index === packingCarouselIndex ? 'var(--accent)' : 'var(--line)' }} />
              ))}
            </div>
          )}
        </div>
        )}
        <div className="dr-card">
          <div className="dr-card-title">อัปโหลด 3 ขั้นตอน</div>
          {!simplePackingFocus && (
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.6 }}>อัปโหลดให้ครบตามลำดับ 1 → 2 → 3 แล้วจึงเลือกผู้ให้บริการโลจิสติกส์และกรอกเลขพัสดุเพื่อไปขั้นถัดไป</p>
          )}
          {simplePackingFocus
            ? <p className="pack-upload-hint">อัปโหลด 1→2→3 แล้วกรอกเลขพัสดุ · วิดีโอไม่เกิน 5 นาที</p>
            : renderVideoUploadHint({ marginBottom: 12 })}
          <DealPackingUploadGrid
            steps={packingSteps}
            slots={packingEvidenceSlots}
            compact={simplePackingFocus}
            fileUrl={fileUrl}
            canUploadStep={canUploadPackingStep}
            uploadPreview={uploadPreview}
            activeUploadStep={packingUploadStep}
            evidenceFull={packingEvidence.length >= 3}
            onPickFile={step => {
              setPackingUploadStep(step);
              evidInputRef.current?.click();
            }}
            onDelete={item => {
              const full = packingEvidence.find(e => e.file_id === item.file_id);
              if (full) deleteEvidenceItem(full);
            }}
            canDelete={item => {
              const full = packingEvidence.find(e => e.file_id === item.file_id);
              return full ? canDeleteEvidenceItem(full) : false;
            }}
          />
          <input ref={evidInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={async e => {
            const f = e.target.files?.[0];
            const activeStep = packingUploadStep;
            e.target.value = '';
            if (!f || !activeStep) return;
            if (!canUploadPackingStep(activeStep) || packingEvidenceSlots[activeStep - 1]) { setPackingUploadStep(null); return; }
            await uploadFile(f, true, 'packing');
            setPackingUploadStep(null);
          }} />
          <div style={{ fontSize: 12, color: hasAllPackingSteps ? 'var(--green-600)' : 'var(--muted)', marginTop: simplePackingFocus ? 6 : 12 }}>
            {hasAllPackingSteps ? '✅ ครบ 3 ขั้น — กรอกเลขพัสดุได้' : `อัปโหลดแล้ว ${packingEvidence.length}/3`}
          </div>
        </div>
        <div className={`dr-card${simplePackingFocus ? ' pack-logistics-card' : ''}`}>
          <div className="pack-logistics-title">ผู้ให้บริการโลจิสติกส์</div>
          <select
            ref={trackingProviderRef}
            className="dr-select pack-logistics-field"
            value={trackingProviderInput}
            onChange={e => {
              setTrackingProviderInput(e.target.value);
              if (e.target.value.trim() && trackingInput.trim()) setShowTrackingRequired(false);
            }}
            style={{
              marginBottom: simplePackingFocus ? 8 : 12,
              border: `2px solid ${trackingProviderInput.trim() ? 'var(--blue-200)' : '#cf2038'}`,
              background: trackingProviderInput.trim() ? 'var(--surface)' : '#fff7f8',
              boxShadow: showTrackingRequired || !trackingProviderInput.trim() ? '0 0 0 4px rgba(207, 32, 56, 0.12)' : 'var(--sh-xs)',
              fontWeight: 700,
            }}
          >
            <option value="">เลือกผู้ให้บริการโลจิสติกส์</option>
            {TH_LOGISTICS_PROVIDERS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <div className="pack-tracking-title">เลขพัสดุ</div>
          <div className="pack-tracking-hint" style={{ color: trackingInput.trim() ? 'var(--muted)' : '#cf2038' }}>
            ต้องกรอกผู้ให้บริการและเลขพัสดุก่อนกดไปขั้นถัดไป
          </div>
          <input
            ref={trackingInputRef}
            type="text"
            className="dr-select pack-logistics-field"
            value={trackingInput}
            onChange={e => {
              setTrackingInput(e.target.value);
              if (e.target.value.trim()) setShowTrackingRequired(false);
            }}
            placeholder="กรอกเลขพัสดุ"
            style={{
              marginBottom: simplePackingFocus ? 8 : 12,
              border: `2px solid ${trackingInput.trim() ? 'var(--blue-200)' : '#cf2038'}`,
              background: trackingInput.trim() ? 'var(--surface)' : '#fff7f8',
              boxShadow: showTrackingRequired || !trackingInput.trim() ? '0 0 0 4px rgba(207, 32, 56, 0.12)' : 'var(--sh-xs)',
              fontWeight: 700,
            }}
          />
          {!simplePackingFocus && renderParticipantStatusRows([
            { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: sellerPacked, doneText: '✅ แพ็คและส่งแล้ว', waitText: '⏳ กำลังแพ็ค' },
            { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!deal!.tracking_to_buyer, doneText: '✅ ได้เลขพัสดุแล้ว', waitText: '⏳ รอเลขพัสดุ' },
          ], { marginBottom: 12 })}
          <div className="pack-submit-bar">
            <AsyncButton className="btn btn-green btn-block btn-lg" onClick={() => {
              if (!hasAllPackingSteps) { alert('กรุณาอัปโหลดหลักฐานให้ครบทั้ง 3 ขั้นก่อน'); return; }
              const payload = getTrackingPayload();
              if (!payload) return;
              return doAction('seller_done_packing', payload);
            }}>📦 แพ็คเสร็จ — ส่งให้ผู้ซื้อโดยตรง</AsyncButton>
          </div>
        </div>
      </div>
    );
  }

  function renderTrackingInfoInline(trackingNumber?: string, trackingProvider?: string) {
    const cleanTrackingNumber = String(trackingNumber || '').trim();
    if (!cleanTrackingNumber) return null;
    const trackingUrl = buildTrackingUrl(trackingProvider, cleanTrackingNumber);
    return (
      <div className="pack-tracking-inline">
        <span className="pack-tracking-inline-provider">{getLogisticsProviderLabel(trackingProvider)}</span>
        <span className="pack-tracking-inline-code">{cleanTrackingNumber}</span>
        {trackingUrl && (
          <a href={trackingUrl} target="_blank" rel="noreferrer" className="pack-tracking-inline-link">
            เช็คพัสดุ ↗
          </a>
        )}
      </div>
    );
  }

  // ─── ขั้น 8: ผู้ซื้อแกะกล่อง + ถ่ายวิดีโอ + ยืนยันรับ/แจ้งปัญหา ───────────
  function renderWizardStep6() {
    const unboxEvidence = evidence.filter(e => e.type === 'receive');
    const buyerReceived = deal!.status === 'completed';
    const simpleReceiveFocus = isSimple;
    const packingEvidence = evidence.filter(e => e.type === 'packing');
    const packingSlots = [packingEvidence[0] || null, packingEvidence[1] || null, packingEvidence[2] || null] as Array<EvidenceItem | null>;
    const packingStepLabels = ['แพ็ค', 'โลจิสติกส์', 'สลิป'];
    if (myRole !== 'buyer') {
      return (
        <div className="dr-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>🚚</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>ส่งสินค้าแล้ว — รอผู้ซื้อยืนยันรับ</div>
          {renderTrackingInfoCard('พัสดุจากผู้ขายถึงผู้ซื้อ', deal!.tracking_to_buyer, deal!.tracking_to_buyer_provider)}
          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>ผู้ซื้อต้องถ่ายวิดีโอก่อนแกะกล่อง แล้วกดยืนยันรับสินค้า ดีลจะเสร็จสมบูรณ์อัตโนมัติ</p>
          <div style={{ textAlign: 'left', marginTop: 16 }}>
            {renderParticipantStatusRows([
              { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: !!deal!.tracking_to_buyer, doneText: '✅ ส่งสินค้าแล้ว', waitText: '⏳ รอจัดส่ง' },
              { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: buyerReceived, doneText: '✅ ยืนยันรับแล้ว', waitText: '⏳ รอยืนยันรับ' },
            ], { marginBottom: 0 })}
          </div>
          {unboxEvidence.length > 0
            ? renderWizardEvidenceThumbs(unboxEvidence)
            : <p style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 10 }}>ยังไม่มีรูป/วิดีโอแกะกล่องจากผู้ซื้อ</p>}
        </div>
      );
    }
    const hasUnboxEvidence = unboxEvidence.length > 0;
    if (simpleReceiveFocus && myRole === 'buyer') {
      const trackingNumber = deal!.tracking_to_buyer;
      const trackingProvider = deal!.tracking_to_buyer_provider;
      const trackingUrl = trackingNumber ? buildTrackingUrl(trackingProvider, String(trackingNumber).trim()) : null;
      return (
        <div className="dr-card simple-deal-receive-card">
          <div className="simple-deal-receive-head">
            <span className="simple-deal-receive-head-title">📦 หลักฐานจากผู้ขาย</span>
            {trackingNumber && (
              <div className="simple-deal-receive-tracking">
                <span className="pack-tracking-inline-provider">{getLogisticsProviderLabel(trackingProvider)}</span>
                <span className="pack-tracking-inline-code">{String(trackingNumber).trim()}</span>
                {trackingUrl && (
                  <a href={trackingUrl} target="_blank" rel="noreferrer" className="pack-tracking-inline-link">
                    เช็คพัสดุ ↗
                  </a>
                )}
              </div>
            )}
          </div>

          {packingEvidence.length > 0 && (
            <DealPackingEvidenceStrip slots={packingSlots} labels={packingStepLabels} />
          )}

          <p className="simple-deal-receive-note">
            📹 ถ่ายวิดีโอก่อนแกะกล่อง · <span className="simple-deal-receive-note-warn">ไม่มีวิดีโอเรียกร้องผู้ขายไม่ได้</span>
          </p>

          <button type="button" onClick={() => buyerEvidInputRef.current?.click()} className="btn btn-soft btn-block btn-sm simple-deal-receive-upload">
            <Icon name="upload" size={16} /> อัปโหลดวิดีโอ/รูปก่อนแกะ
          </button>
          <input ref={buyerEvidInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, true, 'receive'); e.target.value = ''; }} />
          {hasUnboxEvidence && (
            <p className="pack-receive-uploaded">✅ อัปโหลดแล้ว {unboxEvidence.length} ไฟล์</p>
          )}
          {renderWizardEvidenceThumbs(unboxEvidence, true)}
          <AsyncButton
            className="btn btn-green btn-block btn-lg"
            disabled={acting}
            onClick={() => {
              if (!hasUnboxEvidence && !confirm('ยังไม่ได้อัปโหลดวิดีโอก่อนแกะกล่อง — ยืนยันรับสินค้าต่อไหม?')) return;
              return doAction('buyer_received');
            }}
          >
            🎉 ยืนยันรับสินค้า — ดีลเสร็จสมบูรณ์
          </AsyncButton>
          <AsyncButton
            className="btn btn-ghost btn-block btn-sm pack-receive-dispute"
            disabled={acting}
            onClick={() => {
              const r = prompt('อธิบายปัญหาที่พบ (เช่น สินค้าไม่ตรงปก/ชำรุด/ไม่ได้รับสินค้า):');
              if (r === null || !r.trim()) return;
              return doAction('dispute', { reason: r.trim() });
            }}
          >
            ⚠️ แจ้งปัญหากับสินค้า
          </AsyncButton>
        </div>
      );
    }
    const hasUnboxEvidenceFull = unboxEvidence.length > 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* ─ หลักฐานแพ็คสินค้าจากผู้ขาย (step 7) ─ */}
        {packingEvidence.length > 0 && (
          <div className="dr-card">
            <div className="dr-card-title">📦 หลักฐานแพ็คสินค้าจากผู้ขาย</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {packingSlots.map((uploaded, idx) => (
                <div key={idx} style={{ minWidth: 0, border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 10, background: 'var(--surface)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 8, textAlign: 'center' }}>ขั้นตอน {idx + 1}</div>
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                    {uploaded ? (
                      <DealClickableMedia
                        url={fileUrl(uploaded.file_id)}
                        alt={packingStepLabels[idx]}
                        label={packingStepLabels[idx]}
                        isVideo={isDealVideoFile(uploaded.file_name)}
                        fill
                        objectFit="cover"
                      />
                    ) : (
                      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'rgba(15,23,42,0.14)', fontSize: 'clamp(34px,6vw,54px)', fontWeight: 800, lineHeight: 1 }}>
                        {idx + 1}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11.5, color: uploaded ? 'var(--green-600)' : 'var(--faint)', textAlign: 'center', lineHeight: 1.45 }}>
                    {uploaded ? `✅ ${packingStepLabels[idx]}` : '⏳ ยังไม่ได้อัปโหลด'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {renderTrackingInfoCard('พัสดุจากผู้ขายถึงผู้ซื้อ', deal!.tracking_to_buyer, deal!.tracking_to_buyer_provider)}
        <div className="dr-card" style={{ background: '#fff8ef', borderColor: '#ffe0b2' }}>
          <div className="dr-card-title">📹 ถ่ายวิดีโอก่อนแกะกล่อง</div>
          <div style={{ fontSize: 13, color: '#8a5a00', lineHeight: 1.6, marginBottom: 8 }}>⚠️ ต้องถ่ายวิดีโอตอนแกะกล่องทุกครั้ง หากไม่มีวิดีโอก่อนแกะ จะถือว่าสินค้าถูกต้องและเรียกร้องกับผู้ขายไม่ได้</div>
          {renderVideoUploadHint({ marginBottom: 12 })}
          <button onClick={() => buyerEvidInputRef.current?.click()} className="btn btn-soft btn-block"><Icon name="upload" size={16} /> อัปโหลดวิดีโอก่อนแกะ</button>
          <input ref={buyerEvidInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, true, 'receive'); e.target.value = ''; }} />
          {hasUnboxEvidenceFull && <p style={{ fontSize: 12.5, color: 'var(--green-600)', marginTop: 10 }}>✅ อัปโหลดแล้ว {unboxEvidence.length} ไฟล์ — ผู้ขายเห็นชุดนี้ด้วย</p>}
          {renderWizardEvidenceThumbs(unboxEvidence, true)}
        </div>
        <div className="dr-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {renderParticipantStatusRows([
            { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: !!deal!.tracking_to_buyer, doneText: '✅ ส่งสินค้าแล้ว', waitText: '⏳ รอจัดส่ง' },
            { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: buyerReceived, doneText: '✅ ยืนยันรับแล้ว', waitText: '⏳ รอยืนยันรับ' },
          ], { marginBottom: 4 })}
          <AsyncButton className="btn btn-green btn-block btn-lg" disabled={acting} onClick={() => { if (!hasUnboxEvidenceFull && !confirm('ยังไม่ได้อัปโหลดวิดีโอก่อนแกะกล่อง — ยืนยันรับสินค้าต่อไหม?')) return; return doAction('buyer_received'); }}>🎉 ยืนยันรับสินค้า — ดีลเสร็จสมบูรณ์</AsyncButton>
          <AsyncButton className="btn btn-ghost btn-block" disabled={acting} onClick={() => { const r = prompt('อธิบายปัญหาที่พบ (เช่น สินค้าไม่ตรงปก/ชำรุด/ไม่ได้รับสินค้า):'); if (r === null || !r.trim()) return; return doAction('dispute', { reason: r.trim() }); }} style={{ color: '#b22441' }}>⚠️ แจ้งปัญหากับสินค้า</AsyncButton>
        </div>
      </div>
    );
  }

  // ─── ขั้นสุดท้าย simple: จบดีล (ตัดขั้นรอโอนเงิน — buyer/seller มาที่นี่เลยหลังยืนยันรับ) ─
  function renderSimpleWizardFinal(outcome?: 'success' | 'cancelled' | 'disputed') {
    if (outcome === 'disputed') return renderWizardStep7('disputed');
    const pd: DealPriceState = priceState || {};
    const hasPayout = !!pd.payout_slip_file_id;
    const isCancelled = outcome === 'cancelled';

    let doneTitle: string;
    let doneSub: string;
    let doneEmoji: string;

    if (isCancelled) {
      doneEmoji = '↩️';
      doneTitle = 'ดีลถูกยกเลิก — คืนเงินผู้ซื้อแล้ว';
      doneSub = pd.refund_slip_file_id
        ? 'ศูนย์กลางโอนเงินคืนผู้ซื้อเรียบร้อยแล้ว'
        : 'ทีมงานกำลังดำเนินการคืนเงินให้ผู้ซื้อ';
    } else {
      doneEmoji = '🎉';
      doneTitle = 'ดีลเสร็จสมบูรณ์!';
      doneSub = 'คุณยืนยันรับสินค้าแล้ว — ขอบคุณที่ใช้บริการ';
    }

    const allSlips: { label: string; fileId: string }[] = [];
    if (deal!.payment_slip_file_id) allSlips.push({ label: 'สลิปผู้ซื้อ (ค่าสินค้า)', fileId: deal!.payment_slip_file_id });
    if (pd.seller_fee_slip) allSlips.push({ label: 'สลิปผู้ขาย (ค่าบริการ)', fileId: pd.seller_fee_slip });
    if (pd.payout_slip_file_id) allSlips.push({ label: 'สลิปโอนเงินให้ผู้ขาย', fileId: pd.payout_slip_file_id });
    if (pd.refund_slip_file_id) allSlips.push({ label: 'สลิปคืนเงินให้ผู้ซื้อ', fileId: pd.refund_slip_file_id });

    const packingEvid = evidence.filter(e => e.type === 'packing');
    const receiveEvid = evidence.filter(e => e.type === 'receive');
    const chatEvid = evidence.filter(e => e.type === 'chat' || e.type === 'call');
    const inspectionEvid = evidence.filter(e => e.type === 'inspection' || e.type === 'check');
    const otherEvid = evidence.filter(e => ['other', 'meet', 'chat_text', 'testing'].includes(e.type));
    const hasAnyEvidence = packingEvid.length > 0 || receiveEvid.length > 0 || chatEvid.length > 0 || inspectionEvid.length > 0 || otherEvid.length > 0;

    const sellerOk = isCancelled ? true : hasPayout;
    const buyerOk = true;

    return (
      <div className="simple-deal-final">
        <div className="dr-card dr-done-card dr-done-card--compact">
          <div className="dr-done-emoji" aria-hidden>{doneEmoji}</div>
          <div className="dr-done-text">
            <div className="dr-done-title">{doneTitle}</div>
            <div className="dr-done-sub">{doneSub}</div>
          </div>
        </div>

        {renderCompletionReviewBlock(isCancelled, { simple: true })}

        <div className="simple-deal-final-extra">
        {allSlips.length > 0 && (
          <div className="dr-card">
            <div className="dr-card-title">📎 สลิปทั้งหมดในดีล</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <DealMediaThumbGallery
                items={allSlips.map(s => ({ fileId: s.fileId, label: s.label }))}
                resolveUrl={fileUrl}
                thumbHeight={180}
                thumbWidth="min(160px, 42vw)"
              />
            </div>
          </div>
        )}

        <div className="dr-card">
          {renderParticipantStatusRows([
            {
              roleLabel: 'ผู้ขาย',
              name: deal!.seller_name || '-',
              ok: sellerOk,
              doneText: isCancelled ? '✅ ดีลยกเลิกแล้ว' : hasPayout ? '✅ รับเงินแล้ว' : '⏳ รอทีมงานโอนเงิน',
              waitText: '⏳ รอทีมงานโอนเงิน',
            },
            {
              roleLabel: 'ผู้ซื้อ',
              name: deal!.buyer_name || '-',
              ok: buyerOk,
              doneText: isCancelled ? '✅ ได้รับเงินคืนแล้ว' : '✅ ยืนยันรับสินค้าแล้ว',
              waitText: '⏳ รอยืนยันรับ',
            },
          ], { marginBottom: 0 })}
        </div>

        {renderSimpleShareBreakdownCard()}

        {hasAnyEvidence && (
          <div className="dr-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="dr-card-title">📁 หลักฐานทั้งหมดในดีล</div>
            {packingEvid.length > 0 && (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>📦 แพ็คสินค้า ({packingEvid.length} ไฟล์)</div>
                {renderWizardEvidenceThumbs(packingEvid)}
              </div>
            )}
            {receiveEvid.length > 0 && (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>📹 แกะกล่อง ({receiveEvid.length} ไฟล์)</div>
                {renderWizardEvidenceThumbs(receiveEvid)}
              </div>
            )}
            {inspectionEvid.length > 0 && (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>🔍 ตรวจสอบ ({inspectionEvid.length} ไฟล์)</div>
                {renderWizardEvidenceThumbs(inspectionEvid)}
              </div>
            )}
            {chatEvid.length > 0 && (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>💬 แชท/คอล ({chatEvid.length} ไฟล์)</div>
                {renderWizardEvidenceThumbs(chatEvid)}
              </div>
            )}
            {otherEvid.length > 0 && (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>📎 อื่นๆ ({otherEvid.length} ไฟล์)</div>
                {renderWizardEvidenceThumbs(otherEvid)}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    );
  }

  // ─── ขั้น 7: ส่วนกลางโอน/คืน/อายัด (รอทีมงาน) — regular/marketplace ─────
  function renderWizardStep7(outcome?: 'success' | 'cancelled' | 'disputed') {
    if (outcome === 'disputed') {
      return (
        <div className="dr-card" style={{ textAlign: 'center', padding: '30px 20px', borderColor: '#fbd5dd' }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: '#b22441', marginBottom: 8 }}>มีข้อพิพาท — เงินถูกอายัดไว้</div>
          {deal!.reject_reason && <p style={{ fontSize: 13.5, color: 'var(--ink)', background: '#fdeef1', border: '1px solid #fbd5dd', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 12, textAlign: 'left' }}>{deal!.reject_reason}</p>}
          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>ทีมงานกำลังตรวจสอบข้อพิพาทนี้ — คุยรายละเอียดเพิ่มเติมกับอีกฝ่ายในแชตได้ ผลการตัดสินจะแจ้งให้ทราบเมื่อเสร็จสิ้น</p>
          <div style={{ textAlign: 'left', marginTop: 16 }}>
            {renderParticipantStatusRows([
              { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: false, doneText: '✅ ส่งข้อมูลครบแล้ว', waitText: '⚠️ รอทีมงานตรวจสอบ' },
              { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: false, doneText: '✅ ส่งข้อมูลครบแล้ว', waitText: '⚠️ รอทีมงานตรวจสอบ' },
            ], { marginBottom: 0 })}
          </div>
        </div>
      );
    }
    const isCancelled = outcome === 'cancelled';
    const sellerRow = isCancelled
      ? { ok: false, doneText: '✅ ดีลยกเลิกแล้ว', waitText: '⏳ ดีลถูกยกเลิก' }
      : { ok: false, doneText: '✅ รับเงินแล้ว', waitText: '⏳ รอทีมงานโอนเงิน' };
    const buyerRow = isCancelled
      ? { ok: false, doneText: '✅ ได้รับเงินคืนแล้ว', waitText: '⏳ รอทีมงานคืนเงิน' }
      : { ok: true, doneText: '✅ ยืนยันรับสินค้าแล้ว', waitText: '⏳ รอทีมงานโอนเงิน' };
    return (
      <div className="dr-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
        <div style={{ fontSize: 38, marginBottom: 10 }}>💸</div>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>
          {isCancelled ? 'ดีลถูกยกเลิก — กำลังคืนเงินให้ผู้ซื้อ' : 'ยืนยันรับสินค้าแล้ว 🎉 — กำลังโอนเงินให้ผู้ขาย'}
        </div>
        {isCancelled && deal!.reject_reason && <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>เหตุผล: {deal!.reject_reason}</p>}
        <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>ทีมงานกำลังโอนเงินและจะอัปโหลดสลิปยืนยันให้เห็นที่นี่ภายในไม่นาน</p>
        <div style={{ textAlign: 'left', marginTop: 16 }}>
          {renderParticipantStatusRows([
            { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ...sellerRow },
            { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ...buyerRow },
          ], { marginBottom: 0 })}
        </div>
        {/* แสดงหลักฐานทั้งหมดในดีล ให้ทุกฝ่ายเห็นตอนเสร็จสิ้น */}
        {evidence.length > 0 && (
          <div style={{ marginTop: 16, textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>📁 หลักฐานทั้งหมดในดีล ({evidence.length} รายการ)</div>
            {renderEvidencePanel()}
          </div>
        )}
      </div>
    );
  }

  // ─── ขั้น 8: เสร็จสมบูรณ์ + รีวิว ─────────────────────────────────────────
  function renderWizardStep8(outcome?: 'success' | 'cancelled' | 'disputed') {
    const pd: DealPriceState = priceState || {};
    const isCancelled = outcome === 'cancelled';

    // รวบรวมสลิปทุกใบ
    const allSlips: { label: string; fileId: string }[] = [];
    if (deal!.payment_slip_file_id) allSlips.push({ label: 'สลิปผู้ซื้อ (ค่าสินค้า)', fileId: deal!.payment_slip_file_id });
    if (pd.seller_fee_slip) allSlips.push({ label: 'สลิปผู้ขาย (ค่าบริการ)', fileId: pd.seller_fee_slip });
    if (pd.payout_slip_file_id) allSlips.push({ label: 'สลิปโอนเงินให้ผู้ขาย', fileId: pd.payout_slip_file_id });
    if (pd.refund_slip_file_id) allSlips.push({ label: 'สลิปคืนเงินให้ผู้ซื้อ', fileId: pd.refund_slip_file_id });

    // รวบรวมหลักฐานทุกประเภท
    const packingEvid = evidence.filter(e => e.type === 'packing');
    const receiveEvid = evidence.filter(e => e.type === 'receive');
    const chatEvid = evidence.filter(e => e.type === 'chat' || e.type === 'call');
    const inspectionEvid = evidence.filter(e => e.type === 'inspection' || e.type === 'check');
    const otherEvid = evidence.filter(e => ['other', 'meet', 'chat_text', 'testing'].includes(e.type));
    const hasAnyEvidence = packingEvid.length > 0 || receiveEvid.length > 0 || chatEvid.length > 0 || inspectionEvid.length > 0 || otherEvid.length > 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dr-card dr-done-card">
          <div className="dr-done-emoji">{isCancelled ? '↩️' : '🎉'}</div>
          <div className="dr-done-title">{isCancelled ? 'ดีลถูกยกเลิก — คืนเงินผู้ซื้อแล้ว' : 'ดีลเสร็จสมบูรณ์!'}</div>
          <div className="dr-done-sub">{isCancelled ? 'ศูนย์กลางโอนเงินคืนผู้ซื้อเรียบร้อยแล้ว' : 'ศูนย์กลางโอนเงินให้ผู้ขายเรียบร้อยแล้ว (ดำเนินการโดยทีมงาน)'}</div>
        </div>

        {renderCompletionReviewBlock(isCancelled)}

        {allSlips.length > 0 && (
          <div className="dr-card">
            <div className="dr-card-title">📎 สลิปทั้งหมดในดีล</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <DealMediaThumbGallery
                items={allSlips.map(s => ({ fileId: s.fileId, label: s.label }))}
                resolveUrl={fileUrl}
                thumbHeight={180}
                thumbWidth="min(160px, 42vw)"
              />
            </div>
          </div>
        )}
        <div className="dr-card">
          {renderParticipantStatusRows([
            { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: true, doneText: isCancelled ? '✅ ดีลยกเลิกแล้ว' : '✅ รับเงินแล้ว' },
            { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: true, doneText: isCancelled ? '✅ ได้รับเงินคืนแล้ว' : '✅ ดีลเสร็จสมบูรณ์' },
          ], { marginBottom: 0 })}
        </div>
        {renderSimpleShareBreakdownCard()}

        {/* ─ หลักฐานทั้งหมดในดีล ─ */}
        {hasAnyEvidence && (
          <div className="dr-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="dr-card-title">📁 หลักฐานทั้งหมดในดีล</div>
            {packingEvid.length > 0 && (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>📦 แพ็คสินค้า ({packingEvid.length} ไฟล์)</div>
                {renderWizardEvidenceThumbs(packingEvid)}
              </div>
            )}
            {receiveEvid.length > 0 && (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>📹 วิดีโอแกะกล่อง ({receiveEvid.length} ไฟล์)</div>
                {renderWizardEvidenceThumbs(receiveEvid)}
              </div>
            )}
            {inspectionEvid.length > 0 && (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>🔍 ตรวจสอบสินค้า ({inspectionEvid.length} ไฟล์)</div>
                {renderWizardEvidenceThumbs(inspectionEvid)}
              </div>
            )}
            {chatEvid.length > 0 && (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>💬 หลักฐานจากแชท ({chatEvid.length} ไฟล์)</div>
                {renderWizardEvidenceThumbs(chatEvid)}
              </div>
            )}
            {otherEvid.length > 0 && (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>📎 หลักฐานอื่นๆ ({otherEvid.length} ไฟล์)</div>
                {renderWizardEvidenceThumbs(otherEvid)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }


  // ═══════════════════════════════════════════════════════════════════════
  // renderRegularWizard — ซื้อขายผ่านกลางปลอดภัย (deal_type === '' / regular) — 14 ขั้น
  // ═══════════════════════════════════════════════════════════════════════

  function renderRegularWizard() {
    const { step: actualStep, outcome } = getRegularStep();
    const step = Math.min(wzViewStep ?? actualStep, actualStep);
    const isReviewing = step < actualStep;
    const hasMm = !!deal!.middleman_id;
    // ตัดสินใจว่า rwzViewRole ที่ถูกต้องคืออะไร (จำกัดเฉพาะ role ที่มีในดีลนี้)
    const effectiveViewRole: 'seller' | 'middleman' | 'buyer' =
      (rwzViewRole === 'middleman' && !hasMm) ? (myRole === 'buyer' ? 'buyer' : 'seller') : rwzViewRole;

    function goToStep(nextStep: number) {
      const safe = Math.min(actualStep, nextStep);
      if (step === 2 && safe === 3) {
        step3PendingRef.current = safe;
        setShowStep3Warning(true);
        return;
      }
      setWzViewStep(safe);
    }

    // ─── แสดงสถานะผู้เกี่ยวข้อง 3 ฝ่าย (หรือ 4 ฝ่ายรวมศูนย์กลาง สำหรับ HUB_STEPS) ───
    function renderConfirmRows(opts: {
      sellerDone: boolean; sellerText?: string; sellerWait?: string;
      mmDone?: boolean; mmText?: string; mmWait?: string;
      buyerDone: boolean; buyerText?: string; buyerWait?: string;
      hubDone?: boolean; hubText?: string; hubWait?: string;
    }) {
      const showHub = HUB_STEPS.has(step) && opts.hubText;
      return renderParticipantStatusRows([
        { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: opts.sellerDone, doneText: opts.sellerText || '✅ เสร็จแล้ว', waitText: opts.sellerWait || '⏳ รอ' },
        ...(hasMm ? [{ roleLabel: 'คนกลาง', name: deal!.middleman_name || '-', ok: !!opts.mmDone, doneText: opts.mmText || '✅ เสร็จแล้ว', waitText: opts.mmWait || '⏳ รอ' }] : []),
        { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: opts.buyerDone, doneText: opts.buyerText || '✅ เสร็จแล้ว', waitText: opts.buyerWait || '⏳ รอ' },
        ...(showHub ? [{ roleLabel: 'ศูนย์กลาง', name: 'บริษัท กลางฮับ จำกัด', ok: !!opts.hubDone, doneText: opts.hubText || '✅ ดำเนินการแล้ว', waitText: opts.hubWait || '⏳ รอดำเนินการ' }] : []),
      ], { marginBottom: 0 });
    }

    // ─── Role-view switcher (แสดงหลังเลือกคนกลางแล้ว step >= 2) ────────────
    function renderRoleBar() {
      if (!hasMm || step < 2) return null;
      const roles: Array<{ key: 'seller' | 'middleman' | 'buyer'; label: string; icon: string }> = [
        { key: 'seller', label: 'ผู้ขาย', icon: '🛒' },
        { key: 'middleman', label: 'คนกลาง', icon: '🤝' },
        { key: 'buyer', label: 'ผู้ซื้อ', icon: '🛍️' },
      ];
      return (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', padding: 4 }}>
          {roles.map(r => (
            <button key={r.key} type="button"
              onClick={() => setRwzViewRole(r.key)}
              style={{
                flex: 1, border: 'none', borderRadius: 'var(--r-md)', padding: '7px 4px',
                fontWeight: effectiveViewRole === r.key ? 700 : 400,
                fontSize: 12.5, cursor: 'pointer', transition: 'all .18s',
                background: effectiveViewRole === r.key ? 'var(--surface)' : 'transparent',
                color: effectiveViewRole === r.key ? 'var(--ink)' : 'var(--muted)',
                boxShadow: effectiveViewRole === r.key ? 'var(--sh-xs)' : 'none',
              }}
            >
              {r.icon} {r.label}
              {r.key === myRole && <span style={{ fontSize: 9.5, marginLeft: 3, color: 'var(--accent)' }}>(คุณ)</span>}
            </button>
          ))}
        </div>
      );
    }

    // ─── step 2: ยอมรับเงื่อนไข ───────────────────────────────────────────
    function renderRStep1() {
      const fb = computeDealFees(feeConfig, deal!.price, deal!.deal_type);
      const myAccepted = (myRole === 'seller' && deal!.seller_accepted_terms)
        || (myRole === 'middleman' && deal!.middleman_accepted_terms)
        || (myRole === 'buyer' && deal!.buyer_accepted_terms);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="dr-card">
            <div className="regular-step1-slider-frame">
              <img
                key={REGULAR_DEAL_STEP1_SLIDES[regularDealIntroSlide]}
                src={REGULAR_DEAL_STEP1_SLIDES[regularDealIntroSlide]}
                alt={`ภาพอธิบายดีลปลอดภัย ${regularDealIntroSlide + 1}`}
                className="regular-step1-slider-image"
              />
            </div>
            <div className="svc-simple-slider-dots" aria-label="ตัวเลือกภาพขั้นตอนดีลปลอดภัย">
              {REGULAR_DEAL_STEP1_SLIDES.map((slide, index) => (
                <button
                  key={slide}
                  type="button"
                  className={`svc-simple-slider-dot${index === regularDealIntroSlide ? ' is-active' : ''}`}
                  onClick={() => setRegularDealIntroSlide(index)}
                  aria-label={`ดูภาพขั้นตอน ${index + 1}`}
                  aria-pressed={index === regularDealIntroSlide}
                />
              ))}
            </div>
          </div>
          <div className="dr-card">
            <div className="dr-card-title">💸 ค่าบริการ (฿{deal!.price.toLocaleString()})</div>
            {fb.lines.map(l => (
              <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', padding: '2px 0' }}>
                <span>{l.label}</span><span>฿{l.amount.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}>
              <span>รวม</span><span>฿{fb.total.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>* {fb.note}</div>
          </div>
          <div className="dr-card">
            <div className="dr-card-title">สถานะการยืนยัน</div>
            {renderParticipantStatusRows([
              { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: !!deal!.seller_accepted_terms, doneText: '✅ ยอมรับแล้ว', waitText: '⏳ รอยืนยัน' },
              ...(deal!.middleman_id ? [{ roleLabel: 'คนกลาง', name: deal!.middleman_name || '-', ok: !!deal!.middleman_accepted_terms, doneText: '✅ ยอมรับแล้ว', waitText: '⏳ รอยืนยัน' }] : []),
              { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!deal!.buyer_accepted_terms, doneText: '✅ ยอมรับแล้ว', waitText: '⏳ รอยืนยัน' },
            ], { marginBottom: myAccepted ? 0 : 12 })}
            {!myAccepted
              ? <AsyncButton className="btn btn-green btn-block btn-lg" onClick={() => doAction('accept_terms')}>✅ ยอมรับข้อตกลง</AsyncButton>
              : <p style={{ fontSize: 13.5, color: 'var(--green-600)', textAlign: 'center', margin: 0 }}>✅ คุณยืนยันแล้ว — รออีกฝ่ายยืนยัน</p>}
          </div>
        </div>
      );
    }

    // ─── step 1: เลือกคนกลาง ──────────────────────────────────────────────
    function renderRStep2() {
      const allAccepted = !!deal!.seller_accepted_terms && !!deal!.buyer_accepted_terms && (hasMm ? !!deal!.middleman_accepted_terms : true);
      const pd = priceState || {};
      const hasFeeProposal = pd.proposed_mm_fee != null;
      const myMmFeeAccepted = myRole === 'seller' ? !!pd.mm_fee_accepted_seller : myRole === 'buyer' ? !!pd.mm_fee_accepted_buyer : true;
      const fb = computeDealFees(feeConfig, deal!.price, deal!.deal_type);
      const defaultMmFee = fb.lines.find(l => l.label.includes('คนกลาง'))?.amount ?? feeConfig.middlemanFeeMin;
      const defaultInspFee = feeConfig.inspectionFee;

      // ── Popup สำหรับผู้ซื้อ/ผู้ขาย เมื่อคนกลางเสนอราคา ──────────────────
      const showPopup = hasFeeProposal && (myRole === 'seller' || myRole === 'buyer') && !myMmFeeAccepted;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Popup overlay ─────────────────────────────────────────────── */}
          {showPopup && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-xl)', padding: '24px 22px', maxWidth: 360, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,.22)' }}>
                <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 6 }}>💼</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', textAlign: 'center', marginBottom: 4 }}>คนกลางเสนอค่าบริการ</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginBottom: 16 }}>{deal!.middleman_name} กำหนดค่าบริการดังนี้</p>
                <div style={{ background: 'var(--accent-soft)', border: '1px solid #d7e3ff', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--ink)', padding: '4px 0', borderBottom: '1px solid #e8eeff', marginBottom: 6 }}>
                    <span>ค่าบริการคนกลาง</span><span style={{ fontWeight: 700 }}>฿{(pd.proposed_mm_fee ?? 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--ink)', padding: '4px 0', borderBottom: '1px solid #e8eeff', marginBottom: 6 }}>
                    <span>ค่าตรวจสอบสินค้า</span><span style={{ fontWeight: 700 }}>฿{(pd.proposed_inspection_fee ?? 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--ink)', paddingTop: 4 }}>
                    <span>รวม</span><span>฿{((pd.proposed_mm_fee ?? 0) + (pd.proposed_inspection_fee ?? 0)).toLocaleString()}</span>
                  </div>
                </div>
                {renderParticipantStatusRows([
                  { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: !!pd.mm_fee_accepted_seller, doneText: '✅ ยอมรับแล้ว', waitText: '⏳ รอยืนยัน' },
                  { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!pd.mm_fee_accepted_buyer, doneText: '✅ ยอมรับแล้ว', waitText: '⏳ รอยืนยัน' },
                ], { marginBottom: 14 })}
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.6, textAlign: 'center' }}>
                  หากไม่เห็นด้วย ติดต่อคนกลางผ่านแชทเพื่อเจรจา
                </p>
                <AsyncButton className="btn btn-green btn-block btn-lg" onClick={() => doAction('accept_mm_fees')}>
                  ✅ ยอมรับค่าบริการนี้
                </AsyncButton>
              </div>
            </div>
          )}

          {hasMm ? (
            <div className="dr-card" style={{ background: 'var(--accent-soft)', borderColor: 'color-mix(in srgb,var(--accent) 25%,transparent)' }}>
              <div className="dr-card-title">🤝 เลือกคนกลางแล้ว</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{deal!.middleman_name}</div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>รอทุกฝ่ายยอมรับเงื่อนไข — คนกลางจะเห็นดีลนี้ทันทีที่ได้รับลิงก์</p>
              {renderParticipantStatusRows([
                { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: !!deal!.seller_accepted_terms, doneText: '✅ ยืนยันแล้ว', waitText: '⏳ รอยืนยัน' },
                { roleLabel: 'คนกลาง', name: deal!.middleman_name || '-', ok: !!deal!.middleman_accepted_terms, doneText: '✅ ยืนยันแล้ว', waitText: '⏳ รอยืนยัน' },
                { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!deal!.buyer_accepted_terms, doneText: '✅ ยืนยันแล้ว', waitText: '⏳ รอยืนยัน' },
              ], { marginBottom: allAccepted ? 0 : 10 })}
              {!allAccepted && myRole === 'middleman' && !deal!.middleman_accepted_terms && (
                <AsyncButton className="btn btn-green btn-block" onClick={() => doAction('accept_terms')}>✅ ยอมรับและเข้าร่วมดีล</AsyncButton>
              )}
              {myRole === 'buyer' && (
                <button type="button" className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 8 }} onClick={() => setShowSelectMM(v => !v)}>
                  ✏️ เปลี่ยนคนกลาง
                </button>
              )}
            </div>
          ) : (
            <div className="dr-card" style={{ textAlign: 'center', padding: '24px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🤝</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>เลือกคนกลางก่อนดำเนินการต่อ</div>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>คนกลางจะตรวจสอบสินค้าและเป็นผู้รับของจากผู้ขาย ก่อนส่งต่อให้ผู้ซื้อ — ช่วยป้องกันการโกงทั้งสองฝ่าย</p>
              {myRole === 'buyer' && (
                <button type="button" className="btn btn-soft btn-block" style={{ marginTop: 14 }} onClick={() => setShowSelectMM(true)}>
                  🔍 เลือกคนกลาง
                </button>
              )}
              {myRole !== 'buyer' && (
                <p style={{ fontSize: 13, color: 'var(--faint)', marginTop: 12 }}>ผู้ซื้อจะเป็นผู้เลือกคนกลาง</p>
              )}
            </div>
          )}

          {/* ── คนกลางกำหนดค่าบริการ ──────────────────────────────────────── */}
          {hasMm && effectiveViewRole === 'middleman' && deal!.middleman_accepted_terms && (
            <div className="dr-card">
              <div className="dr-card-title">💼 กำหนดค่าบริการของคุณ</div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
                กำหนดค่าบริการคนกลางและค่าตรวจสอบสินค้าที่คุณต้องการ แล้วกดเสนอราคาให้ผู้ซื้อและผู้ขายยืนยัน
              </p>
              <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>ค่าบริการคนกลาง (฿)</label>
                  <input
                    type="number" min="0" className="dr-select"
                    value={mmFeeInput}
                    onChange={e => setMmFeeInput(e.target.value)}
                    placeholder={String(defaultMmFee)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>ค่าตรวจสอบสินค้า (฿)</label>
                  <input
                    type="number" min="0" className="dr-select"
                    value={inspFeeInput}
                    onChange={e => setInspFeeInput(e.target.value)}
                    placeholder={String(defaultInspFee)}
                  />
                </div>
              </div>
              {hasFeeProposal && (
                <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '10px 12px', marginBottom: 12, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>ข้อเสนอปัจจุบัน</div>
                  {renderParticipantStatusRows([
                    { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: !!pd.mm_fee_accepted_seller, doneText: '✅ ยอมรับแล้ว', waitText: '⏳ รอยืนยัน' },
                    { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!pd.mm_fee_accepted_buyer, doneText: '✅ ยอมรับแล้ว', waitText: '⏳ รอยืนยัน' },
                  ], { marginBottom: 0 })}
                </div>
              )}
              <AsyncButton
                className="btn btn-green btn-block"
                onClick={() => {
                  const mmF = Math.max(0, Math.round(Number(mmFeeInput) || defaultMmFee));
                  const insF = Math.max(0, Math.round(Number(inspFeeInput) || defaultInspFee));
                  return doAction('propose_mm_fees', { mmFee: mmF, inspectionFee: insF });
                }}
              >
                📨 เสนอราคาให้ผู้ซื้อและผู้ขายยืนยัน
              </AsyncButton>
            </div>
          )}

          {/* ── แสดงสถานะข้อเสนอสำหรับผู้ซื้อ/ผู้ขาย (ไม่ใช่ popup) ─────── */}
          {hasMm && effectiveViewRole !== 'middleman' && hasFeeProposal && (
            <div className="dr-card">
              <div className="dr-card-title">💼 ค่าบริการที่คนกลางเสนอ</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--ink)', padding: '4px 0' }}>
                <span>ค่าบริการคนกลาง</span><span style={{ fontWeight: 700 }}>฿{(pd.proposed_mm_fee ?? 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--ink)', padding: '4px 0', marginBottom: 10 }}>
                <span>ค่าตรวจสอบสินค้า</span><span style={{ fontWeight: 700 }}>฿{(pd.proposed_inspection_fee ?? 0).toLocaleString()}</span>
              </div>
              {renderParticipantStatusRows([
                { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: !!pd.mm_fee_accepted_seller, doneText: '✅ ยอมรับแล้ว', waitText: '⏳ รอยืนยัน' },
                { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!pd.mm_fee_accepted_buyer, doneText: '✅ ยอมรับแล้ว', waitText: '⏳ รอยืนยัน' },
              ], { marginBottom: myMmFeeAccepted ? 0 : 10 })}
              {!myMmFeeAccepted && (
                <AsyncButton className="btn btn-green btn-block" onClick={() => doAction('accept_mm_fees')}>✅ ยอมรับค่าบริการนี้ — คุณยืนยันแล้ว</AsyncButton>
              )}
            </div>
          )}

          {myRole === 'buyer' && showSelectMM && renderMiddlemanPickerPanel()}
        </div>
      );
    }

    // ─── step 8: แพ็ค + จัดส่งให้คนกลาง ──────────────────────────────────
    function renderRStep8() {
      const packingEvidence = evidence.filter(e => e.type === 'packing');
      const hasAllPackingSteps = packingEvidence.length >= 3;
      const sellerShipped = !!deal!.tracking_to_middleman || ['shipped_to_middleman', 'middleman_received', 'middleman_checking', 'shipped_to_buyer', 'delivered', 'completed'].includes(deal!.status);

      if (effectiveViewRole !== 'seller') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="dr-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>📦</div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>รอผู้ขายแพ็คและจัดส่งสินค้า</div>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 14 }}>ผู้ขายกำลังถ่ายวิดีโอแพ็คของและส่งให้คนกลาง — คนกลางจะตรวจสอบสินค้าก่อนส่งต่อให้ผู้ซื้อ</p>
              {renderConfirmRows({
                sellerDone: sellerShipped, sellerText: '✅ ส่งสินค้าแล้ว', sellerWait: '⏳ กำลังแพ็ค',
                mmDone: sellerShipped, mmText: '⏳ รอรับสินค้า', mmWait: '⏳ รอรับสินค้า',
                buyerDone: false, buyerWait: '⏳ รอคนกลางส่งต่อ',
              })}
            </div>
            {renderTrackingInfoCard('พัสดุ ผู้ขาย → คนกลาง', deal!.tracking_to_middleman, deal!.tracking_to_middleman_provider)}
            {packingEvidence.length > 0 && (
              <div className="dr-card">
                <div className="dr-card-title">📷 หลักฐานการแพ็ค</div>
                {renderWizardEvidenceThumbs(packingEvidence)}
              </div>
            )}
          </div>
        );
      }

      // seller view
      const packingSteps = [
        { step: 1 as const, imageSrc: '/pack.webp', title: 'แพ็คสินค้า' },
        { step: 2 as const, imageSrc: '/Logistic.webp', title: 'โลจิสติกส์' },
        { step: 3 as const, imageSrc: '/Slip.webp', title: 'สลิปและเลขอ้างอิง' },
      ];
      const packingSlots = [packingEvidence[0] || null, packingEvidence[1] || null, packingEvidence[2] || null] as Array<typeof packingEvidence[0] | null>;
      const canUpStep = (s: 1|2|3) => s === 1 || !!packingSlots[s - 2];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {renderBuyerShippingCard()}
          <div className="dr-card">
            <div className="dr-card-title">อัปโหลด 3 ขั้นตอน</div>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.6 }}>ถ่ายวิดีโอทุกขั้นตอน แพ็ค → โลจิสติกส์ → สลิป แล้วกรอกเลขพัสดุส่งให้คนกลาง</p>
            {renderVideoUploadHint({ marginBottom: 12 })}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {packingSteps.map(item => {
                const uploaded = packingSlots[item.step - 1];
                const locked = !canUpStep(item.step);
                return (
                  <div key={item.step} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', padding: 8, background: locked ? 'var(--surface-2)' : 'var(--surface)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, textAlign: 'center' }}>ขั้น {item.step}</div>
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                      {uploaded
                        ? (
                          <DealClickableMedia
                            url={fileUrl(uploaded.file_id)}
                            alt={item.title}
                            label={item.title}
                            isVideo={isDealVideoFile(uploaded.file_name)}
                            fill
                            objectFit="cover"
                          />
                        )
                        : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: 'rgba(15,23,42,.12)' }}>{item.step}</div>}
                    </div>
                    <button type="button" className="btn btn-soft btn-block btn-sm" style={{ marginTop: 6, fontSize: 11 }}
                      disabled={locked || !!uploaded}
                      onClick={() => { if (!uploaded && !locked) { setPackingUploadStep(item.step); evidInputRef.current?.click(); } }}>
                      {uploaded ? '✅' : locked ? '🔒' : <><Icon name="upload" size={12} /> อัป</>}
                    </button>
                    {uploaded && canDeleteEvidenceItem(uploaded) && (
                      <button type="button" className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 4, color: 'var(--rose-500)', fontSize: 10 }}
                        onClick={() => deleteEvidenceItem(uploaded)}>
                        ลบ / อัปใหม่
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <input ref={evidInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={async e => {
              const f = e.target.files?.[0]; const activeStep = packingUploadStep; e.target.value = '';
              if (!f || !activeStep) return;
              await uploadFile(f, true, 'packing'); setPackingUploadStep(null);
            }} />
            <div style={{ fontSize: 12, color: hasAllPackingSteps ? 'var(--green-600)' : 'var(--muted)', marginTop: 10 }}>
              {hasAllPackingSteps ? '✅ อัปโหลดครบ 3 ขั้นแล้ว' : `อัปโหลดแล้ว ${packingEvidence.length}/3 ขั้น`}
            </div>
          </div>
          <div className="dr-card">
            <div className="dr-card-title">🚚 จัดส่งให้คนกลาง</div>
            <select className="dr-select" value={trackingProviderInput} onChange={e => setTrackingProviderInput(e.target.value)} style={{ marginBottom: 10 }}>
              <option value="">เลือกผู้ให้บริการโลจิสติกส์</option>
              {TH_LOGISTICS_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <input ref={trackingInputRef} type="text" className="dr-select" value={trackingInput} onChange={e => setTrackingInput(e.target.value)} placeholder="เลขพัสดุ (ส่งให้คนกลาง)" style={{ marginBottom: 12 }} />
            {renderConfirmRows({
              sellerDone: sellerShipped, sellerText: '✅ ส่งสินค้าแล้ว', sellerWait: '⏳ กำลังแพ็ค',
              mmDone: false, mmWait: '⏳ รอรับสินค้า',
              buyerDone: false, buyerWait: '⏳ รอคนกลาง',
            })}
            <AsyncButton className="btn btn-green btn-block btn-lg" style={{ marginTop: 12 }} onClick={() => {
              if (!hasAllPackingSteps) { alert('กรุณาอัปโหลดหลักฐานให้ครบ 3 ขั้นก่อน'); return; }
              const payload = getTrackingPayload();
              if (!payload) return;
              return doAction('seller_done_packing', payload);
            }}>📦 ส่งสินค้าให้คนกลางแล้ว</AsyncButton>
          </div>
        </div>
      );
    }

    // ─── step 9: คนกลางรับสินค้า ──────────────────────────────────────────
    function renderRStep9() {
      const mmReceived = ['middleman_received', 'middleman_checking', 'shipped_to_buyer', 'delivered', 'completed'].includes(deal!.status);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="dr-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
            <div style={{ fontSize: 38, marginBottom: 10 }}>📬</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>รอคนกลางรับสินค้า</div>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 14 }}>คนกลางต้องกดยืนยันรับสินค้าเมื่อได้รับพัสดุจากผู้ขาย เพื่อเริ่มขั้นตอนตรวจสอบสินค้า</p>
            {renderConfirmRows({
              sellerDone: true, sellerText: '✅ ส่งสินค้าแล้ว',
              mmDone: mmReceived, mmText: '✅ รับสินค้าแล้ว', mmWait: '⏳ รอรับสินค้า',
              buyerDone: false, buyerWait: '⏳ รอคนกลาง',
            })}
          </div>
          {renderTrackingInfoCard('พัสดุ ผู้ขาย → คนกลาง', deal!.tracking_to_middleman, deal!.tracking_to_middleman_provider)}
          {effectiveViewRole === 'middleman' && !mmReceived && (
            <div className="dr-card">
              <AsyncButton className="btn btn-green btn-block btn-lg" onClick={() => doAction('middleman_received')}>📬 รับสินค้าแล้ว — เริ่มตรวจสอบ</AsyncButton>
            </div>
          )}
        </div>
      );
    }

    // ─── step 10: คนกลางตรวจสอบสินค้า ────────────────────────────────────
    function renderRStep10() {
      const mmEvidence = evidence.filter(e => e.type === 'packing');
      const buyerConfirmed = !!deal!.buyer_confirmed_check;
      const mmDone = deal!.status === 'shipped_to_buyer' || deal!.status === 'delivered' || deal!.status === 'completed';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="dr-card">
            <div className="dr-card-title">🔍 การตรวจสอบสินค้า</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 12 }}>คนกลางถ่ายวิดีโอตรวจสอบสินค้า — ผู้ซื้อยืนยันว่าสินค้าตรงตามที่ตกลง — แล้วคนกลางจึงส่งต่อให้ผู้ซื้อ</p>
            {renderConfirmRows({
              sellerDone: true, sellerText: '✅ ส่งสินค้าแล้ว',
              mmDone: mmDone, mmText: '✅ ตรวจเสร็จและส่งต่อแล้ว', mmWait: '⏳ กำลังตรวจสอบ',
              buyerDone: buyerConfirmed, buyerText: '✅ ยืนยันสินค้าไม่มีปัญหา', buyerWait: '⏳ รอยืนยัน',
            })}
          </div>
          {/* คนกลาง: อัปโหลดหลักฐานการตรวจ */}
          {effectiveViewRole === 'middleman' && !mmDone && (
            <div className="dr-card">
              <div className="dr-card-title">📹 อัปโหลดวิดีโอตรวจสินค้า</div>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>ถ่ายวิดีโอขณะตรวจสอบสินค้าเพื่อเป็นหลักฐาน</p>
              {renderVideoUploadHint({ marginBottom: 10 })}
              <button type="button" className="btn btn-soft btn-block" onClick={() => evidInputRef.current?.click()}>
                <Icon name="upload" size={16} /> อัปโหลดวิดีโอตรวจสอบ
              </button>
              <input ref={evidInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }}
                onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; await uploadFile(f, true, 'packing'); }} />
              {mmEvidence.length > 0 && renderWizardEvidenceThumbs(mmEvidence, true)}
            </div>
          )}
          {/* ผู้ซื้อ: ยืนยันสินค้าตรงตามที่ตกลง */}
          {effectiveViewRole === 'buyer' && !buyerConfirmed && (
            <div className="dr-card" style={{ background: 'var(--accent-soft)', borderColor: 'color-mix(in srgb,var(--accent) 25%,transparent)' }}>
              <div className="dr-card-title">✅ ยืนยันสินค้าไม่มีปัญหา</div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>คนกลางกำลังตรวจสอบสินค้า หากสินค้าตรงตามที่ตกลงไว้ กดยืนยัน เพื่อให้คนกลางส่งของต่อให้คุณได้</p>
              <AsyncButton className="btn btn-green btn-block btn-lg" onClick={() => doAction('buyer_confirm_check')}>✅ ยืนยัน — สินค้าตรงตามที่ตกลง</AsyncButton>
              <AsyncButton className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 8, color: '#b22441' }} onClick={() => {
                const r = prompt('อธิบายปัญหาที่พบ:'); if (!r?.trim()) return; return doAction('dispute', { reason: r.trim() });
              }}>⚠️ แจ้งปัญหาสินค้าไม่ตรงปก</AsyncButton>
            </div>
          )}
          {/* คนกลาง: ส่งสินค้าให้ผู้ซื้อ (หลังผู้ซื้อยืนยัน) */}
          {effectiveViewRole === 'middleman' && buyerConfirmed && !mmDone && (
            <div className="dr-card">
              <div className="dr-card-title">🚚 จัดส่งให้ผู้ซื้อ</div>
              <select className="dr-select" value={trackingProviderInput} onChange={e => setTrackingProviderInput(e.target.value)} style={{ marginBottom: 10 }}>
                <option value="">เลือกผู้ให้บริการโลจิสติกส์</option>
                {TH_LOGISTICS_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <input ref={trackingInputRef} type="text" className="dr-select" value={trackingInput} onChange={e => setTrackingInput(e.target.value)} placeholder="เลขพัสดุส่งให้ผู้ซื้อ" style={{ marginBottom: 12 }} />
              <AsyncButton className="btn btn-green btn-block btn-lg" onClick={() => {
                const payload = getTrackingPayload(); if (!payload) return;
                return doAction('middleman_ship_to_buyer', payload);
              }}>🚚 จัดส่งสินค้าให้ผู้ซื้อแล้ว</AsyncButton>
            </div>
          )}
        </div>
      );
    }

    // ─── step 11: จัดส่งให้ผู้ซื้อ (รอผู้ซื้อรับ) ──────────────────────────
    function renderRStep11() {
      const buyerReceived = ['delivered', 'completed'].includes(deal!.status);
      const unboxEvidence = evidence.filter(e => e.type === 'receive');
      if (effectiveViewRole !== 'buyer') {
        return (
          <div className="dr-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
            <div style={{ fontSize: 38, marginBottom: 10 }}>🚚</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>จัดส่งแล้ว — รอผู้ซื้อรับ</div>
            {renderTrackingInfoCard('พัสดุ คนกลาง → ผู้ซื้อ', deal!.tracking_to_buyer, deal!.tracking_to_buyer_provider)}
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 14 }}>ผู้ซื้อต้องถ่ายวิดีโอก่อนแกะกล่อง แล้วกดยืนยันรับ — ระบบจะโอนเงินให้ผู้ขายและคืนเครดิตคนกลางทันที</p>
            {renderConfirmRows({
              sellerDone: true, sellerText: '✅ เสร็จสมบูรณ์',
              mmDone: true, mmText: '✅ ส่งสินค้าแล้ว',
              buyerDone: buyerReceived, buyerText: '✅ ยืนยันรับแล้ว', buyerWait: '⏳ รอยืนยันรับ',
            })}
            {unboxEvidence.length > 0 && renderWizardEvidenceThumbs(unboxEvidence)}
          </div>
        );
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {renderTrackingInfoCard('พัสดุ คนกลาง → ผู้ซื้อ', deal!.tracking_to_buyer, deal!.tracking_to_buyer_provider)}
          <div className="dr-card" style={{ background: '#fff8ef', borderColor: '#ffe0b2' }}>
            <div className="dr-card-title">📹 ถ่ายวิดีโอก่อนแกะกล่อง</div>
            <div style={{ fontSize: 13, color: '#8a5a00', lineHeight: 1.6, marginBottom: 8 }}>⚠️ ต้องถ่ายวิดีโอตอนแกะกล่องทุกครั้ง หากไม่มีวิดีโอก่อนแกะ จะถือว่าสินค้าถูกต้องและเรียกร้องกับผู้ขายไม่ได้</div>
            {renderVideoUploadHint({ marginBottom: 12 })}
            <button onClick={() => buyerEvidInputRef.current?.click()} className="btn btn-soft btn-block"><Icon name="upload" size={16} /> อัปโหลดวิดีโอก่อนแกะ</button>
            <input ref={buyerEvidInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={async e => { const files = Array.from(e.target.files || []); e.target.value = ''; for (const f of files) await uploadFile(f, true, 'receive'); }} />
            {unboxEvidence.length > 0 && <><p style={{ fontSize: 12, color: 'var(--green-600)', marginTop: 8 }}>✅ อัปโหลดแล้ว {unboxEvidence.length} ไฟล์</p>{renderWizardEvidenceThumbs(unboxEvidence, true)}</>}
          </div>
          <div className="dr-card">
            {renderConfirmRows({
              sellerDone: true, sellerText: '✅ เสร็จสมบูรณ์',
              mmDone: true, mmText: '✅ ส่งสินค้าแล้ว',
              buyerDone: buyerReceived, buyerText: '✅ ยืนยันรับแล้ว', buyerWait: '⏳ รอยืนยัน',
            })}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <AsyncButton className="btn btn-green btn-block btn-lg" disabled={acting} onClick={() => {
                if (!unboxEvidence.length && !confirm('ยังไม่ได้อัปโหลดวิดีโอก่อนแกะกล่อง — ยืนยันรับสินค้าต่อไหม?')) return;
                return doAction('buyer_received');
              }}>🎉 ยืนยันรับสินค้า — ดีลเสร็จสมบูรณ์</AsyncButton>
              <AsyncButton className="btn btn-ghost btn-block" disabled={acting} onClick={() => {
                const r = prompt('อธิบายปัญหาที่พบ:'); if (!r?.trim()) return; return doAction('dispute', { reason: r.trim() });
              }} style={{ color: '#b22441' }}>⚠️ แจ้งปัญหากับสินค้า</AsyncButton>
            </div>
          </div>
        </div>
      );
    }

    // ─── step 13: โอนเงินให้ผู้ขาย (HUB) ────────────────────────────────
    function renderRStep13(outcome?: 'success' | 'cancelled' | 'disputed') {
      const pd: DealPriceState = priceState || {};
      if (outcome === 'disputed') {
        return (
          <div className="dr-card" style={{ textAlign: 'center', padding: '28px 20px', borderColor: '#fbd5dd' }}>
            <div style={{ fontSize: 38, marginBottom: 10 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: '#b22441', marginBottom: 8 }}>มีข้อพิพาท — เงินถูกอายัดไว้</div>
            {deal!.reject_reason && <p style={{ fontSize: 13.5, color: 'var(--ink)', background: '#fdeef1', border: '1px solid #fbd5dd', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 12, textAlign: 'left' }}>{deal!.reject_reason}</p>}
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 14 }}>ทีมงานกำลังตรวจสอบข้อพิพาท — คุยรายละเอียดเพิ่มเติมในแชตได้</p>
            {renderConfirmRows({
              sellerDone: false, sellerWait: '⚠️ รอทีมงาน',
              mmDone: false, mmWait: '⚠️ รอทีมงาน',
              buyerDone: false, buyerWait: '⚠️ รอทีมงาน',
              hubDone: false, hubText: '⏳ กำลังตรวจสอบ', hubWait: '⏳ กำลังตรวจสอบ',
            })}
          </div>
        );
      }
      const isCancelled = outcome === 'cancelled';
      return (
        <div className="dr-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>💸</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>
            {isCancelled ? 'ดีลถูกยกเลิก — กำลังคืนเงิน' : '🎉 ดีลสำเร็จ — กำลังโอนเงินให้ผู้ขาย'}
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 14 }}>ทีมงานกำลังโอนเงินและจะแนบสลิปยืนยันให้เห็นที่นี่</p>
          {renderConfirmRows({
            sellerDone: !isCancelled, sellerText: '⏳ รอรับเงิน', sellerWait: isCancelled ? '⏳ ดีลยกเลิก' : '⏳ รอโอนเงิน',
            mmDone: true, mmText: '✅ เสร็จสิ้น',
            buyerDone: !isCancelled, buyerText: isCancelled ? '⏳ รอรับเงินคืน' : '✅ ยืนยันรับแล้ว', buyerWait: isCancelled ? '⏳ รอรับเงินคืน' : '✅ ยืนยันรับแล้ว',
            hubDone: false, hubText: '✅ โอนแล้ว', hubWait: '⏳ กำลังโอนเงิน',
          })}
          {isCancelled && deal!.reject_reason && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>เหตุผล: {deal!.reject_reason}</p>}
        </div>
      );
    }

    // ─── step 14: เสร็จสมบูรณ์ (HUB) ────────────────────────────────────
    function renderRStep14(outcome?: 'success' | 'cancelled' | 'disputed') {
      const pd: DealPriceState = priceState || {};
      const isCancelled = outcome === 'cancelled';
      // รวบรวมสลิปทุกใบ
      const allSlips14: { label: string; fileId: string }[] = [];
      if (deal!.payment_slip_file_id) allSlips14.push({ label: 'สลิปผู้ซื้อ (ค่าสินค้า)', fileId: deal!.payment_slip_file_id });
      if (pd.seller_fee_slip) allSlips14.push({ label: 'สลิปผู้ขาย (ค่าบริการ)', fileId: pd.seller_fee_slip });
      if (pd.payout_slip_file_id) allSlips14.push({ label: 'สลิปโอนเงินให้ผู้ขาย', fileId: pd.payout_slip_file_id });
      if (pd.refund_slip_file_id) allSlips14.push({ label: 'สลิปคืนเงินให้ผู้ซื้อ', fileId: pd.refund_slip_file_id });
      // รวบรวมหลักฐานทุกประเภท
      const packingEvid14 = evidence.filter(e => e.type === 'packing');
      const receiveEvid14 = evidence.filter(e => e.type === 'receive');
      const chatEvid14 = evidence.filter(e => e.type === 'chat' || e.type === 'call');
      const inspectionEvid14 = evidence.filter(e => e.type === 'inspection' || e.type === 'check');
      const otherEvid14 = evidence.filter(e => ['other', 'meet', 'chat_text', 'testing'].includes(e.type));
      const hasEvid14 = packingEvid14.length > 0 || receiveEvid14.length > 0 || chatEvid14.length > 0 || inspectionEvid14.length > 0 || otherEvid14.length > 0;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="dr-card dr-done-card">
            <div className="dr-done-emoji">{isCancelled ? '↩️' : '🎉'}</div>
            <div className="dr-done-title">{isCancelled ? 'ดีลถูกยกเลิก — คืนเงินแล้ว' : 'ดีลเสร็จสมบูรณ์!'}</div>
            <div className="dr-done-sub">{isCancelled ? 'ศูนย์กลางโอนเงินคืนผู้ซื้อเรียบร้อยแล้ว' : 'ศูนย์กลางโอนเงินให้ผู้ขายและคืนเครดิตคนกลางเรียบร้อยแล้ว'}</div>
          </div>

          {renderCompletionReviewBlock(isCancelled)}

          {allSlips14.length > 0 && (
            <div className="dr-card">
              <div className="dr-card-title">📎 สลิปทั้งหมดในดีล</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <DealMediaThumbGallery
                  items={allSlips14.map(s => ({ fileId: s.fileId, label: s.label }))}
                  resolveUrl={fileUrl}
                  thumbHeight={180}
                  thumbWidth="min(160px, 42vw)"
                />
              </div>
            </div>
          )}
          <div className="dr-card">
            {renderConfirmRows({
              sellerDone: true, sellerText: isCancelled ? '✅ ดีลยกเลิก' : '✅ รับเงินแล้ว',
              mmDone: true, mmText: '✅ ได้รับเครดิตคืนแล้ว',
              buyerDone: true, buyerText: isCancelled ? '✅ รับเงินคืนแล้ว' : '✅ ดีลเสร็จสมบูรณ์',
              hubDone: true, hubText: '✅ โอนเงินครบแล้ว',
            })}
          </div>
          {hasEvid14 && (
            <div className="dr-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="dr-card-title">📁 หลักฐานทั้งหมดในดีล</div>
              {packingEvid14.length > 0 && (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>📦 แพ็คสินค้า ({packingEvid14.length} ไฟล์)</div>
                  {renderWizardEvidenceThumbs(packingEvid14)}
                </div>
              )}
              {receiveEvid14.length > 0 && (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>📹 วิดีโอแกะกล่อง ({receiveEvid14.length} ไฟล์)</div>
                  {renderWizardEvidenceThumbs(receiveEvid14)}
                </div>
              )}
              {inspectionEvid14.length > 0 && (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>🔍 ตรวจสอบสินค้า ({inspectionEvid14.length} ไฟล์)</div>
                  {renderWizardEvidenceThumbs(inspectionEvid14)}
                </div>
              )}
              {chatEvid14.length > 0 && (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>💬 หลักฐานแชท/วิดีโอคอล ({chatEvid14.length} ไฟล์)</div>
                  {renderWizardEvidenceThumbs(chatEvid14)}
                </div>
              )}
              {otherEvid14.length > 0 && (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>📎 หลักฐานอื่นๆ ({otherEvid14.length} ไฟล์)</div>
                  {renderWizardEvidenceThumbs(otherEvid14)}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // ─── Main render ──────────────────────────────────────────────────────
    return (
      <div className="dr-inner">
        <DealFlowBrand className="dr-brand-slot" />
        {step > 0 && renderRegularWizardProgress(step)}
        {isReviewing && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '8px 12px', marginBottom: 12, fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>
            👀 กำลังดูขั้นตอนที่ผ่านมาแล้ว (ดูอย่างเดียว) — กด &quot;ถัดไป&quot; เพื่อกลับสู่ขั้นตอนปัจจุบัน
          </div>
        )}
        {renderRoleBar()}
        <div style={isReviewing ? { pointerEvents: 'none', opacity: .55 } : undefined}>
          {step === 0 && renderWizardStep0()}
          {step === 1 && renderRStep2()}
          {step === 2 && renderRStep1()}
          {step === 3 && renderWizardStepChat()}
          {step === 4 && renderWizardStepEvidenceReview()}
          {step === 5 && renderWizardStepPrice()}
          {step === 6 && renderPaymentSection()}
          {step === 7 && renderWizardStep4()}
          {step === 8 && renderRStep8()}
          {step === 9 && renderRStep9()}
          {step === 10 && renderRStep10()}
          {step === 11 && renderRStep11()}
          {step === 12 && renderWizardStep6()}
          {step === 13 && renderRStep13(outcome)}
          {step === 14 && renderRStep14(outcome)}
        </div>
        {step >= 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18 }}>
            {step > 1
              ? <button type="button" className="btn btn-ghost" onClick={() => setWzViewStep(Math.max(1, step - 1))}>← ย้อนกลับ</button>
              : <span />}
            {step < actualStep && (
              <button type="button" className="btn btn-primary" onClick={() => goToStep(step + 1)}>ถัดไป →</button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Wizard ขั้นตอน "ประกันการเดินทาง" (deal_type === 'meetup') — 7 ขั้น
  // ═══════════════════════════════════════════════════════════════════════
  const MEETUP_WZ_TITLES = [
    'ระบุที่อยู่', 'แชทและ Video Call', 'ตรวจหลักฐาน', 'ตกลงจุดนัด',
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

  function renderMeetupWizardStepJoin() {
    const md: MeetupData = meetup || {};
    const myLoc = myRole === 'buyer' ? md.buyer_loc : myRole === 'seller' ? md.seller_loc : undefined;
    const meAccepted = (myRole === 'seller' && !!deal!.seller_accepted_terms) || (myRole === 'buyer' && !!deal!.buyer_accepted_terms);
    const isParty = myRole === 'buyer' || myRole === 'seller';
    async function submitJoin() {
      if (!myLoc?.province && !meetAddr.tambon) { alert('กรุณาเลือกที่อยู่ให้ถึงระดับตำบล'); return; }
      if (!myLoc?.province) await doAction('meetup_set_location', { loc: meetAddr });
      await doAction('accept_terms');
    }
    return (
      <div className="dr-card">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 38, marginBottom: 6 }}>📍</div>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
            ระบุที่อยู่ของคุณเพื่อเริ่มดีลนัดรับ
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6 }}>ระบบจะใช้จังหวัดเพื่อคำนวณระยะทางและแนะนำจุดนัดพบที่เหมาะสม</p>
        </div>
        {isParty && (
          myLoc?.province ? (
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 12, fontSize: 13.5, color: 'var(--green-600)' }}>
              ✅ ที่อยู่ของคุณ: {addressLabel(myLoc)}
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 8 }}>
                📍 ที่อยู่ของฉัน ({myRole === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}) — เลือกถึงระดับตำบล
              </label>
              <AddressPicker value={meetAddr} onChange={setMeetAddr} />
            </div>
          )
        )}
        <div style={{ marginTop: 12 }}>
          {renderParticipantStatusRows([
            { roleLabel: 'ผู้ขาย', name: deal!.seller_name || '-', ok: !!deal!.seller_accepted_terms, doneText: '✅ ระบุที่อยู่แล้ว' },
            { roleLabel: 'ผู้ซื้อ', name: deal!.buyer_name || '-', ok: !!deal!.buyer_accepted_terms, doneText: '✅ ระบุที่อยู่แล้ว' },
          ], { marginBottom: 14 })}
        </div>
        {isParty && !meAccepted && (
          <AsyncButton
            className="btn btn-green btn-block btn-lg"
            disabled={acting || (!myLoc?.province && !meetAddr.tambon)}
            onClick={submitJoin}
          >
            📍 ยืนยันที่อยู่และเริ่มดีล →
          </AsyncButton>
        )}
        {isParty && meAccepted && (
          <p style={{ fontSize: 13.5, color: 'var(--green-600)', textAlign: 'center' }}>✅ คุณยืนยันที่อยู่แล้ว — รออีกฝ่าย</p>
        )}
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
            <button type="button" className="btn btn-green btn-block" onClick={() => setWzViewStep(5)}>ไปวางเงินประกัน →</button>
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
              <AsyncButton type="button" className="btn btn-ghost btn-block btn-sm" disabled={acting} onClick={() => doAction('meetup_respond', { accept: false })}>↩️ ยกเลิกข้อเสนอของฉัน</AsyncButton>
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
                <AsyncButton type="button" className="btn btn-green flex-1" onClick={submitPropose}>✅ ส่งข้อเสนอ</AsyncButton>
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
                <AsyncButton type="button" className="btn btn-green flex-1"
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
              ? <DealClickableMedia url={fileUrl(r.slip)} alt="สลิปเงินประกัน" label="สลิปเงินประกัน" maxHeight={160} />
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
                  ? <DealClickableMedia url={fileUrl(r.slip)} alt={r.label} label={r.label} maxHeight={120} objectFit="cover" />
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
    // หลักฐานการเจอกัน — บังคับอัปโหลดอย่างน้อย 1 ชิ้นก่อนกด "เจอกันแล้ว"
    const meetEvidence = evidence.filter(e => e.type === 'meet' && e.uploaded_by === myId);
    const hasMeetEvidence = meetEvidence.length > 0;
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
          <>
            {/* อัปโหลดหลักฐานการเจอกัน — บังคับก่อนกด "เจอกันแล้ว" */}
            <div className="dr-card">
              <div className="dr-card-title">📷 หลักฐานการเจอกัน (บังคับ)</div>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>ถ่ายรูปหรือวิดีโอขณะเจอกัน — ต้องอัปโหลดอย่างน้อย 1 ชิ้นก่อนกดยืนยัน</p>
              {meetEvidence.length > 0 && (
                <DealMediaThumbGallery
                  items={meetEvidence.filter(e => e.file_id).map(item => ({ id: item.id, fileId: item.file_id!, fileName: item.file_name }))}
                  resolveUrl={fileUrl}
                  thumbHeight={80}
                  thumbWidth="min(90px, 22vw)"
                  showLabels={false}
                />
              )}
              <button type="button" className="btn btn-soft btn-block btn-sm" onClick={() => meetupMeetEvidInputRef.current?.click()}>
                <Icon name="upload" size={15} /> {meetEvidence.length > 0 ? 'เพิ่มหลักฐาน' : 'อัปโหลดรูป/วิดีโอหลักฐาน'}
              </button>
              <input ref={meetupMeetEvidInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }}
                onChange={async e => { const files = Array.from(e.target.files || []); e.target.value = ''; for (const f of files) await uploadFile(f, true, 'meet'); }} />
            </div>
            <div className="dr-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!myDepartedAt && (
                <AsyncButton className="btn btn-green btn-block" onClick={() => { startShareLoc(); return doAction('meetup_depart'); }}>🚗 ออกเดินทางแล้ว — แชร์ตำแหน่ง</AsyncButton>
              )}
              {myDepartedAt && (
                <>
                  {!hasMeetEvidence && (
                    <p style={{ fontSize: 12.5, color: '#b22441', textAlign: 'center' }}>⚠️ อัปโหลดหลักฐานการเจอกันก่อน จึงจะยืนยันได้</p>
                  )}
                  <AsyncButton
                    className="btn btn-green btn-block btn-lg"
                    disabled={!hasMeetEvidence}
                    onClick={() => { if (!confirm('ยืนยันว่านัดเจอกันสำเร็จแล้ว?')) return; stopShareLoc(); return doAction('meetup_met'); }}
                  >✅ เจอกันแล้ว — ยืนยัน</AsyncButton>
                </>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderMeetupWizardStepWaitRefund(outcome?: 'completed' | 'cancelled') {
    const md: MeetupData = meetup || {};
    const isCancelled = outcome === 'cancelled';
    // gallery หลักฐานทั้งหมด: สลิปประกัน + หลักฐานการเจอกัน (สลิปคืนเงินยังไม่มีในขั้นนี้)
    const depositSlips = [
      md.buyer_slip && { label: 'สลิปประกันผู้ซื้อ', id: md.buyer_slip },
      md.seller_slip && { label: 'สลิปประกันผู้ขาย', id: md.seller_slip },
    ].filter(Boolean) as { label: string; id: string }[];
    const meetEvidItems = evidence.filter(e => e.type === 'meet');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {isCancelled ? (
          <div className="dr-card" style={{ textAlign: 'center', padding: '30px 20px', borderColor: '#fbd5dd' }}>
            <div style={{ fontSize: 38, marginBottom: 10 }}>↩️</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: '#b22441', marginBottom: 8 }}>ดีลถูกยกเลิก</div>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>ศูนย์กลางกำลังดำเนินการคืนเงินประกันให้ทั้งสองฝ่าย</p>
          </div>
        ) : (
          <div className="dr-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
            <div style={{ fontSize: 38, marginBottom: 10 }}>⏳</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', marginBottom: 8 }}>นัดพบสำเร็จ! 🎉 — ศูนย์กลางกำลังคืนเงินประกัน</div>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.7 }}>ทีมงานกำลังตัดสินและโอนเงินประกันคืน — จะแจ้งให้ทราบเมื่อโอนแล้ว</p>
          </div>
        )}

        {renderCompletionReviewBlock(isCancelled)}

        {/* gallery สลิปวางประกัน */}
        {depositSlips.length > 0 && (
          <div className="dr-card">
            <div className="dr-card-title">🧾 สลิปเงินประกัน</div>
            <DealMediaThumbGallery
              items={depositSlips.map(s => ({ fileId: s.id, label: s.label }))}
              resolveUrl={fileUrl}
              thumbHeight={110}
            />
          </div>
        )}
        {meetEvidItems.length > 0 && (
          <div className="dr-card">
            <div className="dr-card-title">📷 หลักฐานการเจอกัน</div>
            <DealMediaThumbGallery
              items={meetEvidItems.filter(e => e.file_id).map(item => ({ id: item.id, fileId: item.file_id!, fileName: item.file_name }))}
              resolveUrl={fileUrl}
              thumbHeight={90}
              showLabels={false}
            />
          </div>
        )}
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
    const depositSlips = [
      md.buyer_slip && { label: 'สลิปประกันผู้ซื้อ', id: md.buyer_slip },
      md.seller_slip && { label: 'สลิปประกันผู้ขาย', id: md.seller_slip },
    ].filter(Boolean) as { label: string; id: string }[];
    const refundSlips = [
      md.buyer_refund_slip && { label: 'สลิปคืนเงินผู้ซื้อ', id: md.buyer_refund_slip },
      md.seller_refund_slip && { label: 'สลิปคืนเงินผู้ขาย', id: md.seller_refund_slip },
    ].filter(Boolean) as { label: string; id: string }[];
    const meetEvidItems = evidence.filter(e => e.type === 'meet');
    const allSlips = [...depositSlips, ...refundSlips];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dr-card dr-done-card">
          <div className="dr-done-emoji">🎉</div>
          <div className="dr-done-title">ดีลประกันการเดินทางเสร็จสมบูรณ์!</div>
          {outcomeLabel && <div className="dr-done-sub">ผลการคืนเงินประกัน: {outcomeLabel}</div>}
          {md.refund_decision_note && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>{md.refund_decision_note}</div>}
        </div>

        {renderCompletionReviewBlock(false)}

        {/* gallery สลิปทั้งหมด */}
        {allSlips.length > 0 && (
          <div className="dr-card">
            <div className="dr-card-title">🧾 สลิปทั้งหมดในดีล</div>
            <DealMediaThumbGallery
              items={allSlips.map(s => ({ fileId: s.id, label: s.label }))}
              resolveUrl={fileUrl}
              thumbHeight={110}
            />
          </div>
        )}
        {meetEvidItems.length > 0 && (
          <div className="dr-card">
            <div className="dr-card-title">📷 หลักฐานการเจอกัน</div>
            <DealMediaThumbGallery
              items={meetEvidItems.filter(e => e.file_id).map(item => ({ id: item.id, fileId: item.file_id!, fileName: item.file_name }))}
              resolveUrl={fileUrl}
              thumbHeight={90}
              showLabels={false}
            />
          </div>
        )}
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
    function goToMeetupStep(nextStep: number) {
      const safeNextStep = Math.min(actualStep, nextStep);
      if (step === 1 && safeNextStep === 2) {
        step3PendingRef.current = safeNextStep;
        setShowStep3Warning(true);
        return;
      }
      setWzViewStep(safeNextStep);
    }
    return (
      <div className="dr-inner">
        <DealFlowBrand className="dr-brand-slot" />
        {step > 0 && renderMeetupWizardProgress(step)}
        {isReviewing && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '8px 12px', marginBottom: 12, fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>
            👀 กำลังดูขั้นตอนที่ผ่านมาแล้ว (ดูอย่างเดียว)
          </div>
        )}
        <div style={isReviewing ? { pointerEvents: 'none', opacity: .55 } : undefined}>
          {step === 0 && renderWizardStep0()}
          {step === 1 && renderMeetupWizardStepJoin()}
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
              <button type="button" className="btn btn-primary" onClick={() => goToMeetupStep(step + 1)}>ถัดไป →</button>
            )}
          </div>
        )}
      </div>
    );
  }

  function handleSimpleJoin(role: 'buyer' | 'seller') {
    const notLoggedIn = !myId;
    const dealUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (notLoggedIn) router.push(`/login?returnTo=${encodeURIComponent(dealUrl || `/deal/${dealId}`)}`);
    else doAction(role === 'buyer' ? 'join_as_buyer' : 'join_as_seller');
  }

  /** ขั้น 0 ดีลแบบง่าย — layout เดียวกันทั้งผู้สร้างและผู้เข้าร่วม จบในหน้าเดียว */
  function renderSimplePreJoinView() {
    const isGuestViewer = myRole === 'guest' || myRole === '';
    const dealSlice = {
      title: deal!.title,
      description: deal!.description,
      price: deal!.price,
      images: deal!.images,
      warranty_years: deal!.warranty_years,
      warranty_months: deal!.warranty_months,
      warranty_days: deal!.warranty_days,
      fee_payer: deal!.fee_payer,
      seller_id: deal!.seller_id,
      buyer_id: deal!.buyer_id,
      seller_name: deal!.seller_name,
      buyer_name: deal!.buyer_name,
    };
    if (isGuestViewer) {
      return (
        <SimpleDealPreJoinScreen
          deal={dealSlice}
          mode="guest"
          notLoggedIn={!myId}
          canBeBuyer={!deal!.buyer_id}
          canBeSeller={!deal!.seller_id}
          onJoin={handleSimpleJoin}
        />
      );
    }
    return (
      <SimpleDealPreJoinScreen
        deal={dealSlice}
        mode="wait"
        copied={copied}
        onCopyLink={copyLink}
      />
    );
  }

  function renderSimpleWizard() {
    const { step: actualStep, outcome } = getSimpleStep();
    const step = Math.min(wzViewStep ?? actualStep, actualStep);
    const isReviewing = step < actualStep;
    function goToSimpleStep(nextStep: number) {
      setWzViewStep(Math.min(actualStep, nextStep));
    }
    if (step === 0) return renderSimplePreJoinView();
    const stepPayFocus = step === 1;
    const stepFocus = (step >= 3 && step < WZ_TOTAL) || stepPayFocus;
    const showDealMedia = step < 3 && !stepPayFocus;

    const reviewBanner = isReviewing ? (
      <div className="simple-deal-shell__review">
        👀 กำลังดูขั้นตอนที่ผ่านมาแล้ว (ดูอย่างเดียว) — กด &quot;ถัดไป&quot; เพื่อกลับไปขั้นตอนปัจจุบัน
      </div>
    ) : undefined;

    const nav = step >= 1 && !stepFocus ? (
      <div className="simple-deal-shell__nav">
        {step > 1
          ? <button type="button" className="btn btn-ghost" onClick={() => setWzViewStep(Math.max(1, step - 1))}>← ย้อนกลับ</button>
          : <span />}
        {step < actualStep && (
          <button type="button" className="btn btn-primary" onClick={() => goToSimpleStep(step + 1)}>ถัดไป →</button>
        )}
      </div>
    ) : stepFocus && isReviewing ? (
      <div className="simple-deal-step-nav">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setWzViewStep(actualStep)}>กลับขั้นปัจจุบัน →</button>
      </div>
    ) : undefined;

    return (
      <SimpleDealShell
        focus={stepFocus}
        progress={step > 0 ? renderWizardProgress(step) : undefined}
        reviewBanner={reviewBanner}
        nav={nav}
      >
        {showDealMedia && <DealFlowBrand className="dr-brand-slot" />}
        {showDealMedia && (
          <DealProductGallery
            images={deal!.images}
            warrantyYears={deal!.warranty_years}
            warrantyMonths={deal!.warranty_months}
            warrantyDays={deal!.warranty_days}
            compact
          />
        )}
        <div style={isReviewing ? { pointerEvents: 'none', opacity: .55 } : undefined}>
          {step === 1 && renderPaymentSection({ compact: true })}
          {step === 2 && renderWizardStep4()}
          {step === 3 && renderWizardStep5()}
          {step === 4 && renderWizardStep6()}
          {step === 5 && renderSimpleWizardFinal(outcome)}
        </div>
      </SimpleDealShell>
    );
  }

  function renderMarketplaceWizard() {
    const { step: actualStep, outcome } = getMarketplaceCheckoutStep();
    const step = Math.min(wzViewStep ?? actualStep, actualStep);
    const isReviewing = step < actualStep;
    return (
      <div className="dr-inner">
        <DealFlowBrand className="dr-brand-slot" />
        {step >= 2 && renderMarketplaceProgress(step)}
        {isReviewing && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '8px 12px', marginBottom: 12, fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>
            👀 กำลังดูขั้นตอนที่ผ่านมาแล้ว (ดูอย่างเดียว)
          </div>
        )}
        <div style={isReviewing ? { pointerEvents: 'none', opacity: .55 } : undefined}>
          {step === 2 && renderMarketplacePaymentSection()}
          {step === 4 && renderWizardStep4()}
          {step === 5 && renderWizardStep5()}
          {step === 6 && renderWizardStep6()}
          {step === 7 && renderWizardStep7(outcome)}
          {step === 8 && renderWizardStep8(outcome)}
        </div>
        {step >= 2 && step < actualStep && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button type="button" className="btn btn-primary" onClick={() => setWzViewStep(actualStep)}>กลับขั้นปัจจุบัน →</button>
          </div>
        )}
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────
  const dealSubtitle = `${dealCode(deal.id)} · ${statusText(deal)} · ฿${deal.price.toLocaleString()}${deal.created_at ? ` · สร้าง ${formatDealCreatedAt(deal.created_at)}` : ''}`;
  const chatBadge = (() => { const n = msgs.filter(m => m.role !== 'system').length; return n > 0 && !floatChatOpen ? (n > 99 ? '99+' : n) : undefined; })();

  const dealWizardBody = (
    <>
      {tab === 'steps' && isMarketplaceCheckout && renderMarketplaceWizard()}
      {tab === 'steps' && isSimple && !isMarketplaceCheckout && renderSimpleWizard()}
      {tab === 'steps' && isMeetup && renderMeetupWizard()}
      {tab === 'steps' && !isSimple && !isMeetup && !isMarketplaceCheckout && renderRegularWizard()}
      {floatChatOpen && (
        <FloatingChatBox
          msgs={msgs}
          myId={myId}
          chatInput={chatInput}
          setChatInput={setChatInput}
          sending={sending}
          acting={acting}
          fileInputRef={callFileInputRef}
          onSend={() => { if (chatInput.trim() && chatIsOpen()) sendMsg(chatInput); }}
          onUpload={async (files) => { for (const f of files) { if (!isVideoFile(f) && f.size > 50 * 1024 * 1024) { alert(`${f.name} ใหญ่เกิน 50MB`); continue; } await uploadFile(f); } }}
          onClose={() => setFloatChatOpen(false)}
          onPin={saveMsgEvidence}
          onAutoScroll={() => chatBottomRef.current?.scrollIntoView({ behavior: 'auto' })}
          title="💬 แชทดีล"
          closedHint={!chatIsOpen() ? '⏳ รอบุคคลที่เกี่ยวข้องเข้าร่วมดีลก่อนจึงจะแชทได้' : undefined}
        />
      )}
      {tab === 'evidence' && renderEvidencePanel()}
    </>
  );

  const videoCallOverlay = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0d1117', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,.4)', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
          {callStatus === 'outgoing' ? '📞 กำลังโทร…' : callStatus === 'connecting' ? '🔗 กำลังเชื่อมต่อ…' : '📹 วิดีโอคอล'} (จำกัด 10 นาทีต่อครั้ง)
        </span>
        {isActiveCall && <CallRecorder dealId={dealId} onSaveEvidence={saveCallEvidence} />}
      </div>
      <div style={{ flex: 1, minHeight: '60vh' }}>
        <DealVideoCall
          dealId={dealId}
          getAuthHeaders={getAuthHeaders}
          onEnd={endCall}
          mode="video"
          onTimeout={() => { setCallTimedOut(true); endCall(); }}
          onConnected={() => { if (callStatus === 'connecting') setCallStatus('active'); }}
          onAnswered={onCallAnswered}
        />
      </div>
      {floatChatOpen && (
        <FloatingChatBox
          msgs={msgs}
          myId={myId}
          chatInput={chatInput}
          setChatInput={setChatInput}
          sending={sending}
          acting={acting}
          fileInputRef={callFileInputRef}
          onSend={() => { if (chatInput.trim()) sendMsg(chatInput); }}
          onUpload={async (files) => { for (const f of files) { if (!isVideoFile(f) && f.size > 50 * 1024 * 1024) { alert(`${f.name} ใหญ่เกิน 50MB`); continue; } await uploadFile(f); } }}
          onClose={() => setFloatChatOpen(false)}
          onPin={saveMsgEvidence}
          onAutoScroll={() => chatBottomRef.current?.scrollIntoView({ behavior: 'auto' })}
          title="💬 แชทระหว่างคอล"
        />
      )}
    </div>
  );

  const mobileFloatBar = canCall ? (
    <>
      <DealCommOrb active={floatChatOpen} onClick={() => setFloatChatOpen(v => !v)} icon="💬" label="แชท" badge={chatBadge} />
      {voiceBgActive ? (
        <DealCommOrb className="voice-active" onClick={endCall} icon="📞" label={fmtVoiceDur(callSeconds)} />
      ) : incomingCall ? (
        <DealCommOrb className="ringing" onClick={acceptIncomingCall} icon="📞" label="รับสาย" />
      ) : callStatus === 'idle' ? (
        <DealCommOrb className="voice" onClick={() => startCall('voice')} icon="📞" label="โทร" />
      ) : null}
      {callStatus === 'idle' && !incomingCall && (
        <DealCommOrb className="video" disabled icon="📹" label="วิดีโอ" />
      )}
    </>
  ) : undefined;

  return (
    <>
      <div className="deal-mobile-shell">
        <DealRoomApp
          title={deal.title}
          subtitle={dealSubtitle}
          onBack={() => router.back()}
          showTabs={isMeetup}
          tab={tab === 'evidence' ? 'evidence' : 'steps'}
          onTab={setTab}
          inVideoCall={isInCall && callMode === 'video'}
          videoCallOverlay={videoCallOverlay}
          floatBar={mobileFloatBar}
          floatBarBadge={chatBadge}
        >
          {dealWizardBody}
        </DealRoomApp>
      </div>

      <div className="deal-desktop-shell">
        <div className="dr-root">
          <InAppBanner />
          <AppHeaderBar
            className="dr-header app-header-bar"
            title={deal.title}
            subtitle={dealSubtitle}
            titleIcon="package"
            onBack={() => router.back()}
          />

          {isInCall && callMode === 'video' ? videoCallOverlay : (
            <>
              {isMeetup && (
              <nav className="dr-tabs">
                {(['steps', 'evidence'] as const).map(k => (
                  <button key={k} className={`dr-tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
                    {k === 'steps' ? 'ขั้นตอน' : 'หลักฐาน'}
                  </button>
                ))}
              </nav>
              )}
              {!isSimple && !isMeetup && !isMarketplaceCheckout && (
              <nav className="dr-tabs" style={{ display: 'none' }}>
                {(['steps', 'evidence'] as const).map(k => (
                  <button key={k} className={`dr-tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
                    {k === 'steps' ? 'ขั้นตอน' : 'หลักฐาน'}
                  </button>
                ))}
              </nav>
              )}

              <main className={`dr-body${isSimple ? ' dr-body--simple-deal' : ''}`}>
                {dealWizardBody}
              </main>
            </>
          )}

          {canCall && (
            <DealCommFloatbar badge={chatBadge}>
              <DealCommOrb active={floatChatOpen} onClick={() => setFloatChatOpen(v => !v)} icon="💬" label="แชท" badge={chatBadge} />
              {voiceBgActive ? (
                <DealCommOrb className="voice-active" onClick={endCall} icon="📞" label={fmtVoiceDur(callSeconds)} />
              ) : incomingCall ? (
                <DealCommOrb className="ringing" onClick={acceptIncomingCall} icon="📞" label="รับสาย" />
              ) : callStatus === 'idle' ? (
                <DealCommOrb className="voice" onClick={() => startCall('voice')} icon="📞" label="โทร" />
              ) : null}
              {callStatus === 'idle' && !incomingCall && (
                <DealCommOrb className="video" disabled icon="📹" label="วิดีโอ" />
              )}
            </DealCommFloatbar>
          )}
        </div>
      </div>

      {/* voice call background — mount DealVideoCall แบบซ่อน
          ครอบ outgoing/connecting/active เพื่อให้ useRemoteParticipants detect รับสายได้ตลอด
          (เสียงทำงานตลอด, แสดง tile เฉพาะตอน active) */}
      {(callStatus === 'outgoing' || callStatus === 'connecting' || voiceBgActive) && callMode === 'voice' && (
        <div className="dr-voice-bg">
          <DealVideoCall
            dealId={dealId}
            getAuthHeaders={getAuthHeaders}
            onEnd={endCall}
            mode="voice"
            background={!voiceBgActive}
            onTimeout={() => { setCallTimedOut(true); endCall(); }}
            onConnected={() => { if (callStatus === 'connecting') setCallStatus('active'); }}
            onAnswered={onCallAnswered}
          />
        </div>
      )}
      {/* ─── ringing overlay (ผู้โทรรอสาย — ทั้ง voice/video) ─── */}
      {callStatus === 'outgoing' && (
        <div className="lk-ringing-overlay" role="status" aria-label="กำลังโทร">
          <div className="lk-ringing-avatar">{dealTitle().charAt(0) || '?'}</div>
          <div className="lk-ringing-name">{dealTitle()}</div>
          <div className="lk-ringing-status">
            กำลัง{callMode === 'voice' ? 'โทร' : 'วิดีโอคอล'}
            <span className="lk-ringing-dots"><span /><span /><span /></span>
          </div>
          <button type="button" className="lk-ringing-hangup" onClick={endCall} title="วางสาย" aria-label="วางสาย">
            ✕
          </button>
        </div>
      )}
      {/* popup รับสายเรียกเข้า — ลอยกลางล่าง */}
      {incomingCall && (
        <div className="dr-incoming-call" role="alertdialog" aria-label="สายเรียกเข้า">
          <div className="dr-incoming-call-ic">📞</div>
          <div className="dr-incoming-call-name">สายเรียกเข้าจาก {incomingCall.callerName}</div>
          <div className="dr-incoming-call-sub">{incomingCall.mode === 'voice' ? 'โทรเสียง' : 'วิดีโอคอล'}</div>
          <div className="dr-incoming-call-actions">
            <button type="button" className="dr-incoming-call-accept" onClick={acceptIncomingCall}>✅ รับสาย</button>
            <button type="button" className="dr-incoming-call-decline" onClick={declineIncomingCall}>✕ ปฏิเสธ</button>
          </div>
        </div>
      )}
      {/* แจ้งเตือนเมื่อสายไม่รับ / อีกฝ่ายวางสาย */}
      {callEndedReason && (
        <div className="dr-call-timeout-toast" role="status">
          <div style={{ fontSize: 22, marginBottom: 6 }}>{callEndedReason.title.charAt(0)}</div>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', marginBottom: 4 }}>{callEndedReason.title.slice(2)}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>{callEndedReason.sub}</div>
          <button className="btn btn-green btn-sm btn-block" onClick={() => setCallEndedReason(null)}>รับทราบ</button>
        </div>
      )}
      {/* แจ้งเตือนเมื่อคอลหมดเวลา 10 นาที */}
      {callTimedOut && (
        <div className="dr-call-timeout-toast" role="status">
          <div style={{ fontSize: 22, marginBottom: 6 }}>⏰</div>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', marginBottom: 4 }}>หมดเวลาคุย 10 นาที</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>แตะปุ่ม โทร หรือ วิดีโอ ด้านล่างเพื่อเริ่มคุยใหม่ได้เลย</div>
          <button className="btn btn-green btn-sm btn-block" onClick={() => setCallTimedOut(false)}>รับทราบ</button>
        </div>
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
              📹 สำคัญ: โปรดใช้ปุ่ม แชท / โทร / วิดีโอ ด้านล่างจอ เพื่อพูดคุย ดูสภาพสินค้า และตกลงรายละเอียดให้เรียบร้อยก่อน — แล้วอัปโหลดรูป/วิดีโอหลักฐานในขั้นตอนต่อไปเพื่อใช้ยืนยันกรณีมีปัญหา
            </div>
            <AsyncButton className="btn btn-green btn-block" onClick={() => { setShowTerms(false); setTab('chat'); return doAction('accept_terms'); }}>✅ ยอมรับข้อตกลงและดำเนินการต่อ</AsyncButton>
            <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => setShowTerms(false)}>ยกเลิก</button>
          </div>
        </div>
      ); })()}
      {showStep3Warning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(11, 18, 32, .72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 110 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 680, background: 'var(--surface)', borderRadius: 'var(--r-xl)', border: '1px solid #f7c6cd', boxShadow: '0 30px 70px rgba(12, 24, 54, .28)', padding: '24px 20px 20px', textAlign: 'center' }}>

            <img src="/Lawn.webp" alt="คำเตือนก่อนเข้าหน้าพูดคุย" style={{ width: 'min(100%, 600px)', height: 'auto', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block', margin: '0 auto 16px', borderRadius: 'var(--r-lg)', border: '1px solid var(--line)', background: 'var(--surface-2)' }} />
            <div style={{ fontSize: 'clamp(15px, 2.4vw, 18px)', fontWeight: 700, color: 'var(--ink)', marginBottom: 18 }}>*หากละเลยอาจเสียเปรียบในกรณีเกิดปัญหา*</div>
            <button
              type="button"
              className="btn btn-green btn-lg"
              style={{ minWidth: 180 }}
              onClick={() => {
                const nextStep = step3PendingRef.current ?? 3;
                step3PendingRef.current = null;
                setShowStep3Warning(false);
                setWzViewStep(nextStep);
              }}
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}
      {uploadPreview && (
        <div className="up-toast" role="status" aria-live="polite">
          {uploadPreview.url
            ? <img src={uploadPreview.url} alt={`พรีวิว ${uploadPreview.name}`} />
            : <span className="up-ic">{uploadPreview.progress != null ? '🎬' : '📎'}</span>}
          <div className="up-tx">
            <b>{uploadPreview.status || 'กำลังอัปโหลด...'}</b>
            <span>{uploadPreview.name}</span>
            {uploadPreview.progress != null && (
              <div style={{ marginTop: 6, height: 4, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                <div style={{ width: `${uploadPreview.progress}%`, height: '100%', background: 'var(--accent)', transition: 'width .2s' }} />
              </div>
            )}
          </div>
          <span className="up-spin" aria-hidden="true" />
        </div>
      )}
    </>
  );
}
