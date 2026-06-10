'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ReviewPanel } from '@/components/ReviewPanel';
import { compressImage } from '@/lib/imageCompress';

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

interface Deal {
  $id: string; sellerId: string; sellerName: string; middlemanId: string; middlemanName: string;
  buyerId: string; buyerName: string; title: string; description: string; price: number; category: string;
  status: string; rejectReason: string;
  sellerAcceptedTerms: boolean; middlemanAcceptedTerms: boolean; buyerAcceptedTerms: boolean;
  middlemanConfirmedPayment: boolean; buyerConfirmedCheck: boolean;
  paymentSlipFileId: string; evidenceData: string; trackingToMiddleman: string; trackingToBuyer: string;
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
};
const STEP_ORDER = ['posted', 'buyer_joined', 'terms_pending', 'payment_pending', 'payment_uploaded', 'packing', 'shipped_to_middleman', 'middleman_received', 'middleman_checking', 'shipped_to_buyer', 'delivered', 'completed'];
const TIMELINE = [
  { key: 'terms_pending', label: 'รอยอมรับเงื่อนไข' }, { key: 'payment_pending', label: 'รอโอนเงิน' },
  { key: 'payment_uploaded', label: 'รอยืนยันเงิน' }, { key: 'packing', label: 'ผู้ขายแพ็คของ' },
  { key: 'shipped_to_middleman', label: 'รอคนกลางรับ' }, { key: 'middleman_received', label: 'คนกลางรับแล้ว' },
  { key: 'middleman_checking', label: 'คนกลางตรวจสอบ' }, { key: 'shipped_to_buyer', label: 'จัดส่งให้ผู้ซื้อ' },
  { key: 'delivered', label: 'รอยืนยันรับ' }, { key: 'completed', label: 'เสร็จสมบูรณ์' },
];

