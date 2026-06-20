'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { account } from '@/lib/appwrite';
import { Wallet, Loader2, CheckCircle2, XCircle, ExternalLink, PiggyBank, ShieldCheck, TrendingUp, Clock, ScanLine, AlertTriangle, Search } from 'lucide-react';

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const fileUrl = (bucket: string, id: string) => `${ENDPOINT}/storage/buckets/${bucket}/files/${id}/view?project=${PROJECT}`;
const baht = (n: number) => '฿' + Math.round(n).toLocaleString();

interface FeeLine { label: string; amount: number; }
type TxnStatus = 'pending' | 'confirmed' | 'refund_pending' | 'refunded';
interface BankInfo { bankName: string; bankAcct: string; bankOwner: string; bankQrFileId?: string; }
interface Incoming {
  key: string; source: string; refId: string; dealNumber?: string; title: string;
  payer: string; payerName: string; purpose: string; expected: number;
  fileId: string; bucket: string; status: string; dealType?: string;
  txnStatus?: TxnStatus; note?: string;
  fees?: { lines: FeeLine[]; total: number; note?: string };
  canApprove?: boolean; approveLink?: string;
  bank?: BankInfo | null;
}
interface FinanceGroup {
  key: string;
  referenceCode: string;
  title: string;
  subtitle: string;
  rows: Incoming[];
  totalExpected: number;
  openHref: string;
  searchText: string;
}
interface Summary {
  incomingCount: number; escrowPendingCount: number; heldEscrow: number;
  heldMeetupDeposit: number; completedVolume: number; completedCount: number; estRevenue: number;
  outgoingCount?: number; pendingPayoutAmount?: number; pendingRefundAmount?: number;
}
const TXN_BADGE: Record<TxnStatus, { label: string; cls: string }> = {
  pending:         { label: 'รอตรวจ',        cls: 'bg-amber-50 text-amber-700' },
  confirmed:       { label: 'ยืนยันแล้ว',     cls: 'bg-green-50 text-green-700' },
  refund_pending:  { label: 'รอคืนเงิน',      cls: 'bg-orange-50 text-orange-700' },
  refunded:        { label: 'คืนเงินแล้ว',    cls: 'bg-teal-50 text-teal-700' },
};
interface SlipInfo { amount: number; transRef: string; transTime?: string; transDate?: string; senderName?: string; receiverName?: string; receiverAccount?: string; }
interface SlipCheck {
  result: { ok: boolean; code: string; message: string; slip?: SlipInfo; duplicate?: boolean; wrongReceiver?: boolean };
  expected: number; amountMatch: boolean | null;
}

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  escrow:        { label: 'ค่าสินค้า (Escrow)', cls: 'bg-blue-100 text-blue-700' },
  meetup:        { label: 'เงินประกัน (นัดเจอ)', cls: 'bg-violet-100 text-violet-700' },
  seller_app:    { label: 'ค่าสมัครผู้ขาย', cls: 'bg-green-100 text-green-700' },
  middleman_app: { label: 'ค่าสมัครคนกลาง', cls: 'bg-emerald-100 text-emerald-700' },
  platform_revenue: { label: 'รายได้แพลตฟอร์ม', cls: 'bg-cyan-100 text-cyan-700' },
  payout:        { label: 'จ่ายคืนผู้ขาย', cls: 'bg-rose-100 text-rose-700' },
  refund:        { label: 'คืนเงินผู้ซื้อ', cls: 'bg-orange-100 text-orange-700' },
  meetup_refund: { label: 'คืนเงินประกัน', cls: 'bg-fuchsia-100 text-fuchsia-700' },
  middleman_fee: { label: 'จ่ายค่าคนกลาง', cls: 'bg-lime-100 text-lime-700' },
  onsite_payout: { label: 'จ่ายงานออนไซต์', cls: 'bg-indigo-100 text-indigo-700' },
};
const FILTERS = [
  { k: 'all', label: 'ทั้งหมด' },
  { k: 'escrow', label: 'ค่าสินค้า' },
  { k: 'meetup', label: 'เงินประกัน' },
  { k: 'reg', label: 'ค่าสมัคร' },
];

