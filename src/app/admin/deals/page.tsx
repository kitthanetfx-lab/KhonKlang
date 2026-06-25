'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { Handshake, Loader2, AlertTriangle, CheckCircle2, ExternalLink, RotateCcw, Trash2, Banknote } from 'lucide-react';
import { dealCode } from '@/lib/dealNumber';
import { FeeConfig, FEE_DEFAULTS, computeDealFees } from '@/lib/fees';
import { splitDealFeeComponents } from '@/lib/financeLedger';

const fileUrl = (id: string) => fileViewUrl(DEAL_BUCKET, id);

interface DealMeetup {
  deposit: number; refunded_at?: string; buyer_met: boolean; seller_met: boolean;
  buyer_slip?: string; seller_slip?: string;
  buyer_slip_verified_at?: string; seller_slip_verified_at?: string;
  refund_outcome?: 'buyer_all' | 'seller_all' | 'both' | 'frozen';
  buyer_refund_slip?: string; seller_refund_slip?: string;
  refund_decision_note?: string;
}
interface DealPriceState {
  seller_fee_slip?: string; payout_slip_file_id?: string; refund_slip_file_id?: string;
  middleman_fee_sent_at?: string; middleman_fee_slip_file_id?: string;
}
interface BankInfo { bankName: string; bankAcct: string; bankOwner: string; }
interface Deal {
  id: string; title: string; price: number; status: string; deal_type?: string;
  buyer_name: string; seller_name: string; middleman_name: string; middleman_id?: string;
  reject_reason: string; created_at: string;
  payment_slip_file_id?: string;
  meetup?: DealMeetup | null;
  priceState?: DealPriceState | null;
  buyerBank?: BankInfo | null;
  sellerBank?: BankInfo | null;
  middlemanBank?: BankInfo | null;
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
  { k: 'pay_seller', label: '💰 โอนเงินค่าสินค้า' },
  { k: 'refund_pending', label: '🔄 คืนเงินผู้ซื้อ' },
  { k: 'middleman_fee', label: '💼 โอนเงินค่าคนกลาง' },
  { k: 'meetup_refund', label: '💸 คืนเงินประกัน' },
  { k: 'disputed', label: '⚠️ ข้อพิพาท' },
  { k: 'completed', label: 'สำเร็จ' },
];

