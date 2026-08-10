'use client';

import Link from 'next/link';
import { Icon } from '@/components/Icon';
import {
  AppPage,
  AppHeader,
  AppSegment,
  AppFeed,
  AppEmpty,
  AppLoading,
} from '@/components/mobile';

export type OrdersFilter = 'all' | 'active' | 'completed' | 'cancelled';

export interface OrdersDeal {
  id: string;
  title: string;
  price: number;
  status: string;
  buyerName: string;
  sellerName: string;
  middlemanName: string;
  createdAt: string;
  myRole: string;
  lastMsg: {
    content: string;
    type: string;
    senderName: string;
    role: string;
    createdAt: string;
  } | null;
}

export interface OrdersWanted {
  id: string;
  title: string;
  budget_min: number;
  budget_max: number;
  buy_mode: string;
  status: string;
  created_at: string;
}

const STEP_LABEL: Record<string, string> = {
  posted: 'รอผู้ซื้อ',
  waiting_seller: 'รอผู้ขาย',
  waiting_buyer: 'รอผู้ซื้อ',
  buyer_joined: 'รอเลือกคนกลาง',
  terms_pending: 'รอยอมรับเงื่อนไข',
  payment_pending: 'รอโอนเงิน',
  payment_uploaded: 'รอคนกลางยืนยัน',
  packing: 'ผู้ขายแพ็คของ',
  shipped_to_middleman: 'รอคนกลางรับ',
  middleman_received: 'คนกลางรับแล้ว',
  middleman_checking: 'คนกลางตรวจ',
  shipped_to_buyer: 'จัดส่งให้ผู้ซื้อ',
  delivered: 'รอยืนยันรับ',
  completed: 'เสร็จสมบูรณ์',
  cancelled: 'ยกเลิก',
  disputed: 'มีปัญหา',
};

const ROLE_LABEL: Record<string, string> = {
  buyer: 'ผู้ซื้อ',
  seller: 'ผู้ขาย',
  middleman: 'คนกลาง',
};

const DONE = ['completed'];
const DEAD = ['cancelled', 'disputed'];

const FILTERS: { id: OrdersFilter; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'active', label: 'กำลังดำเนินการ' },
  { id: 'completed', label: 'สำเร็จ' },
  { id: 'cancelled', label: 'ยกเลิก/ปัญหา' },
];

function timeAgo(iso: string) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'เมื่อครู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`;
  return `${Math.floor(s / 86400)} วันที่แล้ว`;
}

function msgPreview(m: OrdersDeal['lastMsg']) {
  if (!m) return 'ยังไม่มีข้อความ';
  const who = m.role === 'system' ? '' : `${m.senderName}: `;
  if (m.type === 'image') return `${who}📷 ส่งรูปภาพ`;
  if (m.type === 'file') return `${who}📎 ส่งไฟล์`;
  return `${who}${m.content}`;
}

type Props = {
  deals: OrdersDeal[] | null;
  wanted: OrdersWanted[];
  filter: OrdersFilter;
  error: string;
  onFilterChange: (f: OrdersFilter) => void;
  onToggleWanted: (id: string, action: 'close' | 'reopen') => void;
};

