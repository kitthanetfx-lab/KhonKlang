'use client';

import { useEffect, useState, useCallback } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Deal {
  $id: string;
  sellerId: string;
  sellerName: string;
  middlemanId: string;
  middlemanName: string;
  title: string;
  description: string;
  price: number;
  category: string;
  status: string;
  sellerConfirmed: boolean;
  middlemanConfirmed: boolean;
  rejectReason: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  posted: 'รอคนกลาง',
  active: 'กำลังดำเนินการ',
  confirming: 'รอยืนยัน',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
  disputed: 'มีปัญหา',
};

const STATUS_COLOR: Record<string, string> = {
  posted: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  active: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  confirming: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  completed: 'bg-green-500/20 text-green-300 border-green-500/40',
  cancelled: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
  disputed: 'bg-red-500/20 text-red-300 border-red-500/40',
};

const TIER_INFO: Record<string, { color: string; deposit: number; label: string }> = {
  Bronze:   { color: 'text-orange-400', deposit: 1000,  label: 'Bronze' },
  Silver:   { color: 'text-slate-300',  deposit: 5000,  label: 'Silver' },
  Gold:     { color: 'text-yellow-400', deposit: 20000, label: 'Gold' },
  Platinum: { color: 'text-cyan-400',   deposit: 50000, label: 'Platinum' },
};

export default function MiddlemanDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tab, setTab] = useState<'available' | 'active' | 'history'>('available');
  const [tier, setTier] = useState('Bronze');
  const [myId, setMyId] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  async function handleAction(dealId: string, action: string) {
    setActionLoading(dealId + action);
    try {
      const jwt = (await account.createJWT()).jwt;
      await fetch(`/api/deals?id=${dealId}`, {
        method: 'PATCH',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await fetchDeals(jwt);
    } finally {
      setActionLoading(null);
    }
  }

  const IN_PROGRESS = ['buyer_joined','terms_pending','payment_pending','payment_uploaded','packing','shipped_to_middleman','middleman_received','middleman_checking','shipped_to_buyer','delivered','active','confirming'];
  const available = deals.filter(d => d.status === 'posted');
  const active    = deals.filter(d => d.middlemanId === myId && IN_PROGRESS.includes(d.status));
  const history   = deals.filter(d => d.middlemanId === myId && ['completed','cancelled','disputed'].includes(d.status));

  const tierInfo = TIER_INFO[tier] || TIER_INFO.Bronze;

  if (loading) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  function DealCard({ deal }: { deal: Deal }) {
    const isMine = deal.middlemanId === myId;
    const busy = actionLoading?.startsWith(deal.$id);
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-white text-lg">{deal.title}</p>
            {deal.description && <p className="text-sm text-gray-400 mt-1 line-clamp-2">{deal.description}</p>}
          </div>
          <span className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap ${STATUS_COLOR[deal.status] || 'bg-gray-500/20 text-gray-300'}`}>
            {STATUS_LABEL[deal.status] || deal.status}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-gray-300">
          <span>💰 {deal.price.toLocaleString()} บาท</span>
          {deal.category && <span>📦 {deal.category}</span>}
          <span>👤 {deal.sellerName || 'ผู้ขาย'}</span>
        </div>
        {isMine && (
          <Link href={`/deal/${deal.$id}`}
            className="block w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-center transition text-sm"
          >💬 เข้าห้อง Deal</Link>
        )}
        {deal.status === 'posted' && !isMine && (
          <button
            onClick={() => handleAction(deal.$id, 'accept')}
            disabled={!!busy}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium transition"
          >
            {busy ? 'กำลังรับงาน...' : 'รับงานนี้'}
          </button>
        )}
        {isMine && deal.status === 'active' && (
          <div className="flex gap-2">
            <button
              onClick={() => handleAction(deal.$id, 'confirm')}
              disabled={!!busy}
              className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-medium transition"
            >
              {busy ? '...' : 'ยืนยันเสร็จสิ้น'}
            </button>
            <button
              onClick={() => handleAction(deal.$id, 'dispute')}
              disabled={!!busy}
              className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-medium transition"
            >
              แจ้งปัญหา
            </button>
          </div>
        )}
        {isMine && deal.status === 'confirming' && !deal.middlemanConfirmed && (
          <button
            onClick={() => handleAction(deal.$id, 'confirm')}
            disabled={!!busy}
            className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium transition"
          >
            {busy ? '...' : 'ยืนยันรับเงิน'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition">
          ←
        </button>
        <h1 className="text-xl font-bold">บอร์ดคนกลาง</h1>
      </div>

      <div className="px-4 pt-6 pb-4 max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/15 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">ระดับ (Tier) ของคุณ</p>
            <p className={`text-3xl font-bold mt-1 ${tierInfo.color}`}>{tierInfo.label}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">เงินประกัน</p>
            <p className="text-2xl font-semibold text-white mt-1">
              {tierInfo.deposit.toLocaleString()} <span className="text-base font-normal text-gray-400">บาท</span>
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {([
            { key: 'available', label: `รอรับงาน (${available.length})` },
            { key: 'active',    label: `กำลังทำ (${active.length})` },
            { key: 'history',   label: `ประวัติ (${history.length})` },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-10 max-w-2xl mx-auto mt-4 space-y-3">
        {tab === 'available' && (available.length === 0 ? (
          <p className="text-center text-gray-500 py-16">ยังไม่มีงานที่รอคนกลาง</p>
        ) : available.map(d => <DealCard key={d.$id} deal={d} />))}

        {tab === 'active' && (active.length === 0 ? (
          <p className="text-center text-gray-500 py-16">ยังไม่มีงานที่กำลังดำเนินการ</p>
        ) : active.map(d => <DealCard key={d.$id} deal={d} />))}

        {tab === 'history' && (history.length === 0 ? (
          <p className="text-center text-gray-500 py-16">ยังไม่มีประวัติการทำงาน</p>
        ) : history.map(d => <DealCard key={d.$id} deal={d} />))}
      </div>
    </div>
  );
}