export default function AdminDeals() {
  const [tab, setTab] = useState('active');
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [acting, setActing] = useState('');
  const [fees, setFees] = useState<FeeConfig>(FEE_DEFAULTS);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const loadCounts = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/admin/deals?filter=counts', { headers });
      const d = await r.json();
      if (d.counts) setCounts(d.counts);
    } catch { /* ไม่ต้อง alert */ }
  }, []);

  useEffect(() => {
    void loadCounts();
    const t = window.setInterval(() => void loadCounts(), 30000);
    return () => window.clearInterval(t);
  }, [loadCounts]);

  useEffect(() => { fetch('/api/fees').then(r => r.json()).then(d => { if (d.fees) setFees(d.fees); }).catch(() => {}); }, []);

  function middlemanNetFee(d: Deal) {
    const fb = computeDealFees(fees, d.price, d.deal_type);
    const parts = splitDealFeeComponents(fees, fb.lines);
    return parts.middlemanNetFee;
  }

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
      const d = await r.json().catch(() => ({}));
      if (r.ok) load(tab);
      else alert(d.error || `บันทึกไม่สำเร็จ (${r.status})`);
    } finally { setActing(''); }
  }

  // ข้อ3: ลบดีลถาวร (พร้อมไฟล์สลิป + ข้อมูลทุกตาราง)
  async function del(id: string) {
    if (!window.confirm('ลบดีลนี้ถาวร?\nจะลบข้อมูลและรูปสลิปทั้งหมดที่เกี่ยวข้อง — กู้คืนไม่ได้')) return;
    setActing(id);
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/admin/deals', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete_deal' }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { load(tab); loadCounts(); } else alert(d.error || `ลบไม่สำเร็จ (${r.status})`);
    } finally { setActing(''); }
  }

  // ข้อ5: ศูนย์กลางตรวจสลิปเงินประกันรายฝ่าย
  async function verifySlip(id: string, side: 'buyer' | 'seller', ok: boolean) {
    let note = '';
    if (!ok) { const v = window.prompt(`เหตุผลที่สลิป${side === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}ไม่ถูกต้อง (ระบบจะถอยให้อีกฝ่ายวางใหม่):`); if (v === null) return; note = v; }
    setActing(id);
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/admin/deals', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'verify_meetup_slip', whichSlip: side, ok, note }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { load(tab); loadCounts(); } else alert(d.error || `บันทึกไม่สำเร็จ (${r.status})`);
    } finally { setActing(''); }
  }

  function pickSlipFile() {
    return new Promise<File | null>(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,.pdf';
      input.onchange = () => resolve(input.files?.[0] || null);
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  async function markMoneySent(id: string, action: 'mark_payout_sent' | 'mark_refund_sent' | 'mark_middleman_fee_sent') {
    setActing(id);
    try {
      const file = await pickSlipFile();
      if (!file) return;
      const promptMsg = action === 'mark_payout_sent'
        ? 'โอนเงินให้ผู้ขายแล้ว — ใส่บันทึกช่วยจำ (เช่น เลขอ้างอิงการโอน) ได้ถ้าต้องการ:'
        : action === 'mark_refund_sent'
        ? 'คืนเงินให้ผู้ซื้อแล้ว — ใส่บันทึกช่วยจำ (เช่น เลขอ้างอิงการโอน) ได้ถ้าต้องการ:'
        : 'โอนค่าบริการให้คนกลางแล้ว — ใส่บันทึกช่วยจำ (เช่น เลขอ้างอิงการโอน) ได้ถ้าต้องการ:';
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

  async function markMeetupRefund(id: string, outcome: 'buyer_all' | 'seller_all' | 'both' | 'frozen', whichSlip?: 'buyer' | 'seller') {
    setActing(id);
    try {
      let fileId = '';
      let note = '';
      if (outcome === 'frozen') {
        const v = window.prompt('เหตุผลที่อยัดเงินประกัน (เช่น กรณีพิพาท):');
        if (v === null) return;
        note = v;
      } else {
        const file = await pickSlipFile();
        if (!file) return;
        const slipTarget = outcome === 'buyer_all' ? 'ผู้ซื้อ (ทั้งหมด)'
          : outcome === 'seller_all' ? 'ผู้ขาย (ทั้งหมด)'
          : whichSlip === 'buyer' ? 'ผู้ซื้อ (แยกฝ่าย)'
          : 'ผู้ขาย (แยกฝ่าย)';
        const v = window.prompt(`สลิปโอนเงินให้${slipTarget} — ใส่บันทึก (เช่น เลขอ้างอิง) ได้ถ้าต้องการ:`, '');
        if (v === null) return;
        note = v;
        const headers = await authHeaders();
        const form = new FormData(); form.append('file', file);
        const upRes = await fetch('/api/upload-deal', { method: 'POST', headers, body: form });
        const upData = await upRes.json();
        if (!upRes.ok) { alert(upData.error || 'อัปโหลดสลิปไม่สำเร็จ'); return; }
        fileId = upData.fileId;
      }
      const headers = await authHeaders();
      const r = await fetch('/api/admin/deals', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'mark_meetup_refund', outcome, fileId: fileId || undefined, whichSlip, note }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { alert(data.error || 'บันทึกไม่สำเร็จ'); return; }
      load(tab);
    } finally { setActing(''); }
  }

  function statusBadge(d: Deal) {
    if (d.status === 'completed' && d.deal_type === 'meetup' && !d.meetup?.refund_outcome) {
      return { label: '⏳ รอตัดสินคืนเงินประกัน', cls: 'bg-amber-100 text-amber-700' };
    }
    if (d.status === 'completed' && d.deal_type !== 'meetup' && !d.priceState?.payout_slip_file_id) {
      return { label: '⏳ รอโอนเงินให้ผู้ขาย', cls: 'bg-amber-100 text-amber-700' };
    }
    if (d.status === 'cancelled' && d.deal_type !== 'meetup' && d.payment_slip_file_id && !d.priceState?.refund_slip_file_id) {
      return { label: '⏳ รอคืนเงินผู้ซื้อ', cls: 'bg-amber-100 text-amber-700' };
    }
    return STATUS_LABEL[d.status] || { label: d.status, cls: 'bg-gray-100 text-gray-600' };
  }

  function refundInfo(d: Deal) {
    if (d.deal_type !== 'meetup' || !d.meetup) return null;
    const md = d.meetup;
    const OUTCOME_LABEL: Record<string, string> = {
      buyer_all: 'โอนให้ผู้ซื้อทั้งหมด', seller_all: 'โอนให้ผู้ขายทั้งหมด',
      both: 'คืนให้ทั้งสองฝ่าย', frozen: 'อายัดไว้',
    };
    return {
      deposit: md.deposit || 0,
      refundedAt: md.refunded_at,
      bothMet: md.buyer_met && md.seller_met,
      outcome: md.refund_outcome,
      outcomeLabel: md.refund_outcome ? OUTCOME_LABEL[md.refund_outcome] : undefined,
      buyerSlipDone: !!md.buyer_refund_slip,
      sellerSlipDone: !!md.seller_refund_slip,
    };
  }

  function slipsOf(d: Deal): { label: string; fileId: string }[] {
    const slips: { label: string; fileId: string }[] = [];
    if (d.payment_slip_file_id) slips.push({ label: 'สลิปผู้ซื้อ (ค่าสินค้า)', fileId: d.payment_slip_file_id });
    const pd = d.priceState;
    if (pd?.seller_fee_slip) slips.push({ label: 'สลิปผู้ขาย (ค่าบริการ)', fileId: pd.seller_fee_slip });
    if (pd?.payout_slip_file_id) slips.push({ label: 'สลิปศูนย์กลางโอนให้ผู้ขาย', fileId: pd.payout_slip_file_id });
    if (pd?.refund_slip_file_id) slips.push({ label: 'สลิปศูนย์กลางคืนให้ผู้ซื้อ', fileId: pd.refund_slip_file_id });
    if (pd?.middleman_fee_slip_file_id) slips.push({ label: 'สลิปศูนย์กลางโอนค่าบริการให้คนกลาง', fileId: pd.middleman_fee_slip_file_id });
    if (d.deal_type === 'meetup' && d.meetup) {
      if (d.meetup.buyer_slip) slips.push({ label: 'สลิปผู้ซื้อ (เงินประกัน)', fileId: d.meetup.buyer_slip });
      if (d.meetup.seller_slip) slips.push({ label: 'สลิปผู้ขาย (เงินประกัน)', fileId: d.meetup.seller_slip });
      if (d.meetup.buyer_refund_slip) slips.push({ label: 'สลิปคืนเงินประกันให้ผู้ซื้อ', fileId: d.meetup.buyer_refund_slip });
      if (d.meetup.seller_refund_slip) slips.push({ label: 'สลิปคืนเงินประกันให้ผู้ขาย', fileId: d.meetup.seller_refund_slip });
    }
    return slips;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Handshake size={22} className="text-blue-600" />
        <h1 className="text-xl font-bold">ดีล & ข้อพิพาท</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">จัดการดีลที่มีปัญหา ตัดสินข้อพิพาท และยืนยันการคืนเงินประกันนัดรับ</p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map(t => {
          const cnt = counts[t.k] ?? 0;
          const isActive = tab === t.k;
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'}`}>
              {t.label}
              {cnt > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold leading-none ${isActive ? 'bg-white text-blue-600' : 'bg-red-500 text-white'}`}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {deals === null && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>}
      {deals !== null && deals.length === 0 && (
        <div className="text-center py-16 text-gray-400"><CheckCircle2 size={36} className="mx-auto mb-2 opacity-40" /><p>ไม่มีรายการในหมวดนี้</p></div>
      )}

      <div className="space-y-3">
        {(deals || []).map(d => {
          const st = statusBadge(d);
          const refund = refundInfo(d);
          const slips = slipsOf(d);
          // refund (คืนเงินประกัน) ทำได้เฉพาะตอนดีลจบแล้ว (เจอกันเสร็จ = completed) เท่านั้น
          const refundStage = d.deal_type === 'meetup' && d.status === 'completed';
          // ตรวจสลิปเงินประกัน: meetup ที่ยังไม่จบ มีสลิปอย่างน้อย 1 ฝ่าย และยังตรวจไม่ครบ
          const needsSlipVerify = d.deal_type === 'meetup'
            && !['completed', 'cancelled'].includes(d.status)
            && (!!d.meetup?.buyer_slip || !!d.meetup?.seller_slip)
            && !(d.meetup?.buyer_slip_verified_at && d.meetup?.seller_slip_verified_at);
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
                  {/* เลขบัญชี + ยอดโอนสำหรับ meetup refund — เฉพาะตอนถึงขั้นคืนเงิน (completed) */}
                  {refund && refundStage && !refund.refundedAt && refund.outcome !== 'frozen' && (
                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs space-y-1">
                      <p className="font-semibold text-amber-800">
                        💰 ยอดโอนคืน: ฝ่ายละ ฿{refund.deposit.toLocaleString()}
                        {!refund.outcome && <span className="ml-1 text-amber-600">(รวม ฿{(refund.deposit * 2).toLocaleString()})</span>}
                      </p>
                      {d.buyerBank?.bankAcct
                        ? <p className="text-blue-700">🛍️ ผู้ซื้อ ({d.buyer_name || '-'}): <span className="font-mono font-semibold">{d.buyerBank.bankName} {d.buyerBank.bankAcct}</span> เจ้าของ: {d.buyerBank.bankOwner || '-'}</p>
                        : <p className="text-red-600">⚠️ ผู้ซื้อ ({d.buyer_name || '-'}): ยังไม่ผูกบัญชีธนาคาร — ติดต่อก่อนโอน</p>
                      }
                      {d.sellerBank?.bankAcct
                        ? <p className="text-blue-700">🛒 ผู้ขาย ({d.seller_name || '-'}): <span className="font-mono font-semibold">{d.sellerBank.bankName} {d.sellerBank.bankAcct}</span> เจ้าของ: {d.sellerBank.bankOwner || '-'}</p>
                        : <p className="text-red-600">⚠️ ผู้ขาย ({d.seller_name || '-'}): ยังไม่ผูกบัญชีธนาคาร — ติดต่อก่อนโอน</p>
                      }
                    </div>
                  )}
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
                  {d.status === 'completed' && d.middleman_id && !d.priceState?.middleman_fee_sent_at && middlemanNetFee(d) > 0 && (
                    d.middlemanBank?.bankAcct
                      ? <p className="text-xs mt-1 text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 inline-block">🏦 โอนค่าบริการให้คนกลาง ฿{middlemanNetFee(d).toLocaleString()}: {d.middlemanBank.bankName} {d.middlemanBank.bankAcct} ({d.middlemanBank.bankOwner || '-'})</p>
                      : <p className="text-xs mt-1 text-red-500 bg-red-50 border border-red-100 rounded-lg px-2 py-1 inline-block">⚠️ คนกลางยังไม่ผูกบัญชีธนาคาร — ติดต่อคนกลางก่อนโอนค่าบริการ ฿{middlemanNetFee(d).toLocaleString()}</p>
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
                {d.status === 'payment_uploaded' && d.deal_type !== 'meetup' && (
                  <button onClick={() => act(d.id, 'confirm_payment', 'หมายเหตุ (เช่น เลขอ้างอิงสลิป) — เว้นว่างได้:')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                    {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    ยืนยันรับเงิน — เริ่มแพ็ค
                  </button>
                )}
                {/* ข้อ5: meetup รอตรวจสลิป — ปุ่มตรวจถูกต้อง/ไม่ถูกต้อง รายฝ่าย */}
                {needsSlipVerify && (
                  <div className="flex flex-wrap gap-2 items-center">
                    {(['buyer', 'seller'] as const).map(side => {
                      const slip = side === 'buyer' ? d.meetup?.buyer_slip : d.meetup?.seller_slip;
                      const verified = side === 'buyer' ? d.meetup?.buyer_slip_verified_at : d.meetup?.seller_slip_verified_at;
                      const lbl = side === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย';
                      if (verified) return <span key={side} className="text-xs px-2 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200">✅ สลิป{lbl} ถูกต้อง</span>;
                      if (!slip) return <span key={side} className="text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-500 border border-gray-200">⏳ {lbl} ยังไม่อัปสลิป</span>;
                      return (
                        <span key={side} className="inline-flex gap-1">
                          <button onClick={() => verifySlip(d.id, side, true)} disabled={!!acting}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                            <CheckCircle2 size={14} /> สลิป{lbl} ถูกต้อง
                          </button>
                          <button onClick={() => verifySlip(d.id, side, false)} disabled={!!acting}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1 disabled:opacity-50">
                            ❌ ไม่ถูกต้อง
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {refund && refundStage && !refund.outcome && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => markMeetupRefund(d.id, 'buyer_all')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50">
                      {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} โอนให้ผู้ซื้อทั้งหมด
                    </button>
                    <button onClick={() => markMeetupRefund(d.id, 'seller_all')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50">
                      {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} โอนให้ผู้ขายทั้งหมด
                    </button>
                    <button onClick={() => markMeetupRefund(d.id, 'both', 'buyer')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 flex items-center gap-1 disabled:opacity-50">
                      {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} โอนให้ทั้งคู่ (สลิปผู้ซื้อ)
                    </button>
                    <button onClick={() => markMeetupRefund(d.id, 'both', 'seller')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 flex items-center gap-1 disabled:opacity-50">
                      {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} โอนให้ทั้งคู่ (สลิปผู้ขาย)
                    </button>
                    <button onClick={() => markMeetupRefund(d.id, 'frozen')} disabled={!!acting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-600 text-white hover:bg-gray-700 flex items-center gap-1 disabled:opacity-50">
                      {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />} อายัดไว้ก่อน
                    </button>
                  </div>
                )}
                {refund && refund.outcome === 'both' && !refund.refundedAt && (
                  <div className="flex flex-wrap gap-2">
                    {!refund.buyerSlipDone && (
                      <button onClick={() => markMeetupRefund(d.id, 'both', 'buyer')} disabled={!!acting}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 flex items-center gap-1 disabled:opacity-50">
                        {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} แนบสลิปผู้ซื้อ
                      </button>
                    )}
                    {!refund.sellerSlipDone && (
                      <button onClick={() => markMeetupRefund(d.id, 'both', 'seller')} disabled={!!acting}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 flex items-center gap-1 disabled:opacity-50">
                        {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} แนบสลิปผู้ขาย
                      </button>
                    )}
                  </div>
                )}
                {refund && refund.outcome && (refund.refundedAt || refund.outcome === 'frozen') && (
                  <span className="text-xs px-2 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200">
                    ✅ {refund.outcomeLabel}{refund.refundedAt ? '' : ' (อายัด — ยังไม่คืน)'}
                  </span>
                )}
                {d.status === 'completed' && d.deal_type !== 'meetup' && !d.priceState?.payout_slip_file_id && (
                  <button onClick={() => markMoneySent(d.id, 'mark_payout_sent')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                    {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} โอนเงินให้ผู้ขายแล้ว — แนบสลิป
                  </button>
                )}
                {d.status === 'cancelled' && d.deal_type !== 'meetup' && d.payment_slip_file_id && !d.priceState?.refund_slip_file_id && (
                  <button onClick={() => markMoneySent(d.id, 'mark_refund_sent')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50">
                    {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} คืนเงินให้ผู้ซื้อแล้ว — แนบสลิป
                  </button>
                )}
                {d.status === 'completed' && d.middleman_id && !d.priceState?.middleman_fee_sent_at && middlemanNetFee(d) > 0 && (
                  <button onClick={() => markMoneySent(d.id, 'mark_middleman_fee_sent')} disabled={!!acting}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1 disabled:opacity-50">
                    {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />} โอนค่าคนกลางแล้ว — แนบสลิป
                  </button>
                )}
                {/* ข้อ3: ลบดีลถาวร — ทุกดีล (ชิดขวา) */}
                <button onClick={() => del(d.id)} disabled={!!acting} title="ลบดีลถาวร (รวมรูปสลิป)"
                  className="ml-auto px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center gap-1 disabled:opacity-50">
                  {acting === d.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} ลบดีล
                </button>
              </div>
            </div>
          );
        })}
        </div>
      </div>
  );
}
