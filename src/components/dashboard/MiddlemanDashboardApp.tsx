'use client';

import type { ReactNode } from 'react';
import { AppPage } from '@/components/mobile/AppPage';
import { AppHeader } from '@/components/mobile/AppHeader';
import { AppFeed } from '@/components/mobile/AppStates';
import { AppSegment } from '@/components/mobile/AppSegment';

type TabId = 'active' | 'history';

type Props = {
  tab: TabId;
  onTabChange: (tab: TabId) => void;
  onRefresh: () => void;
  refreshing: boolean;
  tier: string;
  tierColor: string;
  tierBg: string;
  confirmedTotal: number;
  baht: (n: number) => string;
  activeCount: number;
  historyCount: number;
  walletSummary?: ReactNode;
  depositSummary?: ReactNode;
  infoBanner?: ReactNode;
  ledgerSummary?: ReactNode;
  children: ReactNode;
};

export function MiddlemanDashboardApp({
  tab,
  onTabChange,
  onRefresh,
  refreshing,
  tier,
  tierColor,
  tierBg,
  confirmedTotal,
  baht,
  activeCount,
  historyCount,
  walletSummary,
  depositSummary,
  infoBanner,
  ledgerSummary,
  children,
}: Props) {
  return (
    <AppPage withBottomNav={false} className="dash-app dash-app--middleman" accent="default">
      <AppHeader
        title="บอร์ดคนกลาง"
        backHref="/profile"
        right={
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? '...' : '🔄'}
          </button>
        }
      />
      <AppFeed>
        <div className="dash-app-tier app-card" style={{ background: tierBg }}>
          <div>
            <div className="dash-app-tier-name" style={{ color: tierColor }}>{tier}</div>
            <div className="dash-app-tier-sub">ระดับคนกลางของคุณ</div>
          </div>
          <div className="dash-app-tier-val" style={{ color: tierColor }}>{baht(confirmedTotal)}</div>
        </div>

        {depositSummary}
        {walletSummary}
        {infoBanner}
        {ledgerSummary}

        <AppSegment
          items={[
            { id: 'active', label: `กำลังดีล (${activeCount})` },
            { id: 'history', label: `ประวัติ (${historyCount})` },
          ]}
          value={tab}
          onChange={onTabChange}
          ariaLabel="แท็บดีลคนกลาง"
          columns={2}
        />
        <div className="dash-app-panel">{children}</div>
      </AppFeed>
    </AppPage>
  );
}

export default MiddlemanDashboardApp;
