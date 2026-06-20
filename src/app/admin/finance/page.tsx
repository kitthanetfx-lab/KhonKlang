'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { account } from '@/lib/appwrite';
import {
  Wallet,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  Clock,
  ScanLine,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  PanelRightOpen,
  FileImage,
  Download,
} from 'lucide-react';

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const fileUrl = (bucket: string, id: string) => `${ENDPOINT}/storage/buckets/${bucket}/files/${id}/view?project=${PROJECT}`;
const baht = (n: number) => '฿' + Math.round(n || 0).toLocaleString();

interface FeeLine { label: string; amount: number; }
type TxnStatus = 'pending' | 'confirmed' | 'refund_pending' | 'refunded';
type FinanceTab = 'incoming' | 'outgoing' | 'summary';
interface BankInfo { bankName: string; bankAcct: string; bankOwner: string; bankQrFileId?: string; }
interface SlipInfo { amount: number; transRef: string; transTime?: string; transDate?: string; senderName?: string; receiverName?: string; receiverAccount?: string; }
interface SlipCheck {
  result: { ok: boolean; code: string; message: string; slip?: SlipInfo; duplicate?: boolean; wrongReceiver?: boolean };
  expected: number; amountMatch: boolean | null;
}
interface FinanceRow {
  key: string;
  source: string;
  refId: string;
  referenceType: string;
  dealNumber?: string;
  title: string;
  payer: string;
  payerName: string;
  purpose: string;
  expected: number;
  fileId: string;
  bucket: string;
  status: string;
  dealType?: string;
  txnStatus?: TxnStatus;
  note?: string;
  fees?: { lines: FeeLine[]; total: number; note?: string };
  canApprove?: boolean;
  approveLink?: string;
  bank?: BankInfo | null;
  detailUrl: string;
  buyerId?: string;
  buyerName?: string;
  sellerId?: string;
  sellerName?: string;
  middlemanId?: string;
  middlemanName?: string;
  dealStatus?: string;
  price?: number;
  feeAmount?: number;
  imageCount?: number;
  attachmentCount?: number;
  hasSlip?: boolean;
  category?: string;
  condition?: string;
  location?: string;
  description?: string;
}
interface Summary {
  incomingCount: number; escrowPendingCount: number; heldEscrow: number;
  heldMeetupDeposit: number; completedVolume: number; completedCount: number; estRevenue: number;
  outgoingCount?: number; pendingPayoutAmount?: number; pendingRefundAmount?: number;
}
interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

