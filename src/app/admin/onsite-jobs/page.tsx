'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { account } from '@/lib/appwrite';
import { MapPin, Loader2, CheckCircle2, ExternalLink, RotateCcw, XCircle } from 'lucide-react';

interface Job {
  $id: string;
  itemDescription: string;
  itemPrice?: string;
  maxBudget?: string;
  status: string;
  buyerName?: string;
  sellerProvince?: string;
  sellerLocation?: string;
  middlemanName?: string;
  middlemanTier?: string;
  middlemanDeposit?: string;
  travelFee?: string;
  serviceFee?: string;
  estimatedArrival?: string;
  reportNotes?: string;
  $createdAt: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open:        { label: 'เปิดรับงาน', cls: 'bg-green-100 text-green-700' },
  quoted:      { label: 'มีใบเสนอราคา', cls: 'bg-blue-100 text-blue-700' },
  accepted:    { label: 'รับงานแล้ว', cls: 'bg-indigo-100 text-indigo-700' },
  in_progress: { label: 'กำลังทำงาน', cls: 'bg-amber-100 text-amber-700' },
  completed:   { label: 'เสร็จสมบูรณ์', cls: 'bg-teal-100 text-teal-700' },
  cancelled:   { label: 'ยกเลิก', cls: 'bg-gray-100 text-gray-600' },
};

const TABS = [
  { k: 'active', label: 'กำลังดำเนินการ' },
  { k: 'open', label: 'เปิด/รอเสนอราคา' },
  { k: 'completed', label: 'สำเร็จ' },
  { k: 'cancelled', label: 'ยกเลิก' },
  { k: 'all', label: 'ทั้งหมด' },
];

export default function AdminOnsiteJobs() {
  const [tab, setTab] = useState('active');
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [acting, setActing] = useState('');

  const load = useCallback(async (filter: string) => {
    setJobs(null);
    try {
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch(`/api/admin/onsite-jobs?filter=${filter}`, { headers: { 'x-session-jwt': jwt } });
      const d = await r.json();
      setJobs(d.documents || []);
    } catch { setJobs([]); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(tab); }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, load]);

  async function act(id: string, action: string, promptMsg: string) {
    const note = window.prompt(promptMsg);
    if (note === null) return;
    setActing(id);
    try {
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch('/api/admin/onsite-jobs', {
        method: 'PATCH',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, note }),
      });
      if (r.ok) load(tab);
    } finally { setActing(''); }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <MapPin size={22} className="text-orange-500" />
        <h1 className="text-xl font-bold">งานนัดออนไซต์</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">ดูแลงานตรวจสอบถึงที่ ดูสถานะ ยกเลิก/คืนมัดจำ หรือปิดงานแทนเมื่อมีปัญหา</p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.k ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {jobs === null && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>}
      {jobs !== null && jobs.length === 0 && (
        <div className="text-center py-16 text-gray-400"><CheckCircle2 size={36} className="mx-auto mb-2 opacity-40" /><p>ไม่มีรายการในหมวดนี้</p></div>
      )}

      <div className="space-y-3">
        {(jobs || []).map(j => {
          const st = STATUS_LABEL[j.status] || { label: j.status, cls: 'bg-gray-100 text-gray-600' };
          const canCancel = !['completed', 'cancelled'].includes(j.status);
          return (
            <div key={j.$id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    {j.sellerProvince && <span className="text-xs text-gray-400">📍 {j.sellerProvince}</span>}
                    {Number(j.maxBudget) > 0 && <span className="font-mono text-sm font-bold text-green-600">งบ ฿{Number(j.maxBudget).toLocaleString()}</span>}
                  </div>
                  <p className="font-semibold mt-1 text-gray-900 dark:text-gray-100">{j.itemDescription}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    ผู้ว่าจ้าง: {j.buyerName || '-'}{j.middlemanName ? ` · คนกลาง: ${j.middlemanName}${j.middlemanTier ? ` (${j.middlemanTier})` : ''}` : ' · ยังไม่มีคนกลางรับงาน'}
                  </p>
                  {(Number(j.middlemanDeposit) > 0 || Number(j.travelFee) > 0 || Number(j.serviceFee) > 0) && (
                    <p className="text-xs text-gray-400 mt-1">
                      มัดจำคนกลาง ฿{Number(j.middlemanDeposit || 0).toLocaleString()} · ค่าเดินทาง ฿{Number(j.travelFee || 0).toLocaleString()} · ค่าบริการ ฿{Number(j.serviceFee || 0).toLocaleString()}
                    </p>
                  )}
                  {j.reportNotes && <p className="text-xs text-gray-500 mt-1">📝 {j.reportNotes}</p>}
                </div>
                <Link href={`/onsite/${j.$id}`} target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-1 shrink-0">
                  <ExternalLink size={12} /> เปิดงาน
                </Link>
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {canCancel && (
                  <button onClick={() => act(j.$id, 'cancel', 'เหตุผลยกเลิกงาน + คืนเงินผู้ว่าจ้าง:')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 disabled:opacity-50">
                    {acting === j.$id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} ยกเลิก + คืนเงิน
                  </button>
                )}
                {j.status === 'in_progress' && (
                  <button onClick={() => act(j.$id, 'complete', 'หมายเหตุการปิดงานแทน (เช่น เหตุผล/ข้อสรุป):')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1 disabled:opacity-50">
                    {acting === j.$id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} ปิดงานแทน
                  </button>
                )}
                <button onClick={() => act(j.$id, 'mark_refunded', 'หมายเหตุการคืนมัดจำ (เช่น เลขอ้างอิงการโอน):')} disabled={!!acting}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50">
                  <RotateCcw size={14} /> บันทึกคืนมัดจำ
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
