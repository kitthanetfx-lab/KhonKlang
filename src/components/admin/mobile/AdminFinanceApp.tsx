'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { AdminAppCard, AdminAppChip, AdminAppFrame, AdminAppSearch, AdminAppSection } from './AdminAppFrame';

export type FinanceTab = 'incoming' | 'outgoing' | 'summary';

export type FinanceGroupRow = {
  key: string;
  referenceCode: string;
  title: string;
  buyerName?: string;
  sellerName?: string;
  middlemanName?: string;
  dealStatus?: string;
  price?: number;
  feeAmount: number;
  totalExpected: number;
  hasSlip: boolean;
  detailUrl: string;
  sources: string[];
  rows: unknown[];
};

export type FinanceSummary = {
  incomingCount: number;
  escrowPendingCount: number;
  heldEscrow: number;
  heldMeetupDeposit: number;
  completedVolume: number;
  completedCount: number;
  estRevenue: number;
  outgoingCount?: number;
  pendingPayoutAmount?: number;
  pendingRefundAmount?: number;
};

const baht = (n: number) => '฿' + Math.round(n || 0).toLocaleString();

const SOURCE_BADGE: Record<string, string> = {
  escrow: 'bg-blue-100 text-blue-700',
  meetup: 'bg-violet-100 text-violet-700',
  seller_app: 'bg-green-100 text-green-700',
  middleman_app: 'bg-emerald-100 text-emerald-700',
  payout: 'bg-rose-100 text-rose-700',
  refund: 'bg-orange-100 text-orange-700',
};

type Props = {
  tab: FinanceTab;
  filter: string;
  search: string;
  loading: boolean;
  summary: FinanceSummary | null;
  groups: FinanceGroupRow[];
  page: number;
  pageCount: number;
  hasNext: boolean;
  filters: { k: string; label: string }[];
  onTab: (t: FinanceTab) => void;
  onFilter: (f: string) => void;
  onSearch: (v: string) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSelectGroup: (g: FinanceGroupRow) => void;
  detailPanel?: ReactNode;
};

export function AdminFinanceApp({
  tab, filter, search, loading, summary, groups, page, pageCount, hasNext, filters,
  onTab, onFilter, onSearch, onRefresh, refreshing, onPrevPage, onNextPage, onSelectGroup, detailPanel,
}: Props) {
  return (
    <>
      <AdminAppFrame
        title="การเงิน"
        subtitle={tab === 'summary' ? 'ภาพรวมการเงิน' : tab === 'incoming' ? 'เงินเข้า' : 'เงินออก'}
        onRefresh={onRefresh}
        refreshing={refreshing || loading}
        search={tab !== 'summary' ? (
          <AdminAppSearch value={search} onChange={onSearch} placeholder="ค้นหาเลขดีล, ชื่อ…" />
        ) : undefined}
        filters={
          <div className="admin-app-tabs">
            <button type="button" className={`admin-app-tab${tab === 'incoming' ? ' is-on' : ''}`} onClick={() => onTab('incoming')}>
              เงินเข้า{summary ? ` (${summary.incomingCount})` : ''}
            </button>
            <button type="button" className={`admin-app-tab${tab === 'outgoing' ? ' is-on' : ''}`} onClick={() => onTab('outgoing')}>
              เงินออก{summary?.outgoingCount != null ? ` (${summary.outgoingCount})` : ''}
            </button>
            <button type="button" className={`admin-app-tab${tab === 'summary' ? ' is-on' : ''}`} onClick={() => onTab('summary')}>
              ภาพรวม
            </button>
          </div>
        }
        stats={tab !== 'summary' ? (
          <>
            {filters.map(f => (
              <AdminAppChip key={f.k} label={f.label} active={filter === f.k} onClick={() => onFilter(f.k)} />
            ))}
          </>
        ) : undefined}
      >
        {tab === 'summary' && summary && (
          <AdminAppSection title="สรุป">
            <div className="admin-app-stat-grid">
              <div className="admin-app-stat-tile">
                <div className="admin-app-stat-val">{summary.incomingCount}</div>
                <div className="admin-app-stat-lbl">รอตรวจ</div>
                <div className="admin-app-stat-sub">ค่าสินค้า {summary.escrowPendingCount}</div>
              </div>
              <div className="admin-app-stat-tile">
                <div className="admin-app-stat-val">{baht(summary.heldEscrow)}</div>
                <div className="admin-app-stat-lbl">Escrow</div>
              </div>
              <div className="admin-app-stat-tile">
                <div className="admin-app-stat-val">{baht(summary.heldMeetupDeposit)}</div>
                <div className="admin-app-stat-lbl">เงินประกัน</div>
              </div>
              <div className="admin-app-stat-tile">
                <div className="admin-app-stat-val">{baht(summary.completedVolume)}</div>
                <div className="admin-app-stat-lbl">ยอดสำเร็จ</div>
                <div className="admin-app-stat-sub">{summary.completedCount} ดีล</div>
              </div>
              <div className="admin-app-stat-tile">
                <div className="admin-app-stat-val">{baht(summary.estRevenue)}</div>
                <div className="admin-app-stat-lbl">รายได้ประมาณ</div>
              </div>
              <div className="admin-app-stat-tile">
                <div className="admin-app-stat-val">{baht(summary.pendingPayoutAmount || 0)}</div>
                <div className="admin-app-stat-lbl">รอโอนผู้ขาย</div>
              </div>
            </div>
          </AdminAppSection>
        )}

        {tab !== 'summary' && (
          loading ? (
            <div className="app-loading"><div className="mkt-spinner" /></div>
          ) : groups.length === 0 ? (
            <div className="app-empty"><p>ไม่มีรายการ</p></div>
          ) : (
            groups.map(g => (
              <AdminAppCard
                key={g.key}
                title={g.title}
                subtitle={`${g.referenceCode} · ${g.buyerName || '-'} → ${g.sellerName || '-'}`}
                badges={
                  <>
                    {g.sources.slice(0, 2).map(s => (
                      <span key={s} className={`admin-app-badge ${SOURCE_BADGE[s] || 'bg-gray-100 text-gray-600'}`}>{s}</span>
                    ))}
                    <span className="admin-app-badge bg-green-100 text-green-700">{baht(g.totalExpected)}</span>
                  </>
                }
                meta={`${g.dealStatus || '-'} · สลิป ${g.hasSlip ? 'มี' : '-'}`}
                onClick={() => onSelectGroup(g)}
              />
            ))
          )
        )}

        {tab !== 'summary' && groups.length > 0 && (
          <div className="flex items-center justify-between gap-2 mt-2 text-sm text-gray-500">
            <button type="button" className="admin-app-chip" disabled={page <= 1} onClick={onPrevPage}>← ก่อน</button>
            <span>{page}/{pageCount}</span>
            <button type="button" className="admin-app-chip" disabled={!hasNext} onClick={onNextPage}>ถัดไป →</button>
          </div>
        )}
      </AdminAppFrame>
      {detailPanel}
    </>
  );
}

export function AdminFinanceDetailSheet({
  open, title, subtitle, onClose, children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="admin-app-sheet" role="dialog" aria-modal="true">
      <button type="button" className="admin-app-sheet-backdrop" aria-label="ปิด" onClick={onClose} />
      <div className="admin-app-sheet-panel">
        <h2 className="admin-app-sheet-title">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mb-3">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export function AdminFinanceDetailLink({ href }: { href: string }) {
  return (
    <Link href={href} target="_blank" className="inline-flex items-center gap-1 text-sm text-blue-600 font-semibold mt-2">
      เปิดหน้าจริง →
    </Link>
  );
}
