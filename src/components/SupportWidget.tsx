'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase, authHeaders } from '@/lib/supabase';
import { compressImage } from '@/lib/imageCompress';
import { Icon } from './Icon';
import { CallSession, type CallSessionState } from '@/lib/callSession';
import { SUPPORT_CALLS_COMING_SOON, SUPPORT_CALLS_ENABLED, SUPPORT_CALLS_PREPARE_TEXT } from '@/lib/supportCallFeature';

interface SupportMsg { id: string; sender_id: string; sender_name: string; sender_role: 'customer' | 'staff' | 'system'; content: string; image_url?: string; created_at: string; pending?: boolean }
interface SupportThread {
  customer_id: string; unread_customer: boolean;
  call_status: 'idle' | 'customer_requesting' | 'staff_ringing' | 'connecting' | 'active' | 'ended';
  call_id: string; call_staff_name: string; call_updated_at: string;
  last_read_by_staff_at: string;
}

function timeShort(iso: string) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

/** ปุ่มลอย "ติดต่อทีมงาน" — แสดงทุกหน้า (ยกเว้นหลังบ้าน /admin) เปิดแชท + ขอให้พนักงานโทรกลับได้ */
export function SupportWidget() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;
  return <SupportWidgetPanel pathname={pathname || '/'} />;
}