export default function DealRoom() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const dealId = params.id as string;

  const [deal, setDeal] = useState<Deal | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [middlemen, setMiddlemen] = useState<Middleman[]>([]);
  const [myId, setMyId] = useState('');
  const [myName, setMyName] = useState('');
  const [myRole, setMyRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [trackingInput, setTrackingInput] = useState('');
  const [showJitsi, setShowJitsi] = useState(false);
  const [tab, setTab] = useState<'steps' | 'chat' | 'evidence'>('steps');
  const [evidenceType, setEvidenceType] = useState('packing');
  const [copied, setCopied] = useState(false);
  const [jwt, setJwt] = useState('');
  const [dealError, setDealError] = useState('');
  const [showSelectMM, setShowSelectMM] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<{ url: string; name: string } | null>(null);
  const [mmFilter, setMmFilter] = useState({ q: '', province: '', tier: '', minRating: 0, need: '' });
  const [mmLoading, setMmLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const callNotifyAt = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const evidInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0'); r.style.setProperty('--accent-strong', '#1f54d6'); r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab === 'chat' || requestedTab === 'evidence' || requestedTab === 'steps') {
      setTab(requestedTab);
    }
    // มาจากแจ้งเตือนวิดีโอคอล → เปิดห้องคอลให้เลย
    if (searchParams.get('call') === '1') setShowJitsi(true);
  }, [searchParams]);

  const fetchDeal = useCallback(async (j?: string) => {
    const headers: Record<string, string> = {};
    if (j) headers['x-session-jwt'] = j;
    try {
      const r = await fetch(`/api/deals/${dealId}`, { headers });
      const d = await r.json();
      if (r.ok) { setDeal(d.deal); setDealError(''); } else setDealError(d.error || `Error ${r.status}`);
    } catch (e: any) { setDealError(e?.message || 'Network error'); }
  }, [dealId]);

  const fetchMsgs = useCallback(async (j: string) => {
    const r = await fetch(`/api/messages?dealId=${dealId}`, { headers: { 'x-session-jwt': j } }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setMsgs(d.messages || []); }
  }, [dealId]);

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

  useEffect(() => {
    if (!deal || !myId) return;
    if (deal.sellerId === myId) setMyRole('seller');
    else if (deal.middlemanId === myId) setMyRole('middleman');
    else if (deal.buyerId === myId) setMyRole('buyer');
    else setMyRole('guest');
  }, [deal, myId]);

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
  }, [mmFilter]);

  useEffect(() => {
    if (showSelectMM && jwt) loadMiddlemen(jwt);
  }, [jwt, showSelectMM, loadMiddlemen]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

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

  async function uploadFile(file: File, isEvidence = false) {
    const purl = beginUploadPreview(file);
    try {
      const j = await getJwt();
      const prepared = await compressImage(file); // บีบอัดเฉพาะรูป — วิดีโอ/PDF ส่งตามเดิม
      const form = new FormData(); form.append('file', prepared);
      const r = await fetch('/api/upload-deal', { method: 'POST', headers: { 'x-session-jwt': j }, body: form });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'Upload failed'); return; }
      if (isEvidence) await doAction('add_evidence', { evidenceType, fileId: d.fileId, fileName: d.fileName });
      else await sendMsg('', file.type.startsWith('image/') ? 'image' : 'file', d.fileId, d.fileName);
    } finally { endUploadPreview(purl); }
  }

  async function copyLink() { await navigator.clipboard.writeText(window.location.href).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  /** เปิด/ปิดวิดีโอคอล — ตอนเปิดจะแจ้งเตือนทุกฝ่ายในดีล (กันสแปม: แจ้งซ้ำได้ทุก 2 นาที) */
  function toggleCall() {
    const opening = !showJitsi;
    setShowJitsi(opening);
    if (opening && myRole !== 'guest' && myRole !== '' && Date.now() - callNotifyAt.current > 120000) {
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

  function MiddlemanPickerPanel({ compact = false }: { compact?: boolean }) {
    const currentDeal = deal!;
    const TIERS = ['', 'Bronze', 'Silver', 'Gold', 'Platinum'];
    const filtered = middlemen.filter(m => (mmFilter.minRating === 0 || m.reviewScore >= mmFilter.minRating));
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

  // ─── Payment section ─────────────────────────────────────────────────────
  function PaymentSection() {
    if (!['payment_pending', 'payment_uploaded'].includes(deal!.status)) return null;
    return (
      <div className="dr-card dr-pay-card">
        <div className="dr-card-title">💳 ชำระเงินค่าสินค้า</div>
        <div className="dr-pay-amount">฿{deal!.price.toLocaleString()}</div>
        <div className="dr-pay-to">โอนให้คนกลาง — {deal!.middlemanName}</div>
        <div style={{ fontSize: 12.5, color: 'var(--amber-500)' }}>⚠️ ติดต่อคนกลางเพื่อรับข้อมูลการชำระเงิน (PromptPay/บัญชี)</div>
        {deal!.status === 'payment_pending' && myRole === 'buyer' && (
          <button onClick={() => evidInputRef.current?.click()} className="btn btn-green btn-block" style={{ marginTop: 14 }}>📎 อัปโหลดสลิปหลังโอน</button>
        )}
        {deal!.status === 'payment_uploaded' && <div className="dr-slip-status">✅ ส่งสลิปแล้ว — รอคนกลางยืนยัน</div>}
        <input ref={evidInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
          onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const purl = beginUploadPreview(f); try { const j = await getJwt(); const prepared = await compressImage(f); const form = new FormData(); form.append('file', prepared); const r = await fetch('/api/upload-deal', { method: 'POST', headers: { 'x-session-jwt': j }, body: form }); const d = await r.json(); if (r.ok) await doAction('upload_payment', { fileId: d.fileId }); else alert(d.error || 'อัปโหลดสลิปไม่สำเร็จ'); } finally { endUploadPreview(purl); } e.target.value = ''; }} />
      </div>
    );
  }

  // ─── Action panel ────────────────────────────────────────────────────────
  function ActionPanel() {
    if (acting) return <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '12px 0', fontSize: 13 }}>กำลังดำเนินการ...</div>;
    const s = deal!.status;
    const btns: { label: string; cls: string; fn: () => void }[] = [];
    if (['buyer_joined', 'terms_pending'].includes(s)) {
      const accepted = (myRole === 'seller' && deal!.sellerAcceptedTerms) || (myRole === 'middleman' && deal!.middlemanAcceptedTerms) || (myRole === 'buyer' && deal!.buyerAcceptedTerms);
      if (!accepted) btns.push({ label: '✅ ยอมรับเงื่อนไขข้อตกลง', cls: 'btn-primary', fn: () => doAction('accept_terms') });
      else return <p style={{ color: 'var(--green-600)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>✅ คุณยอมรับเงื่อนไขแล้ว — รอฝ่ายอื่น</p>;
    }
    if (s === 'payment_uploaded' && myRole === 'middleman') btns.push({ label: '✅ ยืนยันรับเงิน — เริ่มขั้นตอนแพ็คของ', cls: 'btn-green', fn: () => doAction('confirm_payment') });
    if (s === 'packing' && myRole === 'seller') btns.push({ label: '📦 แพ็คของเสร็จ — จัดส่งให้คนกลาง', cls: 'btn-primary', fn: () => { if (trackingInput) doAction('seller_done_packing', { trackingNumber: trackingInput }); else alert('กรอกเลขพัสดุ'); } });
    if (s === 'shipped_to_middleman' && myRole === 'middleman') btns.push({ label: '📬 รับสินค้าแล้ว', cls: 'btn-primary', fn: () => doAction('middleman_received') });
    if (s === 'middleman_checking' && myRole === 'buyer' && !deal!.buyerConfirmedCheck) btns.push({ label: '✅ ยืนยันสินค้าไม่มีปัญหา', cls: 'btn-green', fn: () => doAction('buyer_confirm_check') });
    if (s === 'middleman_checking' && myRole === 'middleman' && deal!.buyerConfirmedCheck) btns.push({ label: '🚚 จัดส่งให้ผู้ซื้อแล้ว', cls: 'btn-primary', fn: () => { if (trackingInput) doAction('middleman_ship_to_buyer', { trackingNumber: trackingInput }); else alert('กรอกเลขพัสดุ'); } });
    if (s === 'shipped_to_buyer' && myRole === 'buyer') btns.push({ label: '🎉 ได้รับสินค้าแล้ว — ดีลเสร็จสมบูรณ์', cls: 'btn-green', fn: () => doAction('buyer_received') });
    if (myRole === 'buyer' && s === 'buyer_joined' && !deal!.middlemanId) btns.push({ label: showSelectMM ? 'ซ่อนการเลือกคนกลาง' : '🔎 เลือกคนกลาง', cls: 'btn-ghost', fn: () => setShowSelectMM(v => !v) });
    if (myRole === 'buyer' && deal!.middlemanId && ['terms_pending', 'payment_pending'].includes(s)) btns.push({ label: showSelectMM ? 'ซ่อนรายการคนกลาง' : '🔄 เลือกคนกลางใหม่', cls: 'btn-ghost', fn: () => setShowSelectMM(v => !v) });
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
  function EvidencePanel() {
    const canUp = (myRole === 'seller' && ['packing', 'shipped_to_middleman'].includes(deal!.status)) || (myRole === 'middleman' && ['middleman_received', 'middleman_checking'].includes(deal!.status));
    const typeLabel: Record<string, string> = { packing: '📦 แพ็คของ', testing: '🔧 ทดสอบ', receive: '📬 รับสินค้า (คนกลาง)', check: '🔍 ตรวจสินค้า (คนกลาง)' };
    const items: { type: string; fileId: string; fileName: string }[] = (() => { try { return JSON.parse(deal!.evidenceData || '[]'); } catch { return []; } })();
    return (
      <div className="dr-evid-inner">
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
            const url = fileUrl(item.fileId);
            const isVid = item.fileName?.match(/\.(mp4|mov|avi|webm)$/i);
            return (
              <div key={i} className="dr-card" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{typeLabel[item.type] || item.type}</div>
                {isVid ? <video src={url} controls style={{ width: '100%', maxHeight: 220, borderRadius: 'var(--r-md)', background: '#000' }} /> : <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={item.fileName} style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 'var(--r-md)' }} /></a>}
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
      <header className="dr-header">
        <button onClick={() => router.back()} className="dr-back"><Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} /></button>
        <div className="dr-header-info"><div className="dr-htitle">{deal.title}</div><div className="dr-hsub">{STEP_LABEL[deal.status]} · ฿{deal.price.toLocaleString()}</div></div>
        <div className="dr-hctas">
          <button className="dr-cta-link" onClick={copyLink}>{copied ? '✅ คัดลอกแล้ว' : '🔗 แชร์'}</button>
          <button className="dr-cta-green" onClick={toggleCall}>📹 Video</button>
        </div>
      </header>

      {showJitsi ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0d1117', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,.4)', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>📹 วิดีโอคอล กำลังดำเนินการ...</span>
            <button onClick={() => setShowJitsi(false)} className="btn btn-danger btn-sm">✕ วางสาย</button>
          </div>
          <div style={{ flex: 1, minHeight: '60vh' }}><JitsiMeet roomName={jitsiRoom} displayName={myName || 'ผู้ใช้'} /></div>
        </div>
      ) : (
        <>
          <div className="dr-progress-wrap">
            <div className="dr-prog-meta"><span className="dr-prog-status">{STEP_LABEL[deal.status]}</span><span className="dr-prog-pct">{pct}%</span></div>
            <div className="dr-prog-track"><div className="dr-prog-fill" style={{ width: `${pct}%`, background: deal.status === 'completed' ? 'var(--green-500)' : 'var(--accent)' }} /></div>
          </div>

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
                      ['คนกลาง', deal.middlemanName || '(ยังไม่ได้เลือก)'],
                      ['ศูนย์กลาง', 'บริษัท คนกลาง จำกัด'],
                    ].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--line-2)', fontSize: 14 }}><span style={{ color: 'var(--muted)' }}>{l}</span><span style={{ fontWeight: 600, color: 'var(--ink)' }}>{v}</span></div>
                    ))}
                  </div>
                  {myRole === 'buyer' && ['buyer_joined', 'terms_pending', 'payment_pending'].includes(deal.status) && (
                    <div style={{ marginTop: 14 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowSelectMM(v => !v)}>
                        {showSelectMM ? 'ซ่อนแผงเลือกคนกลาง' : deal.middlemanId ? 'เปลี่ยนคนกลาง' : 'เลือกคนกลาง'}
                      </button>
                    </div>
                  )}
                </div>

                {myRole === 'buyer' && ['buyer_joined', 'terms_pending', 'payment_pending'].includes(deal.status) && showSelectMM && (
                  <MiddlemanPickerPanel />
                )}

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
                  <div className="dr-card-title">ขั้นตอน Escrow</div>
                  <div className="dr-timeline">
                    {TIMELINE.map(st => {
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

                <PaymentSection />

                {deal.paymentSlipFileId && (
                  <div className="dr-card">
                    <div className="dr-card-title">หลักฐานการโอนเงิน</div>
                    <a href={fileUrl(deal.paymentSlipFileId)} target="_blank" rel="noreferrer"><img src={fileUrl(deal.paymentSlipFileId)} alt="slip" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 'var(--r-md)' }} /></a>
                  </div>
                )}
                {deal.trackingToMiddleman && <div className="dr-card"><div className="dr-card-title">📦 เลขพัสดุ ผู้ขาย → คนกลาง</div><div className="dr-track-code">{deal.trackingToMiddleman}</div></div>}
                {deal.trackingToBuyer && <div className="dr-card"><div className="dr-card-title">📦 เลขพัสดุ คนกลาง → ผู้ซื้อ</div><div className="dr-track-code">{deal.trackingToBuyer}</div></div>}

                {deal.status === 'completed' && (
                  <>
                    <div className="dr-card dr-done-card"><div className="dr-done-emoji">🎉</div><div className="dr-done-title">ดีลเสร็จสมบูรณ์!</div><div className="dr-done-sub">เงินถูกโอนให้ผู้ขายเรียบร้อยแล้ว</div></div>
                    <ReviewPanel deal={deal} myRole={myRole as 'buyer' | 'seller' | 'middleman'} jwt={jwt} />
                  </>
                )}

                <div className="dr-card"><div className="dr-card-title">การกระทำ</div><ActionPanel /></div>
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
                          <span className="dr-bubble-t">{new Date(m.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
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

            {tab === 'evidence' && <EvidencePanel />}
          </main>
        </>
      )}
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
