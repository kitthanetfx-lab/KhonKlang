'use client';

import { useEffect, useState, useCallback } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Deal {
  $id: string;
  sellerId: string; sellerName: string;
  buyerId: string; buyerName: string;
  middlemanId: string; middlemanName: string;
  title: string; description: string;
  price: number; category: string;
  status: string; createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  terms_pending:          'รอยอมรับเงื่อนไข',
  payment_pending:        'รอโอนเงิน',
  payment_uploaded:       'ตรวจสลิป',
  packing:                'ผู้ขายแพ็คของ',
  shipped_to_middleman:   'รอรับพัสดุ',
  middleman_received:     'รับพัสดุแล้ว',
  middleman_checking:     'ตรวจสอบสินค้า',
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
const ACTIVE_STATUSES = ['terms_pending','payment_pending','payment_uploaded','packing',
  'shipped_to_middleman','middleman_received','middleman_checking','shipped_to_buyer','delivered'];

export default function MiddlemanDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [tier, setTier] = useState('Bronze');
  const [myId, setMyId] = useState('');

  const fetchDeals = useCallback(async (jwt: string) => {
    const res = await fetch('/api/deals?role=middleman', {
      headers: { 'x-session-jwt': jwt },
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setDeals(data.deals || []);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await account.get();
        const prefs = user.prefs as Record<string, string>;
        if (prefs.middlemanStatus !== 'approved') {
          router.replace('/register/middleman');
          return;
        }
        setTier(prefs.middlemanTierIntent || 'Bronze');
        setMyId(user.$id);
        const jwt = (await account.createJWT()).jwt;
        await fetchDeals(jwt);
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router, fetchDeals]);

  const active  = deals.filter(d => ACTIVE_STATUSES.includes(d.status));
  const history = deals.filter(d => FINAL.includes(d.status));
  const tierInfo = TIER_INFO[tier] || TIER_INFO.Bronze;

  if (loading) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  function DealCard({ deal }: { deal: Deal }) {
    return (
      <Link href={`/deal/${deal.$id}`}
        className="block bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl p-5 space-y-3 transition"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-white text-base leading-tight">{deal.title}</p>
          <span className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap flex-shrink-0 ${STATUS_COLOR[deal.status] || 'bg-gray-500/20 text-gray-300 border-gray-500/40'}`}>
            {STATUS_LABEL[deal.status] || deal.status}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
          <span>💰 {deal.price.toLocaleString()} บาท</span>
          {deal.category && <span>📦 {deal.category}</span>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          {deal.sellerName && <span>ผู้ขาย: {deal.sellerName}</span>}
          {deal.buyerName  && <span>ผู้ซื้อ: {deal.buyerName}</span>}
        </div>
        <div className="pt-1 text-xs text-blue-400 font-medium">แตะเพื่อเข้าห้อง Deal →</div>
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition">←</button>
        <h1 className="text-xl font-bold">บอร์ดคนกลาง</h1>
        <button onClick={async () => {
          const jwt = (await account.createJWT()).jwt;
          fetchDeals(jwt);
        }} className="ml-auto text-gray-400 hover:text-white text-sm transition">🔄 รีเฟรช</button>
      </div>

      {/* Tier card */}
      <div className="px-4 pt-5 pb-4 max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/15 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-1">ระดับของคุณ</p>
            <p className={`text-3xl font-bold ${tierInfo.color}`}>{tier}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">เงินประกัน</p>
            <p className="text-2xl font-semibold">{tierInfo.deposit.toLocaleString()} <span className="text-sm text-gray-400">บาท</span></p>
          </div>
        </div>

        {/* Info box: how middleman gets assigned */}
        <div className="mt-3 bg-blue-900/20 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
          ℹ️ ผู้ซื้อจะเป็นคนเลือกคุณเป็นคนกลาง — ดีลที่คุณถูกเลือกจะปรากฏในแถบ &quot;กำลังดีล&quot;
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 max-w-2xl mx-auto">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {([
            { key: 'active',  label: `กำลังดีล (${active.length})` },
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
      <div className="px-4 pb-10 max-w-2xl mx-auto mt-4 space-y-3">
        {tab === 'active' && (
          active.length === 0
            ? <p className="text-center text-gray-500 py-16">ยังไม่มีดีลที่กำลังดำเนินการ<br/><span className="text-xs text-gray-600">รอผู้ซื้อเลือกคุณเป็นคนกลาง</span></p>
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
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  