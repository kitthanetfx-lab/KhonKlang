'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, authHeaders } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

interface Deal {
  id: string;
  seller_id: string; seller_name: string; sellerPhone?: string;
  buyer_id: string;  buyer_name: string;  buyerPhone?: string;
  middleman_id: string; middleman_name: string;
  title: string; description: string;
  price: number; category: string;
  status: string; created_at: string;
}

interface MiddlemanWallet {
  tier: string;
  credit_limit: number;
  available_credit: number;
  held_credit: number;
  released_credit: number;
  penalty_credit: number;
  active_deal_count: number;
  updated_at: string;
}

interface LedgerEntry {
  id?: string;
  entry_key: string;
  purpose: string;
  amount: number;
  status: string;
  deal_number?: string;
}

const STATUS_LABEL: Record<string, string> = {
  terms_pending: 'รอยอมรับเงื่อนไข', payment_pending: 'รอโอนเงิน', payment_uploaded: 'ตรวจสลิป ⚠️',
  packing: 'ผู้ขายแพ็คของ', shipped_to_middleman: 'รอรับพัสดุ ⚠️', middleman_received: 'รับพัสดุแล้ว',
  middleman_checking: 'ตรวจสอบสินค้า ⚠️', shipped_to_buyer: 'จัดส่งให้ผู้ซื้อ', delivered: 'รอยืนยันรับ',
  completed: 'เสร็จสมบูรณ์', cancelled: 'ยกเลิก', disputed: 'มีปัญหา',
};
const STATUS_CLS: Record<string, string> = {
  terms_pending: 'sb-amber', payment_pending: 'sb-blue', payment_uploaded: 'sb-amber', packing: 'sb-purple',
  shipped_to_middleman: 'sb-teal', middleman_received: 'sb-teal', middleman_checking: 'sb-purple',
  shipped_to_buyer: 'sb-blue', delivered: 'sb-green', completed: 'sb-green', cancelled: 'sb-gray', disputed: 'sb-red',
};
const TIER_INFO: Record<string, { color: string; bg: string; deposit: number }> = {
  Bronze:   { color: '#cd7f32', bg: 'linear-gradient(135deg,#2c1a08 0%,#4a2e0e 100%)', deposit: 1000 },
  Silver:   { color: '#c0c0c0', bg: 'linear-gradient(135deg,#18202e 0%,#2c3750 100%)', deposit: 5000 },
  Gold:     { color: '#ffd700', bg: 'linear-gradient(135deg,#28200a 0%,#463800 100%)', deposit: 20000 },
  Platinum: { color: '#e5e4e2', bg: 'linear-gradient(135deg,#0d1520 0%,#162234 100%)', deposit: 50000 },
};
const FINAL = ['completed', 'cancelled', 'disputed'];
const ACTIVE_STATUSES = ['terms_pending', 'payment_pending', 'payment_uploaded', 'packing', 'shipped_to_middleman', 'middleman_received', 'middleman_checking', 'shipped_to_buyer', 'delivered'];
const NEEDS_ACTION: Record<string, string> = {
  payment_uploaded: '⚠️ รอคุณตรวจสลิปการโอนเงิน',
  shipped_to_middleman: '⚠️ รอคุณรับพัสดุจากผู้ขาย',
  middleman_checking: '⚠️ รอคุณตรวจสินค้าก่อนส่งผู้ซื้อ',
};

const LEDGER_STATUS: Record<string, string> = {
  expected: 'รอเริ่ม',
  held: 'กำลัง hold',
  released: 'ปลดแล้ว',
  forfeited: 'ถูกหัก',
  scheduled: 'รอจ่าย',
  paid: 'จ่ายแล้ว',
};

function baht(amount: number) {
  return `฿${Number(amount || 0).toLocaleString()}`;
}

