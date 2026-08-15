'use client';

import { AdminAppCard, AdminAppChip, AdminAppFrame } from './AdminAppFrame';

export type WalletDoc = {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  reject_reason?: string;
  created_at: string;
  slip_file_id?: string;
  bank_name?: string;
  bank_acct?: string;
  bank_owner?: string;
  user: { display_name?: string; phone?: string } | null;
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending_review: { label: 'รอตรวจสอบ', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'อนุมัติแล้ว', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'ปฏิเสธ', cls: 'bg-red-100 text-red-700' },
};

function baht(n: number) { return `฿${Number(n || 0).toLocaleString()}`; }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

type Props = {
  kind: 'topup' | 'withdraw';
  docs: WalletDoc[];
  loading: boolean;
  statusFilter: string;
  pendingCount: number;
  onKind: (k: 'topup' | 'withdraw') => void;
  onStatusFilter: (s: string) => void;
  onRefresh: () => void;
  renderActions: (d: WalletDoc) => React.ReactNode;
};

export function AdminWalletApp({
  kind, docs, loading, statusFilter, pendingCount, onKind, onStatusFilter, onRefresh, renderActions,
}: Props) {
  return (
    <AdminAppFrame
      title="กระเป๋าเงินผู้ใช้"
      subtitle="ตรวจสลิปเติมเงิน และโอนเงินถอน"
      onRefresh={onRefresh}
      refreshing={loading}
      stats={
        <>
          <AdminAppChip label="เติมเงิน" active={kind === 'topup'} onClick={() => onKind('topup')} />
          <AdminAppChip label="ถอนเงิน" active={kind === 'withdraw'} onClick={() => onKind('withdraw')} />
          {['', 'pending_review', 'approved', 'rejected'].map(key => (
            <AdminAppChip
              key={key || 'all'}
              label={key === '' ? 'ทั้งหมด' : STATUS_CFG[key]?.label || key}
              count={key === 'pending_review' && pendingCount > 0 ? pendingCount : undefined}
              active={statusFilter === key}
              onClick={() => onStatusFilter(key)}
            />
          ))}
        </>
      }
    >
      {loading ? (
        <div className="app-loading"><div className="mkt-spinner" /></div>
      ) : docs.length === 0 ? (
        <div className="app-empty"><p>ไม่มีข้อมูล</p></div>
      ) : (
        docs.map(d => {
          const st = STATUS_CFG[d.status] ?? { label: d.status, cls: 'bg-gray-100 text-gray-600' };
          return (
            <AdminAppCard
              key={d.id}
              title={d.user?.display_name || d.user_id}
              subtitle={kind === 'withdraw' ? [d.bank_name, d.bank_acct, d.bank_owner].filter(Boolean).join(' · ') : d.user?.phone}
              badges={
                <>
                  <span className={`admin-app-badge ${st.cls}`}>{st.label}</span>
                  <span className="admin-app-badge bg-blue-100 text-blue-700">{baht(d.amount)}</span>
                </>
              }
              meta={`แจ้ง ${fmtDate(d.created_at)}${d.status !== 'approved' && d.reject_reason ? ` · ${d.reject_reason}` : ''}`}
              actions={renderActions(d)}
            />
          );
        })
      )}
    </AdminAppFrame>
  );
}
