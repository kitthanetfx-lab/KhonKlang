'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { AdminAppCard, AdminAppChip, AdminAppFrame } from './AdminAppFrame';
import type { AdminDealCategory } from '@/lib/adminDealCategory';

type Tab = { k: string; label: string };
type Category = { k: AdminDealCategory; label: string; desc?: string };

type Props = {
  category: AdminDealCategory;
  tab: string;
  counts: Record<string, number>;
  categories: Category[];
  tabs: Tab[];
  activeCategoryDesc?: string;
  isLoading: boolean;
  isEmpty: boolean;
  onCategoryChange: (c: AdminDealCategory) => void;
  onTabChange: (t: string) => void;
  children: ReactNode;
};

export function AdminDealsApp({
  category, tab, counts, categories, tabs, activeCategoryDesc,
  isLoading, isEmpty, onCategoryChange, onTabChange, children,
}: Props) {
  return (
    <AdminAppFrame
      title="ดีล & ข้อพิพาท"
      subtitle="แยกหมวดดีล — ประกาศที่ยังไม่เริ่มซื้อขายจะไม่แสดง"
      filters={
        <>
          <div className="admin-app-stats">
            {categories.map(c => (
              <AdminAppChip
                key={c.k}
                label={c.label}
                active={category === c.k}
                onClick={() => onCategoryChange(c.k)}
              />
            ))}
          </div>
          {activeCategoryDesc && <p className="text-xs text-gray-500 -mt-1 mb-1">{activeCategoryDesc}</p>}
          <div className="admin-app-stats">
            {tabs.map(t => (
              <AdminAppChip
                key={t.k}
                label={t.label}
                count={(counts[t.k] ?? 0) > 0 ? counts[t.k] : undefined}
                active={tab === t.k}
                onClick={() => onTabChange(t.k)}
              />
            ))}
          </div>
        </>
      }
    >
      {isLoading ? (
        <div className="app-loading"><div className="mkt-spinner" /></div>
      ) : isEmpty ? (
        <div className="app-empty"><p>ไม่มีรายการในหมวดนี้</p></div>
      ) : (
        children
      )}
    </AdminAppFrame>
  );
}

export function AdminDealCompactCard({
  code, title, statusLabel, statusCls, price, subtitle, href, actions,
}: {
  code?: string;
  title: string;
  statusLabel: string;
  statusCls: string;
  price?: string;
  subtitle?: string;
  href?: string;
  actions?: ReactNode;
}) {
  return (
    <AdminAppCard
      title={
        <span className="flex flex-wrap items-center gap-1.5">
          {code && <span className="font-mono text-xs text-gray-400">{code}</span>}
          <span>{title}</span>
        </span>
      }
      subtitle={subtitle}
      badges={
        <>
          <span className={`admin-app-badge ${statusCls}`}>{statusLabel}</span>
          {price && <span className="admin-app-badge bg-green-100 text-green-700">{price}</span>}
        </>
      }
      meta={href ? (
        <Link href={href} target="_blank" className="text-blue-600 text-xs font-semibold">เปิดดีล →</Link>
      ) : undefined}
      actions={actions}
    />
  );
}
