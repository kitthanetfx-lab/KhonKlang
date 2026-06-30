'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authHeaders } from '@/lib/supabase';
import { Icon } from './Icon';

interface Noti { id: string; title: string; body: string; link: string; read: boolean; created_at: string }

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'เมื่อครู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาที`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.`;
  return `${Math.floor(s / 86400)} วัน`;
}

/** กระดิ่งแจ้งเตือนใน Nav — โพลทุก 25 วิ + ตอนกลับมาโฟกัสแท็บ */
export function NotifyBell() {
  const router = useRouter();
  const [items, setItems] = useState<Noti[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/notifications', { headers });
      if (!r.ok) return;
      const d = await r.json();
      setItems(d.notifications || []);
      setUnread(d.unread || 0);
    } catch { /* not logged in / network */ }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const t = setInterval(() => { void load(); }, 25000);
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearTimeout(timer);
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onKey); };
  }, [open]);

  async function openItem(n: Noti) {
    setOpen(false);
    if (!n.read) {
      setItems(prev => prev.map(i => (i.id === n.id ? { ...i, read: true } : i)));
      setUnread(u => Math.max(0, u - 1));
      try {
        const headers = await authHeaders();
        fetch('/api/notifications', { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) }).catch(() => {});
      } catch {}
    }
    if (n.link) router.push(n.link);
  }

  async function markAll() {
    setItems(prev => prev.map(i => ({ ...i, read: true })));
    setUnread(0);
    try {
      const headers = await authHeaders();
      fetch('/api/notifications', { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) }).catch(() => {});
    } catch {}
  }

  return (
    <div className="nb-wrap" ref={wrapRef}>
      <button
        type="button" className="nb-btn"
        aria-label={unread > 0 ? `การแจ้งเตือน ${unread} รายการใหม่` : 'การแจ้งเตือน'}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <Icon name="bell" size={19} />
        {unread > 0 && <span className="nb-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="nb-panel" role="dialog" aria-label="การแจ้งเตือน">
          <div className="nb-head">
            <b>การแจ้งเตือน</b>
            {unread > 0 && <button type="button" className="nb-readall" onClick={markAll}>อ่านทั้งหมด</button>}
          </div>
          <div className="nb-list">
            {items.length === 0 && (
              <div className="nb-empty">
                <Icon name="bell" size={26} />
                <p>ยังไม่มีการแจ้งเตือน</p>
                <span>เมื่อมีคนเข้าร่วมดีล เลือกคุณเป็นคนกลาง หรือดีลคืบหน้า จะแจ้งที่นี่</span>
              </div>
            )}
            {items.map(n => (
              <button key={n.id} type="button" className={`nb-item ${n.read ? '' : 'unread'}`} onClick={() => openItem(n)}>
                <span className={`nb-dot ${n.read ? '' : 'on'}`} />
                <span className="nb-tx">
                  <b>{n.title}</b>
                  <span>{n.body}</span>
                  <small>{timeAgo(n.created_at)}ที่แล้ว</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotifyBell;