function referenceCodeForRow(row: Incoming) {
  if (row.dealNumber) return row.dealNumber;
  if (row.source === 'seller_app') return `SELLER-${row.refId.slice(-8).toUpperCase()}`;
  if (row.source === 'middleman_app') return `MM-${row.refId.slice(-8).toUpperCase()}`;
  return `FIN-${row.refId.slice(-8).toUpperCase()}`;
}

function groupRowsByReference(rows: Incoming[]) {
  const grouped = new Map<string, FinanceGroup>();

  for (const row of rows) {
    const referenceCode = referenceCodeForRow(row);
    const key = row.dealNumber ? `deal:${row.refId}` : `${row.source}:${row.refId}`;
    const subtitleParts = [
      row.dealNumber ? 'อ้างอิงดีลเดียวกัน' : row.purpose,
      row.payerName ? `เกี่ยวข้องกับ ${row.payerName}` : '',
    ].filter(Boolean);
    const existing = grouped.get(key);
    if (existing) {
      existing.rows.push(row);
      existing.totalExpected += Number(row.expected) || 0;
      existing.searchText += ` ${row.purpose} ${row.payer} ${row.payerName} ${row.title}`;
      continue;
    }

    grouped.set(key, {
      key,
      referenceCode,
      title: row.title,
      subtitle: subtitleParts.join(' · '),
      rows: [row],
      totalExpected: Number(row.expected) || 0,
      openHref: row.approveLink ? row.approveLink : `/deal/${row.refId}`,
      searchText: `${referenceCode} ${row.dealNumber || ''} ${row.title} ${row.purpose} ${row.payer} ${row.payerName}`,
    });
  }

  return Array.from(grouped.values());
}

