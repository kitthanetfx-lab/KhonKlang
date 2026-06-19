'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { account } from '@/lib/appwrite';
import {
  MessageCircle, Phone, PhoneOff, PhoneCall, Mic, MicOff, Send,
  Loader2, User, Search, Inbox, Image as ImageIcon,
} from 'lucide-react';
import { CallSession, type CallSessionState } from '@/lib/callSession';

type CallStatus = 'idle' | 'customer_requesting' | 'staff_ringing' | 'connecting' | 'active' | 'ended';

interface ThreadRow {
  $id: string; customerName: string; status: string; lastMessage: string; lastAt: string;
  lastSender: string; unreadStaff: boolean; assignedStaffName: string;
  callStatus: CallStatus; callId: string; callInitiator: string; callStaffName: string;
}
interface Msg { $id: string; senderId: string; senderName: string; senderRole: 'customer' | 'staff' | 'system'; content: string; imageUrl?: string; createdAt: string }

function timeShort(iso: string) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}
function dayShort(iso: string) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }); } catch { return ''; }
}

/** หน้าแชทศูนย์ช่วยเหลือฝั่งพนักงาน — ดูทุกห้องแชท ตอบลูกค้า โทรออก/รับคำขอโทรของลูกค้า */
export default function AdminSupportPage() {
  const [threads, setThreads] = useState<ThreadRow[] | null>(null);
  const [selected, setSelected] = useState('');
  const [thread, setThread] = useState<ThreadRow | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [callState, setCallState] = useState<CallSessionState | null>(null);
  const [muted, setMuted] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const jwtRef = useRef('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<CallSession | null>(null);
  const handledCallIdRef = useRef('');
  const selectedRef = useRef('');
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const getJwt = useCallback(async () => {
    const j = (await account.createJWT()).jwt;
    jwtRef.current = j;
    return j;
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      const jwt = jwtRef.current || await getJwt();
      const r = await fetch('/api/admin/support', { headers: { 'x-session-jwt': jwt } });
      if (!r.ok) return;
      const d = await r.json();
      setThreads(d.threads || []);
    } catch { /* ลองใหม่รอบถัดไป */ }
  }, [getJwt]);

  const loadThread = useCallback(async (customerId: string) => {
    if (!customerId) return;
    try {
      const jwt = jwtRef.current || await getJwt();
      const r = await fetch(`/api/admin/support?with=${encodeURIComponent(customerId)}`, { headers: { 'x-session-jwt': jwt } });
      if (!r.ok) return;
      const d = await r.json();
      if (selectedRef.current !== customerId) return; // ผู้ใช้สลับห้องไปแล้วระหว่างรอ
      setThread(d.thread || null);
      setMsgs(d.messages || []);
    } catch { /* ลองใหม่รอบถัดไป */ }
  }, [getJwt]);

  useEffect(() => {
    const t = window.setTimeout(() => { void loadThreads(); }, 0);
    return () => window.clearTimeout(t);
  }, [loadThreads]);

  useEffect(() => {
    const iv = setInterval(() => { void loadThreads(); }, 8000);
    return () => clearInterval(iv);
  }, [loadThreads]);

  useEffect(() => {
    if (!selected) {
      const t = window.setTimeout(() => { setThread(null); setMsgs([]); }, 0);
      return () => window.clearTimeout(t);
    }
    void loadThread(selected);
    const iv = setInterval(() => { void loadThread(selected); }, 3000);
    return () => clearInterval(iv);
  }, [selected, loadThread]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  // ── จัดการสาย WebRTC ตามสถานะห้องที่เลือก — พนักงานเป็นฝั่ง offerer เสมอ ──
  useEffect(() => {
    const status = thread?.callStatus;
    const callId = thread?.callId || '';
    const customerId = selected;

    if (status === 'connecting' && callId && customerId && handledCallIdRef.current !== callId) {
      handledCallIdRef.current = callId;
      setCallStartedAt(null);
      const session = new CallSession({
        role: 'staff', isOfferer: true, callId, customerId,
        signalUrl: '/api/admin/support/signal', getJwt,
        onState: (s) => { setCallState(s); if (s === 'active') setCallStartedAt(Date.now()); },
        onRemoteStream: (stream) => { if (audioRef.current) audioRef.current.srcObject = stream; },
      });
      sessionRef.current = session;
      void session.start();
    }

    if ((status === 'idle' || status === 'ended' || !status) && sessionRef.current) {
      sessionRef.current.stop(false);
      sessionRef.current = null;
      handledCallIdRef.current = '';
      setCallState(null);
      setCallStartedAt(null);
    }
  }, [thread?.callStatus, thread?.callId, selected, getJwt]);

  useEffect(() => {
    if (!callStartedAt) {
      const t = window.setTimeout(() => setElapsed(0), 0);
      return () => window.clearTimeout(t);
    }
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - callStartedAt) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [callStartedAt]);

  useEffect(() => () => { sessionRef.current?.stop(false); }, []);

  async function send() {
    const content = input.trim();
    if (!content || sending || !selected) return;
    setSending(true);
    try {
      const jwt = jwtRef.current || await getJwt();
      const r = await fetch('/api/admin/support', {
        method: 'POST', headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selected, content }),
      });
      if (r.ok) { setInput(''); void loadThread(selected); void loadThreads(); }
    } finally { setSending(false); }
  }

  async function handleImagePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploading || !selected) return;
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const jwt = jwtRef.current || await getJwt();
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch('/api/support/upload', { method: 'POST', headers: { 'x-session-jwt': jwt }, body: fd });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok || !upData.url) return;
      const r = await fetch('/api/admin/support', {
        method: 'POST', headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selected, content: '', imageUrl: upData.url, mimeType: upData.mimeType }),
      });
      if (r.ok) { void loadThread(selected); void loadThreads(); }
    } finally { setUploading(false); }
  }

  async function callAction(action: string) {
    if (!selected) return;
    try {
      const jwt = jwtRef.current || await getJwt();
      await fetch('/api/admin/support/call', {
        method: 'POST', headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selected, action }),
      });
      void loadThread(selected);
    } catch { /* แสดงผลรอบโพลถัดไป */ }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    sessionRef.current?.setMuted(next);
  }

  const filtered = (threads || []).filter(t =>
    !search.trim() || t.customerName.toLowerCase().includes(search.trim().toLowerCase()));
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const callStatus = thread?.callStatus;

  return (
    <div className="h-full flex flex-col">
      <audio ref={audioRef} autoPlay />
      <div className="flex items-center gap-2 mb-1">
        <MessageCircle size={22} className="text-blue-500" />
        <h1 className="text-xl font-bold">แชทลูกค้า</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">ตอบคำถามลูกค้าและจัดการคำขอโทรกลับ — พนักงานคนใดก็ได้รับคำขอแทนกันได้</p>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* ── รายชื่อห้องแชท ── */}
        <div className="flex flex-col border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900 overflow-hidden">
          <div className="p-2.5 border-b border-gray-200 dark:border-gray-800">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อลูกค้า..." aria-label="ค้นหาชื่อลูกค้า"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {threads === null && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>}
            {threads !== null && filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                <Inbox size={28} className="mx-auto mb-2 opacity-40" />
                ยังไม่มีห้องแชท
              </div>
            )}
            {filtered.map(t => {
              const pendingCall = t.callStatus === 'customer_requesting';
              const live = t.callStatus === 'active' || t.callStatus === 'connecting' || t.callStatus === 'staff_ringing';
              return (
                <button key={t.$id} type="button" onClick={() => setSelected(t.$id)}
                  aria-current={selected === t.$id ? 'true' : undefined}
                  className={`w-full text-left flex items-start gap-2.5 px-3 py-3 border-b border-gray-100 dark:border-gray-800/60 transition-colors
                    ${selected === t.$id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                  <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-500 shrink-0 mt-0.5">
                    <User size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{t.customerName}</span>
                      {(pendingCall || live) && (
                        <PhoneCall size={13} className={pendingCall ? 'text-rose-500 animate-pulse shrink-0' : 'text-green-600 shrink-0'} aria-label={pendingCall ? 'มีคำขอโทร' : 'กำลังโทร'} />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{t.lastMessage || 'ยังไม่มีข้อความ'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[11px] text-gray-400">{dayShort(t.lastAt)}</span>
                    {t.unreadStaff && <span className="w-2 h-2 rounded-full bg-rose-500" aria-label="ข้อความใหม่" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── แชท + ควบคุมสาย ── */}
        <div className="flex flex-col border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900 overflow-hidden">
          {!selected && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
              <MessageCircle size={32} className="opacity-30" />
              เลือกห้องแชทจากรายการด้านซ้าย
            </div>
          )}

          {selected && (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <div>
                  <p className="font-medium text-sm">{thread?.customerName || '...'}</p>
                  <p className="text-xs text-gray-400">{thread?.assignedStaffName ? `ดูแลโดย ${thread.assignedStaffName}` : 'ยังไม่มีพนักงานรับเรื่อง'}</p>
                </div>
                {(!callStatus || callStatus === 'idle' || callStatus === 'ended') && (
                  <button type="button" onClick={() => callAction('call')}
                    className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
                    <Phone size={16} /> โทรออก
                  </button>
                )}
              </div>

              {/* ── แถบสถานะสาย ── */}
              {callStatus === 'customer_requesting' && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-sm font-medium" role="alert">
                  <span className="flex items-center gap-2"><PhoneCall size={16} /> ลูกค้าขอให้โทรกลับ</span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => callAction('approve')} aria-label="รับคำขอโทร"
                      className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500">
                      <Phone size={17} />
                    </button>
                    <button type="button" onClick={() => callAction('decline')} aria-label="ปฏิเสธคำขอโทร"
                      className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                      <PhoneOff size={17} />
                    </button>
                  </span>
                </div>
              )}
              {callStatus === 'staff_ringing' && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm font-medium" role="status">
                  <span className="flex items-center gap-2"><Phone size={16} /> กำลังโทรไปหาลูกค้า…</span>
                  <button type="button" onClick={() => callAction('hangup')} aria-label="ยกเลิกการโทร"
                    className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                    <PhoneOff size={17} />
                  </button>
                </div>
              )}
              {callStatus === 'connecting' && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm font-medium" role="status">
                  <span className="flex items-center gap-2"><Phone size={16} /> {callState === 'failed' ? 'เชื่อมต่อไม่สำเร็จ' : 'กำลังเชื่อมต่อสาย…'}</span>
                  <button type="button" onClick={() => callAction('hangup')} aria-label="วางสาย"
                    className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                    <PhoneOff size={17} />
                  </button>
                </div>
              )}
              {callStatus === 'active' && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm font-medium" role="status">
                  <span className="flex items-center gap-2"><Phone size={16} /> สายกำลังคุยอยู่ · {mm}:{ss}</span>
                  <span className="flex gap-2">
                    <button type="button" onClick={toggleMute} aria-label={muted ? 'เปิดไมค์' : 'ปิดไมค์'}
                      className={`w-10 h-10 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${muted ? 'bg-gray-700 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}>
                      {muted ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                    <button type="button" onClick={() => callAction('hangup')} aria-label="วางสาย"
                      className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                      <PhoneOff size={17} />
                    </button>
                  </span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 dark:bg-gray-950/40">
                {msgs.length === 0 && <p className="text-center text-sm text-gray-400 mt-8">ยังไม่มีข้อความในห้องนี้</p>}
                {msgs.map(m => {
                  const mine = m.senderRole === 'staff';
                  if (m.senderRole === 'system') {
                    return <p key={m.$id} className="text-center text-xs text-gray-400 py-1">{m.content}</p>;
                  }
                  return (
                    <div key={m.$id} className={`flex flex-col max-w-[78%] ${mine ? 'items-end ml-auto' : 'items-start'}`}>
                      <div className={`flex flex-col gap-1.5 px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${mine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-bl-md'}`}>
                        {m.imageUrl && (
                          <a href={m.imageUrl} target="_blank" rel="noopener noreferrer">
                            <img src={m.imageUrl} alt="รูปที่ส่งในแชท" className="max-w-[200px] max-h-[200px] rounded-lg object-cover" />
                          </a>
                        )}
                        {m.content && <span>{m.content}</span>}
                      </div>
                      <small className="text-[10.5px] text-gray-400 mt-0.5">{mine ? m.senderName : ''} {timeShort(m.createdAt)}</small>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-200 dark:border-gray-800">
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImagePick} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="แนบรูปภาพ"
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <ImageIcon size={19} />
                </button>
                <input
                  value={input} onChange={e => setInput(e.target.value)}
                  placeholder="พิมพ์ข้อความถึงลูกค้า..." maxLength={2000}
                  aria-label="พิมพ์ข้อความถึงลูกค้า"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  className="flex-1 px-4 py-2.5 min-h-[44px] text-sm rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                <button type="button" onClick={send} disabled={!input.trim() || sending} aria-label="ส่งข้อความ"
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <Send size={17} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
