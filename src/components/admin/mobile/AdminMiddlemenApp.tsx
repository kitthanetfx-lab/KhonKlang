'use client';

import { AdminAppCard, AdminAppChip, AdminAppFrame, AdminAppSearch } from './AdminAppFrame';

export type MiddlemanRow = {
  id: string;
  full_name_id: string;
  work_province?: string;
  status: string;
  created_at: string;
  wallet?: { tier: string; available_credit: number; held_credit: number; credit_limit: number } | null;
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending_review: { label: 'รอตรวจสอบ', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'อนุมัติแล้ว', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'ปฏิเสธ', cls: 'bg-red-100 text-red-700' },
};

const STATUS_TABS = [
  { key: '', label: 'ทั้งหมด' },
  { key: 'pending_review', label: 'รอตรวจ' },
  { key: 'approved', label: 'อนุมัติ' },
  { key: 'rejected', label: 'ปฏิเสธ' },
];

const TIER_ICON: Record<string, string> = { Bronze: '🥉', Silver: '🥈', Gold: '🥇', Platinum: '💎' };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}
function baht(n: number) { return `฿${Number(n || 0).toLocaleString()}`; }

type Props = {
  apps: MiddlemanRow[];
  loading: boolean;
  search: string;
  statusFilter: string;
  pendingCount: number;
  onSearch: (v: string) => void;
  onStatusFilter: (s: string) => void;
  onRefresh: () => void;
  onSelect: (a: MiddlemanRow) => void;
  renderActions?: (a: MiddlemanRow) => React.ReactNode;
};

export function AdminMiddlemenApp({
  apps, loading, search, statusFilter, pendingCount, onSearch, onStatusFilter, onRefresh, onSelect, renderActions,
}: Props) {
  const filtered = apps.filter(a => {
    const q = search.toLowerCase();
    if (!q) return true;
    return a.full_name_id.toLowerCase().includes(q) || (a.work_province || '').toLowerCase().includes(q);
  });

  return (
    <AdminAppFrame
      title="ใบสมัครคนกลาง"
      subtitle={`${apps.length} รายการ`}
      onRefresh={onRefresh}
      refreshing={loading}
      search={<AdminAppSearch value={search} onChange={onSearch} placeholder="ค้นหาชื่อหรือจังหวัด…" />}
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
      ) : filtered.length === 0 ? (
        <div className="app-empty"><p>ไม่มีข้อมูล</p></div>
      ) : (
        filtered.map(a => {
          const st = STATUS_CFG[a.status] ?? { label: a.status, cls: 'bg-gray-100 text-gray-600' };
          const tier = a.wallet?.tier || 'Bronze';
          return (
            <AdminAppCard
              key={a.id}
              title={a.full_name_id}
              subtitle={`${a.work_province || '—'} · ${TIER_ICON[tier] || ''} ${tier}`}
              badges={
                <>
                  <span className={`admin-app-badge ${st.cls}`}>{st.label}</span>
                  {a.wallet && (
                    <span className="admin-app-badge bg-blue-100 text-blue-700">
                      เครดิต {baht(a.wallet.available_credit)}
                    </span>
                  )}
                </>
              }
              meta={`สมัคร ${fmtDate(a.created_at)}${a.wallet ? ` · ประกัน ${baht(a.wallet.credit_limit)}` : ''}`}
              onClick={() => onSelect(a)}
              actions={renderActions?.(a)}
            />
          );
        })
      )}
    </AdminAppFrame>
  );
}