export default function AdminFinance() {
  const [tab, setTab] = useState<'incoming' | 'outgoing' | 'summary'>('incoming');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [incoming, setIncoming] = useState<Incoming[] | null>(null);
  const [outgoing, setOutgoing] = useState<Incoming[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [acting, setActing] = useState('');
  const [verifying, setVerifying] = useState('');
  const [slipResults, setSlipResults] = useState<Record<string, SlipCheck>>({});

  const load = useCallback(async () => {
    setIncoming(null);
    try {
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch('/api/admin/finance', { headers: { 'x-session-jwt': jwt } });
      const d = await r.json();
      setIncoming(d.incoming || []);
      setOutgoing(d.outgoing || []);
      setSummary(d.summary || null);
    } catch { setIncoming([]); setOutgoing([]); }
  }, []);

  useEffect(() => { const t = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(t); }, [load]);

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
    } else if (!window.confirm('ยืนยันว่าได้รับเงินจริงตามยอด แล้วให้ผู้ขายเริ่มแพ็คสินค้า?')) return;
    setActing(refId);
    try {
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch('/api/admin/finance', { method: 'PATCH', headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: refId, action, note }) });
      if (r.ok) load();
    } finally { setActing(''); }
  }

  async function verifySlip(row: Incoming) {
    setVerifying(row.key);
    try {
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch('/api/admin/finance', { method: 'PATCH', headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify_slip', fileId: row.fileId, bucket: row.bucket, expected: row.expected }) });
      const d = await r.json();
      if (r.ok) setSlipResults(prev => ({ ...prev, [row.key]: d }));
      else setSlipResults(prev => ({ ...prev, [row.key]: { result: { ok: false, code: String(r.status), message: d.error || 'ตรวจสลิปไม่สำเร็จ' }, expected: 0, amountMatch: null } }));
    } finally { setVerifying(''); }
  }

  const rows = (incoming || []).filter(r =>
    filter === 'all' ? true :
    filter === 'reg' ? (r.source === 'seller_app' || r.source === 'middleman_app') :
    r.source === filter);
  const incomingGroups = groupRowsByReference(rows).filter(group => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return group.searchText.toLowerCase().includes(q);
  });
  const outgoingGroups = groupRowsByReference(outgoing || []).filter(group => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return group.searchText.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Wallet size={22} className="text-green-600" />
        <h1 className="text-xl font-bold">การเงิน</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">เงินเข้าทุกก้อนในที่เดียว — ค่าสินค้า เงินประกัน ค่าสมัคร · ตรวจสลิปอัตโนมัติ (SlipOK) · อนุมัติให้ดีลไปต่อ</p>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setTab('incoming')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'incoming' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600'}`}>เงินเข้า {summary ? `(${summary.incomingCount})` : ''}</button>
        <button onClick={() => setTab('outgoing')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'outgoing' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600'}`}>เงินออก {summary?.outgoingCount != null ? `(${summary.outgoingCount})` : ''}</button>
        <button onClick={() => setTab('summary')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'summary' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600'}`}>ภาพรวมการเงิน</button>
      </div>

      {tab !== 'summary' && (
        <div className="mb-4">
          <label className="relative block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาด้วยเลขดีล / รหัสการเงิน / ชื่อดีล / ชื่อผู้เกี่ยวข้อง"
              className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 pl-10 pr-4 py-3 text-sm"
            />
          </label>
          <p className="text-xs text-gray-400 mt-1.5">รหัสดีลและรหัสการเงินของรายการที่อ้างอิงดีล จะใช้เลขเดียวกับดีล เช่น `KKL-XXXXXXXX`</p>
        </div>
      )}

      {tab === 'incoming' && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === f.k ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-500'}`}>{f.label}</button>
          ))}
        </div>
      )}

      {(tab === 'incoming' ? incoming === null : tab === 'outgoing' ? outgoing === null : false) && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>}

      {tab === 'incoming' && incoming !== null && (
        incomingGroups.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><CheckCircle2 size={36} className="mx-auto mb-2 opacity-40" /><p>ไม่มีรายการเงินเข้าในหมวดนี้</p></div>
        ) : (
          <div className="space-y-3">
            {incomingGroups.map(group => (
              <div key={group.key} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 font-mono">{group.referenceCode}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">รวม {group.rows.length} รายการในบิลเดียวกัน</span>
                    </div>
                    <p className="font-semibold mt-1">{group.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{group.subtitle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">ยอดรวมที่เกี่ยวข้องกับดีลนี้</p>
                    <p className="text-lg font-bold text-green-600">{baht(group.totalExpected)}</p>
                    <Link href={group.openHref} target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-1 justify-end mt-1"><ExternalLink size={12} /> เปิดดีล/หน้าจัดการ</Link>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {group.rows.map(d => {
                    const sb = SOURCE_BADGE[d.source] || { label: d.source, cls: 'bg-gray-100 text-gray-600' };
                    const sc = slipResults[d.key];
                    return (
                      <div key={d.key} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sb.cls}`}>{sb.label}</span>
                              {(() => { const tb = TXN_BADGE[(d.txnStatus as TxnStatus) || 'pending']; return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tb.cls}`}>{tb.label}</span>; })()}
                            </div>
                            <p className="font-semibold mt-1">{d.purpose}</p>
                            <p className="text-xs text-gray-500 mt-1">{d.payer}: {d.payerName || '-'} · รหัสอ้างอิง {referenceCodeForRow(d)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-gray-400">ยอดรายการนี้</p>
                            <p className="text-sm font-bold text-green-600">{d.expected > 0 ? baht(d.expected) : 'ยังไม่ตั้งยอด'}</p>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3 mt-3">
                          <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between text-sm font-bold"><span>ยอดที่ควรได้รับ</span><span className="text-green-600">{d.expected > 0 ? baht(d.expected) : 'ยังไม่ตั้งยอด'}</span></div>
                            {d.fees && (
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-400 mb-1">รายละเอียดบิลในดีลนี้</p>
                                {d.fees.lines.map(l => (<div key={l.label} className="flex justify-between text-xs text-gray-500 py-0.5"><span>{l.label}</span><span>{baht(l.amount)}</span></div>))}
                                <div className="flex justify-between text-xs font-semibold mt-1 pt-1 border-t border-gray-200 dark:border-gray-700"><span>ยอดรวมรายการ</span><span>{baht(d.fees.total)}</span></div>
                              </div>
                            )}
                          </div>
                          <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-400 mb-2">หลักฐานการโอน</p>
                            {d.fileId ? (
                              <a href={fileUrl(d.bucket, d.fileId)} target="_blank" rel="noreferrer">
                                <img src={fileUrl(d.bucket, d.fileId)} alt="slip" className="w-full max-h-40 object-contain rounded-lg border border-gray-200 dark:border-gray-700" />
                              </a>
                            ) : <p className="text-xs text-gray-400">ไม่มีสลิป</p>}
                          </div>
                        </div>
                        <BankInfoBox bank={d.bank} label={`บัญชีของ${d.payer || 'ผู้โอน'}`} />

                        {sc && (() => { const s = sc.result.slip; const good = sc.result.ok && sc.amountMatch !== false;
                          return (
                            <div className={`mt-3 rounded-xl p-3 border ${sc.result.ok ? (sc.amountMatch === false ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200') : 'bg-red-50 border-red-200'}`}>
                              <div className="flex items-center gap-1.5 text-sm font-semibold">
                                {good ? <CheckCircle2 size={15} className="text-green-600" /> : <AlertTriangle size={15} className="text-amber-600" />}
                                <span className={sc.result.ok ? 'text-green-700' : 'text-red-700'}>{sc.result.ok ? 'สลิปจริง — ตรวจกับธนาคารผ่าน' : `ตรวจไม่ผ่าน: ${sc.result.message}`}</span>
                              </div>
                              {sc.result.duplicate && <p className="text-xs text-amber-700 mt-1">⚠️ สลิปซ้ำ — เคยถูกใช้มาก่อน</p>}
                              {sc.result.wrongReceiver && <p className="text-xs text-red-700 mt-1">⚠️ บัญชีผู้รับไม่ตรงกับบัญชีหลักของร้าน</p>}
                              {s && (
                                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 space-y-0.5">
                                  <div className="flex justify-between"><span>ยอดในสลิป</span><span className={sc.amountMatch === false ? 'text-red-600 font-semibold' : 'text-green-700 font-semibold'}>{baht(s.amount)} {sc.amountMatch === false ? `(ควร ${baht(sc.expected)} ✗)` : sc.amountMatch ? '✓' : ''}</span></div>
                                  {(s.senderName || s.receiverName) && <div className="flex justify-between"><span>โอน</span><span>{s.senderName || '-'} → {s.receiverName || '-'}</span></div>}
                                  {s.receiverAccount && <div className="flex justify-between"><span>บัญชีผู้รับ</span><span>{s.receiverAccount}</span></div>}
                                  {s.transRef && <div className="flex justify-between"><span>เลขอ้างอิง</span><span className="font-mono">{s.transRef}</span></div>}
                                  {(s.transDate || s.transTime) && <div className="flex justify-between"><span>เวลาโอน</span><span>{s.transDate} {s.transTime}</span></div>}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {d.canApprove && <p className="text-xs text-gray-400 mt-2">เมื่ออนุมัติ → ขั้นถัดไป: <b className="text-gray-600 dark:text-gray-300">ผู้ขายแพ็คของ</b></p>}
                        {d.source === 'meetup' && <p className="text-xs text-gray-400 mt-2">* เงินประกันนัดเจอจะคืน/หักตามผลการนัดเจอโดยอัตโนมัติ — ใช้หน้านี้ตรวจสลิปเท่านั้น</p>}

                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {d.fileId && (
                            <button onClick={() => verifySlip(d)} disabled={verifying === d.key}
                              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1 disabled:opacity-50">
                              {verifying === d.key ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />} ตรวจสลิปอัตโนมัติ
                            </button>
                          )}
                          {d.canApprove && (
                            <>
                              <button onClick={() => act(d.refId, 'approve_payment')} disabled={!!acting}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 disabled:opacity-50">
                                {acting === d.refId ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} อนุมัติ — เริ่มแพ็ค
                              </button>
                              <button onClick={() => act(d.refId, 'reject_payment')} disabled={!!acting}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-1 disabled:opacity-50">
                                <XCircle size={14} /> ปฏิเสธการโอน
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'outgoing' && outgoing !== null && (
        outgoingGroups.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><CheckCircle2 size={36} className="mx-auto mb-2 opacity-40" /><p>ไม่มีรายการเงินออก</p></div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 -mt-1 mb-1">เงินที่ศูนย์กลางต้องโอน &quot;ออก&quot; — จ่ายคืนผู้ขายเมื่อปิดดีล / คืนเงินผู้ซื้อเมื่อยกเลิก / คืนเงินประกันนัดเจอ ทำเครื่องหมายเมื่อโอนจริงแล้วเพื่อบันทึกสถานะ</p>
            {outgoingGroups.map(group => (
              <div key={group.key} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 font-mono">{group.referenceCode}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">รวม {group.rows.length} รายการเงินออกในดีลเดียวกัน</span>
                    </div>
                    <p className="font-semibold mt-1">{group.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{group.subtitle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">ยอดรวมที่ต้องโอนออก</p>
                    <p className="text-lg font-bold text-rose-600">{baht(group.totalExpected)}</p>
                    <Link href={group.openHref} target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-1 justify-end mt-1"><ExternalLink size={12} /> เปิดดีล/หน้าจัดการ</Link>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {group.rows.map(d => {
                    const sb = SOURCE_BADGE[d.source] || { label: d.source, cls: 'bg-gray-100 text-gray-600' };
                    const tb = TXN_BADGE[(d.txnStatus as TxnStatus) || 'pending'];
                    const canMark = (d.source === 'payout' || d.source === 'refund') && d.txnStatus === 'pending';
                    return (
                      <div key={d.key} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sb.cls}`}>{sb.label}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tb.cls}`}>{tb.label}</span>
                            </div>
                            <p className="font-semibold mt-1">{d.purpose}</p>
                            <p className="text-xs text-gray-500 mt-1">ผู้รับ: {d.payerName || '-'} · รหัสอ้างอิง {referenceCodeForRow(d)}</p>
                            {d.note && <p className="text-xs text-gray-400 mt-1">บันทึก: {d.note}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-gray-400">ยอดรายการนี้</p>
                            <p className="text-sm font-bold text-rose-600">{baht(d.expected)}</p>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-3 mt-3 border border-gray-200 dark:border-gray-700">
                          <div className="flex justify-between text-sm font-bold"><span>ยอดที่ต้องโอนออก</span><span className="text-rose-600">{baht(d.expected)}</span></div>
                        </div>
                        <BankInfoBox bank={d.bank} label={`บัญชีรับเงิน — ${d.payerName || 'ผู้รับ'}`} />
                        {canMark && (
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <button onClick={() => act(d.refId, d.source === 'payout' ? 'mark_payout_sent' : 'mark_refund_sent')} disabled={!!acting}
                              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-1 disabled:opacity-50">
                              {acting === d.refId ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} โอนแล้ว — บันทึกสถานะ
                            </button>
                          </div>
                        )}
                        {d.source === 'meetup_refund' && <p className="text-xs text-gray-400 mt-2">* จัดการคืนเงินประกันนัดเจอที่หน้าจัดการดีล (ปุ่ม &quot;ไปหน้าจัดการ&quot;)</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'summary' && summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <SumCard icon={<Clock size={22} className="text-amber-600" />} color="bg-amber-50 dark:bg-amber-900/20" label="รายการเงินเข้ารอตรวจ" value={String(summary.incomingCount)} sub={`ค่าสินค้า ${summary.escrowPendingCount} รายการ`} />
            <SumCard icon={<PiggyBank size={22} className="text-blue-600" />} color="bg-blue-50 dark:bg-blue-900/20" label="เงินพักในระบบ (Escrow)" value={baht(summary.heldEscrow)} sub="โอนเข้าแล้ว ยังไม่ปล่อย/คืน" />
            <SumCard icon={<ShieldCheck size={22} className="text-violet-600" />} color="bg-violet-50 dark:bg-violet-900/20" label="เงินประกันถือไว้ (นัดเจอ)" value={baht(summary.heldMeetupDeposit)} sub="คืนเมื่อเจอกันสำเร็จ" />
            <SumCard icon={<CheckCircle2 size={22} className="text-teal-600" />} color="bg-teal-50 dark:bg-teal-900/20" label="ยอดซื้อขายสำเร็จสะสม" value={baht(summary.completedVolume)} sub={`${summary.completedCount} ดีล`} />
            <SumCard icon={<TrendingUp size={22} className="text-green-600" />} color="bg-green-50 dark:bg-green-900/20" label="รายได้ค่าบริการ (ประมาณ)" value={baht(summary.estRevenue)} sub="จากดีลที่สำเร็จ ตามอัตราปัจจุบัน" />
            <SumCard icon={<AlertTriangle size={22} className="text-rose-600" />} color="bg-rose-50 dark:bg-rose-900/20" label="รอโอนคืนผู้ขาย" value={baht(summary.pendingPayoutAmount || 0)} sub="ดีลปิดแล้ว ยังไม่บันทึกว่าโอนออก" />
            <SumCard icon={<AlertTriangle size={22} className="text-orange-600" />} color="bg-orange-50 dark:bg-orange-900/20" label="รอคืนเงินผู้ซื้อ/เงินประกัน" value={baht(summary.pendingRefundAmount || 0)} sub="ยกเลิก/จบนัดเจอแล้ว ยังไม่คืน" />
          </div>
          <p className="text-xs text-gray-400 mt-4">* รายได้เป็นยอดประมาณการจากอัตราค่าธรรมเนียมที่ตั้งไว้ × ดีลที่สำเร็จ (ยังไม่ได้บันทึกยอดจริงต่อดีล) · เงินเข้า/ออกทุกรายการมีสถานะติดตามได้ที่แท็บ &quot;เงินเข้า&quot;/&quot;เงินออก&quot;</p>
        </>
      )}
    </div>
  );
}

function BankInfoBox({ bank, label }: { bank?: BankInfo | null; label: string }) {
  if (!bank) {
    return (
      <div className="mt-3 rounded-xl p-3 border border-amber-200 bg-amber-50 text-xs text-amber-700">
        ⚠️ ยังไม่มีข้อมูลบัญชี/คิวอาร์โค๊ดในหน้าโปรไฟล์ของผู้ใช้นี้ — ต้องสอบถามลูกค้าเองก่อนโอน
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-xl p-3 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-start justify-between gap-3 flex-wrap">
      <div className="text-xs space-y-0.5">
        <p className="text-gray-400 mb-1">{label}</p>
        <p><span className="text-gray-400">ธนาคาร:</span> {bank.bankName || '-'}</p>
        <p><span className="text-gray-400">เลขบัญชี:</span> <span className="font-mono">{bank.bankAcct || '-'}</span></p>
        <p><span className="text-gray-400">ชื่อบัญชี:</span> {bank.bankOwner || '-'}</p>
      </div>
      {bank.bankQrFileId && (
        <a href={fileUrl('deal_files', bank.bankQrFileId)} target="_blank" rel="noreferrer" className="shrink-0">
          <img src={fileUrl('deal_files', bank.bankQrFileId)} alt="QR" className="w-20 h-20 object-contain rounded-lg border border-gray-200 dark:border-gray-700" />
        </a>
      )}
    </div>
  );
}

function SumCard({ icon, color, label, value, sub }: { icon: React.ReactNode; color: string; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xl font-bold">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
