'use client';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, authHeaders } from '@/lib/supabase';
import { Nav, Footer } from '@/components/Site';
import { Icon } from '@/components/Icon';

interface Thread { threadId: string; otherId: string; otherName: string; lastContent: string; lastAt: string; fromMe: boolean; unread: number }
interface Dm { id: string; from_id: string; from_name: string; to_id: string; to_name: string; content: string; created_at: string }

function timeAgo(iso: string) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'เมื่อครู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาที`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.`;
  if (s < 604800) return `${Math.floor(s / 86400)} วัน`;
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function MessagesInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialTo = sp.get('to');
  const [myId, setMyId] = useState('');
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [active, setActive] = useState<{ id: string; name: string } | null>(
    initialTo ? { id: initialTo, name: sp.get('name') || 'สมาชิก' } : null,
  );
  const [msgs, setMsgs] = useState<Dm[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const bottomRef = useRef<HTMLDivElement>(null);
  const headersRef = useRef<Record<string, string>>({});

  const getAuthHeaders = useCallback(async () => {
    const h = await authHeaders();
    headersRef.current = h;
    return h;
  }, []);

  const currentReturnTo = useCallback(() => {
    const query = sp.toString();
    return `/messages${query ? `?${query}` : ''}`;
  }, [sp]);

  const loadThreads = useCallback(async () => {
    try {
      const h = await getAuthHeaders();
      const r = await fetch('/api/dm', { headers: h });
      if (r.ok) { const d = await r.json(); setThreads(d.threads || []); }
    } catch { router.push(`/login?returnTo=${encodeURIComponent(currentReturnTo())}`); }
  }, [currentReturnTo, getAuthHeaders, router]);

  const loadThread = useCallback(async (otherId: string) => {
    try {
      const h = Object.keys(headersRef.current).length ? headersRef.current : await getAuthHeaders();
      const r = await fetch(`/api/dm?with=${otherId}`, { headers: h });
      if (r.ok) { const d = await r.json(); setMsgs(d.messages || []); }
    } catch {}
  }, [getAuthHeaders]);

  // init: ตัวตน + รายชื่อบทสนทนา + เปิดแชทจาก ?to=
  useEffect(() => {
    const timer = window.setTimeout(() => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setMyId(user.id);
        else router.push(`/login?returnTo=${encodeURIComponent(currentReturnTo())}`);
      });
      void loadThreads();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentReturnTo, loadThreads, router]);

  // โพล: รายชื่อทุก 15 วิ / ห้องที่เปิดอยู่ทุก 4 วิ
  useEffect(() => {
    const t = setInterval(loadThreads, 15000);
    return () => clearInterval(t);
  }, [loadThreads]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => { void loadThread(active.id); }, 0);
    const t = setInterval(() => { void loadThread(active.id); }, 4000);
    return () => {
      window.clearTimeout(timer);
      clearInterval(t);
    };
  }, [active, loadThread]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  async function send() {
    const text = input.trim();
    if (!text || !active || sending) return;
    setSending(true);
    try {
      const h = Object.keys(headersRef.current).length ? headersRef.current : await getAuthHeaders();
      const r = await fetch('/api/dm', {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ toId: active.id, toName: active.name, content: text }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'ส่งไม่สำเร็จ'); return; }
      setInput('');
      await loadThread(active.id);
      loadThreads();
    } finally { setSending(false); }
  }

  function openThread(t: Thread) {
    setActive({ id: t.otherId, name: t.otherName });
    setThreads(prev => (prev || []).map(x => (x.threadId === t.threadId ? { ...x, unread: 0 } : x)));
  }

  const visibleThreads = (threads || []).filter(t => {
    if (filter === 'unread' && t.unread <= 0) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return t.otherName.toLowerCase().includes(q) || t.lastContent.toLowerCase().includes(q);
  });

  return (
    <>
      <Nav />
      <main className="dm-shell">
        <div className="container">
          <div className={`dm-layout ${active ? 'has-active' : ''}`}>
            {/* ── รายชื่อบทสนทนา ── */}
            <aside className="dm-list">
              <div className="dm-list-head">
                <h1>ข้อความ</h1>
                <div className="dm-search-wrap">
                  <Icon name="search" size={16} className="dm-search-ic" />
                  <input
                    type="search"
                    className="dm-search"
                    placeholder="ค้นหา Messenger"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="ค้นหาบทสนทนา"
                  />
                </div>
                <div className="dm-filters" role="tablist" aria-label="ตัวกรองบทสนทนา">
                  <button type="button" role="tab" aria-selected={filter === 'all'} className={`dm-filter${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>ทั้งหมด</button>
                  <button type="button" role="tab" aria-selected={filter === 'unread'} className={`dm-filter${filter === 'unread' ? ' active' : ''}`} onClick={() => setFilter('unread')}>ยังไม่ได้อ่าน</button>
                </div>
              </div>
              {threads === null && <div className="mkt-detail-loading" style={{ margin: '60px auto' }} />}
              {threads !== null && visibleThreads.length === 0 && (
                <div className="dm-empty">
                  <Icon name="message" size={28} />
                  <p>{search || filter === 'unread' ? 'ไม่พบบทสนทนา' : 'ยังไม่มีข้อความ'}</p>
                  <span>{search || filter === 'unread' ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง' : 'ทักผู้ขายจากหน้าสินค้า หรือทักผู้ซื้อจากประกาศหา ข้อความจะรวมอยู่ที่นี่'}</span>
                </div>
              )}
              {visibleThreads.map(t => (
                <button key={t.threadId} type="button" className={`dm-thread ${active?.id === t.otherId ? 'active' : ''} ${t.unread > 0 ? 'unread' : ''}`} onClick={() => openThread(t)}>
                  <span className="dm-av">{(t.otherName || '?').slice(0, 1)}</span>
                  <span className="dm-thread-tx">
                    <b>{t.otherName}</b>
                    <span className="dm-thread-preview">
                      <span className="dm-thread-snippet">{t.fromMe ? 'คุณ: ' : ''}{t.lastContent}</span>
                      <span className="dm-thread-time"> · {timeAgo(t.lastAt)}</span>
                    </span>
                  </span>
                  {t.unread > 0 && <span className="dm-unread-dot" aria-label={`${t.unread} ข้อความใหม่`} />}
                </button>
              ))}
            </aside>

            {/* ── ห้องแชท ── */}
            <section className="dm-room">
              {!active ? (
                <div className="dm-empty" style={{ margin: 'auto' }}>
                  <Icon name="chat" size={30} />
                  <p>เลือกบทสนทนาทางซ้าย</p>
                  <span>หรือเริ่มทักใครสักคนจากหน้าสินค้า/ประกาศหา</span>
                </div>
              ) : (
                <>
                  <div className="dm-room-head">
                    <button type="button" className="dm-back" onClick={() => setActive(null)} aria-label="กลับไปรายชื่อ">
                      <Icon name="chevronRight" size={17} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <span className="dm-av">{(active.name || '?').slice(0, 1)}</span>
                    <b>{active.name}</b>
                  </div>
                  <div className="dm-feed">
                    {msgs.length === 0 && <p className="dm-feed-empty">เริ่มบทสนทนากับ {active.name} — ข้อความจะถูกเก็บไว้ให้เปิดอ่านได้ตลอด</p>}
                    {msgs.map((m, i) => {
                      const mine = m.from_id === myId;
                      const prev = msgs[i - 1];
                      const next = msgs[i + 1];
                      const sameAsPrev = prev && prev.from_id === m.from_id;
                      const sameAsNext = next && next.from_id === m.from_id;
                      const showSender = !mine && !sameAsPrev;
                      return (
                        <div
                          key={m.id}
                          className={`dm-row ${mine ? 'mine' : ''}${sameAsPrev ? ' dm-row--cont' : ''}${sameAsNext ? ' dm-row--has-next' : ''}`}
                        >
                          {showSender && <span className="dm-sender">{m.from_name || active.name}</span>}
                          <div className={`dm-bubble ${mine ? 'mine' : ''}`}>{m.content}</div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                  <div className="dm-bar">
                    <div className="dm-composer">
                      <button type="button" className="dm-composer-ic" aria-label="เพิ่ม" tabIndex={-1}>
                        <Icon name="plus" size={20} />
                      </button>
                      <input
                        className="dm-composer-input"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Aa"
                        maxLength={2000}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                      />
                      <button type="button" className="dm-composer-ic" aria-label="รูปภาพ" tabIndex={-1}>
                        <Icon name="image" size={20} />
                      </button>
                      <button type="button" className="dm-composer-ic" aria-label="สติกเกอร์" tabIndex={-1}>
                        <Icon name="sparkles" size={20} />
                      </button>
                      <button type="button" className="dm-composer-send" onClick={send} disabled={!input.trim() || sending} aria-label="ส่ง">
                        <Icon name="arrowRight" size={18} />
                      </button>
                    </div>
                  </div>
                  <p className="dm-safety">⚠️ อย่าโอนเงินนอกระบบ และอย่ากดลิงก์/เปิดไฟล์แปลกปลอมจากคู่สนทนา — ชวนกัน<Link href="/deal/create">เปิดดีลผ่านคนกลาง</Link>เพื่อความปลอดภัย</p>
                </>
              )}
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="mkt-detail-loading" />}>
      <MessagesInner />
    </Suspense>
  );
}
