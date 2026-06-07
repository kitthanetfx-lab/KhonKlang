'use client';

import { useEffect, useState, useCallback } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Deal {
  $id: string;
  sellerId: string; sellerName: string; sellerPhone?: string;
  buyerId: string;  buyerName: string;  buyerPhone?: string;
  middlemanId: string; middlemanName: string;
  title: string; description: string;
  price: number; category: string;
  status: string; createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  terms_pending:          'รอยอมรับเงื่อนไข',
  payment_pending:        'รอโอนเงิน',
  payment_uploaded:       'ตรวจสลิป ⚠️',
  packing:                'ผู้ขายแพ็คของ',
  shipped_to_middleman:   'รอรับพัสดุ ⚠️',
  middleman_received:     'รับพัสดุแล้ว',
  middleman_checking:     'ตรวจสอบสินค้า ⚠️',
  shipped_to_buyer:       'จัดส่งให้ผู้ซื้อ',
  delivered:              'รอยืนยันรับ',
  completed:              'เสร็จสมบูรณ์',
  cancelled:              'ยกเลิก',
  disputed:               'มีปัญหา',
};

const STATUS_COLOR: Record<string, string> = {
  terms_pending:        'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  payment_pending:      'bg-blue-500/20 text-blue-300 border-blue-500/40',
  payment_uploaded:     'bg-orange-500/20 text-orange-300 border-orange-500/40',
  packing:              'bg-purple-500/20 text-purple-300 border-purple-500/40',
  shipped_to_middleman: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  middleman_received:   'bg-teal-500/20 text-teal-300 border-teal-500/40',
  middleman_checking:   'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  shipped_to_buyer:     'bg-blue-500/20 text-blue-300 border-blue-500/40',
  delivered:            'bg-green-500/20 text-green-300 border-green-500/40',
  completed:            'bg-green-700/30 text-green-300 border-green-600/40',
  cancelled:            'bg-gray-500/20 text-gray-400 border-gray-500/40',
  disputed:             'bg-red-500/20 text-red-300 border-red-500/40',
};

const TIER_INFO: Record<string, { color: string; deposit: number }> = {
  Bronze:   { color: 'text-orange-400', deposit: 1000  },
  Silver:   { color: 'text-slate-300',  deposit: 5000  },
  Gold:     { color: 'text-yellow-400', deposit: 20000 },
  Platinum: { color: 'text-cyan-400',   deposit: 50000 },
};

const FINAL = ['completed', 'cancelled', 'disputed'];
const ACTIVE_STATUSES = [
  'terms_pending','payment_pending','payment_uploaded','packing',
  'shipped_to_middleman','middleman_received','middleman_checking',
  'shipped_to_buyer','delivered',
];

const NEEDS_ACTION: Record<string, string> = {
  payment_uploaded:     '⚠️ รอคุณตรวจสลิป',
  shipped_to_middleman: '⚠️ รอคุณรับพัสดุ',
  middleman_checking:   '⚠️ รอคุณตรวจสินค้า',
};

