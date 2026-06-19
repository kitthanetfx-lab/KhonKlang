'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { account } from '@/lib/appwrite';
import { Handshake, Loader2, AlertTriangle, CheckCircle2, ExternalLink, RotateCcw, Trash2 } from 'lucide-react';
import { dealCode } from '@/lib/dealNumber';
import { readDealPriceState } from '@/lib/dealPriceState';

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const fileUrl = (id: string) => `${ENDPOINT}/storage/buckets/deal_files/files/${id}/view?project=${PROJECT}`;

interface Deal {
  $id: string; title: string; price: number; status: string; dealType?: string;
  buyerName: string; sellerName: string; middlemanName: string;
  rejectReason: string; meetupData?: string; priceData?: string; createdAt: string;
  paymentSlipFileId?: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  disputed:   { label: 'มีปัญหา/ข้อพิพาท', cls: 'bg-red-100 text-red-700' },
  completed:  { label: 'เสร็จสมบูรณ์', cls: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'ยกเลิก', cls: 'bg-gray-100 text-gray-600' },
  meetup_ready: { label: 'พร้อมนัดเจอ', cls: 'bg-blue-100 text-blue-700' },
  payment_pending: { label: 'รอโอนเงิน', cls: 'bg-amber-100 text-amber-700' },
  payment_uploaded: { label: 'รอศูนย์กลางยืนยันรับเงิน', cls: 'bg-amber-100 text-amber-700' },
};

const TABS = [
  { k: 'active', label: 'กำลังดำเนินการ' },
  { k: 'confirm_pay', label: '⚡ ยืนยันรับเงิน' },
  { k: 'meetup_refund', label: '💸 คืนเงินประกัน' },
  { k: 'disputed', label: '⚠️ ข้อพิพาท' },
  { k: 'completed', label: 'สำเร็จ' },
];

