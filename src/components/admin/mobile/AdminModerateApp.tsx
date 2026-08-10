'use client';

import { AdminAppCard, AdminAppChip, AdminAppFrame } from './AdminAppFrame';

export type ModTab = 'wanted' | 'reviews' | 'listings';

type Props = {
  tab: ModTab;
  loading: boolean;
  onTab: (t: ModTab) => void;
  children: React.ReactNode;
};

const TABS: { k: ModTab; label: string }[] = [
  { k: 'wanted', label: 'ประกาศหา' },
  { k: 'reviews', label: 'รีวิว' },
  { k: 'listings', label: 'ตลาด' },
];

export function AdminModerateApp({ tab, loading, onTab, children }: Props) {
  return (
    <AdminAppFrame
      title="ตรวจสอบเนื้อหา"
      subtitle="ประกาศหา · รีวิว · ตลาด"
      stats={
        <>
          {TABS.map(t => (
            <AdminAppChip key={t.k} label={t.label} active={tab === t.k} onClick={() => onTab(t.k)} />
          ))}
        </>
      }
    >
      {loading ? (
        <div className="app-loading"><div className="mkt-spinner" /></div>
      ) : (
        children
      )}
    </AdminAppFrame>
  );
}

export function AdminModerateWantedCard({
  title, detail, userName, province, status, createdAt, actions,
}: {
  title: string; detail?: string; userName: string; province?: string; status: string; createdAt: string; actions?: React.ReactNode;
}) {
  return (
    <AdminAppCard
      title={title}
      subtitle={detail}
      badges={
        <span className={`admin-app-badge ${status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {status === 'open' ? 'เปิดอยู่' : 'ปิดแล้ว'}
        </span>
      }
      meta={`${province ? `📍 ${province} · ` : ''}โดย ${userName} · ${new Date(createdAt).toLocaleDateString('th-TH')}`}
      actions={actions}
    />
  );
}

export function AdminModerateReviewCard({
  rating, comment, reviewerName, reviewerRole, targetRole, createdAt, actions,
}: {
  rating: number; comment?: string; reviewerName: string; reviewerRole: string; targetRole: string; createdAt: string; actions?: React.ReactNode;
}) {
  return (
    <AdminAppCard
      title={'★'.repeat(rating) + '☆'.repeat(5 - rating)}
      subtitle={comment}
      badges={<span className="admin-app-badge bg-amber-100 text-amber-700">{reviewerRole} → {targetRole}</span>}
      meta={`โดย ${reviewerName} · ${new Date(createdAt).toLocaleDateString('th-TH')}`}
      actions={actions}
    />
  );
}

export function AdminModerateListingCard({
  title, price, sellerName, location, category, removed, createdAt, actions,
}: {
  title: string; price: number; sellerName?: string; location?: string; category?: string; removed: boolean; createdAt: string; actions?: React.ReactNode;
}) {
  return (
    <AdminAppCard
      title={title}
      subtitle={`฿${Number(price || 0).toLocaleString()} · ${category || '-'}`}
      badges={
        <span className={`admin-app-badge ${removed ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
          {removed ? 'ถอดแล้ว' : 'แสดงในตลาด'}
        </span>
      }
      meta={`${location ? `📍 ${location} · ` : ''}โดย ${sellerName || '-'} · ${new Date(createdAt).toLocaleDateString('th-TH')}`}
      actions={actions}
    />
  );
}

export function AdminModerateEmpty() {
  return <div className="app-empty"><p>ไม่มีรายการ</p></div>;
}