export function OrdersApp({
  deals,
  wanted,
  filter,
  error,
  onFilterChange,
  onToggleWanted,
}: Props) {
  const filtered = (deals || []).filter(d => {
    if (filter === 'completed') return DONE.includes(d.status);
    if (filter === 'cancelled') return DEAD.includes(d.status);
    if (filter === 'active') return !DONE.includes(d.status) && !DEAD.includes(d.status);
    return true;
  });

  const filterItems = FILTERS.map(f => ({
    id: f.id,
    label: f.id === 'all' && deals ? `${f.label} (${deals.length})` : f.label,
  }));

  return (
    <AppPage withBottomNav>
      <AppHeader title="ดีลของฉัน" backHref="/" />

      <AppSegment<OrdersFilter>
        items={filterItems}
        value={filter}
        onChange={onFilterChange}
        ariaLabel="กรองดีล"
        columns={2}
      />

      <AppFeed>
        {error && <p className="rv-error">{error}</p>}
        {deals === null && !error && <AppLoading />}

        {deals !== null && filtered.length === 0 && (
          <AppEmpty
            action={
              <div className="orders-app-empty-actions">
                <Link href="/marketplace" className="btn btn-primary orders-app-cta">ดูตลาด</Link>
                <Link href="/deal/create" className="btn btn-ghost orders-app-cta">สร้างดีลใหม่</Link>
              </div>
            }
          >
            ยังไม่มีดีลในหมวดนี้
          </AppEmpty>
        )}

        <ul className="orders-app-list">
          {filtered.map(d => {
            const done = DONE.includes(d.status);
            const dead = DEAD.includes(d.status);
            return (
              <li key={d.id} className="orders-app-card app-card">
                <div className="orders-app-head">
                  <span className={`orders-app-badge orders-app-badge--${d.myRole}`}>
                    ฉันเป็น{ROLE_LABEL[d.myRole] || d.myRole}
                  </span>
                  <span className={`orders-app-badge orders-app-badge--${done ? 'done' : dead ? 'dead' : 'active'}`}>
                    {STEP_LABEL[d.status] || d.status}
                  </span>
                  <span className="orders-app-price">฿{Number(d.price || 0).toLocaleString()}</span>
                </div>
                <h3 className="orders-app-title">{d.title}</h3>
                <p className="orders-app-parties">
                  {d.sellerName && <>ผู้ขาย: {d.sellerName} · </>}
                  {d.buyerName && <>ผู้ซื้อ: {d.buyerName} · </>}
                  {d.middlemanName ? <>คนกลาง: {d.middlemanName}</> : <>ยังไม่มีคนกลาง</>}
                </p>
                <div className="orders-app-msg">
                  <Icon name="message" size={14} />
                  <span className="orders-app-msg-tx">{msgPreview(d.lastMsg)}</span>
                  <small>{timeAgo(d.lastMsg?.createdAt || d.createdAt)}</small>
                </div>
                <div className="orders-app-actions">
                  <Link className="btn btn-primary orders-app-cta" href={`/deal/${d.id}`}>
                    เปิดดีล <Icon name="arrowRight" size={14} />
                  </Link>
                  <Link className="btn btn-ghost orders-app-cta" href={`/deal/${d.id}?tab=chat`}>
                    <Icon name="chat" size={14} /> แชท
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>

        {wanted.length > 0 && (
          <section className="orders-app-wanted">
            <h2>📢 ประกาศหาสินค้าของฉัน</h2>
            <ul className="orders-app-list">
              {wanted.map(p => (
                <li key={p.id} className="orders-app-card orders-app-card--wanted app-card">
                  <div className="orders-app-head">
                    <span className={`orders-app-badge orders-app-badge--${p.status === 'open' ? 'done' : 'muted'}`}>
                      {p.status === 'open' ? 'เปิดอยู่' : 'ปิดแล้ว'}
                    </span>
                    <span className="orders-app-time">{timeAgo(p.created_at)}</span>
                  </div>
                  <h3 className="orders-app-title">{p.title}</h3>
                  <div className="orders-app-actions">
                    <Link className="btn btn-ghost orders-app-cta" href="/wanted">ดูหน้าประกาศหา</Link>
                    {p.status === 'open' ? (
                      <button type="button" className="btn btn-ghost orders-app-cta" onClick={() => onToggleWanted(p.id, 'close')}>
                        <Icon name="check" size={14} /> ปิดประกาศ
                      </button>
                    ) : (
                      <button type="button" className="btn btn-soft orders-app-cta" onClick={() => onToggleWanted(p.id, 'reopen')}>
                        <Icon name="refresh" size={14} /> เปิดอีกครั้ง
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </AppFeed>
    </AppPage>
  );
}

export default OrdersApp;
