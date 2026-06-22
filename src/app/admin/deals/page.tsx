'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { Handshake, Loader2, AlertTriangle, CheckCircle2, ExternalLink, RotateCcw, Trash2, Banknote } from 'lucide-react';
import { dealCode } from '@/lib/dealNumber';

const fileUrl = (id: string) => fileViewUrl(DEAL_BUCKET, id);

interface DealMeetup {
  deposit: number; refunded_at?: string; buyer_met: boolean; seller_met: boolean;
  buyer_slip?: string; seller_slip?: string;
}
interface DealPriceState {
  seller_fee_slip?: string; payout_slip_file_id?: string; refund_slip_file_id?: string;
}
interface BankInfo { bankName: string; bankAcct: string; bankOwner: string; }
interface Deal {
  id: string; title: string; price: number; status: string; deal_type?: string;
  buyer_name: string; seller_name: string; middleman_name: string;
  reject_reason: string; created_at: string;
  payment_slip_file_id?: string;
  meetup?: DealMeetup | null;
  priceState?: DealPriceState | null;
  buyerBank?: BankInfo | null;
  sellerBank?: BankInfo | null;
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
      const headers = await authHeaders();
      const r = await fetch(`/api/admin/deals?filter=${filter}`, { headers });
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
      const headers = await authHeaders();
      const r = await fetch('/api/admin/deals', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, note }),
      });
      if (r.ok) load(tab);
    } finally { setActing(''); }
  }

  function pickSlipFile() {
    return new Promise<File | null>(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,.pdf';
      input.onchange = () => resolve(input.files?.[0] || null);
      // ถ้าผู้ใช้กดยกเลิกหน้าต่างเลือกไฟล์ — ต้องเคลียร์สถานะ "กำลังทำงาน" ด้วย ไม่งั้นปุ่มจะหมุนค้าง
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  // โอนเงินให้ผู้ขาย (ดีลสำเร็จ) / คืนเงินให้ผู้ซื้อ (ดีลยกเลิก) — ต้องแนบสลิปจริงเสมอ
  // ใช้ endpoint เดิมที่ /api/admin/finance (มีอยู่แล้ว) แค่เพิ่มปุ่ม+อัปโหลดให้ทำได้จากหน้าดีลนี้โดยตรง
  async function markMoneySent(id: string, action: 'mark_payout_sent' | 'mark_refund_sent') {
    // ต้องเปิดตัวเลือกไฟล์เป็นอย่างแรกเสมอ (synchronous กับการคลิกปุ่ม) — ถ้ามี window.prompt
    // หรือ await อื่นแทรกก่อนหน้านี้ เบราว์เซอร์จะถือว่า user activation หมดอายุแล้ว
    // ทำให้ input.click() ไม่เปิดหน้าต่างเลือกไฟล์ (เงียบ ไม่มี error) และปุ่มหมุนค้างตลอดไป
    setActing(id);
    try {
      const file = await pickSlipFile();
      if (!file) return;
      const promptMsg = action === 'mark_payout_sent'
        ? 'โอนเงินให้ผู้ขายแล้ว — ใส่บันทึกช่วยจำ (เช่น เลขอ้างอิงการโอน) ได้ถ้าต้องการ:'
        : 'คืนเงินให้ผู้ซื้อแล้ว — ใส่บันทึกช่วยจำ (เช่น เลขอ้างอิงการโอน) ได้ถ้าต้องการ:';
      const note = window.prompt(promptMsg, '');
      if (note === null) return;
      const headers = await authHeaders();
      const form = new FormData();
      form.append('file', file);
      const upRes = await fetch('/api/upload-deal', { method: 'POST', headers, body: form });
      const upData = await upRes.json();
      if (!upRes.ok) { alert(upData.error || 'อัปโหลดสลิปไม่สำเร็จ'); return; }
      const r = await fetch('/api/admin/finance', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, note, fileId: upData.fileId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { alert(d.error || 'บันทึกไม่สำเร็จ'); return; }
      load(tab);
    } finally { setActing(''); }
  }

  function refundInfo(d: Deal) {
    if (d.deal_type !== 'meetup' || !d.meetup) return null;
    const md = d.meetup;
    return { deposit: md.deposit || 0, refundedAt: md.refunded_at, bothMet: md.buyer_met && md.seller_met };
  }

  // รวมสลิปทุกใบของดีล — ทุกฝ่าย (ผู้ซื้อ/ผู้ขาย/คนกลาง/แอดมิน) ต้องเห็นได้ที่นี่เช่นกัน
  function slipsOf(d: Deal): { label: string; fileId: string }[] {
    const slips: { label: string; fileId: string }[] = [];
    if (d.payment_slip_file_id) slips.push({ label: 'สลิปผู้ซื้อ (ค่าสินค้า)', fileId: d.payment_slip_file_id });
    const pd = d.priceState;
    if (pd?.seller_fee_slip) slips.push({ label: 'สลิปผู้ขาย (ค่าบริการ)', fileId: pd.seller_fee_slip });
    if (pd?.payout_slip_file_id) slips.push({ label: 'สลิปศูนย์กลางโอนให้ผู้ขาย', fileId: pd.payout_slip_file_id });
    if (pd?.refund_slip_file_id) slips.push({ label: 'สลิปศูนย์กลางคืนให้ผู้ซื้อ', fileId: pd.refund_slip_file_id });
    if (d.deal_type === 'meetup' && d.meetup) {
      if (d.meetup.buyer_slip) slips.push({ label: 'สลิปผู้ซื้อ (เงินประกัน)', fileId: d.meetup.buyer_slip });
      if (d.meetup.seller_slip) slips.push({ label: 'สลิปผู้ขาย (เงินประกัน)', fileId: d.meetup.seller_slip });
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
            <div key={d.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 font-mono">{dealCode(d.id)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    {d.deal_type === 'meetup' && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">นัดรับ</span>}
                    {d.deal_type === 'simple' && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">แบบง่าย</span>}
                    <span className="font-mono text-sm font-bold text-green-600">฿{Number(d.price || 0).toLocaleString()}</span>
                  </div>
                  <p className="font-semibold mt-1 text-gray-900 dark:text-gray-100">{d.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    ผู้ขาย: {d.seller_name || '-'} · ผู้ซื้อ: {d.buyer_name || '-'} {d.middleman_name ? `· คนกลาง: ${d.middleman_name}` : ''}
                  </p>
                  {d.reject_reason && <p className="text-xs text-red-500 mt-1">เหตุ: {d.reject_reason}</p>}
                  {refund && (
                    <p className="text-xs mt-1 text-gray-500">
                      เงินประกัน ฿{refund.deposit.toLocaleString()}/ฝ่าย · {refund.bothMet ? 'เจอกันสำเร็จ' : 'ยังไม่ครบ'} ·
                      {refund.refundedAt ? <span className="text-green-600"> ✅ คืนเงินแล้ว</span> : <span className="text-amber-600"> ⏳ ยังไม่คืนเงิน</span>}
                    </p>
                  )}
                  {/* บัญชีที่ต้องโอนเงินเข้า — แสดงให้แอดมินเห็นตรงนี้เลย ไม่ต้องเปิดดีลแยกไปหา */}
                  {d.deal_type !== 'meetup' && (d.status === 'completed' || d.status === 'disputed') && !d.priceState?.payout_slip_file_id && (
                    d.sellerBank?.bankAcct
                      ? <p className="text-xs mt-1 text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 inline-block">🏦 โอนให้ผู้ขาย: {d.sellerBank.bankName} {d.sellerBank.bankAcct} ({d.sellerBank.bankOwner || '-'})</p>
                      : <p className="text-xs mt-1 text-red-500 bg-red-50 border border-red-100 rounded-lg px-2 py-1 inline-block">⚠️ ผู้ขายยังไม่ผูกบัญชีธนาคาร — ติดต่อผู้ขายก่อนโอนเงิน</p>
                  )}
                  {d.deal_type !== 'meetup' && (d.status === 'cancelled' || d.status === 'disputed') && !d.priceState?.refund_slip_file_id && (
                    d.buyerBank?.bankAcct
                      ? <p className="text-xs mt-1 text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 inline-block">🏦 คืนให้ผู้ซื้อ: {d.buyerBank.bankName} {d.buyerBank.bankAcct} ({d.buyerBank.bankOwner || '-'})</p>
                      : <p className="text-xs mt-1 text-red-500 bg-red-50 border border-red-100 rounded-lg px-2 py-1 inline-block">⚠️ ผู้ซื้อยังไม่ผูกบัญชีธนาคาร — ติดต่อผู้ซื้อก่อนคืนเงิน</p>
                  )}
                </div>
                <Link href={`/deal/${d.id}`} target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-1 shrink-0">
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
                    <button onClick={() => act(d.id, 'resolve_dispute', 'บันทึกผลการตัดสิน (ปล่อยเงินให้ผู้ขาย/ดำเนินการต่อ):')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                      {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} ตัดสินให้จบ
                    </button>
                    <button onClick={() => act(d.id, 'cancel_refund', 'เหตุผลยกเลิก + คืนเงินผู้ซื้อ:')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 disabled:opacity-50">
                      <RotateCcw size={14} /> ยกเลิก + คืนเงินผู้ซื้อ
                    </button>
                  </>
                )}
                {d.status === 'payment_uploaded' && (
                  <button onClick={() => act(d.id, 'confirm_payment', 'หมายเหตุ (เช่น เลขอ้างอิงสลิป) — เว้นว่างได้:')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                    {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} ยืนยันรับเงิน — เริ่มแพ็ค
                  </button>
                )}
                {refund && !refund.refundedAt && (
                  <button onClick={() => act(d.id, 'mark_refunded', 'หมายเหตุการคืนเงิน (เช่น เลขอ้างอิงการโอน):')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50">
                    {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />} ยืนยันคืนเงินประกันแล้ว
                  </button>
                )}
                {/* ดีลสำเร็จ (ไม่ใช่นัดรับ) แต่ยังไม่มีสลิปโอนเงินให้ผู้ขาย — ให้แอดมินอัปโหลดสลิปได้ตรงนี้เลย */}
                {d.status === 'completed' && d.deal_type !== 'meetup' && !d.priceState?.payout_slip_file_id && (
                  <button onClick={() => markMoneySent(d.id, 'mark_payout_sent')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                    {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} โอนเงินให้ผู้ขายแล้ว — แนบสลิป
                  </button>
                )}
                {/* ดีลถูกยกเลิก (ไม่ใช่นัดรับ) แต่ยังไม่มีสลิปคืนเงินผู้ซื้อ */}
                {d.status === 'cancelled' && d.deal_type !== 'meetup' && d.payment_slip_file_id && !d.priceState?.refund_slip_file_id && (
                  <button onClick={() => markMoneySent(d.id, 'mark_refund_sent')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50">
                    {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} คืนเงินให้ผู้ซื้อแล้ว — แนบสลิป
                  </button>
                )}
                <button onClick={() => { if (window.confirm(`ลบดีล "${d.title}" ถาวร? (ใช้เฉพาะกรณีดีลทดสอบ/สแปม — กู้คืนไม่ได้)`)) act(d.id, 'delete_deal'); }} disabled={!!acting}
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
