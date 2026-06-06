'use client';

import { useEffect, useState } from 'react';
import { account } from '@/lib/appwrite';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Deal {
  $id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  description: string;
  price: number;
  category: string;
  status: string;
  middlemanId: string;
  buyerId: string;
  createdAt: string;
}

const CATS = ['ทั้งหมด','สินค้าทั่วไป','อิเล็กทรอนิกส์','เสื้อผ้า','ยานพาหนะ','อสังหาริมทรัพย์','บริการ','อื่นๆ'];

export default function Marketplace() {
  const router = useRouter();
  const [deals, setDeals]     = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId]       = useState('');
  const [cat, setCat]         = useState('ทั้งหมด');
  const [search, setSearch]   = useState('');
  const [joining, setJoining] = useState<string|null>(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await account.get();
        setMyId(user.$id);
      } catch { /* guest */ }
      try {
        const res = await fetch('/api/deals?role=buyer');
        if (res.ok) {
          const data = await res.json();
          setDeals(data.deals || []);
        }
      } finally { setLoading(false); }
    })();
  }, []);

  async function joinDeal(dealId: string) {
    setJoining(dealId);
    try {
      const jwt = (await account.createJWT()).jwt;
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join_as_buyer' }),
      });
      if (res.ok) router.push(`/deal/${dealId}`);
      else { const d = await res.json(); alert(d.error || 'เกิดข้อผิดพลาด'); }
    } finally { setJoining(null); }
  }

  const filtered = deals
    .filter(d => d.status === 'posted' && d.sellerId !== myId)
    .filter(d => cat === 'ทั้งหมด' || d.category === cat)
    .filter(d => !search || d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-white transition">←</Link>
        <h1 className="text-xl font-bold">ตลาด — หาสินค้า</h1>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ค้นหาสินค้า..."
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
        />

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                cat === c ? 'bg-blue-600 border-blue-500 text-white' : 'border-white/15 text-gray-400 hover:text-white'
              }`}>{c}</button>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-16">ไม่พบสินค้า</p>
        ) : (
          <div className="space-y-3">
            {filtered.map(d => (
              <div key={d.$id} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white text-lg">{d.title}</p>
                    {d.description && <p className="text-sm text-gray-400 mt-1 line-clamp-2">{d.description}</p>}
                  </div>
                  <p className="text-xl font-bold text-green-400 whitespace-nowrap">
                    {d.price.toLocaleString()} ฿
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-gray-400">
                  {d.category && <span>📦 {d.category}</span>}
                  <span>👤 {d.sellerName || 'ผู้ขาย'}</span>
                </div>
                <div className="flex gap-2">
                  {myId ? (
                    d.buyerId === myId ? (
                      <Link href={`/deal/${d.$id}`}
                        className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium text-center transition"
                      >เข้าห้อง Deal</Link>
                    ) : (
                      <button
                        onClick={() => joinDeal(d.$id)}
                        disabled={joining === d.$id}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium transition"
                      >{joining === d.$id ? 'กำลังเข้าร่วม...' : 'ขอซื้อ / เข้าร่วม'}</button>
                    )
                  ) : (
                    <Link href="/login"
                      className="flex-1 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium text-center transition"
                    >เข้าสู่ระบบเพื่อซื้อ</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