function SupportWidgetPanel({ pathname }: { pathname: string }) {
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
  const [nowTs, setNowTs] = useState(() => Date.now());

  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<CallSession | null>(null);
  const headersRef = useRef<Record<string, string> | null>(null);
  const handledCallIdRef = useRef('');
  const threadRef = useRef<SupportThread | null>(null);
  const callStateRef = useRef<CallSessionState | null>(null);

  useEffect(() => { threadRef.current = thread; }, [thread]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  const getAuthHeaders = useCallback(async (forceFresh = false) => {
    if (forceFresh) await supabase.auth.refreshSession().catch(() => null);
    if (!forceFresh && headersRef.current) return headersRef.current;
    const h = await authHeaders();
    headersRef.current = h;
    return h;
  }, []);

  const loadThread = useCallback(async (markOpen: boolean) => {
    try {
      let headers = await getAuthHeaders();
      let r = await fetch(`/api/support${markOpen ? '?open=1' : ''}`, { headers, cache: 'no-store' });
      if (r.status === 401) {
        headers = await getAuthHeaders(true);
        r = await fetch(`/api/support${markOpen ? '?open=1' : ''}`, { headers, cache: 'no-store' });
      }
      if (r.status === 401) { setAuthed(false); return; }
      if (!r.ok) return;
      const d = await r.json();
      setAuthed(true);
      setThread(d.thread || null);
      setMsgs(d.messages || []);
    } catch { /* network — ลองใหม่รอบถัดไป */ }
  }, [getAuthHeaders]);

  // ตรวจสถานะล็อกอินครั้งแรก แต่ยังไม่โหลด thread จนกว่าผู้ใช้จะเปิด widget จริง
  useEffect(() => {
    const t = window.setTimeout(() => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) { setMyId(user.id); setAuthed(true); } else setAuthed(false);
      }).catch(() => setAuthed(false));
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const iv = setInterval(() => { void loadThread(true); }, 5000);
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

  const unread = !!thread?.unread_customer;
  const ringing = thread?.call_status === 'staff_ringing';
  const callFeatureLocked = !SUPPORT_CALLS_ENABLED;
  const elapsed = callStartedAt ? Math.max(0, Math.floor((nowTs - callStartedAt) / 1000)) : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const getIceServers = useCallback(async () => {
    const headers = headersRef.current || await getAuthHeaders();
    const r = await fetch('/api/support/ice', { headers, cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    return Array.isArray(d.iceServers) ? d.iceServers : [];
  }, [getAuthHeaders]);

  const callAction = useCallback(async (action: string) => {
    try {
      const headers = headersRef.current || await getAuthHeaders();
      const r = await fetch('/api/support/call', {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ action }),
      });
      const d = await r.json().catch(() => ({}));
      void loadThread(open);
      return d as { callId?: string };
    } catch { /* แสดงผลรอบโพลถัดไป */ }
    return {};
  }, [getAuthHeaders, loadThread, open]);

  useEffect(() => {
    if (!callStartedAt) {
      const t = window.setTimeout(() => setNowTs(Date.now()), 0);
      return () => window.clearTimeout(t);
    }
    const iv = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [callStartedAt]);

  useEffect(() => {
    const status = thread?.call_status;
    const callId = thread?.call_id || '';
    if (callFeatureLocked) {
      if (sessionRef.current) {
        sessionRef.current.stop(false);
        sessionRef.current = null;
      }
      setCallState(null);
      setCallStartedAt(null);
      setMuted(false);
      return;
    }
    if (status === 'connecting' && callId && handledCallIdRef.current !== callId) {
      handledCallIdRef.current = callId;
      setCallStartedAt(null);
      const session = new CallSession({
        role: 'customer',
        isOfferer: false,
        callId,
        signalUrl: '/api/support/signal',
        getAuthHeaders,
        getIceServers,
        onState: (s) => {
          setCallState(s);
          if (s === 'active') {
            setCallStartedAt(Date.now());
            void callAction('active');
          }
          if (s === 'failed') void callAction('hangup');
        },
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
      setMuted(false);
    }
  }, [thread?.call_status, thread?.call_id, getAuthHeaders, getIceServers, callAction, callFeatureLocked]);

  useEffect(() => () => { sessionRef.current?.stop(false); }, []);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    const tempId = `tmp-${Date.now()}`;
    const tempMsg: SupportMsg = {
      id: tempId,
      sender_id: myId,
      sender_name: 'คุณ',
      sender_role: 'customer',
      content,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMsgs(prev => [...prev, tempMsg]);
    setInput('');
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setSending(true);
    try {
      const headers = headersRef.current || await getAuthHeaders();
      const r = await fetch('/api/support', {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ content }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.message) {
        setMsgs(prev => prev.map(m => m.id === tempId ? d.message : m));
        void loadThread(true);
      } else {
        setMsgs(prev => prev.filter(m => m.id !== tempId));
        setInput(content);
      }
    } catch {
      setMsgs(prev => prev.filter(m => m.id !== tempId));
      setInput(content);
    } finally { setSending(false); }
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploading) return;
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const headers = headersRef.current || await getAuthHeaders();
      const prepared = await compressImage(file); // บีบอัดรูปก่อนส่ง กันไฟล์ใหญ่เกินลิมิต body ของ API route บน Vercel
      const fd = new FormData();
      fd.append('file', prepared);
      const up = await fetch('/api/support/upload', { method: 'POST', headers, body: fd, cache: 'no-store' });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok || !upData.url) { alert(upData.error || 'อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง'); return; }
      const r = await fetch('/api/support', {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ content: '', imageUrl: upData.url, mimeType: upData.mimeType }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.message) {
        setMsgs(prev => [...prev, d.message]);
        void loadThread(true);
      }
    } catch {
      alert('อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally { setUploading(false); }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    sessionRef.current?.setMuted(next);
  }

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
                {callFeatureLocked && (
                  <div className="sw-callbar pending" role="status" aria-live="polite">
                    <span><Icon name="phone" size={16} /> {SUPPORT_CALLS_PREPARE_TEXT} · {SUPPORT_CALLS_COMING_SOON}</span>
                  </div>
                )}
                {!callFeatureLocked && thread?.call_status === 'customer_requesting' && (
                  <div className="sw-callbar pending" role="status">
                    <span><Icon name="phone" size={16} /> กำลังขอให้พนักงานโทรกลับ…</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => callAction('cancel')}>ยกเลิก</button>
                  </div>
                )}
                {!callFeatureLocked && ringing && (
                  <div className="sw-callbar ring" role="alert">
                    <span><Icon name="phone" size={16} /> พนักงาน{thread?.call_staff_name ? ` ${thread.call_staff_name}` : ''}กำลังโทรเข้า</span>
                    <span className="sw-callbtns">
                      <button type="button" className="sw-roundbtn accept" onClick={() => callAction('answer')} aria-label="รับสาย"><Icon name="phoneCall" size={18} /></button>
                      <button type="button" className="sw-roundbtn decline" onClick={() => callAction('decline')} aria-label="ปฏิเสธสาย"><Icon name="phoneOff" size={18} /></button>
                    </span>
                  </div>
                )}
                {!callFeatureLocked && thread?.call_status === 'connecting' && (
                  <div className="sw-callbar active" role="status">
                    <span><Icon name="phone" size={16} /> {callState === 'failed' ? 'เชื่อมต่อไม่สำเร็จ' : 'กำลังเชื่อมต่อสาย…'}</span>
                    <button type="button" className="sw-roundbtn decline" onClick={() => callAction('hangup')} aria-label="วางสาย"><Icon name="phoneOff" size={18} /></button>
                  </div>
                )}
                {!callFeatureLocked && (thread?.call_status === 'active' || callState === 'active') && (
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
                    <p className="sw-empty">สวัสดีครับ/ค่ะ มีอะไรให้ทีมงานช่วยไหม? พิมพ์คำถามได้เลย{callFeatureLocked ? ` ตอนนี้ระบบโทรอยู่ระหว่างเตรียมเปิดใช้งาน (${SUPPORT_CALLS_COMING_SOON})` : ' หรือกดโทรศัพท์ด้านบนเพื่อขอให้พนักงานโทรกลับ'}</p>
                  )}
                  {msgs.map(m => {
                    if (m.sender_role === 'system') {
                      return (
                        <div key={m.id} className="sw-row sys">
                          <div className="sw-sys">{m.content}</div>
                        </div>
                      );
                    }
                    const mine = m.sender_role === 'customer';
                    const readByStaff = !!(thread?.last_read_by_staff_at && mine && !m.pending && m.created_at <= thread.last_read_by_staff_at);
                    return (
                      <div key={m.id} className={`sw-row ${mine ? 'mine' : 'theirs'}`}>
                        {!mine && (
                          <span className="sw-sender">{m.sender_name || 'ทีมงาน'}</span>
                        )}
                        <div className={`sw-bubble ${mine ? 'mine' : 'theirs'}`}>
                          {m.image_url && (
                            <a href={m.image_url} target="_blank" rel="noopener noreferrer" className="sw-img-link">
                              <img src={m.image_url} alt="รูปที่ส่งในแชท" className="sw-img" />
                            </a>
                          )}
                          {m.content && <p className="sw-text">{m.content}</p>}
                        </div>
                        <small className="sw-meta">
                          {timeShort(m.created_at)}
                          {m.pending ? ' · กำลังส่ง…' : readByStaff ? ' · อ่านแล้ว' : ''}
                        </small>
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
                    type="button" className="sw-iconbtn call" aria-label={callFeatureLocked ? `ระบบโทร ${SUPPORT_CALLS_COMING_SOON}` : 'ขอให้พนักงานโทรกลับ'}
                    title={callFeatureLocked ? `${SUPPORT_CALLS_PREPARE_TEXT} (${SUPPORT_CALLS_COMING_SOON})` : undefined}
                    disabled={callFeatureLocked || (!!thread && thread.call_status !== 'idle' && thread.call_status !== 'ended')}
                    onClick={() => { if (!callFeatureLocked) void callAction('request'); }}
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
