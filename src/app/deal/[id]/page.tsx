'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Deal {
  $id: string; sellerId: string; sellerName: string;
  middlemanId: string; middlemanName: string;
  buyerId: string; buyerName: string;
  title: string; description: string; price: number; category: string;
  status: string; rejectReason: string;
  sellerAcceptedTerms: boolean; middlemanAcceptedTerms: boolean; buyerAcceptedTerms: boolean;
  middlemanConfirmedPayment: boolean; buyerConfirmedCheck: boolean;
  paymentSlipFileId: string; evidenceData: string;
  trackingToMiddleman: string; trackingToBuyer: string;
}
interface Msg {
  $id: string; senderId: string; senderName: string;
  role: string; type: string; content: string;
  fileId: string; fileName: string; createdAt: string;
}
interface Middleman { userId: string; name: string; tier: string; workProvince: string; phone: string; }

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
const PROJECT  = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const BUCKET   = 'deal_files';
function fileUrl(id: string) { return `${ENDPOINT}/storage/buckets/${BUCKET}/files/${id}/view?project=${PROJECT}`; }

const STEP_LABEL: Record<string,string> = {
  posted:'รอผู้ซื้อ', waiting_seller:'รอผู้ขาย', waiting_buyer:'รอผู้ซื้อ',
  buyer_joined:'รอเลือกคนกลาง', terms_pending:'รอยอมรับเงื่อนไข',
  payment_pending:'รอโอนเงิน', payment_uploaded:'รอคนกลางยืนยัน',
  packing:'ผู้ขายแพ็คของ', shipped_to_middleman:'รอคนกลางรับ',
  middleman_received:'คนกลางรับแล้ว', middleman_checking:'คนกลางตรวจ',
  shipped_to_buyer:'จัดส่งให้ผู้ซื้อ', delivered:'รอยืนยันรับ',
  completed:'เสร็จสมบูรณ์', cancelled:'ยกเลิก', disputed:'มีปัญหา',
};
const STEP_ORDER = ['posted','buyer_joined','terms_pending','payment_pending','payment_uploaded','packing','shipped_to_middleman','middleman_received','middleman_checking','shipped_to_buyer','delivered','completed'];

