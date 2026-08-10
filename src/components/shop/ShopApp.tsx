'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import {
  SubPageApp,
  AppSegment,
  AppList,
  AppListRow,
  AppLoading,
  AppEmpty,
} from '@/components/mobile';

interface ShopData {
  id: string;
  shopName: string;
  shopTagline: string;
  shopLocation: string;
  shopAddress: string;
  shopAvatarFileId: string;
  shopBannerFileId: string;
  reviewScore: number;
  reviewCount: number;
}

interface ShopPublicStats {
  listingCount: number;
  soldCount: number;
  reviewScore: number;
  reviewCount: number;
}

interface Listing {
  id: string;
  title: string;
  price: number;
  condition?: string;
  images?: string[];
  deal_type?: string;
}

export type ShopAppProps = {
  loading?: boolean;
  error?: string;
  shop: ShopData | null;
  stats: ShopPublicStats | null;
  listings: Listing[];
  sold: Listing[];
  imgUrl: (id: string) => string;
};

function stars(score: number) {
  const full = Math.round(score);
  return '★'.repeat(Math.min(5, full)) + '☆'.repeat(Math.max(0, 5 - full));
}

type Tab = 'active' | 'sold';

export function ShopApp({ loading, error, shop, stats, listings, sold, imgUrl }: ShopAppProps) {
  const [tab, setTab] = useState<Tab>('active');

  if (loading) {
    return (
      <SubPageApp title="หน้าร้าน" backHref="/marketplace">
        <AppLoading />
      </SubPageApp>
    );
  }

  if (error || !shop || !stats) {
    return (
      <SubPageApp title="หน้าร้าน" backHref="/marketplace">
        <AppEmpty>{error || 'ไม่พบร้าน'}</AppEmpty>
      </SubPageApp>
    );
  }

  const bannerSrc = shop.shopBannerFileId ? imgUrl(shop.shopBannerFileId) : '';
  const avatarSrc = shop.shopAvatarFileId ? imgUrl(shop.shopAvatarFileId) : '';
  const items = tab === 'active' ? listings : sold;

  return (
    <SubPageApp title={shop.shopName} backHref="/marketplace">
      <div className="shop-app-sign">
        <div className="shop-app-banner" style={bannerSrc ? { backgroundImage: `url(${bannerSrc})` } : undefined}>
          {!bannerSrc && <div className="shop-app-banner-fallback" />}
        </div>
        <div className="shop-app-body">
          <div className="shop-app-avatar-wrap">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="shop-app-avatar" />
            ) : (
              <div className="shop-app-avatar shop-app-avatar--empty">🏪</div>
            )}
          </div>
          <div className="shop-app-info">
            <h2 className="shop-app-name">{shop.shopName}</h2>
            {shop.shopTagline && <p className="shop-app-tag">{shop.shopTagline}</p>}
            {shop.shopLocation && <p className="shop-app-loc">📍 {shop.shopLocation}</p>}
            {shop.shopAddress && <p className="shop-app-addr">{shop.shopAddress}</p>}
          </div>
        </div>
        <div className="shop-app-stats">
          <div><strong>{stats.listingCount}</strong><span>สินค้าในร้าน</span></div>
          <div><strong>{stats.soldCount}</strong><span>ขายแล้ว</span></div>
          <div>
            <strong>{stats.reviewScore > 0 ? stats.reviewScore.toFixed(1) : '—'}</strong>
            <span>{stats.reviewCount > 0 ? `${stars(stats.reviewScore)} (${stats.reviewCount})` : 'ยังไม่มีรีวิว'}</span>
          </div>
        </div>
      </div>

      <AppSegment
        items={[
          { id: 'active' as Tab, label: `ในร้าน (${listings.length})` },
          { id: 'sold' as Tab, label: `ขายแล้ว (${sold.length})` },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel="มุมมองสินค้า"
        columns={2}
      />

      {items.length === 0 ? (
        <AppEmpty>{tab === 'active' ? 'ยังไม่มีสินค้าในร้าน' : 'ยังไม่มีสินค้าที่ขายแล้ว'}</AppEmpty>
      ) : (
        <AppList>
          {items.map(item => {
            const thumb = item.images?.[0] ? imgUrl(item.images[0]) : '';
            if (tab === 'sold') {
              return (
                <li key={item.id}>
                  <div className="app-row shop-app-row--sold">
                    <div className="app-thumb">
                      {thumb ? <img src={thumb} alt="" loading="lazy" /> : <Icon name="package" size={28} />}
                      <span className="shop-app-badge shop-app-badge--sold">ขายแล้ว</span>
                    </div>
                    <div className="app-row-body">
                      <div className="app-row-price">฿{(item.price || 0).toLocaleString()}</div>
                      <h3 className="app-row-title">{item.title}</h3>
                      {item.condition && <div className="app-row-meta">{item.condition}</div>}
                    </div>
                  </div>
                </li>
              );
            }
            return (
              <AppListRow
                key={item.id}
                href={`/marketplace/${item.id}`}
                title={item.title}
                price={`฿${(item.price || 0).toLocaleString()}`}
                thumbSrc={thumb || undefined}
                thumbFallback={<Icon name="package" size={28} />}
                variant={item.deal_type === 'auction' ? 'auction' : 'default'}
                badge={item.deal_type === 'auction' ? <span className="shop-app-badge shop-app-badge--auction">ประมูล</span> : undefined}
                meta={item.condition ? <span>{item.condition}</span> : undefined}
              />
            );
          })}
        </AppList>
      )}
    </SubPageApp>
  );
}

export default ShopApp;
