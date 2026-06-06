'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { account, client } from '@/lib/appwrite';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Deal {
  $id: string; sellerId: string; sellerName: string;
  middlemanId: string; middlemanName: string;
  buyerId: string; buyerName: string;
  title: string; description: string; price: number; category: string;
  status: string; rejectReason: string;
  sellerAcceptedTerms: boolean; middlemanAcceptedTerms: boolean; buyerAcceptedTerms: boolean;
  paymentSlipFileId: string; middlemanConfirmedPayment: boolean;
  packingEvidence: string; testingEvidence: string;
  receiveEvidence: string; checkEvidence: string;
  trackingToMiddleman: string; trackingToBuyer: string;
  buyerConfirmedCheck: boolean; completedAt: string;
  jitsiRoomId: string;
}

interface Msg {
  $id: string; senderId: string; senderName: string;
  role: string; type: string; content: string;
  fileId: string; fileName: string; createdAt: string;
}

const STEP_ORDER = [
  'posted','buyer_joined','terms_pending','payment_pending','payment_uploaded',
  'packing','shipped_to_middleman','middleman_received','middleman_checking',
  'shipped_to_buyer','delivered','completed',
];

const STEP_LABEL: Record<string,string> = {
  posted: 'รอผู้ซื้อ', buyer_joined: 'รอยอมรับเงื่อนไข',
  terms_pending: 'รอยอมรับเงื่อนไข', payment_pending: 'รอโอนเงิน',
  payment_uploaded: 'รอคนกลางยืนยันเงิน', packing: 'ผู้ขายแพ็คของ',
  shipped_to_middleman: 'รอคนกลางรับ', middleman_received: 'คนกลางรับแล้ว',
  middleman_checking: 'คนกลางตรวจของ', shipped_to_buyer: 'จัดส่งให้ผู้ซื้อ',
  delivered: 'รอยืนยันรับ', completed: 'เสร็จสมบูรณ์',
  cancelled: 'ยกเลิก', disputed: 'มีปัญหา',
};

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
const PROJECT  = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const BUCKET   = 'deal_files';

function fileUrl(fileId: string) {
  return `${ENDPOINT}/storage/buckets/${BUCKET}/files/${fileId}/view?project=${PROJECT}`;
}

