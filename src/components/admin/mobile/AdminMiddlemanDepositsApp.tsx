'use client';

import { AdminAppCard, AdminAppChip, AdminAppFrame } from './AdminAppFrame';

export type DepositRow = {
  id: string;
  middleman_id: string;
  amount: number;
  slip_file_id?: string;
  status: string;
  reject_reason?: string;
  created_at: string;
  middleman: { display_name?: string; phone?: string; middleman_tier?: string } | null;
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending_review: { label: 'รอตรวจสอบ', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'อนุมัติแล้ว', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'ปฏิเสธ', cls: 'bg-red-100 text-red-700' },
};

const STATUS_TABS = [
  { key: '', label: 'ทั้งหมด' },
  { key: 'pending_review', label: 'รอตรวจสอบ' },
  { key: 'approved', label: 'อนุมัติ' },
  { key: 'rejected', label: 'ปฏิเสธ' },
];

function baht(n: number) { return `฿${Number(n || 0).toLocaleString()}`; }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

type Props = {
  docs: DepositRow[];
  loading: boolean;
  statusFilter: string;
  pendingCount: number;
  onStatusFilter: (s: string) => void;
  onRefresh: () => void;
  renderActions: (d: DepositRow) => React.ReactNode;
};

export function AdminMiddlemanDepositsApp({
  docs, loading, statusFilter, pendingCount, onStatusFilter, onRefresh, renderActions,
}: Props) {
  return (
    <AdminAppFrame
      title="เงินค้ำประกันคนกลาง"
      subtitle="ตรวจสอบและอนุมัติเงินค้ำประกัน"
      onRefresh={onRefresh}
      refreshing={loading}
      stats={
        <>
          {STATUS_TABS.map(t => (
            <AdminAppChip
              key={t.key}
              label={t.label}
              count={t.key === 'pending_review' && pendingCount > 0 ? pendingCount : undefined}
              active={statusFilter === t.key}
              onClick={() => onStatusFilter(t.key)}
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
              title={d.middleman?.display_name || d.middleman_id}
              subtitle={[d.middleman?.phone, d.middleman?.middleman_tier].filter(Boolean).join(' · ') || undefined}
              badges={
                <>
                  <span className={`admin-app-badge ${st.cls}`}>{st.label}</span>
                  <span className="admin-app-badge bg-blue-100 text-blue-700">{baht(d.amount)}</span>
                </>
              }
              meta={`แจ้ง ${fmtDate(d.created_at)}${d.reject_reason ? ` · ${d.reject_reason}` : ''}`}
              actions={renderActions(d)}
            />
          );
        })
      )}
    </AdminAppFrame>
  );
}
