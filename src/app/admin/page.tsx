'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { account } from '@/lib/appwrite';
import { Users, Store, Shield, Clock, CheckCircle2, TrendingUp, ArrowRight } from 'lucide-react';

interface Stats {
  totalUsers: number;
  pendingSellers: number;
  approvedSellers: number;
  pendingMiddlemen: number;
  approvedMiddlemen: number;
  recentSellers: Application[];
  recentMiddlemen: Application[];
}

interface Application {
  $id: string;
  fullNameId: string;
  sellerType?: string;
  tier?: string;
  province?: string;
  workProvince?: string;
  status: string;
  $createdAt: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending_review: { label: 'รอตรวจสอบ', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  approved:       { label: 'อนุมัติแล้ว', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  rejected:       { label: 'ปฏิเสธ',     cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

function StatCard({ icon, label, value, sub, color, href }: {
  icon: React.ReactNode; label: string; value: number | string;
  sub?: string; color: string; href?: string;
}) {
  const inner = (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex items-start gap-4 hover:shadow-md transition-all ${href ? 'cursor-pointer' : ''}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    (async () => {
      try {
        const jwt = (await account.createJWT()).jwt;
        const res = await fetch('/api/admin/stats', { headers: { 'x-session-jwt': jwt } });
        if (res.status === 403) { router.replace('/'); return; }
        if (!res.ok) throw new Error('Failed to load stats');
        setStats(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return <div className="text-red-500 text-sm">{error}</div>;
  if (!stats) return null;

  const pendingTotal = stats.pendingSellers + stats.pendingMiddlemen;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold">ภาพรวมระบบ</h1>
        <p className="text-sm text-gray-500 mt-0.5">ข้อมูล ณ วันนี้</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={<Users size={22} className="text-blue-600" />}
          label="ผู้ใช้ทั้งหมด" value={stats.totalUsers}
          color="bg-blue-50 dark:bg-blue-900/20" href="/admin/users" />
        <StatCard icon={<Clock size={22} className="text-amber-600" />}
          label="รอตรวจสอบ" value={pendingTotal}
          sub={`ผู้ขาย ${stats.pendingSellers} | คนกลาง ${stats.pendingMiddlemen}`}
          color="bg-amber-50 dark:bg-amber-900/20" />
        <StatCard icon={<Store size={22} className="text-green-600" />}
          label="ผู้ขายที่อนุมัติ" value={stats.approvedSellers}
          color="bg-green-50 dark:bg-green-900/20" href="/admin/sellers" />
        <StatCard icon={<Shield size={22} className="text-purple-600" />}
          label="คนกลางที่อนุมัติ" value={stats.approvedMiddlemen}
          color="bg-purple-50 dark:bg-purple-900/20" href="/admin/middlemen" />
        <StatCard icon={<TrendingUp size={22} className="text-indigo-600" />}
          label="ใบสมัครทั้งหมด"
          value={stats.approvedSellers + stats.pendingSellers + stats.approvedMiddlemen + stats.pendingMiddlemen}
          color="bg-indigo-50 dark:bg-indigo-900/20" />
        <StatCard icon={<CheckCircle2 size={22} className="text-teal-600" />}
          label="อนุมัติแล้วรวม"
          value={stats.approvedSellers + stats.approvedMiddlemen}
          color="bg-teal-50 dark:bg-teal-900/20" />
      </div>

      {/* Pending alert */}
      {pendingTotal > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-4 flex items-center gap-3">
          <Clock size={18} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            มีใบสมัคร <strong>{pendingTotal} รายการ</strong> รอการตรวจสอบ
          </p>
          <div className="ml-auto flex gap-2">
            {stats.pendingSellers > 0 && (
              <Link href="/admin/sellers?status=pending_review"
                className="text-xs font-medium text-amber-700 bg-amber-100 dark:bg-amber-900/40 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors">
                ผู้ขาย ({stats.pendingSellers})
              </Link>
            )}
            {stats.pendingMiddlemen > 0 && (
              <Link href="/admin/middlemen?status=pending_review"
                className="text-xs font-medium text-amber-700 bg-amber-100 dark:bg-amber-900/40 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors">
                คนกลาง ({stats.pendingMiddlemen})
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Recent tables */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Recent sellers */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-sm flex items-center gap-2"><Store size={16} /> ผู้ขายล่าสุด</h2>
            <Link href="/admin/sellers" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              ดูทั้งหมด <ArrowRight size={12} />
            </Link>
          </div>
          {stats.recentSellers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {stats.recentSellers.map(s => (
                <div key={s.$id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.fullNameId}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.province} · {formatDate(s.$createdAt)}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent middlemen */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-sm flex items-center gap-2"><Shield size={16} /> คนกลางล่าสุด</h2>
            <Link href="/admin/middlemen" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              ดูทั้งหมด <ArrowRight size={12} />
            </Link>
          </div>
          {stats.recentMiddlemen.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {stats.recentMiddlemen.map(m => (
                <div key={m.$id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.fullNameId}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{m.workProvince} · Tier {m.tier} · {formatDate(m.$createdAt)}</p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