export default function MiddlemanDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [tier, setTier] = useState('Bronze');
  const [wallet, setWallet] = useState<MiddlemanWallet | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#10a566'); r.style.setProperty('--accent-strong', '#0a8654'); r.style.setProperty('--accent-soft', '#e9faf2');
  }, []);

  const fetchDeals = useCallback(async (headers: Record<string, string>) => {
    const res = await fetch('/api/deals?role=middleman', { headers }).catch(() => null);
    if (res?.ok) { const data = await res.json(); setDeals(data.deals || []); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/login'); return; }
        const { data: profile } = await supabase.from('profiles').select('middleman_status, middleman_tier_intent').eq('id', user.id).maybeSingle();
        if (profile?.middleman_status !== 'approved') { router.replace('/register/middleman'); return; }
        setTier(profile?.middleman_tier_intent || 'Bronze');
        const headers = await authHeaders();
        const [profileRes] = await Promise.all([
          fetch('/api/profile', { headers }).catch(() => null),
          fetchDeals(headers),
        ]);
        const profileData = profileRes?.ok ? await profileRes.json() : null;
        setWallet(profileData?.wallet || null);
        setLedger(profileData?.ledger || []);
      } catch { router.replace('/login'); }
      finally { setLoading(false); }
    })();
  }, [router, fetchDeals]);

  async function refresh() {
    setRefreshing(true);
    try {
      const headers = await authHeaders();
      await fetchDeals(headers);
      try {
        const res = await fetch('/api/profile', { headers }).catch(() => null);
        const data = res?.ok ? await res.json() : null;
        setWallet(data?.wallet || null);
        setLedger(data?.ledger || []);
      } catch { /* ignore */ }
    } finally { setRefreshing(false); }
  }

  const active = deals.filter(d => ACTIVE_STATUSES.includes(d.status));
  const history = deals.filter(d => FINAL.includes(d.status));
  const ti = TIER_INFO[tier] || TIER_INFO.Bronze;

  if (loading) return (
    <div className="dash-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'dashSpin .8s linear infinite' }} />
    </div>
  );

  function DealCard({ deal }: { deal: Deal }) {
    const action = NEEDS_ACTION[deal.status];
    return (
      <div className={`deal-card${action ? ' action-needed' : ''}`}>
        <div className="deal-card-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="deal-card-title">{deal.title}</div>
            <div className="deal-card-meta"><span className="deal-card-price">฿{(deal.price || 0).toLocaleString()}</span>{deal.category && <span>{deal.category}</span>}</div>
          </div>
          <span className={`sb ${STATUS_CLS[deal.status] || 'sb-gray'}`}>{STATUS_LABEL[deal.status] || deal.status}</span>
        </div>
        {action && <div className="deal-action-needed">{action}</div>}
        <div className="parties-row">
          <div className="party-box">
            <span className="party-box-role">ผู้ขาย</span>
            <span className="party-box-name">{deal.seller_name || '—'}</span>
            {deal.sellerPhone && <a href={`tel:${deal.sellerPhone}`} className="party-box-phone">📞 {deal.sellerPhone}</a>}
          </div>
          <div className="party-box">
            <span className="party-box-role">ผู้ซื้อ</span>
            <span className="party-box-name">{deal.buyer_name || '—'}</span>
            {deal.buyerPhone && <a href={`tel:${deal.buyerPhone}`} className="party-box-phone">📞 {deal.buyerPhone}</a>}
          </div>
        </div>
        <Link href={`/deal/${deal.id}`} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>เข้าห้องดีล →</Link>
      </div>
    );
  }

  return (
    <div className="dash-root">
      <header className="dash-header">
        <button onClick={() => router.back()} className="dash-back"><Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} /></button>
        <div className="dash-head-info"><div className="dash-head-title">🤝 บอร์ดคนกลาง</div></div>
        <div className="dash-head-actions">
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={refreshing}>
            <span className={refreshing ? 'spin' : ''}>🔄</span> {refreshing ? 'กำลังโหลด...' : 'รีเฟรช'}
          </button>
        </div>
      </header>

      <main className="dash-body">
        <div className="tier-card" style={{ background: ti.bg }}>
          <div><div className="tier-card-name" style={{ color: ti.color }}>{tier}</div><div className="tier-card-sub">ระดับคนกลางของคุณ</div></div>
          <div className="tier-card-right"><div className="tier-card-dep-lbl">เงินประกัน</div><div className="tier-card-dep-val" style={{ color: ti.color }}>฿{ti.deposit.toLocaleString()}</div></div>
        </div>

        {wallet && (
          <div className="deal-card" style={{ gap: 14 }}>
            <div className="deal-card-header">
              <div style={{ flex: 1 }}>
                <div className="deal-card-title">เครดิตคนกลาง</div>
                <div className="deal-card-meta"><span>วงเงิน {baht(wallet.credit_limit)}</span><span>อัปเดต {new Date(wallet.updated_at).toLocaleString('th-TH')}</span></div>
              </div>
              <span className="sb sb-green">พร้อมรับงาน {wallet.active_deal_count} รายการ</span>
            </div>
            <div className="parties-row">
              <div className="party-box">
                <span className="party-box-role">เครดิตคงเหลือ</span>
                <span className="party-box-name" style={{ color: 'var(--accent-strong)' }}>{baht(wallet.available_credit)}</span>
              </div>
              <div className="party-box">
                <span className="party-box-role">เครดิตที่ hold</span>
                <span className="party-box-name">{baht(wallet.held_credit)}</span>
              </div>
              <div className="party-box">
                <span className="party-box-role">เครดิตปลดแล้ว</span>
                <span className="party-box-name">{baht(wallet.released_credit)}</span>
              </div>
            </div>
            {wallet.penalty_credit > 0 && (
              <div className="deal-action-needed">เครดิตถูกหักสะสม {baht(wallet.penalty_credit)}</div>
            )}
          </div>
        )}

        <div className="info-banner">
          <Icon name="info" size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>ผู้ซื้อเป็นคนเลือกคุณเป็นคนกลาง กดรีเฟรชเพื่อตรวจสอบดีลใหม่ที่เข้ามา</span>
        </div>

        {ledger.length > 0 && (
          <div className="deal-card">
            <div className="deal-card-header">
              <div>
                <div className="deal-card-title">รายการเครดิตล่าสุด</div>
                <div className="deal-card-meta"><span>ดูจาก wallet ledger จริง</span></div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ledger.slice(0, 4).map(item => (
                <div key={item.entry_key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{item.purpose}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{item.deal_number || item.entry_key}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700 }}>{baht(item.amount)}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{LEDGER_STATUS[item.status] || item.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dash-tabs-inline">
          {([{ k: 'active', l: `กำลังดีล (${active.length})` }, { k: 'history', l: `ประวัติ (${history.length})` }] as const).map(({ k, l }) => (
            <button key={k} className={`dash-tab-inline${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'active' && (active.length === 0 ? (
          <div className="dash-empty">
            <div className="dash-empty-icon">🤝</div>
            <p>ยังไม่มีดีลที่กำลังดำเนินการ</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>รอผู้ซื้อเลือกคุณเป็นคนกลาง</p>
            <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={refresh} disabled={refreshing}>🔄 ตรวจสอบอีกครั้ง</button>
          </div>
        ) : active.map(d => <DealCard key={d.id} deal={d} />))}
        {tab === 'history' && (history.length === 0 ? <div className="dash-empty"><p>ยังไม่มีประวัติ</p></div> : history.map(d => <DealCard key={d.id} deal={d} />))}
      </main>
    </div>
  );
}
