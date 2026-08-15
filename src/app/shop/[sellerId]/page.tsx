'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { SubPageHeader } from '@/components/mobile/SubPageHeader';

const imgUrl = (id: string) => fileViewUrl(DEAL_BUCKET, id);

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
  location?: string;
  images?: string[];
  deal_type?: string;
  status?: string;
}

function stars(score: number) {
  const full = Math.round(score);
  return '★'.repeat(Math.min(5, full)) + '☆'.repeat(Math.max(0, 5 - full));
}

export default function PublicShopPage() {
  const params = useParams();
  const sellerId = String(params.sellerId || '');
  const [shop, setShop] = useState<ShopData | null>(null);
  const [stats, setStats] = useState<ShopPublicStats | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [sold, setSold] = useState<Listing[]>([]);
  const [shopZone, setShopZone] = useState<'listing' | 'auction'>('listing');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) return;
    fetch(`/api/shop/${sellerId}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'โหลดไม่สำเร็จ');
        setShop(d.shop);
        setStats(d.stats);
        setListings(d.listings || []);
        setSold(d.sold || []);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'โหลดไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, [sellerId]);

  if (loading) {
    return (
      <div className="sub-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'dashSpin .8s linear infinite' }} />
      </div>
    );
  }

  if (error || !shop || !stats) {
    return (
      <div className="sub-page">
        <SubPageHeader backHref="/marketplace" title="หน้าร้าน" titleIcon="store" />
        <div className="dash-empty" style={{ marginTop: 48 }}><p>{error || 'ไม่พบร้าน'}</p></div>
      </div>
    );
  }

  const bannerSrc = shop.shopBannerFileId ? imgUrl(shop.shopBannerFileId) : '';
  const avatarSrc = shop.shopAvatarFileId ? imgUrl(shop.shopAvatarFileId) : '';
  const saleListings = listings.filter(item => item.deal_type !== 'auction');
  const auctionListings = listings.filter(item => item.deal_type === 'auction');
  const visibleListings = shopZone === 'auction' ? auctionListings : saleListings;

  function renderListingCard(item: Listing) {
    const thumb = item.images?.[0] ? imgUrl(item.images[0]) : '';
    const isAuction = item.deal_type === 'auction';
    return (
      <Link
        key={item.id}
        href={`/marketplace/${item.id}`}
        className={`lc-card mkt-card${isAuction ? ' lc-card--auction' : ''}`}
      >
        <div className="lc-card-img-wrap">
          {thumb ? <img src={thumb} alt="" className="lc-card-img" /> : <div className="lc-card-img lc-card-img--empty">📦</div>}
          <span className={`shop-card-badge${isAuction ? ' shop-card-badge--auction' : ' shop-card-badge--listing'}`}>
            {isAuction ? '🔨 ประมูล' : '🛒 ขาย'}
          </span>
        </div>
        <div className="lc-card-body">
          <div className="lc-card-title">{item.title}</div>
          <div className="lc-card-price">฿{(item.price || 0).toLocaleString()}{isAuction ? ' เริ่ม' : ''}</div>
          {item.condition && <div className="lc-card-meta">{item.condition}</div>}
        </div>
      </Link>
    );
  }

  return (
    <div className="sub-page shop-public-page">
      <SubPageHeader backHref="/marketplace" title="หน้าร้าน" titleIcon="store" />

      <div className="shop-sign-card shop-sign-card--public">
        <div className="shop-sign-banner" style={bannerSrc ? { backgroundImage: `url(${bannerSrc})` } : undefined}>
          {!bannerSrc && <div className="shop-sign-banner-fallback" />}
        </div>
        <div className="shop-sign-body">
          <div className="shop-sign-avatar-wrap">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="shop-sign-avatar" />
            ) : (
              <div className="shop-sign-avatar shop-sign-avatar--empty">🏪</div>
            )}
          </div>
          <div className="shop-sign-info">
            <h1 className="shop-sign-name">{shop.shopName}</h1>
            {shop.shopTagline && <p className="shop-sign-tagline">{shop.shopTagline}</p>}
            {shop.shopLocation && <p className="shop-sign-loc">📍 {shop.shopLocation}</p>}
            {shop.shopAddress && <p className="shop-sign-addr">{shop.shopAddress}</p>}
          </div>
        </div>
        <div className="shop-sign-stats shop-sign-stats--public">
          <div className="shop-sign-stat"><span className="shop-sign-stat-val">{stats.listingCount}</span><span className="shop-sign-stat-lbl">สินค้าในร้าน</span></div>
          <div className="shop-sign-stat"><span className="shop-sign-stat-val">{stats.soldCount}</span><span className="shop-sign-stat-lbl">ขายแล้ว</span></div>
          <div className="shop-sign-stat shop-sign-stat--rating">
            <span className="shop-sign-stat-val">{stats.reviewScore > 0 ? stats.reviewScore.toFixed(1) : '—'}</span>
            <span className="shop-sign-stat-lbl">{stats.reviewCount > 0 ? `${stars(stats.reviewScore)} (${stats.reviewCount})` : 'ยังไม่มีรีวิว'}</span>
          </div>
        </div>
      </div>

      <section className="shop-listings-section">
        <div className="shop-listings-head">
          <h2 className="shop-listings-title">สินค้าในร้าน</h2>
          <div className="mkt-mode-tabs shop-zone-tabs" role="tablist" aria-label="ประเภทสินค้าในร้าน">
            <button
              type="button"
              role="tab"
              aria-selected={shopZone === 'listing'}
              className={`mkt-mode-tab mkt-mode-tab--listing${shopZone === 'listing' ? ' active' : ''}`}
              onClick={() => setShopZone('listing')}
            >
              <span className="mkt-mode-tab-ic">🛒</span>
              ขายสินค้า ({saleListings.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={shopZone === 'auction'}
              className={`mkt-mode-tab mkt-mode-tab--auction${shopZone === 'auction' ? ' active' : ''}`}
              onClick={() => setShopZone('auction')}
            >
              <span className="mkt-mode-tab-ic">🔨</span>
              ประมูล ({auctionListings.length})
            </button>
          </div>
        </div>
        {listings.length === 0 ? (
          <div className="dash-empty"><p>ยังไม่มีสินค้าในร้าน</p></div>
        ) : visibleListings.length === 0 ? (
          <div className="dash-empty">
            <p>{shopZone === 'auction' ? 'ยังไม่มีสินค้าประมูลในร้าน' : 'ยังไม่มีสินค้าขายปกติในร้าน'}</p>
            <button type="button" className="btn btn-soft btn-sm" style={{ marginTop: 12 }} onClick={() => setShopZone(shopZone === 'auction' ? 'listing' : 'auction')}>
              ดู{shopZone === 'auction' ? 'สินค้าขายปกติ' : 'สินค้าประมูล'}แทน
            </button>
          </div>
        ) : (
          <div className="mkt-grid shop-listings-grid">
            {visibleListings.map(renderListingCard)}
          </div>
        )}
      </section>

      <section className="shop-listings-section">
        <h2 className="shop-listings-title">ขายแล้ว ({sold.length})</h2>
        {sold.length === 0 ? (
          <div className="dash-empty"><p>ยังไม่มีสินค้าที่ขายแล้ว</p></div>
        ) : (
          <div className="mkt-grid shop-listings-grid">
            {sold.map(item => {
              const thumb = item.images?.[0] ? imgUrl(item.images[0]) : '';
              return (
                <div key={item.id} className="lc-card mkt-card shop-card--sold">
                  <div className="lc-card-img-wrap">
                    {thumb ? <img src={thumb} alt="" className="lc-card-img" /> : <div className="lc-card-img lc-card-img--empty">📦</div>}
                    <span className="shop-card-badge shop-card-badge--sold">ขายแล้ว</span>
                  </div>
                  <div className="lc-card-body">
                    <div className="lc-card-title">{item.title}</div>
                    <div className="lc-card-price">฿{(item.price || 0).toLocaleString()}</div>
                    {item.condition && <div className="lc-card-meta">{item.condition}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
