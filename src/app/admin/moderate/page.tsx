'use client';

import { useState, useEffect, useCallback } from 'react';
import { account } from '@/lib/appwrite';
import { Megaphone, Star, Loader2, Trash2, EyeOff, CheckCircle2 } from 'lucide-react';

interface Wanted { $id: string; userName: string; title: string; detail: string; buyMode: string; status: string; province: string; createdAt: string }
interface Review { $id: string; reviewerName: string; reviewerRole: string; targetRole: string; rating: number; comment: string; tags: string; createdAt: string }

export default function AdminModerate() {
  const [tab, setTab] = useState<'wanted' | 'reviews'>('wanted');
  const [items, setItems] = useState<(Wanted | Review)[] | null>(null);
  const [acting, setActing] = useState('');

  const load = useCallback(async (type: string) => {
    setItems(null);
    try {
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch(`/api/admin/moderate?type=${type}`, { headers: { 'x-session-jwt': jwt } });
      const d = await r.json();
      setItems(d.documents || []);
    } catch { setItems([]); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(tab); }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, load]);

  async function act(id: string, type: 'wanted' | 'reviews', action: string) {
    if (!window.confirm(action === 'delete' ? 'ลบรีวิวนี้ถาวร?' : 'ปิดประกาศนี้?')) return;
    setActing(id);
    try {
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch('/api/admin/moderate', {
        method: 'PATCH',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, action }),
      });
      if (r.ok) setItems(prev => (prev || []).filter(x => x.$id !== id));
    } finally { setActing(''); }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <EyeOff size={22} className="text-violet-500" />
        <h1 className="text-xl font-bold">ตรวจสอบเนื้อหา</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">จัดการประกาศหาสินค้าและรีวิวที่ไม่เหมาะสม</p>

      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('wanted')} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 ${tab === 'wanted' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600'}`}><Megaphone size={15} /> ประกาศหา</button>
        <button onClick={() => setTab('reviews')} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 ${tab === 'reviews' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600'}`}><Star size={15} /> รีวิว</button>
      </div>

      {items === null && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>}
      {items !== null && items.length === 0 && (
        <div className="text-center py-16 text-gray-400"><CheckCircle2 size={36} className="mx-auto mb-2 opacity-40" /><p>ไม่มีรายการ</p></div>
      )}

      <div className="space-y-3">
        {tab === 'wanted' && (items as Wanted[] || []).map(w => (
          <div key={w.$id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${w.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{w.status === 'open' ? 'เปิดอยู่' : 'ปิดแล้ว'}</span>
                  {w.province && <span className="text-xs text-gray-400">📍 {w.province}</span>}
                </div>
                <p className="font-semibold mt-1">{w.title}</p>
                {w.detail && <p className="text-sm text-gray-500 mt-1">{w.detail}</p>}
                <p className="text-xs text-gray-400 mt-1">โดย {w.userName} · {new Date(w.createdAt).toLocaleDateString('th-TH')}</p>
              </div>
              {w.status === 'open' && (
                <button onClick={() => act(w.$id, 'wanted', 'remove')} disabled={!!acting}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 shrink-0 disabled:opacity-50">
                  {acting === w.$id ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />} ปิดประกาศ
                </button>
              )}
            </div>
          </div>
        ))}

        {tab === 'reviews' && (items as Review[] || []).map(rv => (
          <div key={rv.$id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 font-bold">{'★'.repeat(rv.rating)}{'☆'.repeat(5 - rv.rating)}</span>
                  <span className="text-xs text-gray-400">{rv.reviewerRole} → {rv.targetRole}</span>
                </div>
                {rv.comment && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{rv.comment}</p>}
                <p className="text-xs text-gray-400 mt-1">โดย {rv.reviewerName} · {new Date(rv.createdAt).toLocaleDateString('th-TH')}</p>
              </div>
              <button onClick={() => act(rv.$id, 'reviews', 'delete')} disabled={!!acting}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 shrink-0 disabled:opacity-50">
                {acting === rv.$id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} ลบ
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
