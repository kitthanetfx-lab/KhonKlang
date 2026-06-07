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

const CATEGORIES = ['สินค้าทั่วไป', 'อิเล็กทรอนิกส์', 'เสื้อผ้า', 'ยานพาหนะ', 'อสังหาริมทรัพย์', 'บริการ', 'อื่นๆ'];

export default function SellerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tab, setTab] = useState<'active' | 'post' | 'history'>('active');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [myId, setMyId] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [postDone, setPostDone] = useState(false);

  const fetchDeals = useCallback(async (jwt: string) => {
    const res = await fetch('/api/deals?role=seller', {
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
        if (prefs.sellerStatus !== 'approved') {
          router.replace('/register/seller');
          return;
        }
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

  async function handlePost() {
    if (!title || !price) { setPostError('กรุณากรอกชื่อสินค้าและราคา'); return; }
    setPosting(true); setPostError('');
    try {
      const jwt = (await account.createJWT()).jwt;
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, price: Number(price), category, creatorRole: 'seller' }),
      });
      if (!res.ok) { const d = await res.json(); setPostError(d.error || 'เกิดข้อผิดพลาด'); return; }
      setPostDone(true);
      setTitle(''); setDescription(''); setPrice(''); setCategory('');
      await fetchDeals(jwt);
      setTimeout(() => { setPostDone(false); setTab('active'); }, 1500);
    } finally {
      setPosting(false);
    }
  }

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

  const ACTIVE_STATUSES = ['posted','buyer_joined','terms_pending','payment_pending','payment_uploaded','packing','shipped_to_middleman','middleman_received','middleman_checking','shipped_to_buyer','delivered','active','confirming'];
  const DONE_STATUSES   = ['completed','cancelled','disputed'];
  const activeDeals  = deals.filter(d => d.sellerId === myId && ACTIVE_STATUSES.includes(d.status));
  const historyDeals = deals.filter(d => d.sellerId === myId && DONE_STATUSES.includes(d.status));

  if (loading) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  function DealCard({ deal }: { deal: Deal }) {
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
          {deal.middlemanName && <span>🤝 คนกลาง: {deal.middlemanName}</span>}
        </div>
        <Link href={`/deal/${deal.$id}`}
          className="block w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-center transition text-sm"
        >💬 เข้าห้อง Deal</Link>
        {deal.status === 'active' && (
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
        {deal.status === 'posted' && (
          <button
            onClick={() => handleAction(deal.$id, 'cancel')}
            disabled={!!busy}
            className="w-full py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-medium transition"
          >
            {busy ? '...' : 'ยกเลิกประกาศ'}
          </button>
        )}
        {deal.status === 'confirming' && !deal.sellerConfirmed && (
          <button
            onClick={() => handleAction(deal.$id, 'confirm')}
            disabled={!!busy}
            className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium transition"
          >
            {busy ? '...' : 'ยืนยันการรับสินค้า/บริการ'}
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
        <h1 className="text-xl font-bold">บอร์ดผู้ขาย</h1>
      </div>

      <div className="px-4 max-w-2xl mx-auto pt-4">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {([
            { key: 'active',  label: `กำลังขาย (${activeDeals.length})` },
            { key: 'post',    label: '+ ลงประกาศ' },
            { key: 'history', label: `ประวัติ (${historyDeals.length})` },
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
        {tab === 'active' && (activeDeals.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-gray-500">ยังไม่มีประกาศที่กำลังดำเนินการ</p>
            <button onClick={() => setTab('post')} className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition">
              ลงประกาศใหม่
            </button>
          </div>
        ) : activeDeals.map(d => <DealCard key={d.$id} deal={d} />))}

        {tab === 'post' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold">ลงประกาศใหม่</h2>
            {postDone && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-300 text-center">
                ✅ ลงประกาศสำเร็จ กำลังเปลี่ยนหน้า...
              </div>
            )}
            {postError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">
                {postError}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">ชื่อสินค้า / บริการ *</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="เช่น iPhone 15 Pro Max 256GB"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">รายละเอียด</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  placeholder="รายละเอียดสินค้า สภาพ เงื่อนไข..."
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition resize-none"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm text-gray-400 mb-1.5 block">ราคา (บาท) *</label>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm text-gray-400 mb-1.5 block">หมวดหมู่</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-[#1a2035] border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
                  >
                    <option value="">เลือก...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={handlePost}
                disabled={posting || postDone}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500