export default function DealRoom() {
  const router  = useRouter();
  const params  = useParams();
  const dealId  = params.id as string;

  const [deal, setDeal]           = useState<Deal | null>(null);
  const [msgs, setMsgs]           = useState<Msg[]>([]);
  const [middlemen, setMiddlemen]  = useState<Middleman[]>([]);
  const [myId, setMyId]           = useState('');
  const [myName, setMyName]       = useState('');
  const [myRole, setMyRole]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending]     = useState(false);
  const [acting, setActing]       = useState(false);
  const [trackingInput, setTrackingInput] = useState('');
  const [showJitsi, setShowJitsi] = useState(false);
  const [tab, setTab]             = useState<'steps'|'chat'|'evidence'>('steps');
  const [evidenceType, setEvidenceType] = useState('packing');
  const [copied, setCopied]       = useState(false);
  const [jwt, setJwt]             = useState('');
  const [dealError, setDealError] = useState('');
  const chatBottomRef  = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const evidInputRef   = useRef<HTMLInputElement>(null);

  const fetchDeal = useCallback(async (j?: string) => {
    const headers: Record<string,string> = {};
    if (j) headers['x-session-jwt'] = j;
    try {
      const r = await fetch(`/api/deals/${dealId}`, { headers });
      const d = await r.json();
      if (r.ok) { setDeal(d.deal); setDealError(''); }
      else setDealError(d.error || `Error ${r.status}`);
    } catch (e: any) {
      setDealError(e?.message || 'Network error');
    }
  }, [dealId]);

  const fetchMsgs = useCallback(async (j: string) => {
    const r = await fetch(`/api/messages?dealId=${dealId}`, { headers: { 'x-session-jwt': j } }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setMsgs(d.messages || []); }
  }, [dealId]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    (async () => {
      // Always load deal (public) — no login required to view
      await fetchDeal();
      try {
        const user = await account.get();
        setMyId(user.$id); setMyName(user.name || '');
        const j = (await account.createJWT()).jwt;
        setJwt(j);
        fetchMsgs(j);
        timer = setInterval(async () => {
          const j2 = (await account.createJWT().catch(() => ({ jwt: '' }))).jwt;
          if (j2) { setJwt(j2); fetchMsgs(j2); fetchDeal(j2); }
        }, 4000);
      } catch { /* not logged in — guest view only */ }
      finally { setLoading(false); }
    })();
    return () => clearInterval(timer);
  }, [dealId, fetchDeal, fetchMsgs]);

  useEffect(() => {
    if (!deal || !myId) return;
    if      (deal.sellerId    === myId) setMyRole('seller');
    else if (deal.middlemanId === myId) setMyRole('middleman');
    else if (deal.buyerId     === myId) setMyRole('buyer');
    else                                setMyRole('guest');
  }, [deal, myId]);

  // Load middlemen list when buyer needs to select
  useEffect(() => {
    if (myRole === 'buyer' && deal?.status === 'buyer_joined' && !deal.middlemanId && jwt) {
      fetch('/api/middlemen', { headers: { 'x-session-jwt': jwt } })
        .then(r => r.json()).then(d => setMiddlemen(d.middlemen || [])).catch(() => {});
    }
  }, [myRole, deal, jwt]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function getJwt() {
    const j = (await account.createJWT()).jwt;
    setJwt(j); return j;
  }

  async function doAction(action: string, extra: Record<string,unknown> = {}) {
    setActing(true);
    try {
      const j = await getJwt();
      const r = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH', headers: { 'x-session-jwt': j, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await r.json();
      if (r.ok) { setDeal(d.deal); fetchMsgs(j); }
      else alert(d.error || 'เกิดข้อผิดพลาด');
    } finally { setActing(false); }
  }

  async function sendMsg(text: string, type = 'text', fileId = '', fileName = '') {
    if (!text && !fileId) return;
    setSending(true);
    try {
      const j = await getJwt();
      await fetch('/api/messages', {
        method: 'POST', headers: { 'x-session-jwt': j, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, content: text, type, fileId, fileName, role: myRole }),
      });
      setChatInput('');
      await fetchMsgs(j);
    } finally { setSending(false); }
  }

  async function uploadFile(file: File, isEvidence = false) {
    const j = await getJwt();
    const form = new FormData(); form.append('file', file);
    const r = await fetch('/api/upload-deal', { method: 'POST', headers: { 'x-session-jwt': j }, body: form });
    const d = await r.json();
    if (!r.ok) { alert(d.error || 'Upload failed'); return; }
    if (isEvidence) await doAction('add_evidence', { evidenceType, fileId: d.fileId, fileName: d.fileName });
    else await sendMsg('', file.type.startsWith('image/') ? 'image' : 'file', d.fileId, d.fileName);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!deal) return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center text-white gap-4 p-6 text-center">
      <p className="text-2xl">❌ ไม่พบ Deal</p>
      {dealError && <p className="text-sm text-red-400 bg-red-900/30 border border-red-700 rounded-xl px-4 py-2 max-w-sm break-all">{dealError}</p>}
      <p className="text-gray-400 text-sm">Deal อาจถูกลบหรือลิงก์ไม่ถูกต้อง</p>
      <a href="/deal/create" className="mt-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition">สร้าง Deal ใหม่</a>
    </div>
  );

  const jitsiRoom = `khonklang-${dealId.slice(0,10)}`;
  const stepIdx   = STEP_ORDER.indexOf(deal.status);
  const pct       = stepIdx >= 0 ? Math.round((stepIdx / (STEP_ORDER.length - 1)) * 100) : 0;
  const isFinished = ['completed','cancelled','disputed'].includes(deal.status);

  // ─── QR Payment section ────────────────────────────────────────────────────
  function PaymentSection() {
    if (!['payment_pending','payment_uploaded'].includes(deal!.status)) return null;
    const amount = deal!.price;
    // Use middleman's phone for PromptPay if available
    const mmPhone = ''; // Will be populated from middleman prefs in future
    const qrUrl = mmPhone ? `https://promptpay.io/${mmPhone}/${amount}` : '';
    return (
      <div className="bg-gradient-to-br from-green-900/30 to-blue-900/30 border border-green-500/30 rounded-2xl p-5 space-y-4">
        <p className="font-semibold text-green-300">💳 ชำระเงินค่าสินค้า</p>
        <div className="text-center">
          <p className="text-3xl font-bold text-white">{amount.toLocaleString()} <span className="text-lg font-normal text-gray-400">บาท</span></p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 space-y-2 text-sm">
          <p className="text-gray-400 text-xs mb-2">โอนเงินให้คนกลาง (บัญชีพักเงิน)</p>
          <div className="flex justify-between"><span className="text-gray-400">ชื่อ</span><span className="font-medium">{deal!.middlemanName}</span></div>
          {qrUrl ? (
            <div className="flex justify-center pt-2">
              <img src={qrUrl} alt="PromptPay QR" className="w-40 h-40 rounded-xl bg-white p-1" />
            </div>
          ) : (
            <p className="text-yellow-400 text-xs">⚠️ ติดต่อคนกลางเพื่อรับข้อมูลการชำระเงิน</p>
          )}
        </div>
        {deal!.status === 'payment_pending' && myRole === 'buyer' && (
          <button onClick={() => evidInputRef.current?.click()}
            className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium transition"
          >📎 อัปโหลดสลิปหลังโอน</button>
        )}
        <input ref={evidInputRef} type="file" accept="image/*,.pdf" className="hidden"
          onChange={async e => {
            const f = e.target.files?.[0]; if (!f) return;
            const j = await getJwt();
            const form = new FormData(); form.append('file', f);
            const r = await fetch('/api/upload-deal', { method: 'POST', headers: { 'x-session-jwt': j }, body: form });
            const d = await r.json();
            if (r.ok) await doAction('upload_payment', { fileId: d.fileId });
            e.target.value = '';
          }}
        />
      </div>
    );
  }

  // ─── Guest / not-logged-in join panel ────────────────────────────────────
  if (myRole === 'guest' || myRole === '') {
    const canBeBuyer  = !deal.buyerId;
    const canBeSeller = !deal.sellerId;
    const notLoggedIn = !myId;
    const dealUrl = typeof window !== 'undefined' ? window.location.href : '';

    function handleJoin(role: 'buyer' | 'seller') {
      if (notLoggedIn) {
        // Redirect to login, then come back here
        router.push(`/login?returnTo=${encodeURIComponent(dealUrl || `/deal/${dealId}`)}`);
      } else {
        doAction(role === 'buyer' ? 'join_as_buyer' : 'join_as_seller');
      }
    }

    return (
      <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col">
        <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white">←</Link>
          <h1 className="text-xl font-bold truncate">{deal.title}</h1>
        </div>
        <div className="max-w-md mx-auto px-4 py-12 space-y-6 w-full">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <p className="text-xl font-bold">{deal.title}</p>
            {deal.description && <p className="text-gray-400 text-sm">{deal.description}</p>}
            <p className="text-2xl font-bold text-green-400">{deal.price.toLocaleString()} ฿</p>
            <div className="flex flex-wrap gap-3 text-sm text-gray-400 pt-1">
              {deal.sellerName && <span>ผู้ขาย: {deal.sellerName}</span>}
              {deal.buyerName  && <span>ผู้ซื้อ: {deal.buyerName}</span>}
            </div>
          </div>

          {notLoggedIn && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-300 text-center">
              ⚠️ กรุณาเข้าสู่ระบบก่อนเข้าร่วมดีล<br/>
              <span className="text-xs text-yellow-400/70">แนะนำให้เปิดลิงก์ใน Chrome หรือ Safari</span>
            </div>
          )}

          <div className="space-y-3">
            {canBeBuyer && (
              <button onClick={() => handleJoin('buyer')} disabled={acting}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-lg transition"
              >{acting ? '...' : notLoggedIn ? '🔑 เข้าสู่ระบบเพื่อเป็นผู้ซื้อ' : '🛍️ เข้าร่วมเป็นผู้ซื้อ'}</button>
            )}
            {canBeSeller && (
              <button onClick={() => handleJoin('seller')} disabled={acting}
                className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-lg transition"
              >{acting ? '...' : notLoggedIn ? '🔑 เข้าสู่ระบบเพื่อเป็นผู้ขาย' : '🛒 เข้าร่วมเป็นผู้ขาย'}</button>
            )}
            {!canBeBuyer && !canBeSeller && (
              <p className="text-center text-gray-500">ดีลนี้มีผู้ซื้อและผู้ขายครบแล้ว</p>
            )}
          </div>

          <button onClick={copyLink}
            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition text-sm"
          >{copied ? '✅ คัดลอกลิงก์แล้ว' : '🔗 คัดลอกลิงก์แชร์'}</button>
        </div>
      </div>
    );
  }

  // ─── Middleman selection (buyer only, after buyer_joined) ─────────────────
  if (myRole === 'buyer' && deal.status === 'buyer_joined' && !deal.middlemanId) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col">
        <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white">←</button>
          <h1 className="text-xl font-bold">เลือกคนกลาง</h1>
        </div>
        <div className="max-w-xl mx-auto px-4 py-6 space-y-4 w-full">
          <p className="text-gray-400 text-sm">เลือกคนกลางที่คุณไว้วางใจเพื่อดูแลธุรกรรมนี้</p>
          {middlemen.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p>กำลังโหลดรายชื่อคนกลาง...</p>
            </div>
          ) : middlemen.map(m => (
            <div key={m.userId} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold text-white">{m.name}</p>
                  <p className="text-sm text-gray-400">Tier: {m.tier} {m.workProvince ? `• ${m.workProvince}` : ''}</p>
                </div>
              </div>
              <button onClick={() => doAction('select_middleman', { middlemanId: m.userId, middlemanName: m.name })}
                disabled={acting}
                className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-medium transition"
              >{acting ? '...' : 'เลือกคนกลางนี้'}</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Action panel ──────────────────────────────────────────────────────────
  function ActionPanel() {
    if (acting) return <div className="text-center text-gray-400 py-3 text-sm">กำลังดำเนินการ...</div>;
    const s = deal!.status;
    const btns: { label: string; cls: string; fn: () => void }[] = [];
    const BLU = 'bg-blue-600 hover:bg-blue-500';
    const GRN = 'bg-green-600 hover:bg-green-500';
    const YLW = 'bg-yellow-600 hover:bg-yellow-500';
    const PRP = 'bg-purple-600 hover:bg-purple-500';
    const RED = 'bg-red-700/70 hover:bg-red-700';

    if (['buyer_joined','terms_pending'].includes(s)) {
      const accepted =
        (myRole==='seller' && deal!.sellerAcceptedTerms) ||
        (myRole==='middleman' && deal!.middlemanAcceptedTerms) ||
        (myRole==='buyer' && deal!.buyerAcceptedTerms);
      if (!accepted) btns.push({ label:'✅ ยอมรับเงื่อนไขข้อตกลง', cls:BLU, fn:() => doAction('accept_terms') });
      else return <p className="text-green-400 text-sm text-center py-2">✅ คุณยอมรับเงื่อนไขแล้ว — รอฝ่ายอื่น</p>;
    }
    if (s==='payment_uploaded' && myRole==='middleman')
      btns.push({ label:'✅ ยืนยันรับเงิน — เริ่มขั้นตอนแพ็คของ', cls:GRN, fn:() => doAction('confirm_payment') });
    if (s==='packing' && myRole==='seller')
      btns.push({ label:'📦 แพ็คของเสร็จ — จัดส่งให้คนกลาง', cls:YLW, fn:() => { if(trackingInput) doAction('seller_done_packing',{trackingNumber:trackingInput}); else alert('กรอกเลขพัสดุ'); }});
    if (s==='shipped_to_middleman' && myRole==='middleman')
      btns.push({ label:'📬 รับสินค้าแล้ว', cls:PRP, fn:() => doAction('middleman_received') });
    if (s==='middleman_checking' && myRole==='buyer' && !deal!.buyerConfirmedCheck)
      btns.push({ label:'✅ ยืนยันสินค้าไม่มีปัญหา', cls:GRN, fn:() => doAction('buyer_confirm_check') });
    if (s==='middleman_checking' && myRole==='middleman' && deal!.buyerConfirmedCheck)
      btns.push({ label:'🚚 จัดส่งให้ผู้ซื้อแล้ว', cls:BLU, fn:() => { if(trackingInput) doAction('middleman_ship_to_buyer',{trackingNumber:trackingInput}); else alert('กรอกเลขพัสดุ'); }});
    if (s==='shipped_to_buyer' && myRole==='buyer')
      btns.push({ label:'🎉 ได้รับสินค้าแล้ว — ดีลเสร็จสมบูรณ์', cls:GRN, fn:() => doAction('buyer_received') });
    if (!isFinished && myRole!=='guest')
      btns.push({ label:'❌ ยกเลิก', cls:RED, fn:() => { const r=prompt('เหตุผล'); doAction('cancel',{reason:r||''}); }});

    if (btns.length===0) return <p className="text-gray-500 text-sm text-center py-2">ไม่มีการกระทำในขั้นตอนนี้</p>;
    return (
      <div className="space-y-2">
        {(['packing','middleman_checking'].includes(s) && (myRole==='seller'||(myRole==='middleman'&&deal!.buyerConfirmedCheck))) && (
          <input type="text" value={trackingInput} onChange={e=>setTrackingInput(e.target.value)}
            placeholder="เลขพัสดุ / Tracking number"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
          />
        )}
        {btns.map(b=>(<button key={b.label} onClick={b.fn} className={`w-full py-3 rounded-xl text-white font-medium transition ${b.cls}`}>{b.label}</button>))}
      </div>
    );
  }

  // ─── Evidence panel ────────────────────────────────────────────────────────
  function EvidencePanel() {
    const canUp = (myRole==='seller'&&['packing','shipped_to_middleman'].includes(deal!.status)) ||
      (myRole==='middleman'&&['middleman_received','middleman_checking'].includes(deal!.status));
    const typeLabel: Record<string,string> = {
      packing:'📦 แพ็คของ', testing:'🔧 ทดสอบ',
      receive:'📬 รับสินค้า (คนกลาง)', check:'🔍 ตรวจสินค้า (คนกลาง)',
    };
    const items: {type:string;fileId:string;fileName:string}[] = (() => {
      try { return JSON.parse(deal!.evidenceData || '[]'); } catch { return []; }
    })();
    return (
      <div className="space-y-4">
        {canUp && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium">อัปโหลดหลักฐาน</p>
            <select value={evidenceType} onChange={e=>setEvidenceType(e.target.value)}
              className="w-full bg-[#1a2035] border border-white/15 rounded-lg px-3 py-2 text-white text-sm"
            >
              {myRole==='seller'&&<><option value="packing">วิดีโอแพ็คของ</option><option value="testing">วิดีโอทดสอบ</option></>}
              {myRole==='middleman'&&<><option value="receive">วิดีโอรับสินค้า</option><option value="check">วิดีโอตรวจ</option></>}
            </select>
            <button onClick={()=>evidInputRef.current?.click()}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm"
            >📎 เลือกไฟล์ (รูป/วิดีโอ)</button>
            <input ref={evidInputRef} type="file" accept="image/*,video/*" className="hidden"
              onChange={e=>{const f=e.target.files?.[0];if(f)uploadFile(f,true);e.target.value='';}}
            />
          </div>
        )}
        {items.length === 0 && !canUp && (
          <p className="text-center text-gray-500 py-8">ยังไม่มีหลักฐาน</p>
        )}
        {items.map((item, i) => {
          const url = fileUrl(item.fileId);
          const isVid = item.fileName?.match(/\.(mp4|mov|avi|webm)$/i);
          return (
            <div key={i} className="space-y-1">
              <p className="text-xs text-gray-400">{typeLabel[item.type] || item.type}</p>
              <div className="bg-white/5 rounded-xl overflow-hidden">
                {isVid
                  ? <video src={url} controls className="w-full max-h-52 object-contain"/>
                  : <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={item.fileName} className="w-full max-h-52 object-contain"/></a>
                }
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col">

      {/* Header */}
      <div className="bg-[#111827] border-b border-white/10 px-4 py-3 flex items-center gap-2 sticky top-0 z-30">
        <button onClick={()=>router.back()} className="text-gray-400 hover:text-white">←</button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate text-sm">{deal.title}</p>
          <p className="text-xs text-gray-400">{STEP_LABEL[deal.status]} • {deal.price.toLocaleString()} ฿</p>
        </div>
        <button onClick={copyLink}
          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition"
        >{copied ? '✅ คัดลอกแล้ว' : '🔗 แชร์ลิงค์'}</button>
        <button onClick={()=>setShowJitsi(!showJitsi)}
          className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-xs font-medium transition"
        >📹 Video</button>
      </div>

      {/* Jitsi */}
      {showJitsi&&(
        <div className="bg-black border-b border-white/10">
          <div className="flex justify-end px-3 py-1">
            <button onClick={()=>setShowJitsi(false)} className="text-gray-400 text-sm">✕</button>
          </div>
          <iframe src={`https://meet.jit.si/${jitsiRoom}`}
            allow="camera; microphone; fullscreen; display-capture"
            className="w-full" style={{height:'320px',border:'none'}}
          />
        </div>
      )}

      {/* Progress */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{STEP_LABEL[deal.status]}</span><span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all" style={{width:`${pct}%`}}/>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-2">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {(['steps','chat','evidence'] as const).map(k=>(
            <button key={k} onClick={()=>setTab(k)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab===k?'bg-blue-600 text-white':'text-gray-400 hover:text-white'}`}
            >{k==='steps'?'ขั้นตอน':k==='chat'?`แชท (${msgs.filter(m=>m.role!=='system').length})`:'หลักฐาน'}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 max-w-2xl mx-auto w-full">

        {/* Steps tab */}
        {tab==='steps'&&(
          <div className="space-y-4">
            {/* Parties */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 text-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">ผู้เกี่ยวข้อง</p>
              <div className="flex justify-between"><span className="text-gray-400">ผู้ขาย</span><span>{deal.sellerName||'(รอผู้ขาย)'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">ผู้ซื้อ</span><span>{deal.buyerName||'(รอผู้ซื้อ)'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">คนกลาง</span><span>{deal.middlemanName||'(ยังไม่ได้เลือก)'}</span></div>
            </div>

            {/* Terms status */}
            {(deal.sellerAcceptedTerms||deal.buyerAcceptedTerms||deal.middlemanAcceptedTerms)&&(
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 text-sm">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">ยอมรับเงื่อนไข</p>
                <div className="flex justify-between"><span className="text-gray-400">ผู้ขาย</span><span className={deal.sellerAcceptedTerms?'text-green-400':'text-gray-500'}>{deal.sellerAcceptedTerms?'✅ ยอมรับแล้ว':'⏳ รอ'}</span></div>
                {deal.middlemanId&&<div className="flex justify-between"><span className="text-gray-400">คนกลาง</span><span className={deal.middlemanAcceptedTerms?'text-green-400':'text-gray-500'}>{deal.middlemanAcceptedTerms?'✅ ยอมรับแล้ว':'⏳ รอ'}</span></div>}
                <div className="flex justify-between"><span className="text-gray-400">ผู้ซื้อ</span><span className={deal.buyerAcceptedTerms?'text-green-400':'text-gray-500'}>{deal.buyerAcceptedTerms?'✅ ยอมรับแล้ว':'⏳ รอ'}</span></div>
              </div>
            )}

            {/* Payment QR */}
            <PaymentSection/>

            {/* Payment slip */}
            {deal.paymentSlipFileId&&(
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-xs text-gray-400 mb-2">หลักฐานการโอนเงิน</p>
                <a href={fileUrl(deal.paymentSlipFileId)} target="_blank" rel="noreferrer">
                  <img src={fileUrl(deal.paymentSlipFileId)} alt="slip" className="w-full max-h-48 object-contain rounded-xl"/>
                </a>
              </div>
            )}

            {/* Tracking numbers */}
            {deal.trackingToMiddleman&&(
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm">
                <p className="text-gray-400 text-xs mb-1">เลขพัสดุ ผู้ขาย→คนกลาง</p>
                <p className="font-mono text-white">{deal.trackingToMiddleman}</p>
              </div>
            )}
            {deal.trackingToBuyer&&(
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm">
                <p className="text-gray-400 text-xs mb-1">เลขพัสดุ คนกลาง→ผู้ซื้อ</p>
                <p className="font-mono text-white">{deal.trackingToBuyer}</p>
              </div>
            )}

            {/* Completed */}
            {deal.status==='completed'&&(
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
                <p className="text-3xl mb-2">🎉</p>
                <p className="text-green-300 font-bold text-lg">ดีลเสร็จสมบูรณ์!</p>
              </div>
            )}

            {/* Actions */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">การกระทำ</p>
              <ActionPanel/>
            </div>
          </div>
        )}

        {/* Chat tab */}
        {tab==='chat'&&(
          <div className="flex flex-col" style={{minHeight:'60vh'}}>
            <div className="flex-1 space-y-2 pb-4">
              {msgs.length===0&&<p className="text-center text-gray-500 py-8 text-sm">ยังไม่มีข้อความ</p>}
              {msgs.map(m=>{
                if(m.role==='system') return(
                  <div key={m.$id} className="text-center">
                    <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full">{m.content}</span>
                  </div>
                );
                const isMe=m.senderId===myId;
                return(
                  <div key={m.$id} className={`flex ${isMe?'justify-end':'justify-start'}`}>
                    <div className={`max-w-[75%] flex flex-col ${isMe?'items-end':'items-start'}`}>
                      {!isMe&&<span className="text-xs text-gray-500 px-1 mb-0.5">{m.senderName}</span>}
                      <div className={`rounded-2xl px-4 py-2.5 ${isMe?'bg-blue-600 rounded-br-sm':'bg-white/10 rounded-bl-sm'}`}>
                        {m.type==='image'?(
                          <a href={fileUrl(m.fileId)} target="_blank" rel="noreferrer">
                            <img src={fileUrl(m.fileId)} alt={m.fileName} className="max-w-[200px] rounded-lg object-contain"/>
                          </a>
                        ):m.type==='file'?(
                          <a href={fileUrl(m.fileId)} target="_blank" rel="noreferrer" className="underline text-sm">📎 {m.fileName}</a>
                        ):(<p className="text-sm">{m.content}</p>)}
                      </div>
                      <span className="text-[10px] text-gray-600 px-1 mt-0.5">{new Date(m.createdAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef}/>
            </div>
            <div className="sticky bottom-0 bg-[#0a0f1e] pt-2 pb-4">
              <div className="flex gap-2 items-end">
                <button onClick={()=>fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 flex-shrink-0"
                >📎</button>
                <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf" className="hidden"
                  onChange={e=>{const f=e.target.files?.[0];if(f)uploadFile(f);e.target.value='';}}
                />
                <textarea value={chatInput} onChange={e=>setChatInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg(chatInput);}}}
                  placeholder="พิมพ์ข้อความ... (Enter ส่ง)"
                  rows={1}
                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none text-sm"
                />
                <button onClick={()=>sendMsg(chatInput)} disabled={!chatInput.trim()||sending}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 flex-shrink-0"
                >➤</button>
              </div>
            </div>
          </div>
        )}

        {/* Evidence tab */}
        {tab==='evidence'&&<EvidencePanel/>}
      </div>
    </div>
  );
}
