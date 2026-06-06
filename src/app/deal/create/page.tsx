'use client';
import { useState } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const CATS = ['สินค้าทั่วไป','อิเล็กทรอนิกส์','เสื้อผ้า','ยานพาหนะ','อสังหาริมทรัพย์','บริการ','อื่นๆ'];

export default function CreateDeal() {
  const router = useRouter();
  const [role, setRole]           = useState<'seller'|'buyer'>('seller');
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [price, setPrice]         = useState('');
  const [category, setCategory]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  async function handleCreate() {
    if (!title || !price) { setError('กรุณากรอกชื่อและราคา'); return; }
    setLoading(true); setError('');
    try {
      const jwt = (await account.createJWT()).jwt;
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, price: Number(price), category, creatorRole: role }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'เกิดข้อผิดพลาด'); return; }
      router.push(`/deal/${d.deal.$id}`);
    } catch { setError('เกิดข้อผิดพลาด'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-white">←</Link>
        <h1 className="text-xl font-bold">สร้างดีลใหม่</h1>
      </div>
      <div className="max-w-xl mx-auto px-4 py-8 space-y-5">

        {/* Role selector */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">คุณเป็น...</label>
          <div className="flex gap-2">
            {([['seller','ผู้ขาย 🛒'],['buyer','ผู้ซื้อ 🛍️']] as const).map(([k,l]) => (
              <button key={k} onClick={() => setRole(k)}
                className={`flex-1 py-3 rounded-xl font-medium border transition ${role === k ? 'bg-blue-600 border-blue-500 text-white' : 'border-white/15 text-gray-400 hover:text-white'}`}
              >{l}</button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {role === 'seller' ? 'สร้างดีล → ส่งลิงค์ให้ผู้ซื้อ → ผู้ซื้อเลือกคนกลาง' : 'สร้างดีล → ส่งลิงค์ให้ผู้ขาย → เลือกคนกลางเอง'}
          </p>
        </div>

        {/* Form */}
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">ชื่อสินค้า / บริการ *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="เช่น iPhone 15 Pro Max 256GB สภาพ 9/10"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">รายละเอียด</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={3}
              placeholder="สภาพ อุปกรณ์ที่แถม เงื่อนไขต่างๆ..."
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition resize-none"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm text-gray-400 mb-1.5 block">ราคา (บาท) *</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0"
                placeholder="0"
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm text-gray-400 mb-1.5 block">หมวดหมู่</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full bg-[#1a2035] border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="">เลือก...</option>
                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button onClick={handleCreate} disabled={loading}
          className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-lg transition"
        >{loading ? 'กำลังสร้าง...' : 'สร้างดีล & รับลิงค์แชร์'}</button>

        <p className="text-center text-xs text-gray-500">หลังสร้าง คัดลอกลิงค์จากหน้าดีลและส่งให้อีกฝ่าย</p>
      </div>
    </div>
  );
}
