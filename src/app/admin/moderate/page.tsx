'use client';

import { useState, useEffect, useCallback } from 'react';
import { authHeaders } from '@/lib/supabase';
import { Megaphone, Star, Loader2, Trash2, EyeOff, CheckCircle2, Store, RotateCcw } from 'lucide-react';

interface Wanted { id: string; user_name: string; title: string; detail: string; buy_mode: string; status: string; province: string; created_at: string }
interface Review { id: string; reviewer_name: string; reviewer_role: string; target_role: string; rating: number; comment: string; tags: string[]; created_at: string }
interface Listing { id: string; title: string; price: number; status: string; seller_name: string; location: string; category: string; created_at: string }

type ModTab = 'wanted' | 'reviews' | 'listings';

export default function AdminModerate() {
  const [tab, setTab] = useState<ModTab>('wanted');
  const [items, setItems] = useState<(Wanted | Review | Listing)[] | null>(null);
  const [acting, setActing] = useState('');

  const load = useCallback(async (type: string) => {
    setItems(null);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/admin/moderate?type=${type}`, { headers });
      const d = await r.json();
      setItems(d.documents || []);
    } catch { setItems([]); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(tab); }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, load]);

  const CONFIRM: Record<string, string> = {
    delete: 'ลบรีวิวนี้ถาวร?', remove: tab === 'listings' ? 'ถอดประกาศนี้จากตลาด?' : 'ปิดประกาศนี้?', restore: 'คืนประกาศนี้กลับสู่ตลาด?',
  };
  async function act(id: string, type: ModTab, action: string) {
    if (!window.confirm(CONFIRM[action] || 'ยืนยันการดำเนินการ?')) return;
    setActing(id);
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/admin/moderate', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, action }),
      });
      // listings: เปลี่ยนสถานะ (ไม่ลบทิ้ง) จึงรีโหลดเพื่อให้เห็นสถานะใหม่ ; อื่น ๆ เอาออกจากรายการ
      if (r.ok) { if (type === 'listings') load(tab); else setItems(prev => (prev || []).filter(x => x.id !== id)); }
    } finally { setActing(''); }
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-1">
        <EyeOff size={22} className="text-violet-500" />
        <h1 className="text-xl font-bold">ตรวจสอบเนื้อหา</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">จัดการประกาศหาสินค้า รีวิว และประกาศขายในตลาดที่ไม่เหมาะสม</p>

      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('wanted')} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 ${tab === 'wanted' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600'}`}><Megaphone size={15} /> ประกาศหา</button>
        <button onClick={() => setTab('reviews')} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 ${tab === 'reviews' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600'}`}><Star size={15} /> รีวิว</button>
        <button onClick={() => setTab('listings')} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 ${tab === 'listings' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600'}`}><Store size={15} /> ประกาศตลาด</button>
      </div>

      {items === null && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>}
      {items !== null && items.length === 0 && (
        <div className="text-center py-16 text-gray-400"><CheckCircle2 size={36} className="mx-auto mb-2 opacity-40" /><p>ไม่มีรายการ</p></div>
      )}

      <div className="space-y-3">
        {tab === 'wanted' && (items as Wanted[] || []).map(w => (
          <div key={w.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${w.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{w.status === 'open' ? 'เปิดอยู่' : 'ปิดแล้ว'}</span>
                  {w.province && <span className="text-xs text-gray-400">📍 {w.province}</span>}
                </div>
                <p className="font-semibold mt-1">{w.title}</p>
                {w.detail && <p className="text-sm text-gray-500 mt-1">{w.detail}</p>}
                <p className="text-xs text-gray-400 mt-1">โดย {w.user_name} · {new Date(w.created_at).toLocaleDateString('th-TH')}</p>
              </div>
              {w.status === 'open' && (
                <button onClick={() => act(w.id, 'wanted', 'remove')} disabled={!!acting}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 shrink-0 disabled:opacity-50">
                  {acting === w.id ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />} ปิดประกาศ
                </button>
              )}
            </div>
          </div>
        ))}

        {tab === 'reviews' && (items as Review[] || []).map(rv => (
          <div key={rv.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 font-bold">{'★'.repeat(rv.rating)}{'☆'.repeat(5 - rv.rating)}</span>
                  <span className="text-xs text-gray-400">{rv.reviewer_role} → {rv.target_role}</span>
                </div>
                {rv.comment && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{rv.comment}</p>}
                <p className="text-xs text-gray-400 mt-1">โดย {rv.reviewer_name} · {new Date(rv.created_at).toLocaleDateString('th-TH')}</p>
              </div>
              <button onClick={() => act(rv.id, 'reviews', 'delete')} disabled={!!acting}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 shrink-0 disabled:opacity-50">
                {acting === rv.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} ลบ
              </button>
            </div>
          </div>
        ))}

        {tab === 'listings' && (items as Listing[] || []).map(l => {
          const removed = l.status !== 'posted';
          return (
            <div key={l.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${removed ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>{removed ? 'ถอดแล้ว' : 'แสดงในตลาด'}</span>
                    {l.location && <span className="text-xs text-gray-400">📍 {l.location}</span>}
                    <span className="font-mono text-sm font-bold text-green-600">฿{Number(l.price || 0).toLocaleString()}</span>
                  </div>
                  <p className="font-semibold mt-1">{l.title}</p>
                  <p className="text-xs text-gray-400 mt-1">โดย {l.seller_name || '-'} · {l.category || '-'} · {new Date(l.created_at).toLocaleDateString('th-TH')}</p>
                </div>
                {removed ? (
                  <button onClick={() => act(l.id, 'listings', 'restore')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-600 flex items-center gap-1 shrink-0 disabled:opacity-50">
                    {acting === l.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} คืนประกาศ
                  </button>
                ) : (
                  <button onClick={() => act(l.id, 'listings', 'remove')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 shrink-0 disabled:opacity-50">
                    {acting === l.id ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />} ถอดประกาศ
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
