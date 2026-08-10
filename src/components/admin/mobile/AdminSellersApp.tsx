'use client';

import { AdminAppCard, AdminAppChip, AdminAppFrame, AdminAppSearch } from './AdminAppFrame';

export type SellerRow = {
  id: string;
  full_name_id: string;
  seller_type: string;
  province?: string;
  status: string;
  created_at: string;
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending_review: { label: 'รอตรวจสอบ', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'อนุมัติแล้ว', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'ปฏิเสธ', cls: 'bg-red-100 text-red-700' },
};

const SELLER_TYPE_LABEL: Record<string, string> = {
  freelance: 'ผู้ค้าอิสระ', physical: 'มีหน้าร้าน', distributor: 'ตัวแทนจำหน่าย', corporate: 'บริษัท',
};

const STATUS_TABS = [
  { key: '', label: 'ทั้งหมด' },
  { key: 'pending_review', label: 'รอตรวจ' },
  { key: 'approved', label: 'อนุมัติ' },
  { key: 'rejected', label: 'ปฏิเสธ' },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

type Props = {
  apps: SellerRow[];
  loading: boolean;
  search: string;
  statusFilter: string;
  pendingCount: number;
  onSearch: (v: string) => void;
  onStatusFilter: (s: string) => void;
  onRefresh: () => void;
  onSelect: (a: SellerRow) => void;
  renderActions?: (a: SellerRow) => React.ReactNode;
};

export function AdminSellersApp({
  apps, loading, search, statusFilter, pendingCount, onSearch, onStatusFilter, onRefresh, onSelect, renderActions,
}: Props) {
  const filtered = apps.filter(a => {
    const q = search.toLowerCase();
    if (!q) return true;
    return a.full_name_id.toLowerCase().includes(q) || (a.province || '').toLowerCase().includes(q);
  });

  return (
    <AdminAppFrame
      title="ใบสมัครผู้ขาย"
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
          return (
            <AdminAppCard
              key={a.id}
              title={a.full_name_id}
              subtitle={`${SELLER_TYPE_LABEL[a.seller_type] ?? a.seller_type} · ${a.province || '—'}`}
              badges={<span className={`admin-app-badge ${st.cls}`}>{st.label}</span>}
              meta={`สมัคร ${fmtDate(a.created_at)}`}
              onClick={() => onSelect(a)}
              actions={renderActions?.(a)}
            />
          );
        })
      )}
    </AdminAppFrame>
  );
}