export default function MiddlemanDashboard() {
  const router = useRouter();
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [deals, setDeals]             = useState<Deal[]>([]);
  const [tab, setTab]                 = useState<'active' | 'history'>('active');
  const [tier, setTier]               = useState('Bronze');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [jwtState, setJwtState]       = useState('');

  const fetchDeals = useCallback(async (jwt: string) => {
    const res = await fetch('/api/deals?role=middleman', {
      headers: { 'x-session-jwt': jwt },
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setDeals(data.deals || []);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await account.get();
        const prefs = user.prefs as Record<string, string>;
        if (prefs.middlemanStatus !== 'approved') { router.replace('/register/middleman'); return; }
        setTier(prefs.middlemanTierIntent || 'Bronze');
        const jwt = (await account.createJWT()).jwt;
        setJwtState(jwt);
        await fetchDeals(jwt);
      } catch { router.replace('/login'); }
      finally { setLoading(false); }
    })();
  }, [router, fetchDeals]);

  async function refresh() {
    setRefreshing(true);
    try {
      const jwt = (await account.createJWT()).jwt;
      setJwtState(jwt);
      await fetchDeals(jwt);
    } finally { setRefreshing(false); }
  }

  const active  = deals.filter(d => ACTIVE_STATUSES.includes(d.status));
  const history = deals.filter(d => FINAL.includes(d.status));
  const tierInfo = TIER_INFO[tier] || TIER_INFO.Bronze;

  if (loading) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  function DealCard({ deal }: { deal: Deal }) {
    const action = NEEDS_ACTION[deal.status];
    return (
      <div className={`border rounded-2xl p-5 space-y-3 ${
        action
          ? 'bg-orange-900/20 border-orange-500/40'
          : 'bg-white/5 border-white/10'
      }`}>
        {/* Title + status */}
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-white text-base leading-tight">{deal.title}</p>
          <span className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap flex-shrink-0 ${STATUS_COLOR[deal.status] || 'bg-gray-500/20 text-gray-300 border-gray-500/40'}`}>
            {STATUS_LABEL[deal.status] || deal.status}
          </span>
        </div>

        {/* Action needed */}
        {action && (
          <div className="text-xs font-semibold text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
            {action}
          </div>
        )}

        {/* Price / category */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
          <span>💰 {deal.price.toLocaleString()} บาท</span>
          {deal.category && <span>📦 {deal.category}</span>}
        </div>

        {/* Parties + contact phones */}
        <div className="grid grid-cols-2 gap-2">
          {/* Seller */}
          <div className="bg-white/5 rounded-xl p-3 space-y-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">ผู้ขาย</p>
            <p className="text-sm text-white font-medium truncate">{deal.sellerName || '—'}</p>
            {deal.sellerPhone ? (
              <a href={`tel:${deal.sellerPhone}`}
                className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition"
              >📞 {deal.sellerPhone}</a>
            ) : (
              <p className="text-xs text-gray-600">ไม่มีเบอร์</p>
            )}
          </div>
          {/* Buyer */}
          <div className="bg-white/5 rounded-xl p-3 space-y-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">ผู้ซื้อ</p>
            <p className="text-sm text-white font-medium truncate">{deal.buyerName || '—'}</p>
            {deal.buyerPhone ? (
              <a href={`tel:${deal.buyerPhone}`}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
              >📞 {deal.buyerPhone}</a>
            ) : (
              <p className="text-xs text-gray-600">ไม่มีเบอร์</p>
            )}
          </div>
        </div>

        {/* Enter room */}
        <Link href={`/deal/${deal.$id}`}
          className="block w-full text-center py-2.5 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white text-sm font-medium transition"
        >เข้าห้อง Deal →</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* Header */}
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition">←</button>
        <h1 className="text-xl font-bold">บอร์ดคนกลาง</h1>
        <div className="ml-auto flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-500 hidden sm:block">
              {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium transition"
          >
            <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
            {refreshing ? 'กำลังโหลด...' : 'รีเฟรช'}
          </button>
        </div>
      </div>

      {/* Tier card */}
      <div className="px-4 pt-5 pb-4 max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/15 rounded-2xl p-5 flex items-center justify-between">
          <div>            <p className={`text-3xl font-bold ${tierInfo.color}`}>{tier}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">เงินประกัน</p>
            <p className="text-2xl font-semibold">{tierInfo.deposit.toLocaleString()} <span className="text-sm text-gray-400">บาท</span></p>
          </div>
        </div>
        <p className="mt-3 text-xs text-blue-300 bg-blue-900/20 border border-blue-500/20 rounded-xl px-3 py-2">
          ℹ️ ผู้ซื้อจะเป็นคนเลือกคุณเป็นคนกลาง กดรีเฟรชเพื่อตรวจสอบดีลใหม่
        </p>
      </div>

      {/* Tabs */}
      <div className="px-4 max-w-2xl mx-auto">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {([
            { key: 'active',  label: `กำลังดีล (${active.length})`  },
            { key: 'history', label: `ประวัติ (${history.length})` },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-10 max-w-2xl mx-auto mt-4 space-y-4">
        {tab === 'active' && (
          active.length === 0
            ? (
              <div className="text-center py-16">
                <p className="text-gray-500">ยังไม่มีดีลที่กำลังดำเนินการ</p>
                <p className="text-xs text-gray-600 mt-2">รอผู้ซื้อเลือกคุณเป็นคนกลาง</p>
                <button onClick={refresh} disabled={refreshing}
                  className="mt-4 px-4 py-2 rounded-lg bg-blue-600/60 hover:bg-blue-600 text-white text-sm transition disabled:opacity-50"
                >🔄 ตรวจสอบอีกครั้ง</button>
              </div>
            )
            : active.map(d => <DealCard key={d.$id} deal={d} />)
        )}
        {tab === 'history' && (
          history.length === 0
            ? <p className="text-center text-gray-500 py-16">ยังไม่มีประวัติ</p>
            : history.map(d => <DealCard key={d.$id} deal={d} />)
        )}
      </div>
    </div>
  );
}