const TXN_BADGE: Record<TxnStatus, { label: string; cls: string }> = {
  pending:         { label: 'รอตรวจ',     cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed:       { label: 'ยืนยันแล้ว',  cls: 'bg-green-50 text-green-700 border-green-200' },
  refund_pending:  { label: 'รอคืนเงิน',   cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  refunded:        { label: 'คืนเงินแล้ว', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
};

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  escrow:        { label: 'Escrow', cls: 'bg-blue-100 text-blue-700' },
  meetup:        { label: 'Meetup', cls: 'bg-violet-100 text-violet-700' },
  seller_app:    { label: 'สมัครผู้ขาย', cls: 'bg-green-100 text-green-700' },
  middleman_app: { label: 'สมัครคนกลาง', cls: 'bg-emerald-100 text-emerald-700' },
  platform_revenue: { label: 'รายได้แอป', cls: 'bg-cyan-100 text-cyan-700' },
  payout:        { label: 'จ่ายผู้ขาย', cls: 'bg-rose-100 text-rose-700' },
  refund:        { label: 'คืนผู้ซื้อ', cls: 'bg-orange-100 text-orange-700' },
  meetup_refund: { label: 'คืนเงินประกัน', cls: 'bg-fuchsia-100 text-fuchsia-700' },
  middleman_fee: { label: 'จ่ายคนกลาง', cls: 'bg-lime-100 text-lime-700' },
  onsite_payout: { label: 'งานออนไซต์', cls: 'bg-indigo-100 text-indigo-700' },
};

const INCOMING_FILTERS = [
  { k: 'all', label: 'ทั้งหมด' },
  { k: 'escrow', label: 'ค่าสินค้า' },
  { k: 'meetup', label: 'เงินประกัน' },
  { k: 'reg', label: 'ค่าสมัคร' },
];

const OUTGOING_FILTERS = [
  { k: 'all', label: 'ทั้งหมด' },
  { k: 'payout', label: 'จ่ายออก' },
  { k: 'refund', label: 'คืนเงิน' },
];

function referenceCodeForRow(row: FinanceRow) {
  if (row.dealNumber) return row.dealNumber;
  if (row.referenceType === 'seller_application') return `SELLER-${row.refId.slice(-8).toUpperCase()}`;
  if (row.referenceType === 'middleman_application') return `MM-${row.refId.slice(-8).toUpperCase()}`;
  if (row.referenceType === 'onsite_job') return `ONSITE-${row.refId.slice(-8).toUpperCase()}`;
  return `FIN-${row.refId.slice(-8).toUpperCase()}`;
}

export default function AdminFinance() {
  const [tab, setTab] = useState<FinanceTab>('incoming');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<FinanceRow[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, pageSize: 50, total: 0, hasNext: false });
  const [acting, setActing] = useState('');
  const [verifying, setVerifying] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | ''>('');
  const [slipResults, setSlipResults] = useState<Record<string, SlipCheck>>({});
  const [selected, setSelected] = useState<FinanceRow | null>(null);
  const [querySearch, setQuerySearch] = useState('');

  const load = useCallback(async () => {
    if (tab === 'summary') {
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch('/api/admin/finance?tab=incoming&page=1&pageSize=20&filter=all', { headers: { 'x-session-jwt': jwt } });
      const d = await r.json();
      setSummary(d.summary || null);
      return;
    }

    setRows(null);
    try {
      const jwt = (await account.createJWT()).jwt;
      const params = new URLSearchParams({
        tab,
        filter,
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
        search: querySearch,
      });
      const r = await fetch(`/api/admin/finance?${params.toString()}`, { headers: { 'x-session-jwt': jwt } });
      const d = await r.json();
      setRows(d.rows || []);
      setSummary(d.summary || null);
      setPagination(prev => ({
        ...prev,
        page: d.pagination?.page || prev.page,
        pageSize: d.pagination?.pageSize || prev.pageSize,
        total: d.pagination?.total || 0,
        hasNext: !!d.pagination?.hasNext,
      }));
    } catch {
      setRows([]);
    }
  }, [filter, pagination.page, pagination.pageSize, querySearch, tab]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setSelected(null);
  }, [tab, filter, pagination.page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuerySearch(search.trim());
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  async function act(refId: string, action: string) {
    let note = '';
    if (action === 'reject_payment') {
      const v = window.prompt('เหตุผลที่ปฏิเสธหลักฐานการโอน (ผู้ซื้อจะเห็นและต้องอัปสลิปใหม่):');
      if (v === null) return;
      note = v;
    } else if (action === 'mark_payout_sent') {
      const v = window.prompt('โอนเงินคืนผู้ขายแล้ว — ใส่บันทึกช่วยจำ (เช่น เลขอ้างอิงการโอน) ได้ถ้าต้องการ:', '');
      if (v === null) return;
      note = v;
    } else if (action === 'mark_refund_sent') {
      const v = window.prompt('คืนเงินผู้ซื้อแล้ว — ใส่บันทึกช่วยจำ (เช่น เลขอ้างอิงการโอน) ได้ถ้าต้องการ:', '');
      if (v === null) return;
      note = v;
    } else if (!window.confirm('ยืนยันว่าได้รับเงินจริงตามยอด แล้วให้ผู้ขายเริ่มแพ็คสินค้า?')) {
      return;
    }
    setActing(refId);
    try {
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch('/api/admin/finance', {
        method: 'PATCH',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: refId, action, note }),
      });
      if (r.ok) await load();
    } finally {
      setActing('');
    }
  }

  async function verifySlip(row: FinanceRow) {
    setVerifying(row.key);
    try {
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch('/api/admin/finance', {
        method: 'PATCH',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_slip', fileId: row.fileId, bucket: row.bucket, expected: row.expected }),
      });
      const d = await r.json();
      if (r.ok) {
        setSlipResults(prev => ({ ...prev, [row.key]: d }));
      } else {
        setSlipResults(prev => ({
          ...prev,
          [row.key]: { result: { ok: false, code: String(r.status), message: d.error || 'ตรวจสลิปไม่สำเร็จ' }, expected: 0, amountMatch: null },
        }));
      }
    } finally {
      setVerifying('');
    }
  }

  async function exportFile(format: 'csv' | 'xlsx') {
    setExporting(format);
    try {
      const jwt = (await account.createJWT()).jwt;
      const params = new URLSearchParams({
        tab,
        filter,
        page: '1',
        pageSize: String(pagination.pageSize),
        search: querySearch,
        format,
      });
      const response = await fetch(`/api/admin/finance?${params.toString()}`, {
        headers: { 'x-session-jwt': jwt },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fileName = `finance-${tab}-${filter}.${format}`;
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setExporting('');
    }
  }

  const currentFilters = tab === 'outgoing' ? OUTGOING_FILTERS : INCOMING_FILTERS;
  const filteredRows = rows || [];

  const pageCount = Math.max(1, Math.ceil((pagination.total || 0) / pagination.pageSize));

  return (
    <div className="mx-auto max-w-[1700px]">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={22} className="text-green-600" />
            <h1 className="text-2xl font-bold tracking-tight">การเงิน</h1>
          </div>
          <p className="text-sm text-gray-500 max-w-3xl">
            เปลี่ยนเป็นมุมมองแบบตารางสำหรับงานหลังบ้านโดยเฉพาะ แสดงเป็นรายแถวเหมือนสเปรดชีต, ค้นหาได้, แบ่งหน้าได้,
            และกดดูรายละเอียดเต็มในแผงด้านข้างได้โดยไม่ต้องเปิดการ์ดทีละก้อน
          </p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700 max-w-md">
          ตารางนี้ตั้งใจรองรับข้อมูลจำนวนมากกว่าเดิม โดยลดการแสดงรูปใน list หลักและแยกรายละเอียดไปที่ detail panel
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => { setTab('incoming'); setFilter('all'); setPagination(prev => ({ ...prev, page: 1 })); }} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'incoming' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
          เงินเข้า {summary ? `(${summary.incomingCount})` : ''}
        </button>
        <button onClick={() => { setTab('outgoing'); setFilter('all'); setPagination(prev => ({ ...prev, page: 1 })); }} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'outgoing' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
          เงินออก {summary?.outgoingCount != null ? `(${summary.outgoingCount})` : ''}
        </button>
        <button onClick={() => setTab('summary')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'summary' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
          ภาพรวมการเงิน
        </button>
      </div>

      {tab === 'summary' && summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <SumCard icon={<Clock size={22} className="text-amber-600" />} color="bg-amber-50" label="รายการเงินเข้ารอตรวจ" value={String(summary.incomingCount)} sub={`ค่าสินค้า ${summary.escrowPendingCount} รายการ`} />
            <SumCard icon={<PiggyBank size={22} className="text-blue-600" />} color="bg-blue-50" label="เงินพักในระบบ (Escrow)" value={baht(summary.heldEscrow)} sub="โอนเข้าแล้ว ยังไม่ปล่อย/คืน" />
            <SumCard icon={<ShieldCheck size={22} className="text-violet-600" />} color="bg-violet-50" label="เงินประกันถือไว้ (นัดเจอ)" value={baht(summary.heldMeetupDeposit)} sub="คืนเมื่อเจอกันสำเร็จ" />
            <SumCard icon={<CheckCircle2 size={22} className="text-teal-600" />} color="bg-teal-50" label="ยอดซื้อขายสำเร็จสะสม" value={baht(summary.completedVolume)} sub={`${summary.completedCount} ดีล`} />
            <SumCard icon={<TrendingUp size={22} className="text-green-600" />} color="bg-green-50" label="รายได้ค่าบริการ (ประมาณ)" value={baht(summary.estRevenue)} sub="จากดีลที่สำเร็จตาม ledger" />
            <SumCard icon={<AlertTriangle size={22} className="text-rose-600" />} color="bg-rose-50" label="รอโอนคืนผู้ขาย" value={baht(summary.pendingPayoutAmount || 0)} sub="ดีลปิดแล้ว ยังไม่บันทึกว่าโอนออก" />
            <SumCard icon={<AlertTriangle size={22} className="text-orange-600" />} color="bg-orange-50" label="รอคืนเงินผู้ซื้อ/เงินประกัน" value={baht(summary.pendingRefundAmount || 0)} sub="ยกเลิก/จบนัดเจอแล้ว ยังไม่คืน" />
          </div>
        </>
      )}

      {tab !== 'summary' && (
        <>
          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="p-4 border-b border-gray-200 space-y-3">
              <div className="flex flex-wrap gap-2">
                {currentFilters.map(f => (
                  <button
                    key={f.k}
                    onClick={() => { setFilter(f.k); setPagination(prev => ({ ...prev, page: 1 })); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === f.k ? 'bg-gray-900 text-white' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <label className="relative flex-1 min-w-[260px]">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="ค้นหาจากเลขดีล, ผู้ซื้อ, ผู้ขาย, คนกลาง, รายละเอียด..."
                    className="w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-4 py-3 text-sm"
                  />
                </label>
                <select
                  value={pagination.pageSize}
                  onChange={e => setPagination(prev => ({ ...prev, page: 1, pageSize: Number(e.target.value) }))}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm"
                >
                  <option value={25}>25 แถว</option>
                  <option value={50}>50 แถว</option>
                  <option value={100}>100 แถว</option>
                </select>
                <button
                  onClick={() => void exportFile('csv')}
                  disabled={exporting !== ''}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {exporting === 'csv' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Export CSV
                </button>
                <button
                  onClick={() => void exportFile('xlsx')}
                  disabled={exporting !== ''}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {exporting === 'xlsx' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Export Excel
                </button>
              </div>
            </div>

            {rows === null ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>
            ) : filteredRows.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <CheckCircle2 size={36} className="mx-auto mb-2 opacity-40" />
                <p>ไม่มีรายการในมุมมองนี้</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1540px] w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr className="[&>th]:px-3 [&>th]:py-3 [&>th]:text-left [&>th]:font-semibold [&>th]:border-b [&>th]:border-gray-200">
                      <th className="sticky left-0 z-20 bg-gray-50 min-w-[130px]">อ้างอิง</th>
                      <th className="sticky left-[130px] z-20 bg-gray-50 min-w-[120px]">ประเภท</th>
                      <th>ดีล/รายการ</th>
                      <th>ผู้ซื้อ</th>
                      <th>ผู้ขาย</th>
                      <th>คนกลาง</th>
                      <th>สถานะ</th>
                      <th>ราคาสินค้า</th>
                      <th>ค่าจัดการ</th>
                      <th>ยอดรายการ</th>
                      <th>รูป</th>
                      <th>ไฟล์แนบ</th>
                      <th>สลิป</th>
                      <th className="sticky right-0 z-20 bg-gray-50 min-w-[190px]">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map(row => {
                      const source = SOURCE_BADGE[row.source] || { label: row.source, cls: 'bg-gray-100 text-gray-700' };
                      const txn = TXN_BADGE[(row.txnStatus as TxnStatus) || 'pending'];
                      const slip = slipResults[row.key];
                      const canMarkOutgoing = (row.source === 'payout' || row.source === 'refund') && row.txnStatus === 'pending';
                      return (
                        <tr
                          key={row.key}
                          onClick={() => setSelected(row)}
                          className="cursor-pointer border-b border-gray-100 hover:bg-blue-50/40 transition-colors align-top"
                        >
                          <td className="px-3 py-3 sticky left-0 z-10 bg-white shadow-[8px_0_12px_-12px_rgba(15,23,42,0.18)]">
                            <div className="font-mono text-xs text-gray-700">{referenceCodeForRow(row)}</div>
                            <div className="text-[11px] text-gray-400 mt-1">{row.referenceType}</div>
                          </td>
                          <td className="px-3 py-3 sticky left-[130px] z-10 bg-white shadow-[8px_0_12px_-12px_rgba(15,23,42,0.18)]">
                            <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${source.cls}`}>{source.label}</span>
                          </td>
                          <td className="px-3 py-3 min-w-[260px]">
                            <p className="font-semibold text-gray-900">{row.title}</p>
                            <p className="text-xs text-gray-500 mt-1">{row.purpose}</p>
                            {row.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{row.description}</p>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium">{row.buyerName || '-'}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium">{row.sellerName || '-'}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium">{row.middlemanName || '-'}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="space-y-1">
                              <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${txn.cls}`}>{txn.label}</span>
                              <div className="text-[11px] text-gray-400">{row.dealStatus || row.status || '-'}</div>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-semibold">{row.price ? baht(row.price) : '-'}</td>
                          <td className="px-3 py-3">{row.feeAmount ? baht(row.feeAmount) : '-'}</td>
                          <td className="px-3 py-3 font-bold text-gray-900">{baht(row.expected)}</td>
                          <td className="px-3 py-3 text-center">{row.imageCount || 0}</td>
                          <td className="px-3 py-3 text-center">{row.attachmentCount || 0}</td>
                          <td className="px-3 py-3 text-center">
                            {row.hasSlip ? <span className="text-green-600 font-semibold">มี</span> : <span className="text-gray-400">-</span>}
                            {slip && <div className="text-[11px] mt-1 text-gray-500">{slip.result.ok ? 'ตรวจแล้ว' : 'ตรวจไม่ผ่าน'}</div>}
                          </td>
                          <td className="px-3 py-3 sticky right-0 z-10 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.18)]">
                            <div className="flex flex-col gap-2 min-w-[170px]" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => setSelected(row)}
                                className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                              >
                                <PanelRightOpen size={13} /> ดูรายละเอียด
                              </button>
                              {row.fileId && (
                                <button
                                  onClick={() => void verifySlip(row)}
                                  disabled={verifying === row.key}
                                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  {verifying === row.key ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
                                  ตรวจสลิป
                                </button>
                              )}
                              {row.canApprove && (
                                <>
                                  <button
                                    onClick={() => void act(row.refId, 'approve_payment')}
                                    disabled={acting === row.refId}
                                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {acting === row.refId ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                                    อนุมัติ
                                  </button>
                                  <button
                                    onClick={() => void act(row.refId, 'reject_payment')}
                                    disabled={!!acting}
                                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <XCircle size={13} /> ปฏิเสธ
                                  </button>
                                </>
                              )}
                              {canMarkOutgoing && (
                                <button
                                  onClick={() => void act(row.refId, row.source === 'payout' ? 'mark_payout_sent' : 'mark_refund_sent')}
                                  disabled={!!acting}
                                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                                >
                                  {acting === row.refId ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                                  บันทึกว่าโอนแล้ว
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 bg-gray-50/80">
              <div className="text-sm text-gray-500">
                แสดงหน้า {pagination.page} / {pageCount} · ทั้งหมด {pagination.total.toLocaleString()} รายการ
                {querySearch ? ` · ค้นหา "${querySearch}"` : ''}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
                >
                  <ChevronLeft size={16} /> ก่อนหน้า
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={!pagination.hasNext}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
                >
                  ถัดไป <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {selected && (
            <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setSelected(null)}>
              <div
                className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700">{referenceCodeForRow(selected)}</span>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${(SOURCE_BADGE[selected.source] || { cls: 'bg-gray-100 text-gray-700' }).cls}`}>
                        {(SOURCE_BADGE[selected.source] || { label: selected.source }).label}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold mt-2">{selected.title}</h2>
                    <p className="text-sm text-gray-500 mt-1">{selected.purpose}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600">ปิด</button>
                </div>

                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <DetailCard label="ราคาสินค้า" value={selected.price ? baht(selected.price) : '-'} />
                    <DetailCard label="ยอดรายการ" value={baht(selected.expected)} />
                    <DetailCard label="ค่าจัดการ/ค่าธรรมเนียม" value={selected.feeAmount ? baht(selected.feeAmount) : '-'} />
                    <DetailCard label="สถานะดีล/รายการ" value={selected.dealStatus || selected.status || '-'} />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <InfoPanel title="ผู้เกี่ยวข้อง">
                      <DetailLine label="ผู้ซื้อ" value={selected.buyerName || '-'} />
                      <DetailLine label="ผู้ขาย" value={selected.sellerName || '-'} />
                      <DetailLine label="คนกลาง" value={selected.middlemanName || '-'} />
                      <DetailLine label="ผู้จ่าย/เจ้าของรายการ" value={`${selected.payer}${selected.payerName ? ` · ${selected.payerName}` : ''}`} />
                    </InfoPanel>
                    <InfoPanel title="รายละเอียดงาน/ดีล">
                      <DetailLine label="ประเภทอ้างอิง" value={selected.referenceType} />
                      <DetailLine label="หมวด" value={selected.category || '-'} />
                      <DetailLine label="สภาพ" value={selected.condition || '-'} />
                      <DetailLine label="สถานที่" value={selected.location || '-'} />
                    </InfoPanel>
                  </div>

                  {selected.description && (
                    <InfoPanel title="คำอธิบาย">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.description}</p>
                    </InfoPanel>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    <InfoPanel title="ไฟล์ที่เกี่ยวข้อง">
                      <DetailLine label="จำนวนรูปสินค้า" value={`${selected.imageCount || 0} รูป`} />
                      <DetailLine label="จำนวนไฟล์แนบ" value={`${selected.attachmentCount || 0} ไฟล์`} />
                      <DetailLine label="มีสลิปหรือไม่" value={selected.hasSlip ? 'มี' : 'ไม่มี'} />
                      <div className="pt-2">
                        <Link href={selected.detailUrl} target="_blank" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50">
                          <ExternalLink size={14} /> เปิดหน้าจริง
                        </Link>
                      </div>
                    </InfoPanel>

                    <InfoPanel title="ข้อมูลธนาคาร">
                      <BankInfoBox bank={selected.bank} label={`บัญชีของ${selected.payer || 'ผู้เกี่ยวข้อง'}`} />
                    </InfoPanel>
                  </div>

                  {selected.fees && (
                    <InfoPanel title="รายละเอียดค่าจัดการ">
                      <div className="space-y-2">
                        {selected.fees.lines.map(line => (
                          <div key={line.label} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{line.label}</span>
                            <span className="font-medium">{baht(line.amount)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-sm font-semibold">
                          <span>รวม</span>
                          <span>{baht(selected.fees.total)}</span>
                        </div>
                      </div>
                    </InfoPanel>
                  )}

                  {selected.fileId && (
                    <InfoPanel title="หลักฐานการโอน">
                      <a href={fileUrl(selected.bucket, selected.fileId)} target="_blank" rel="noreferrer">
                        <img src={fileUrl(selected.bucket, selected.fileId)} alt="slip" className="w-full rounded-2xl border border-gray-200 bg-gray-50 object-contain max-h-[380px]" />
                      </a>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          onClick={() => void verifySlip(selected)}
                          disabled={verifying === selected.key}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {verifying === selected.key ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
                          ตรวจสลิปอัตโนมัติ
                        </button>
                        <a href={fileUrl(selected.bucket, selected.fileId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <FileImage size={14} /> เปิดไฟล์ต้นฉบับ
                        </a>
                      </div>
                      {slipResults[selected.key] && (
                        <SlipResultBox result={slipResults[selected.key]} />
                      )}
                    </InfoPanel>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BankInfoBox({ bank, label }: { bank?: BankInfo | null; label: string }) {
  if (!bank) {
    return (
      <div className="rounded-xl p-3 border border-amber-200 bg-amber-50 text-xs text-amber-700">
        ⚠️ ยังไม่มีข้อมูลบัญชี/คิวอาร์โค๊ดในหน้าโปรไฟล์ของผู้ใช้นี้ — ต้องสอบถามลูกค้าเองก่อนโอน
      </div>
    );
  }
  return (
    <div className="rounded-xl p-3 border border-gray-200 bg-white flex items-start justify-between gap-3 flex-wrap">
      <div className="text-xs space-y-0.5">
        <p className="text-gray-400 mb-1">{label}</p>
        <p><span className="text-gray-400">ธนาคาร:</span> {bank.bankName || '-'}</p>
        <p><span className="text-gray-400">เลขบัญชี:</span> <span className="font-mono">{bank.bankAcct || '-'}</span></p>
        <p><span className="text-gray-400">ชื่อบัญชี:</span> {bank.bankOwner || '-'}</p>
      </div>
      {bank.bankQrFileId && (
        <a href={fileUrl('deal_files', bank.bankQrFileId)} target="_blank" rel="noreferrer" className="shrink-0">
          <img src={fileUrl('deal_files', bank.bankQrFileId)} alt="QR" className="w-20 h-20 object-contain rounded-lg border border-gray-200" />
        </a>
      )}
    </div>
  );
}

function SumCard({ icon, color, label, value, sub }: { icon: React.ReactNode; color: string; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xl font-bold">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-right text-gray-700">{value}</span>
    </div>
  );
}

function SlipResultBox({ result }: { result: SlipCheck }) {
  const slip = result.result.slip;
  const good = result.result.ok && result.amountMatch !== false;
  return (
    <div className={`mt-4 rounded-2xl border p-4 ${result.result.ok ? (result.amountMatch === false ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50') : 'border-red-200 bg-red-50'}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        {good ? <CheckCircle2 size={16} className="text-green-600" /> : <AlertTriangle size={16} className="text-amber-600" />}
        <span className={result.result.ok ? 'text-green-700' : 'text-red-700'}>
          {result.result.ok ? 'สลิปจริง — ตรวจกับธนาคารผ่าน' : `ตรวจไม่ผ่าน: ${result.result.message}`}
        </span>
      </div>
      {slip && (
        <div className="mt-3 space-y-1 text-xs text-gray-600">
          <div className="flex justify-between"><span>ยอดในสลิป</span><span className={result.amountMatch === false ? 'text-red-600 font-semibold' : 'text-green-700 font-semibold'}>{baht(slip.amount)}</span></div>
          {(slip.senderName || slip.receiverName) && <div className="flex justify-between"><span>โอน</span><span>{slip.senderName || '-'} → {slip.receiverName || '-'}</span></div>}
          {slip.receiverAccount && <div className="flex justify-between"><span>บัญชีผู้รับ</span><span>{slip.receiverAccount}</span></div>}
          {slip.transRef && <div className="flex justify-between"><span>เลขอ้างอิง</span><span className="font-mono">{slip.transRef}</span></div>}
          {(slip.transDate || slip.transTime) && <div className="flex justify-between"><span>เวลาโอน</span><span>{slip.transDate} {slip.transTime}</span></div>}
        </div>
      )}
    </div>
  );
}