export default function DealRoom() {
  const router = useRouter();
  const params = useParams();
  const dealId = params.id as string;

  const [deal, setDeal]       = useState<Deal | null>(null);
  const [msgs, setMsgs]       = useState<Msg[]>([]);
  const [myId, setMyId]       = useState('');
  const [myName, setMyName]   = useState('');
  const [myRole, setMyRole]   = useState('');  // seller|middleman|buyer
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [acting, setActing]   = useState(false);
  const [trackingInput, setTrackingInput] = useState('');
  const [showJitsi, setShowJitsi] = useState(false);
  const [tab, setTab]         = useState<'chat'|'steps'|'evidence'>('steps');
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);
  const [evidenceType, setEvidenceType] = useState('packing');

  const fetchDeal = useCallback(async (jwt: string) => {
    const res = await fetch(`/api/deals/${dealId}`, { headers: { 'x-session-jwt': jwt } }).catch(() => null);
    if (res?.ok) { const d = await res.json(); setDeal(d.deal); }
  }, [dealId]);

  const fetchMsgs = useCallback(async (jwt: string) => {
    const res = await fetch(`/api/messages?dealId=${dealId}`, { headers: { 'x-session-jwt': jwt } }).catch(() => null);
    if (res?.ok) { const d = await res.json(); setMsgs(d.messages || []); }
  }, [dealId]);

  // Initial load + polling for realtime-ish chat
  useEffect(() => {
    let jwt = '';
    let timer: ReturnType<typeof setInterval>;
    (async () => {
      try {
        const user = await account.get();
        setMyId(user.$id);
        setMyName(user.name || '');
        jwt = (await account.createJWT()).jwt;
        await Promise.all([fetchDeal(jwt), fetchMsgs(jwt)]);
      } catch { router.replace('/login'); return; }
      finally { setLoading(false); }
      // Poll every 4s
      timer = setInterval(() => { fetchMsgs(jwt); fetchDeal(jwt); }, 4000);
    })();
    return () => clearInterval(timer);
  }, [dealId, router, fetchDeal, fetchMsgs]);

  // Determine role from deal
  useEffect(() => {
    if (!deal || !myId) return;
    if (deal.sellerId    === myId) setMyRole('seller');
    else if (deal.middlemanId === myId) setMyRole('middleman');
    else if (deal.buyerId     === myId) setMyRole('buyer');
    else setMyRole('guest');
  }, [deal, myId]);

  // Scroll chat to bottom
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function getJwt() { return (await account.createJWT()).jwt; }

  async function doAction(action: string, extra: Record<string,unknown> = {}) {
    setActing(true);
    try {
      const jwt = await getJwt();
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json();
      if (res.ok) { setDeal(d.deal); await fetchMsgs(jwt); }
      else alert(d.error || 'เกิดข้อผิดพลาด');
    } finally { setActing(false); }
  }

  async function sendMsg(text: string, type = 'text', fileId = '', fileName = '') {
    if (!text && !fileId) return;
    setSending(true);
    try {
      const jwt = await getJwt();
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, content: text, type, fileId, fileName, role: myRole }),
      });
      setChatInput('');
      await fetchMsgs(jwt);
    } finally { setSending(false); }
  }

  async function uploadFile(file: File, isEvidence = false) {
    const jwt = await getJwt();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/upload-deal', { method: 'POST', headers: { 'x-session-jwt': jwt }, body: form });
    const d = await res.json();
    if (!res.ok) { alert(d.error || 'Upload failed'); return null; }
    if (isEvidence) {
      await doAction('add_evidence', { evidenceType, fileId: d.fileId, fileName: d.fileName });
    } else {
      await sendMsg('', file.type.startsWith('image/') ? 'image' : 'file', d.fileId, d.fileName);
    }
    return d;
  }

  const jitsiRoom = deal?.jitsiRoomId || `khonklang-${dealId.slice(0, 10)}`;

  if (loading) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!deal) return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center gap-4 text-white">
      <p className="text-gray-400">ไม่พบ Deal</p>
      <Link href="/" className="text-blue-400 underline">กลับหน้าแรก</Link>
    </div>
  );

  const stepIdx     = STEP_ORDER.indexOf(deal.status);
  const totalSteps  = STEP_ORDER.length;
  const progressPct = stepIdx >= 0 ? Math.round((stepIdx / (totalSteps - 1)) * 100) : 0;

  // ─── Action panel ─────────────────────────────────────────────────────────
  function ActionPanel() {
    if (acting) return <div className="text-center text-gray-400 py-4">กำลังดำเนินการ...</div>;
    const s = deal!.status;
    const btns: { label: string; color: string; onClick: () => void }[] = [];

    // Accept terms
    if ((s === 'buyer_joined' || s === 'terms_pending') && !acting) {
      const alreadyAccepted =
        (myRole === 'seller'    && deal!.sellerAcceptedTerms)    ||
        (myRole === 'middleman' && deal!.middlemanAcceptedTerms) ||
        (myRole === 'buyer'     && deal!.buyerAcceptedTerms);
      if (!alreadyAccepted) {
        btns.push({ label: '✅ ยอมรับเงื่อนไขข้อตกลง', color: 'bg-blue-600 hover:bg-blue-500',
          onClick: () => doAction('accept_terms') });
      } else {
        return <p className="text-green-400 text-center py-3">✅ คุณยอมรับเงื่อนไขแล้ว — รอฝ่ายอื่น</p>;
      }
    }

    // Buyer: upload payment
    if (s === 'payment_pending' && myRole === 'buyer') {
      btns.push({ label: '💳 อัปโหลดหลักฐานการโอน', color: 'bg-green-600 hover:bg-green-500',
        onClick: () => {
          const el = document.createElement('input');
          el.type = 'file'; el.accept = 'image/*,application/pdf';
          el.onchange = async (ev) => {
            const f = (ev.target as HTMLInputElement).files?.[0];
            if (!f) return;
            const jwt = await getJwt();
            const form = new FormData(); form.append('file', f);
            const res = await fetch('/api/upload-deal', { method: 'POST', headers: { 'x-session-jwt': jwt }, body: form });
            const d = await res.json();
            if (res.ok) await doAction('upload_payment', { fileId: d.fileId });
          };
          el.click();
        }
      });
    }

    // Middleman: confirm payment
    if (s === 'payment_uploaded' && myRole === 'middleman') {
      btns.push({ label: '✅ ยืนยันรับเงิน', color: 'bg-green-600 hover:bg-green-500',
        onClick: () => doAction('confirm_payment') });
    }

    // Seller: done packing
    if (s === 'packing' && myRole === 'seller') {
      btns.push({ label: '📦 จัดส่งให้คนกลางแล้ว', color: 'bg-yellow-600 hover:bg-yellow-500',
        onClick: () => { if (trackingInput) doAction('seller_done_packing', { trackingNumber: trackingInput }); else alert('กรอกเลขพัสดุ'); }
      });
    }

    // Middleman: received
    if (s === 'shipped_to_middleman' && myRole === 'middleman') {
      btns.push({ label: '📬 รับสินค้าแล้ว', color: 'bg-purple-600 hover:bg-purple-500',
        onClick: () => doAction('middleman_received') });
    }

    // Buyer: confirm check ok
    if (s === 'middleman_checking' && myRole === 'buyer' && !deal!.buyerConfirmedCheck) {
      btns.push({ label: '✅ ยืนยันสินค้าไม่มีปัญหา', color: 'bg-green-600 hover:bg-green-500',
        onClick: () => doAction('buyer_confirm_check') });
    }

    // Middleman: ship to buyer
    if (s === 'middleman_checking' && myRole === 'middleman' && deal!.buyerConfirmedCheck) {
      btns.push({ label: '🚚 จัดส่งให้ผู้ซื้อแล้ว', color: 'bg-blue-600 hover:bg-blue-500',
        onClick: () => { if (trackingInput) doAction('middleman_ship_to_buyer', { trackingNumber: trackingInput }); else alert('กรอกเลขพัสดุ'); }
      });
    }

    // Buyer: received
    if (s === 'shipped_to_buyer' && myRole === 'buyer') {
      btns.push({ label: '🎉 ได้รับสินค้าแล้ว', color: 'bg-green-700 hover:bg-green-600',
        onClick: () => doAction('buyer_received') });
    }

    // Cancel
    if (!['completed','cancelled','disputed'].includes(s) && myRole !== 'guest') {
      btns.push({ label: '❌ ยกเลิก Deal', color: 'bg-red-700/60 hover:bg-red-700',
        onClick: () => { const r = prompt('เหตุผล (ถ้ามี)'); doAction('cancel', { reason: r || '' }); }
      });
    }

    if (btns.length === 0) return <p className="text-gray-500 text-center py-3 text-sm">ไม่มีการกระทำที่ต้องทำในขั้นตอนนี้</p>;

    return (
      <div className="space-y-2">
        {(s === 'packing' && myRole === 'seller') || (s === 'middleman_checking' && myRole === 'middleman') ? (
          <input type="text" value={trackingInput} onChange={e => setTrackingInput(e.target.value)}
            placeholder="เลขพัสดุ / Tracking number"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
          />
        ) : null}
        {btns.map(b => (
          <button key={b.label} onClick={b.onClick}
            className={`w-full py-3 rounded-xl text-white font-medium transition ${b.color}`}
          >{b.label}</button>
        ))}
      </div>
    );
  }

  // ─── Evidence panel ───────────────────────────────────────────────────────
  function EvidencePanel() {
    const canUpload =
      (myRole === 'seller'    && ['packing','shipped_to_middleman','middleman_received','middleman_checking'].includes(deal!.status)) ||
      (myRole === 'middleman' && ['middleman_received','middleman_checking'].includes(deal!.status));

    const parseEvidence = (raw: string) => { try { return JSON.parse(raw || '[]'); } catch { return []; } };
    const allEvidence = [
      { key: 'packingEvidence',  label: '📦 แพ็คของ' },
      { key: 'testingEvidence',  label: '🔧 ทดสอบ' },
      { key: 'receiveEvidence',  label: '📬 รับสินค้า (คนกลาง)' },
      { key: 'checkEvidence',    label: '🔍 ตรวจสินค้า (คนกลาง)' },
    ] as const;

    return (
      <div className="space-y-4">
        {canUpload && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium">อัปโหลดหลักฐาน (วิดีโอ/รูปภาพ)</p>
            <select value={evidenceType} onChange={e => setEvidenceType(e.target.value)}
              className="w-full bg-[#1a2035] border border-white/15 rounded-lg px-3 py-2 text-white text-sm"
            >
              {myRole === 'seller' && <option value="packing">วิดีโอแพ็คของ</option>}
              {myRole === 'seller' && <option value="testing">วิดีโอทดสอบสินค้า</option>}
              {myRole === 'middleman' && <option value="receive">วิดีโอรับสินค้า</option>}
              {myRole === 'middleman' && <option value="check">วิดีโอตรวจสินค้า</option>}
            </select>
            <button onClick={() => evidenceInputRef.current?.click()}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition text-sm"
            >📎 เลือกไฟล์</button>
            <input ref={evidenceInputRef} type="file" accept="image/*,video/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, true); e.target.value = ''; }}
            />
          </div>
        )}
        {allEvidence.map(({ key, label }) => {
          const items = parseEvidence(deal![key as keyof Deal] as string);
          if (items.length === 0) return null;
          return (
            <div key={key} className="space-y-2">
              <p className="text-sm font-medium text-gray-300">{label}</p>
              {items.map((item: { fileId: string; fileName: string }, i: number) => {
                const url = fileUrl(item.fileId);
                const isVideo = item.fileName?.match(/\.(mp4|mov|avi|webm)$/i);
                return (
                  <div key={i} className="bg-white/5 rounded-xl overflow-hidden">
                    {isVideo ? (
                      <video src={url} controls className="w-full max-h-48 object-contain" />
                    ) : (
                      <a href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={item.fileName} className="w-full max-h-48 object-contain" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col">

      {/* Header */}
      <div className="bg-[#111827] border-b border-white/10 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white">←</button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{deal.title}</p>
          <p className="text-xs text-gray-400">{STEP_LABEL[deal.status] || deal.status} • {deal.price.toLocaleString()} ฿</p>
        </div>
        <button onClick={() => setShowJitsi(!showJitsi)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition"
        >📹 Video Call</button>
      </div>

      {/* Jitsi */}
      {showJitsi && (
        <div className="bg-black border-b border-white/10">
          <div className="flex justify-end px-3 py-1">
            <button onClick={() => setShowJitsi(false)} className="text-gray-400 hover:text-white text-sm">✕ ปิด</button>
          </div>
          <iframe
            src={`https://meet.jit.si/${jitsiRoom}`}
            allow="camera; microphone; fullscreen; display-capture"
            className="w-full" style={{ height: '340px', border: 'none' }}
          />
        </div>
      )}

      {/* Progress bar */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{STEP_LABEL[deal.status]}</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-2">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {([['steps','ขั้นตอน'],['chat','แชท'],['evidence','หลักฐาน']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === k ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >{l}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 max-w-2xl mx-auto w-full">

        {/* ─── Steps tab ─── */}
        {tab === 'steps' && (
          <div className="space-y-4">
            {/* Parties */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">ผู้เกี่ยวข้อง</p>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">ผู้ขาย</span><span>{deal.sellerName || '-'}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">คนกลาง</span><span>{deal.middlemanName || '(ยังไม่มี)'}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">ผู้ซื้อ</span><span>{deal.buyerName || '(รอผู้ซื้อ)'}</span></div>
              </div>
            </div>

            {/* Terms accepted */}
            {(deal.status === 'buyer_joined' || deal.status === 'terms_pending' || deal.sellerAcceptedTerms) && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 text-sm">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">ยอมรับเงื่อนไข</p>
                <div className="flex justify-between"><span className="text-gray-400">ผู้ขาย</span><span className={deal.sellerAcceptedTerms ? 'text-green-400' : 'text-gray-500'}>{deal.sellerAcceptedTerms ? '✅' : '⏳'}</span></div>
                {deal.middlemanId && <div className="flex justify-between"><span className="text-gray-400">คนกลาง</span><span className={deal.middlemanAcceptedTerms ? 'text-green-400' : 'text-gray-500'}>{deal.middlemanAcceptedTerms ? '✅' : '⏳'}</span></div>}
                <div className="flex justify-between"><span className="text-gray-400">ผู้ซื้อ</span><span className={deal.buyerAcceptedTerms ? 'text-green-400' : 'text-gray-500'}>{deal.buyerAcceptedTerms ? '✅' : '⏳'}</span></div>
              </div>
            )}

            {/* Tracking numbers */}
            {deal.trackingToMiddleman && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm">
                <p className="text-gray-400 text-xs mb-1">เลขพัสดุ (ผู้ขาย → คนกลาง)</p>
                <p className="font-mono">{deal.trackingToMiddleman}</p>
              </div>
            )}
            {deal.trackingToBuyer && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm">
                <p className="text-gray-400 text-xs mb-1">เลขพัสดุ (คนกลาง → ผู้ซื้อ)</p>
                <p className="font-mono">{deal.trackingToBuyer}</p>
              </div>
            )}

            {/* Payment slip */}
            {deal.paymentSlipFileId && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-xs text-gray-400 mb-2">หลักฐานการโอนเงิน</p>
                <a href={fileUrl(deal.paymentSlipFileId)} target="_blank" rel="noreferrer">
                  <img src={fileUrl(deal.paymentSlipFileId)} alt="slip" className="w-full max-h-48 object-contain rounded-lg" />
                </a>
              </div>
            )}

            {/* Action buttons */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">การกระทำ</p>
              <ActionPanel />
            </div>
          </div>
        )}

        {/* ─── Chat tab ─── */}
        {tab === 'chat' && (
          <div className="flex flex-col" style={{ minHeight: '60vh' }}>
            <div className="flex-1 space-y-2 pb-4">
              {msgs.length === 0 && <p className="text-center text-gray-500 py-8">ยังไม่มีข้อความ</p>}
              {msgs.map(m => {
                const isMe = m.senderId === myId;
                const isSystem = m.role === 'system';
                if (isSystem) return (
                  <div key={m.$id} className="text-center">
                    <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full">{m.content}</span>
                  </div>
                );
                return (
                  <div key={m.$id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] space-y-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {!isMe && <span className="text-xs text-gray-500 px-1">{m.senderName}</span>}
                      <div className={`rounded-2xl px-4 py-2.5 ${isMe ? 'bg-blue-600 rounded-br-sm' : 'bg-white/10 rounded-bl-sm'}`}>
                        {m.type === 'image' ? (
                          <a href={fileUrl(m.fileId)} target="_blank" rel="noreferrer">
                            <img src={fileUrl(m.fileId)} alt={m.fileName} className="max-w-full rounded-lg max-h-48 object-contain" />
                          </a>
                        ) : m.type === 'file' ? (
                          <a href={fileUrl(m.fileId)} target="_blank" rel="noreferrer" className="underline text-sm">📎 {m.fileName}</a>
                        ) : (
                          <p className="text-sm">{m.content}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-600 px-1">{new Date(m.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>
            {/* Chat input */}
            <div className="sticky bottom-0 bg-[#0a0f1e] pt-2 pb-4">
              <div className="flex gap-2 items-end">
                <button onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 transition flex-shrink-0"
                >📎</button>
                <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }}
                />
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(chatInput); } }}
                  placeholder="พิมพ์ข้อความ..."
                  rows={1}
                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition resize-none text-sm"
                />
                <button onClick={() => sendMsg(chatInput)} disabled={!chatInput.trim() || sending}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition flex-shrink-0"
                >➤</button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Evidence tab ─── */}
        {tab === 'evidence' && <EvidencePanel />}
      </div>
    </div>
  );
}
