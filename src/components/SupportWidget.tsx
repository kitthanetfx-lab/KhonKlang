'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { account } from '@/lib/appwrite';
import { compressImage } from '@/lib/imageCompress';
import { Icon } from './Icon';
import { CallSession, type CallSessionState } from '@/lib/callSession';

interface SupportMsg { $id: string; senderId: string; senderName: string; senderRole: 'customer' | 'staff' | 'system'; content: string; imageUrl?: string; createdAt: string }
interface SupportThread {
  $id: string; unreadCustomer: boolean;
  callStatus: 'idle' | 'customer_requesting' | 'staff_ringing' | 'connecting' | 'active' | 'ended';
  callId: string; callStaffName: string;
}

function timeShort(iso: string) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

/** ปุ่มลอย "ติดต่อทีมงาน" — แสดงทุกหน้า (ยกเว้นหลังบ้าน /admin) เปิดแชท + ขอให้พนักงานโทรกลับได้ */
export function SupportWidget() {
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [myId, setMyId] = useState('');
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [msgs, setMsgs] = useState<SupportMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [callState, setCallState] = useState<CallSessionState | null>(null);
  const [muted, setMuted] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<CallSession | null>(null);
  const jwtRef = useRef('');
  const handledCallIdRef = useRef('');

  const getJwt = useCallback(async () => {
    const j = (await account.createJWT()).jwt;
    jwtRef.current = j;
    return j;
  }, []);

  const loadThread = useCallback(async (markOpen: boolean) => {
    try {
      const jwt = jwtRef.current || await getJwt();
      const r = await fetch(`/api/support${markOpen ? '?open=1' : ''}`, { headers: { 'x-session-jwt': jwt } });
      if (r.status === 401) { setAuthed(false); return; }
      if (!r.ok) return;
      const d = await r.json();
      setAuthed(true);
      setThread(d.thread || null);
      setMsgs(d.messages || []);
    } catch { /* network — ลองใหม่รอบถัดไป */ }
  }, [getJwt]);

  // ตรวจสถานะล็อกอินครั้งแรก + เริ่มโพลเบื้องหลัง
  useEffect(() => {
    const t = window.setTimeout(() => {
      account.get().then(u => { setMyId(u.$id); void loadThread(false); }).catch(() => setAuthed(false));
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadThread]);

  useEffect(() => {
    const iv = setInterval(() => { void loadThread(open); }, open ? 3000 : 20000);
    return () => clearInterval(iv);
  }, [open, loadThread]);

  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length, open]);

  // เปิดแผง: โฟกัสปุ่มปิด + เรียก mark-as-read
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (open) { void loadThread(true); closeRef.current?.focus(); }
      else fabRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, loadThread]);

  // ปิดด้วย Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // ── จัดการสาย WebRTC ตามสถานะห้องแชท ──
  useEffect(() => {
    const status = thread?.callStatus;
    const callId = thread?.callId || '';

    if (status === 'connecting' && callId && handledCallIdRef.current !== callId) {
      handledCallIdRef.current = callId;
      setCallStartedAt(null);
      const session = new CallSession({
        role: 'customer', isOfferer: false, callId,
        signalUrl: '/api/support/signal', getJwt,
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
  }, [thread?.callStatus, thread?.callId, getJwt]);

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
    if (!content || sending) return;
    setSending(true);
    try {
      const jwt = jwtRef.current || await getJwt();
      const r = await fetch('/api/support', {
        method: 'POST', headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (r.ok) { setInput(''); void loadThread(true); }
    } finally { setSending(false); }
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploading) return;
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const jwt = jwtRef.current || await getJwt();
      const prepared = await compressImage(file); // บีบอัดรูปก่อนส่ง กันไฟล์ใหญ่เกินลิมิต body ของ API route บน Vercel
      const fd = new FormData();
      fd.append('file', prepared);
      const up = await fetch('/api/support/upload', { method: 'POST', headers: { 'x-session-jwt': jwt }, body: fd });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok || !upData.url) { alert(upData.error || 'อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง'); return; }
      const r = await fetch('/api/support', {
        method: 'POST', headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '', imageUrl: upData.url, mimeType: upData.mimeType }),
      });
      if (r.ok) void loadThread(true);
    } catch {
      alert('อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally { setUploading(false); }
  }

  async function callAction(action: string) {
    try {
      const jwt = jwtRef.current || await getJwt();
      await fetch('/api/support/call', {
        method: 'POST', headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      void loadThread(open);
    } catch { /* แสดงผลรอบโพลถัดไป */ }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    sessionRef.current?.setMuted(next);
  }

  // ไม่แสดงในหลังบ้านแอดมิน — แอดมินมีแดชบอร์ดแชทของตัวเองแล้ว
  if (pathname?.startsWith('/admin')) return null;

  const unread = !!thread?.unreadCustomer;
  const ringing = thread?.callStatus === 'staff_ringing';
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <>
      <audio ref={audioRef} autoPlay />
      <div className="sw-wrap">
        {open && (
          <div className="sw-panel" role="dialog" aria-modal="false" aria-label="แชทกับทีมงาน" ref={panelRef}>
            <div className="sw-head">
              <span className="sw-head-tx"><Icon name="headset" size={18} /> ติดต่อทีมงาน</span>
              <button type="button" className="sw-iconbtn" onClick={() => setOpen(false)} aria-label="ปิดหน้าต่างแชท" ref={closeRef}>
                <Icon name="x" size={17} />
              </button>
            </div>

            {authed === false && (
              <div className="sw-login">
                <Icon name="user" size={26} />
                <p>เข้าสู่ระบบเพื่อแชทกับทีมงานและขอให้โทรกลับ</p>
                <Link href={`/login?returnTo=${encodeURIComponent(pathname || '/')}`} className="btn btn-primary btn-sm">เข้าสู่ระบบ</Link>
              </div>
            )}

            {authed === null && <div className="sw-loading" aria-live="polite">กำลังโหลด…</div>}

            {authed && (
              <>
                {/* ── แถบสถานะสาย ── */}
                {thread?.callStatus === 'customer_requesting' && (
                  <div className="sw-callbar pending" role="status">
                    <span><Icon name="phone" size={16} /> กำลังขอให้พนักงานโทรกลับ…</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => callAction('cancel')}>ยกเลิก</button>
                  </div>
                )}
                {ringing && (
                  <div className="sw-callbar ring" role="alert">
                    <span><Icon name="phone" size={16} /> พนักงาน{thread?.callStaffName ? ` ${thread.callStaffName}` : ''}กำลังโทรเข้า</span>
                    <span className="sw-callbtns">
                      <button type="button" className="sw-roundbtn accept" onClick={() => callAction('answer')} aria-label="รับสาย"><Icon name="phoneCall" size={18} /></button>
                      <button type="button" className="sw-roundbtn decline" onClick={() => callAction('decline')} aria-label="ปฏิเสธสาย"><Icon name="phoneOff" size={18} /></button>
                    </span>
                  </div>
                )}
                {thread?.callStatus === 'connecting' && (
                  <div className="sw-callbar active" role="status">
                    <span><Icon name="phone" size={16} /> {callState === 'failed' ? 'เชื่อมต่อไม่สำเร็จ' : 'กำลังเชื่อมต่อสาย…'}</span>
                    <button type="button" className="sw-roundbtn decline" onClick={() => callAction('hangup')} aria-label="วางสาย"><Icon name="phoneOff" size={18} /></button>
                  </div>
                )}
                {thread?.callStatus === 'active' && (
                  <div className="sw-callbar active" role="status">
                    <span><Icon name="phone" size={16} /> สายกำลังคุยอยู่ · {mm}:{ss}</span>
                    <span className="sw-callbtns">
                      <button type="button" className={`sw-roundbtn ${muted ? 'on' : ''}`} onClick={toggleMute} aria-label={muted ? 'เปิดไมค์' : 'ปิดไมค์'}>
                        <Icon name={muted ? 'micOff' : 'mic'} size={16} />
                      </button>
                      <button type="button" className="sw-roundbtn decline" onClick={() => callAction('hangup')} aria-label="วางสาย"><Icon name="phoneOff" size={18} /></button>
                    </span>
                  </div>
                )}

                <div className="sw-feed">
                  {msgs.length === 0 && (
                    <p className="sw-empty">สวัสดีครับ/ค่ะ มีอะไรให้ทีมงานช่วยไหม? พิมพ์คำถามได้เลย หรือกดโทรศัพท์ด้านบนเพื่อขอให้พนักงานโทรกลับ</p>
                  )}
                  {msgs.map(m => {
                    const mine = m.senderRole !== 'staff';
                    return (
                      <div key={m.$id} className={`sw-row ${mine ? 'mine' : ''} ${m.senderRole === 'system' ? 'sys' : ''}`}>
                        {m.senderRole === 'system' ? (
                          <div className="sw-sys">{m.content}</div>
                        ) : (
                          <>
                            <div className={`sw-bubble ${mine ? 'mine' : ''}`}>
                              {m.imageUrl && (
                                <a href={m.imageUrl} target="_blank" rel="noopener noreferrer">
                                  <img src={m.imageUrl} alt="รูปที่ส่งในแชท" className="sw-img" />
                                </a>
                              )}
                              {m.content && <span>{m.content}</span>}
                            </div>
                            <small>{m.senderRole === 'staff' ? `${m.senderName} · ` : ''}{timeShort(m.createdAt)}</small>
                          </>
                        )}
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <div className="sw-bar">
                  <input
                    ref={fileInputRef} type="file" accept="image/*" hidden
                    onChange={handleImagePick}
                  />
                  <button
                    type="button" className="sw-iconbtn" aria-label="แนบรูปภาพ"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Icon name="image" size={18} />
                  </button>
                  <button
                    type="button" className="sw-iconbtn call" aria-label="ขอให้พนักงานโทรกลับ"
                    disabled={!!thread && thread.callStatus !== 'idle' && thread.callStatus !== 'ended'}
                    onClick={() => callAction('request')}
                  >
                    <Icon name="phoneCall" size={18} />
                  </button>
                  <input
                    value={input} onChange={e => setInput(e.target.value)}
                    placeholder="พิมพ์ข้อความถึงทีมงาน..." maxLength={2000}
                    aria-label="พิมพ์ข้อความถึงทีมงาน"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  />
                  <button type="button" onClick={send} disabled={!input.trim() || sending} aria-label="ส่งข้อความ" className="sw-send">
                    <Icon name="arrowRight" size={17} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <button
          type="button" className={`sw-fab ${ringing ? 'ring' : ''}`} ref={fabRef}
          aria-label={unread ? 'ติดต่อทีมงาน มีข้อความใหม่' : ringing ? 'ติดต่อทีมงาน มีสายเข้า' : open ? 'ปิดหน้าต่างแชท' : 'ติดต่อทีมงาน'}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          <Icon name={open ? 'x' : 'headset'} size={24} />
          {!open && (unread || ringing) && <span className="sw-fab-badge" aria-hidden="true" />}
        </button>
      </div>
    </>
  );
}

export default SupportWidget;

