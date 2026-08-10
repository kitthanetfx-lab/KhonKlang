'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authHeaders } from '@/lib/supabase';
import { Nav, Footer } from '@/components/Site';
import { Icon } from '@/components/Icon';
import { OrdersApp, type OrdersFilter } from '@/components/orders/OrdersApp';
import { ResponsiveShell } from '@/components/mobile';

const STEP_LABEL: Record<string, string> = {
  posted: 'รอผู้ซื้อ', waiting_seller: 'รอผู้ขาย', waiting_buyer: 'รอผู้ซื้อ', buyer_joined: 'รอเลือกคนกลาง',
  terms_pending: 'รอยอมรับเงื่อนไข', payment_pending: 'รอโอนเงิน', payment_uploaded: 'รอคนกลางยืนยัน',
  packing: 'ผู้ขายแพ็คของ', shipped_to_middleman: 'รอคนกลางรับ', middleman_received: 'คนกลางรับแล้ว',
  middleman_checking: 'คนกลางตรวจ', shipped_to_buyer: 'จัดส่งให้ผู้ซื้อ', delivered: 'รอยืนยันรับ',
  completed: 'เสร็จสมบูรณ์', cancelled: 'ยกเลิก', disputed: 'มีปัญหา',
};
const ROLE_LABEL: Record<string, string> = { buyer: 'ผู้ซื้อ', seller: 'ผู้ขาย', middleman: 'คนกลาง' };
const ROLE_CLS: Record<string, string> = { buyer: 'badge-blue', seller: 'badge-amber', middleman: 'badge-green' };

type Filter = OrdersFilter;
const DONE = ['completed'];
const DEAD = ['cancelled', 'disputed'];

interface MyDeal {
  id: string; title: string; price: number; status: string;
  buyerName: string; sellerName: string; middlemanName: string;
  createdAt: string; myRole: string;
  lastMsg: { content: string; type: string; senderName: string; role: string; createdAt: string } | null;
}
interface MyWanted { id: string; title: string; budget_min: number; budget_max: number; buy_mode: string; status: string; created_at: string }

function timeAgo(iso: string) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'เมื่อครู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`;
  return `${Math.floor(s / 86400)} วันที่แล้ว`;
}

function msgPreview(m: MyDeal['lastMsg']) {
  if (!m) return 'ยังไม่มีข้อความ';
  const who = m.role === 'system' ? '' : `${m.senderName}: `;
  if (m.type === 'image') return `${who}📷 ส่งรูปภาพ`;
  if (m.type === 'file') return `${who}📎 ส่งไฟล์`;
  return `${who}${m.content}`;
}

export default function OrdersPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<MyDeal[] | null>(null);
  const [wanted, setWanted] = useState<MyWanted[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0');
    r.style.setProperty('--accent-strong', '#1f54d6');
    r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);

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
        else setError('โหลดข้อมูลไม่สำเร็จ');
        if (wr.ok) { const w = await wr.json(); setWanted(w.posts || []); }
      } catch {
        setError('โหลดข้อมูลไม่สำเร็จ');
      }
    })();
  }, [router]);

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
    { k: 'all', t: 'ทั้งหมด' }, { k: 'active', t: 'กำลังดำเนินการ' },
    { k: 'completed', t: 'สำเร็จ' }, { k: 'cancelled', t: 'ยกเลิก/มีปัญหา' },
  ];

  return (
    <>
      <Nav />
      <ResponsiveShell
        mobile={
          <OrdersApp
            deals={deals}
            wanted={wanted}
            filter={filter}
            error={error}
            onFilterChange={setFilter}
            onToggleWanted={toggleWanted}
          />
        }
        desktop={
          <>
            <header className="page-hero">
              <div className="container">
                <div className="kicker" style={{ marginBottom: 12 }}>ประวัติการซื้อขาย</div>
                <h1 className="section-title">ดีลของฉันทั้งหมด</h1>
                <p className="section-lead" style={{ marginTop: 12 }}>
                  รวมทุกดีลที่คุณเกี่ยวข้อง — ซื้อ ขาย หรือเป็นคนกลาง พร้อมข้อความล่าสุดของแต่ละห้อง
                </p>
              </div>
            </header>
            <main className="page-body">
              <div className="container">
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
                    <p style={{ fontWeight: 600, color: 'var(--ink)' }}>ยังไม่มีดีลในหมวดนี้</p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
                      <Link className="btn btn-primary" href="/marketplace">ดูตลาด</Link>
                      <Link className="btn btn-ghost" href="/deal/create">สร้างดีลใหม่</Link>
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
                          <span className={`badge ${ROLE_CLS[d.myRole] || 'badge-gray'}`}>ฉันเป็น{ROLE_LABEL[d.myRole] || d.myRole}</span>
                          <span className={`badge ${done ? 'badge-green' : dead ? 'badge-rose' : 'badge-blue'}`}>{STEP_LABEL[d.status] || d.status}</span>
                          <span className="od-price mono">฿{Number(d.price || 0).toLocaleString()}</span>
                        </div>
                        <h3 className="od-title">{d.title}</h3>
                        <p className="od-parties">
                          {d.sellerName && <>ผู้ขาย: {d.sellerName} · </>}
                          {d.buyerName && <>ผู้ซื้อ: {d.buyerName} · </>}
                          {d.middlemanName ? <>คนกลาง: {d.middlemanName}</> : <>ยังไม่มีคนกลาง</>}
                        </p>
                        <div className="od-msg">
                          <Icon name="message" size={14} />
                          <span className="od-msg-tx">{msgPreview(d.lastMsg)}</span>
                          <small>{timeAgo(d.lastMsg?.createdAt || d.createdAt)}</small>
                        </div>
                        <div className="od-actions">
                          <Link className="btn btn-primary btn-sm" href={`/deal/${d.id}`}>เปิดดีล <Icon name="arrowRight" size={14} /></Link>
                          <Link className="btn btn-ghost btn-sm" href={`/deal/${d.id}?tab=chat`}><Icon name="chat" size={14} /> เปิดแชท</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {wanted.length > 0 && (
                  <>
                    <h2 style={{ fontSize: 19, margin: '36px 0 14px' }}>📢 ประกาศหาสินค้าของฉัน</h2>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {wanted.map(p => (
                        <div key={p.id} className="od-card" style={{ padding: '14px 18px' }}>
                          <div className="od-head">
                            <span className={`badge ${p.status === 'open' ? 'badge-green' : 'badge-gray'}`}>{p.status === 'open' ? 'เปิดอยู่' : 'ปิดแล้ว'}</span>
                            <span style={{ fontSize: 12, color: 'var(--faint)' }}>{timeAgo(p.created_at)}</span>
                          </div>
                          <h3 className="od-title" style={{ fontSize: 15 }}>{p.title}</h3>
                          <div className="od-actions" style={{ marginTop: 10, paddingTop: 10 }}>
                            <Link className="btn btn-ghost btn-sm" href="/wanted">ดูหน้าประกาศหา</Link>
                            {p.status === 'open'
                              ? <button className="btn btn-ghost btn-sm" onClick={() => toggleWanted(p.id, 'close')}><Icon name="check" size={14} /> ปิดประกาศ</button>
                              : <button className="btn btn-soft btn-sm" onClick={() => toggleWanted(p.id, 'reopen')}><Icon name="refresh" size={14} /> เปิดประกาศอีกครั้ง</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </main>
            <Footer />
          </>
        }
      />
    </>
  );
}
