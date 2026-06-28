'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authHeaders } from '@/lib/supabase';
import { PageShell } from '@/components/PageShell';
import { Icon } from '@/components/Icon';
import { useAppPreferences } from '@/components/AppPreferences';

const ROLE_CLS: Record<string, string> = { buyer: 'badge-blue', seller: 'badge-amber', middleman: 'badge-green' };

type Filter = 'all' | 'active' | 'completed' | 'cancelled';
const DONE = ['completed'];
const DEAD = ['cancelled', 'disputed'];

interface MyDeal {
  id: string; title: string; price: number; status: string;
  buyerName: string; sellerName: string; middlemanName: string;
  createdAt: string; myRole: string;
  lastMsg: { content: string; type: string; senderName: string; role: string; createdAt: string } | null;
}
interface MyWanted { id: string; title: string; budget_min: number; budget_max: number; buy_mode: string; status: string; created_at: string }

function timeAgo(iso: string, locale: 'th' | 'en') {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (locale === 'en') {
    if (s < 60) return 'Just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
    return `${Math.floor(s / 86400)} day ago`;
  }
  if (s < 60) return 'เมื่อครู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`;
  return `${Math.floor(s / 86400)} วันที่แล้ว`;
}

function msgPreview(m: MyDeal['lastMsg'], locale: 'th' | 'en') {
  if (!m) return locale === 'th' ? 'ยังไม่มีข้อความ' : 'No messages yet';
  const who = m.role === 'system' ? '' : `${m.senderName}: `;
  if (m.type === 'image') return `${who}${locale === 'th' ? '📷 ส่งรูปภาพ' : '📷 Sent an image'}`;
  if (m.type === 'file') return `${who}${locale === 'th' ? '📎 ส่งไฟล์' : '📎 Sent a file'}`;
  return `${who}${m.content}`;
}

