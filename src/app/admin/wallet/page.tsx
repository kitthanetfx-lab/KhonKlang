'use client';

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useCallback } from 'react';
import { authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { Wallet, CheckCircle2, XCircle, RefreshCw, Eye, FileText } from 'lucide-react';
import { AdminWalletApp, type WalletDoc } from '@/components/admin/mobile/AdminWalletApp';

const STATUS_TABS = [
  { key: '', label: 'ทั้งหมด' },
  { key: 'pending_review', label: 'รอตรวจสอบ' },
  { key: 'approved', label: 'อนุมัติแล้ว' },
  { key: 'rejected', label: 'ปฏิเสธ' },
];

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending_review: { label: 'รอตรวจสอบ', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  approved: { label: 'อนุมัติแล้ว', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: 'ปฏิเสธ', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

function baht(amount: number) {
  return `฿${Number(amount || 0).toLocaleString()}`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AdminWalletPage() {
  const [kind, setKind] = useState<'topup' | 'withdraw'>('topup');
  const [docs, setDocs] = useState<WalletDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ kind });
      if (statusFilter) params.set('status', statusFilter);
      const headers = await authHeaders();
      const res = await fetch(`/api/admin/wallet?${params}`, { headers });
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [kind, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function act(docId: string, action: 'approve' | 'reject', r?: string) {
    setActing(true);
    try {
      const headers = await authHeaders();
      await fetch('/api/admin/wallet', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, docId, action, reason: r }),
      });
      setRejectingId(null); setReason('');
      await load();
    } finally { setActing(false); }
  }

  const pendingCount = docs.filter(d => d.status === 'pending_review').length;

  function renderActions(d: WalletDoc) {
    if (d.status !== 'pending_review') {
      return d.slip_file_id ? (
        <a href={fileViewUrl(DEAL_BUCKET, d.slip_file_id)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600"><Eye size={12} /> สลิป</a>
      ) : null;
    }
    if (rejectingId === d.id) {
      return (
        <div className="flex flex-col gap-2 min-w-[140px]">
          <textarea className="w-full border rounded-lg px-2 py-1 text-xs resize-none" rows={2}
            placeholder="เหตุผลปฏิเสธ" value={reason} onChange={e => setReason(e.target.value)} />
          <div className="flex gap-1">
            <button type="button" className="flex-1 py-1 text-xs border rounded-lg" onClick={() => { setRejectingId(null); setReason(''); }}>ยกเลิก</button>
            <button type="button" className="flex-1 py-1 text-xs bg-red-600 text-white rounded-lg" onClick={() => act(d.id, 'reject', reason)} disabled={acting}>ยืนยัน</button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        <button type="button" className="text-xs text-red-600" onClick={() => setRejectingId(d.id)}><XCircle size={13} /> ปฏิเสธ</button>
        <button type="button" className="text-xs text-green-600" onClick={() => act(d.id, 'approve')} disabled={acting}><CheckCircle2 size={13} /> อนุมัติ</button>
      </div>
    );
  }

  return (
    <>
      <div className="admin-mobile-only">
        <AdminWalletApp
          kind={kind}
          docs={docs}
          loading={loading}
          statusFilter={statusFilter}
          pendingCount={pendingCount}
          onKind={setKind}
          onStatusFilter={setStatusFilter}
          onRefresh={() => load()}
          renderActions={renderActions}
        />
      </div>

      <div className="admin-desktop-only">
        <div className="space-y-5 w-full">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2"><Wallet size={20} /> กระเป๋าเงินผู้ใช้</h1>
              <p className="text-sm text-gray-500 mt-0.5">ตรวจสลิปเติมเงิน และโอนเงินออกตามคำขอถอน — ยอดเข้ากระเป๋าเมื่ออนุมัติเติมเท่านั้น</p>
            </div>
            <button onClick={() => load()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
              <RefreshCw size={15} /> รีเฟรช
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
              {([['topup', 'เติมเงิน'], ['withdraw', 'ถอนเงิน']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setKind(k)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${kind === k ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
              {STATUS_TABS.map(t => (
                <button key={t.key} onClick={() => setStatusFilter(t.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === t.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500'}`}>
                  {t.label}
                  {t.key === 'pending_review' && pendingCount > 0 && (
                    <span className="ml-1.5 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">ผู้ใช้</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">จำนวน</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">{kind === 'topup' ? 'สลิป' : 'บัญชีรับเงิน'}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">วันที่</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">สถานะ</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:border-gray-800">
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
                  ) : docs.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">ไม่มีข้อมูล</td></tr>
                  ) : docs.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors align-top">
                      <td className="px-5 py-3.5">
                        <div className="font-medium">{d.user?.display_name || d.user_id}</div>
                        <div className="text-xs text-gray-400">{d.user?.phone || ''}</div>
                      </td>
                      <td className="px-4 py-3.5 font-semibold">{baht(d.amount)}</td>
                      <td className="px-4 py-3.5">
                        {kind === 'topup' ? (
                          d.slip_file_id ? (
                            <a href={fileViewUrl(DEAL_BUCKET, d.slip_file_id)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                              <Eye size={12} /> ดูสลิป
                            </a>
                          ) : <span className="text-xs text-gray-400 flex items-center gap-1"><FileText size={12} /> ไม่มีสลิป</span>
                        ) : (
                          <div className="text-xs text-gray-600 dark:text-gray-300">
                            <div>{d.bank_name}</div>
                            <div className="font-mono">{d.bank_acct}</div>
                            <div>{d.bank_owner}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-gray-500 text-xs whitespace-nowrap">{formatDate(d.created_at)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CFG[d.status]?.cls || ''}`}>{STATUS_CFG[d.status]?.label || d.status}</span>
                        {d.status === 'rejected' && d.reject_reason && <div className="text-xs text-red-500 mt-1 max-w-[180px]">{d.reject_reason}</div>}
                      </td>
                      <td className="px-4 py-3.5">
                        {d.status === 'pending_review' && (
                          rejectingId === d.id ? (
                            <div className="flex flex-col gap-2 min-w-[200px]">
                              <textarea className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none resize-none bg-white dark:bg-gray-800"
                                rows={2} placeholder="เหตุผลการปฏิเสธ (ไม่บังคับ)" value={reason} onChange={e => setReason(e.target.value)} />
                              <div className="flex gap-2">
                                <button onClick={() => { setRejectingId(null); setReason(''); }} className="flex-1 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-xs">ยกเลิก</button>
                                <button onClick={() => act(d.id, 'reject', reason)} disabled={acting} className="flex-1 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium disabled:opacity-60">ยืนยัน</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 justify-end">
                              <button onClick={() => setRejectingId(d.id)} className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 flex items-center gap-1">
                                <XCircle size={13} /> ปฏิเสธ
                              </button>
                              <button onClick={() => act(d.id, 'approve')} disabled={acting} className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-1 disabled:opacity-60">
                                <CheckCircle2 size={13} /> อนุมัติ
                              </button>
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
