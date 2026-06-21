'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { authHeaders } from '@/lib/supabase';
import { Icon } from './Icon';

/** ไอคอนกล่องข้อความ (ข้างกระดิ่ง) — badge แสดงจำนวนข้อความที่ยังไม่อ่าน */
export function MessengerIcon() {
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/dm?box=unread', { headers });
      if (r.ok) { const d = await r.json(); setUnread(d.unread || 0); }
    } catch { /* not logged in */ }
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

  return (
    <Link
      href="/messages"
      className="nb-btn"
      style={{ position: 'relative', flex: '0 0 auto' }}
      aria-label={unread > 0 ? `กล่องข้อความ ${unread} ข้อความใหม่` : 'กล่องข้อความ'}
    >
      <Icon name="message" size={19} />
      {unread > 0 && <span className="nb-badge">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  );
}

export default MessengerIcon;
