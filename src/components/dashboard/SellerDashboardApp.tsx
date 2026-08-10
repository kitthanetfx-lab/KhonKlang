'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AppPage } from '@/components/mobile/AppPage';
import { AppHeader } from '@/components/mobile/AppHeader';
import { AppFeed } from '@/components/mobile/AppStates';
import { AppSegment } from '@/components/mobile/AppSegment';
import { Icon } from '@/components/Icon';

type TabId = 'selling' | 'packing' | 'shipping' | 'done' | 'history';

type TabItem = { id: TabId; label: string };

type ShopStats = {
  listingCount: number;
  soldCount: number;
  reviewScore: number;
  reviewCount: number;
} | null;

type Props = {
  tab: TabId;
  tabs: TabItem[];
  onTabChange: (tab: TabId) => void;
  onPost: () => void;
  shopName: string;
  shopTagline: string;
  shopLocation: string;
  shopAvatarUrl: string;
  shopBannerUrl: string;
  shopPublic: boolean;
  myId: string;
  shopStats: ShopStats;
  stats: { packing: number; shipping: number; done: number; revenue: number };
  children: ReactNode;
};

function stars(score: number) {
  const full = Math.round(score);
  return '★'.repeat(Math.min(5, full)) + '☆'.repeat(Math.max(0, 5 - full));
}

export function SellerDashboardApp({
  tab,
  tabs,
  onTabChange,
  onBack,
  onPost,
  shopName,
  shopTagline,
  shopLocation,
  shopAvatarUrl,
  shopBannerUrl,
  shopPublic,
  myId,
  shopStats,
  stats,
  children,
}: Props) {
  return (
    <AppPage withBottomNav={false} className="dash-app dash-app--seller">
      <AppHeader
        title="ร้านของฉัน"
        backHref="/profile"
        right={
          <button type="button" className="btn btn-primary btn-sm" onClick={onPost}>+ ลงขาย</button>
        }
      />
      <AppFeed>
        <div className="dash-app-shop app-card">
          <div
            className="dash-app-shop-banner"
            style={shopBannerUrl ? { backgroundImage: `url(${shopBannerUrl})` } : undefined}
          />
          <div className="dash-app-shop-body">
            <div className="dash-app-shop-av">
              {shopAvatarUrl ? <img src={shopAvatarUrl} alt="" /> : '🏪'}
            </div>
            <div className="dash-app-shop-tx">
              <strong>{shopName || 'ตั้งชื่อร้านของคุณ'}</strong>
              {shopTagline && <span>{shopTagline}</span>}
              {shopLocation && <span>📍 {shopLocation}</span>}
            </div>
            {shopPublic && shopName && myId && (
              <Link href={`/shop/${myId}`} className="btn btn-ghost btn-sm" target="_blank">หน้าร้าน ↗</Link>
            )}
          </div>
          {shopStats && (
            <div className="dash-app-shop-stats">
              <div><b>{shopStats.listingCount}</b><span>สินค้า</span></div>
              <div><b>{shopStats.soldCount}</b><span>ขายแล้ว</span></div>
              <div><b>{shopStats.reviewScore > 0 ? shopStats.reviewScore.toFixed(1) : '—'}</b><span>{shopStats.reviewCount > 0 ? stars(shopStats.reviewScore) : 'รีวิว'}</span></div>
            </div>
          )}
        </div>

        <div className="dash-app-mini-stats">
          <div><b>{stats.packing}</b><span>รอแพค</span></div>
          <div><b>{stats.shipping}</b><span>กำลังส่ง</span></div>
          <div><b>{stats.done}</b><span>สำเร็จ</span></div>
          <div><b>฿{stats.revenue.toLocaleString()}</b><span>รายได้</span></div>
        </div>

        <AppSegment items={tabs} value={tab} onChange={onTabChange} ariaLabel="แท็บร้านค้า" columns={2} />
        <div className="dash-app-panel">{children}</div>
      </AppFeed>
    </AppPage>
  );
}

export default SellerDashboardApp;
