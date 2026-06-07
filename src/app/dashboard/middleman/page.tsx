'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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

// Action required from middleman
const NEEDS_ACTION: Record<string, string> = {
  payment_uploaded:     '⚠️ รอคุณตรวจสลิป',
  shipped_to_middleman: '⚠️ รอคุณรับพัสดุ',
  middleman_checking:   '⚠️ รอคุณตรวจสินค้า',
};

function sendBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico', badge: '/favicon.ico' });
  }
}

export default function MiddlemanDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [tier, setTier] = useState('Bronze');
  const [lastSeen, setLastSeen] = useState<Set<string>>(new Set());
  const [newCount, setNewCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const jwtRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  const fetchDeals = useCallback(async (jwt: string, isPolling = false) => {
    try {
      const res = await fetch('/api/deals?role=middleman', {
        headers: { 'x-session-jwt': jwt },
      });
      if (!res.ok) return;
      const data = await res.json();
      const fetched: Deal[] = data.deals || [];

      setDeals(fetched);
      setLastUpdated(new Date());

      if (isPolling && fetched.length > 0) {
        // Check for newly assigned deals (not seen before)
        const newDeals = fetched.filter(d => !lastSeen.has(d.$id) && ACTIVE_STATUSES.includes(d.status));
        if (newDeals.length > 0) {
          setNewCount(n => n + newDeals.length);
          setTab('active');
          newDeals.forEach(d => {
            sendBrowserNotification(
              '🔔 มีดีลใหม่สำหรับคุณ!',
              `${d.sellerName || 'ผู้ขาย'} ต้องการคนกลางสำหรับ "${d.title}" ราคา ${d.price.toLocaleString()} บาท`
            );
          });
        }
        // Also notify for deals needing action
        const actionNeeded = fetched.filter(d => NEEDS_ACTION[d.status] && !lastSeen.has(d.$id + d.status));
        actionNeeded.forEach(d => {
          sendBrowserNotification('⚠️ ต้องดำเนินการ', `${NEEDS_ACTION[d.status]} — "${d.title}"`);
        });
      }

      // Update lastSeen with all current IDs
      setLastSeen(new Set(fetched.map(d => d.$id)));
    } catch { /* ignore */ }
  }, [lastSeen]);

  // Update page title with notification count
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = newCount > 0 ? `(${newCount}) บอร์ดคนกลาง` : 'บอร์ดคนกลาง';
    }
    return () => { if (typeof document !== 'undefined') document.title = 'Khonklang'; };
  }, [newCount]);

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
        const jwt = (await account.createJWT()).jwt;
        jwtRef.current = jwt;
        await fetchDeals(jwt, false);

        // Poll every 15 seconds
        timerRef.current = setInterval(async () => {
          try {
            const j = (await account.createJWT()).jwt;
            jwtRef.current = j;
            await fetchDeals(j, true);
          } catch { /* ignore */ }
        }, 15000);
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    })();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [router]); // eslint-disable-line

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
      <Link href={`/deal/${deal.$id}`}
        className={`block border rounded-2xl p-5 space-y-3 transition ${
          action
            ? 'bg-orange-900/20 border-orange-500/40 hover:bg-orange-900/30'
            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-white text-base leading-tight">{deal.title}</p>
          <span className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap flex-shrink-0 ${STATUS_COLOR[deal.status] || 'bg-gray-500/20 text-gray-300 border-gray-500/40'}`}>
            {STATUS_LABEL[deal.status] || deal.status}
          </span>
        </div>

        {action && (
          <div className="text-xs font-semibold text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
            {action}
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
          <span>💰 {deal.price.toLocaleString()} บาท</span>
          {deal.category && <span>📦 {deal.category}</span>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          {deal.sellerName && <span>ผู้ขาย: {deal.sellerName}</span>}
          {deal.buyerName  && <span>ผู้ซื้อ: {deal.buyerName}</span>}
        </div>
        <div className="text-xs text-blue-400 font-medium pt-1">แตะเพื่อเข้าห้อง Deal →</div>
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* Header */}
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition">←</button>
        <h1 className="text-xl font-