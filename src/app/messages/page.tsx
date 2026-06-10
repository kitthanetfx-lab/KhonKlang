'use client';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { account } from '@/lib/appwrite';
import { Nav, Footer } from '@/components/Site';
import { Icon } from '@/components/Icon';

interface Thread { threadId: string; otherId: string; otherName: string; lastContent: string; lastAt: string; fromMe: boolean; unread: number }
interface Dm { $id: string; fromId: string; fromName: string; toId: string; toName: string; content: string; createdAt: string }

function timeAgo(iso: string) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'เมื่อครู่';
  if (s < 3600) return `${Math.floor(s / 60)} น.`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.`;
  return `${Math.floor(s / 86400)} วัน`;
}

function MessagesInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [myId, setMyId] = useState('');
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [active, setActive] = useState<{ id: string; name: string } | null>(null);
  const [msgs, setMsgs] = useState<Dm[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const jwtRef = useRef('');

  const getJwt = useCallback(async () => {
    const j = (await account.createJWT()).jwt;
    jwtRef.current = j;
    return j;
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      const j = await getJwt();
      const r = await fetch('/api/dm', { headers: { 'x-session-jwt': j } });
      if (r.ok) { const d = await r.json(); setThreads(d.threads || []); }
    } catch { router.push(`/login?returnTo=${encodeURIComponent('/messages')}`); }
  }, [getJwt, router]);

  const loadThread = useCallback(async (otherId: string) => {
    try {
      const j = jwtRef.current || await getJwt();
      const r = await fetch(`/api/dm?with=${otherId}`, { headers: { 'x-session-jwt': j } });
      if (r.ok) { const d = await r.json(); setMsgs(d.messages || []); }
    } catch {}
  }, [getJwt]);

  // init: ตัวตน + รายชื่อบทสนทนา + เปิดแชทจาก ?to=
  useEffect(() => {
    account.get().then(u => setMyId(u.$id)).catch(() => router.push(`/login?returnTo=${encodeURIComponent('/messages')}`));
    loadThreads();
    const to = sp.get('to');
    if (to) setActive({ id: to, name: sp.get('name') || 'สมาชิก' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // โพล: รายชื่อทุก 15 วิ / ห้องที่เปิดอยู่ทุก 4 วิ
  useEffect(() => {
    const t = setInterval(loadThreads, 15000);
    return () => clearInterval(t);
  }, [loadThreads]);
  useEffect(() => {
    if (!active) return;
    loadThread(active.id);
    const t = setInterval(() => loadThread(active.id), 4000);
    return () => clearInterval(t);
  }, [active, loadThread]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  async function send() {
    const text = input.trim();
    if (!text || !active || sending) return;
    setSending(true);
    try {
      const j = jwtRef.current || await getJwt();
      const r = await fetch('/api/dm', {
        method: 'POST',
        headers: { 'x-session-jwt': j, 'Content-Type': 'application/json' },
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

  return (
    <>
      <Nav />
      <main className="dm-shell">
        <div className="container">
          <div className={`dm-layout ${active ? 'has-active' : ''}`}>
            {/* ── รายชื่อบทสนทนา ── */}
            <aside className="dm-list">
              <div className="dm-list-head">
                <h1>กล่องข้อความ</h1>
              </div>
              {threads === null && <div className="mkt-detail-loading" style={{ margin: '60px auto' }} />}
              {threads !== null && threads.length === 0 && (
                <div className="dm-empty">
                  <Icon name="message" size={28} />
                  <p>ยังไม่มีข้อความ</p>
                  <span>ทักผู้ขายจากหน้าสินค้า หรือทักผู้ซื้อจากประกาศหา ข้อความจะรวมอยู่ที่นี่</span>
                </div>
              )}
              {(threads || []).map(t => (
                <button key={t.threadId} type="button" className={`dm-thread ${active?.id === t.otherId ? 'active' : ''} ${t.unread > 0 ? 'unread' : ''}`} onClick={() => openThread(t)}>
                  <span className="dm-av">{(t.otherName || '?').slice(0, 1)}</span>
                  <span className="dm-thread-tx">
                    <b>{t.otherName}</b>
                    <span>{t.fromMe ? 'คุณ: ' : ''}{t.lastContent}</span>
                  </span>
                  <span className="dm-thread-meta">
                    <small>{timeAgo(t.lastAt)}</small>
                    {t.unread > 0 && <span className="dm-unread">{t.unread}</span>}
                  </span>
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
                    {msgs.map(m => {
                      const mine = m.fromId === myId;
                      return (
                        <div key={m.$id} className={`dm-row ${mine ? 'mine' : ''}`}>
                          <div className={`dm-bubble ${mine ? 'mine' : ''}`}>{m.content}</div>
                          <small>{new Date(m.createdAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                  <div className="dm-bar">
                    <input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder={`ส่งข้อความถึง ${active.name}...`}
                      maxLength={2000}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    />
                    <button type="button" onClick={send} disabled={!input.trim() || sending} aria-label="ส่ง">
                      <Icon name="arrowRight" size={17} />
                    </button>
                  </div>
                  <p className="dm-safety">⚠️ อย่าโอนเงินนอกระบบเด็ดขาด — ชวนคู่สนทนา<Link href="/deal/create">เปิดดีลผ่านคนกลาง</Link>เพื่อความปลอดภัย</p>
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