export default function AdminDeals() {
  const [tab, setTab] = useState('active');
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [acting, setActing] = useState('');

  const load = useCallback(async (filter: string) => {
    setDeals(null);
    try {
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch(`/api/admin/deals?filter=${filter}`, { headers: { 'x-session-jwt': jwt } });
      const d = await r.json();
      setDeals(d.documents || []);
    } catch { setDeals([]); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(tab); }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, load]);

  async function act(id: string, action: string, promptMsg?: string) {
    let note = '';
    if (promptMsg) { const v = window.prompt(promptMsg); if (v === null) return; note = v; }
    setActing(id);
    try {
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch('/api/admin/deals', {
        method: 'PATCH',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, note }),
      });
      if (r.ok) load(tab);
    } finally { setActing(''); }
  }

  function refundInfo(d: Deal) {
    if (d.dealType !== 'meetup') return null;
    try {
      const md = JSON.parse(d.meetupData || '{}');
      return { deposit: md.deposit || 0, refundedAt: md.refundedAt, bothMet: md.buyerMet && md.sellerMet };
    } catch { return null; }
  }

  // รวมสลิปทุกใบของดีล — ทุกฝ่าย (ผู้ซื้อ/ผู้ขาย/คนกลาง/แอดมิน) ต้องเห็นได้ที่นี่เช่นกัน
  function slipsOf(d: Deal): { label: string; fileId: string }[] {
    const slips: { label: string; fileId: string }[] = [];
    if (d.paymentSlipFileId) slips.push({ label: 'สลิปผู้ซื้อ (ค่าสินค้า)', fileId: d.paymentSlipFileId });
    const pd = readDealPriceState({ priceData: d.priceData || '', meetupData: d.meetupData || '' });
    if (pd.sellerFeeSlip) slips.push({ label: 'สลิปผู้ขาย (ค่าบริการ)', fileId: pd.sellerFeeSlip });
    if (d.dealType === 'meetup') {
      try {
        const md = JSON.parse(d.meetupData || '{}');
        if (md.buyerSlip) slips.push({ label: 'สลิปผู้ซื้อ (เงินประกัน)', fileId: md.buyerSlip });
        if (md.sellerSlip) slips.push({ label: 'สลิปผู้ขาย (เงินประกัน)', fileId: md.sellerSlip });
      } catch {}
    }
    return slips;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Handshake size={22} className="text-blue-500" />
        <h1 className="text-xl font-bold">ดีล & ข้อพิพาท</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">จัดการดีลที่มีปัญหา ตัดสินข้อพิพาท และยืนยันการคืนเงินประกันนัดรับ</p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.k ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {deals === null && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>}
      {deals !== null && deals.length === 0 && (
        <div className="text-center py-16 text-gray-400"><CheckCircle2 size={36} className="mx-auto mb-2 opacity-40" /><p>ไม่มีรายการในหมวดนี้</p></div>
      )}

      <div className="space-y-3">
        {(deals || []).map(d => {
          const st = STATUS_LABEL[d.status] || { label: d.status, cls: 'bg-gray-100 text-gray-600' };
          const refund = refundInfo(d);
          const slips = slipsOf(d);
          return (
            <div key={d.$id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 font-mono">{dealCode(d.$id)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    {d.dealType === 'meetup' && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">นัดรับ</span>}
                    {d.dealType === 'simple' && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">แบบง่าย</span>}
                    <span className="font-mono text-sm font-bold text-green-600">฿{Number(d.price || 0).toLocaleString()}</span>
                  </div>
                  <p className="font-semibold mt-1 text-gray-900 dark:text-gray-100">{d.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    ผู้ขาย: {d.sellerName || '-'} · ผู้ซื้อ: {d.buyerName || '-'} {d.middlemanName ? `· คนกลาง: ${d.middlemanName}` : ''}
                  </p>
                  {d.rejectReason && <p className="text-xs text-red-500 mt-1">เหตุ: {d.rejectReason}</p>}
                  {refund && (
                    <p className="text-xs mt-1 text-gray-500">
                      เงินประกัน ฿{refund.deposit.toLocaleString()}/ฝ่าย · {refund.bothMet ? 'เจอกันสำเร็จ' : 'ยังไม่ครบ'} ·
                      {refund.refundedAt ? <span className="text-green-600"> ✅ คืนเงินแล้ว</span> : <span className="text-amber-600"> ⏳ ยังไม่คืนเงิน</span>}
                    </p>
                  )}
                </div>
                <Link href={`/deal/${d.$id}`} target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-1 shrink-0">
                  <ExternalLink size={12} /> เปิดดีล
                </Link>
              </div>

              {slips.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {slips.map(s => (
                    <a key={s.fileId} href={fileUrl(s.fileId)} target="_blank" rel="noreferrer" className="block">
                      <img src={fileUrl(s.fileId)} alt={s.label} className="w-full h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{s.label}</p>
                    </a>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {d.status === 'disputed' && (
                  <>
                    <button onClick={() => act(d.$id, 'resolve_dispute', 'บันทึกผลการตัดสิน (ปล่อยเงินให้ผู้ขาย/ดำเนินการต่อ):')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                      {acting === d.$id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} ตัดสินให้จบ
                    </button>
                    <button onClick={() => act(d.$id, 'cancel_refund', 'เหตุผลยกเลิก + คืนเงินผู้ซื้อ:')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 disabled:opacity-50">
                      <RotateCcw size={14} /> ยกเลิก + คืนเงินผู้ซื้อ
                    </button>
                  </>
                )}
                {d.status === 'payment_uploaded' && (
                  <button onClick={() => act(d.$id, 'confirm_payment', 'หมายเหตุ (เช่น เลขอ้างอิงสลิป) — เว้นว่างได้:')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                    {acting === d.$id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} ยืนยันรับเงิน — เริ่มแพ็ค
                  </button>
                )}
                {refund && !refund.refundedAt && (
                  <button onClick={() => act(d.$id, 'mark_refunded', 'หมายเหตุการคืนเงิน (เช่น เลขอ้างอิงการโอน):')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50">
                    {acting === d.$id ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />} ยืนยันคืนเงินประกันแล้ว
                  </button>
                )}
                <button onClick={() => { if (window.confirm(`ลบดีล "${d.title}" ถาวร? (ใช้เฉพาะกรณีดีลทดสอบ/สแปม — กู้คืนไม่ได้)`)) act(d.$id, 'delete_deal'); }} disabled={!!acting}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 disabled:opacity-50 ml-auto">
                  <Trash2 size={14} /> ลบดีล
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