export default function OrdersPage() {
  const router = useRouter();
  const { locale } = useAppPreferences();
  const [deals, setDeals] = useState<MyDeal[] | null>(null);
  const [wanted, setWanted] = useState<MyWanted[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');

  const STEP_LABEL: Record<string, string> = locale === 'th'
    ? {
        posted: 'รอผู้ซื้อ', waiting_seller: 'รอผู้ขาย', waiting_buyer: 'รอผู้ซื้อ', buyer_joined: 'รอเลือกคนกลาง',
        terms_pending: 'รอยอมรับเงื่อนไข', payment_pending: 'รอโอนเงิน', payment_uploaded: 'รอคนกลางยืนยัน',
        packing: 'ผู้ขายแพ็คของ', shipped_to_middleman: 'รอคนกลางรับ', middleman_received: 'คนกลางรับแล้ว',
        middleman_checking: 'คนกลางตรวจ', shipped_to_buyer: 'จัดส่งให้ผู้ซื้อ', delivered: 'รอยืนยันรับ',
        completed: 'เสร็จสมบูรณ์', cancelled: 'ยกเลิก', disputed: 'มีปัญหา',
      }
    : {
        posted: 'Waiting for buyer', waiting_seller: 'Waiting for seller', waiting_buyer: 'Waiting for buyer', buyer_joined: 'Choose middleman',
        terms_pending: 'Awaiting terms', payment_pending: 'Awaiting payment', payment_uploaded: 'Awaiting middleman confirmation',
        packing: 'Seller packing', shipped_to_middleman: 'Waiting for middleman', middleman_received: 'Middleman received',
        middleman_checking: 'Middleman checking', shipped_to_buyer: 'Shipping to buyer', delivered: 'Awaiting delivery confirmation',
        completed: 'Completed', cancelled: 'Cancelled', disputed: 'Disputed',
      };
  const ROLE_LABEL: Record<string, string> = locale === 'th'
    ? { buyer: 'ผู้ซื้อ', seller: 'ผู้ขาย', middleman: 'คนกลาง' }
    : { buyer: 'Buyer', seller: 'Seller', middleman: 'Middleman' };
  const roleBadgeText = (role: string) => locale === 'th'
    ? `ฉันเป็น${ROLE_LABEL[role] || role}`
    : `Role: ${ROLE_LABEL[role] || role}`;
  const wantedStatusText = (status: string) => status === 'open'
    ? (locale === 'th' ? 'เปิดอยู่' : 'Open')
    : (locale === 'th' ? 'ปิดแล้ว' : 'Closed');

  useEffect(() => {
    (async () => {
      const headers = await authHeaders();
      if (!headers.Authorization) {
        router.push(`/login?returnTo=${encodeURIComponent('/orders')}`);
        return;
      }
      try {
        const [dr, wr] = await Promise.all([
          fetch('/api/my-deals', { headers }),
          fetch('/api/wanted?mine=1', { headers }),
        ]);
        if (dr.ok) { const d = await dr.json(); setDeals(d.deals || []); }
        else setError(locale === 'th' ? 'โหลดข้อมูลไม่สำเร็จ' : 'Failed to load data');
        if (wr.ok) { const w = await wr.json(); setWanted(w.posts || []); }
      } catch {
        setError(locale === 'th' ? 'โหลดข้อมูลไม่สำเร็จ' : 'Failed to load data');
      }
    })();
  }, [locale, router]);

  async function toggleWanted(id: string, action: 'close' | 'reopen') {
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/wanted', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (r.ok) setWanted(prev => prev.map(p => (p.id === id ? { ...p, status: action === 'close' ? 'closed' : 'open' } : p)));
    } catch {}
  }

  const filtered = (deals || []).filter(d => {
    if (filter === 'completed') return DONE.includes(d.status);
    if (filter === 'cancelled') return DEAD.includes(d.status);
    if (filter === 'active') return !DONE.includes(d.status) && !DEAD.includes(d.status);
    return true;
  });

  const FILTERS: { k: Filter; t: string }[] = [
    { k: 'all', t: locale === 'th' ? 'ทั้งหมด' : 'All' },
    { k: 'active', t: locale === 'th' ? 'กำลังดำเนินการ' : 'Active' },
    { k: 'completed', t: locale === 'th' ? 'สำเร็จ' : 'Completed' },
    { k: 'cancelled', t: locale === 'th' ? 'ยกเลิก/มีปัญหา' : 'Cancelled/Disputed' },
  ];

  return (
    <PageShell
      kicker={{ th: 'ประวัติการซื้อขาย', en: 'Trade History' }}
      title={{ th: 'ดีลของฉันทั้งหมด', en: 'All My Deals' }}
      lead={{ th: 'รวมทุกดีลที่คุณเกี่ยวข้อง — ซื้อ ขาย หรือเป็นคนกลาง พร้อมข้อความล่าสุดของแต่ละห้อง', en: 'View every deal you are involved in, whether as buyer, seller, or middleman, with the latest message in each room.' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {FILTERS.map(f => (
          <button key={f.k} className={`chip ${filter === f.k ? 'is-active' : ''}`} onClick={() => setFilter(f.k)}>
            {f.t}{f.k === 'all' && deals ? ` (${deals.length})` : ''}
          </button>
        ))}
      </div>

      {error && <p className="rv-error">{error}</p>}
      {deals === null && !error && <div className="mkt-detail-loading" />}

      {deals !== null && filtered.length === 0 && (
        <div className="prose-card center" style={{ padding: '44px 24px' }}>
          <p style={{ fontSize: 30, marginBottom: 8 }}>📦</p>
          <p style={{ fontWeight: 600, color: 'var(--ink)' }}>{locale === 'th' ? 'ยังไม่มีดีลในหมวดนี้' : 'No deals in this section yet'}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" href="/marketplace">{locale === 'th' ? 'ดูตลาด' : 'Browse marketplace'}</Link>
            <Link className="btn btn-ghost" href="/deal/create">{locale === 'th' ? 'สร้างดีลใหม่' : 'Create new deal'}</Link>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map(d => {
          const done = DONE.includes(d.status);
          const dead = DEAD.includes(d.status);
          return (
            <div key={d.id} className="od-card">
              <div className="od-head">
                <span className={`badge ${ROLE_CLS[d.myRole] || 'badge-gray'}`}>{roleBadgeText(d.myRole)}</span>
                <span className={`badge ${done ? 'badge-green' : dead ? 'badge-rose' : 'badge-blue'}`}>{STEP_LABEL[d.status] || d.status}</span>
                <span className="od-price mono">฿{Number(d.price || 0).toLocaleString()}</span>
              </div>
              <h3 className="od-title">{d.title}</h3>
              <p className="od-parties">
                {d.sellerName && <>{locale === 'th' ? 'ผู้ขาย' : 'Seller'}: {d.sellerName} · </>}
                {d.buyerName && <>{locale === 'th' ? 'ผู้ซื้อ' : 'Buyer'}: {d.buyerName} · </>}
                {d.middlemanName ? <>{locale === 'th' ? 'คนกลาง' : 'Middleman'}: {d.middlemanName}</> : <>{locale === 'th' ? 'ยังไม่มีคนกลาง' : 'No middleman yet'}</>}
              </p>
              <div className="od-msg">
                <Icon name="message" size={14} />
                <span className="od-msg-tx">{msgPreview(d.lastMsg, locale)}</span>
                <small>{timeAgo(d.lastMsg?.createdAt || d.createdAt, locale)}</small>
              </div>
              <div className="od-actions">
                <Link className="btn btn-primary btn-sm" href={`/deal/${d.id}`}>{locale === 'th' ? 'เปิดดีล' : 'Open deal'} <Icon name="arrowRight" size={14} /></Link>
                <Link className="btn btn-ghost btn-sm" href={`/deal/${d.id}?tab=chat`}><Icon name="chat" size={14} /> {locale === 'th' ? 'เปิดแชท' : 'Open chat'}</Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ประกาศหาของฉัน (รวมที่ปิดแล้ว) ── */}
      {wanted.length > 0 && (
        <>
          <h2 style={{ fontSize: 19, margin: '36px 0 14px' }}>📢 {locale === 'th' ? 'ประกาศหาสินค้าของฉัน' : 'My wanted posts'}</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {wanted.map(p => (
              <div key={p.id} className="od-card" style={{ padding: '14px 18px' }}>
                <div className="od-head">
                  <span className={`badge ${p.status === 'open' ? 'badge-green' : 'badge-gray'}`}>{wantedStatusText(p.status)}</span>
                  <span style={{ fontSize: 12, color: 'var(--faint)' }}>{timeAgo(p.created_at, locale)}</span>
                </div>
                <h3 className="od-title" style={{ fontSize: 15 }}>{p.title}</h3>
                <div className="od-actions" style={{ marginTop: 10, paddingTop: 10 }}>
                  <Link className="btn btn-ghost btn-sm" href="/wanted">{locale === 'th' ? 'ดูหน้าประกาศหา' : 'View wanted board'}</Link>
                  {p.status === 'open'
                    ? <button className="btn btn-ghost btn-sm" onClick={() => toggleWanted(p.id, 'close')}><Icon name="check" size={14} /> {locale === 'th' ? 'ปิดประกาศ' : 'Close post'}</button>
                    : <button className="btn btn-soft btn-sm" onClick={() => toggleWanted(p.id, 'reopen')}><Icon name="refresh" size={14} /> {locale === 'th' ? 'เปิดประกาศอีกครั้ง' : 'Reopen post'}</button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
