'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { AuctionCountdown } from '@/components/AuctionCountdown';
import { isCertifiedMode } from '@/lib/listingMode';
import type { AuctionPublic, MyAuctionStatus } from '@/lib/auction';
import { MY_AUCTION_STATUS_LABEL } from '@/lib/auction';

export type MktZone = 'listing' | 'auction';

export interface MktListing {
  id: string;
  seller_id: string;
  seller_name: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  location: string;
  selling_mode: string;
  source?: string;
  deal_type?: string;
  images: string[];
  status: string;
  buyer_id: string;
  created_at: string;
  auction?: AuctionPublic;
  myAuctionStatus?: MyAuctionStatus;
}

type Props = {
  zone: MktZone;
  auctionView: 'all' | 'mine';
  myId: string;
  loading: boolean;
  items: MktListing[];
  cats: string[];
  provinces: string[];
  search: string;
  cat: string;
  province: string;
  certified: boolean;
  listingSort: string;
  auctionSort: string;
  imgUrl: (fileId: string) => string;
  onZone: (z: MktZone) => void;
  onAuctionView: (v: 'all' | 'mine') => void;
  onSearch: (v: string) => void;
  onCat: (v: string) => void;
  onProvince: (v: string) => void;
  onCertified: (v: boolean) => void;
  onListingSort: (v: string) => void;
  onAuctionSort: (v: string) => void;
  onClearFilters: () => void;
  myStatusMap: Map<string, MyAuctionStatus>;
};

/**
 * UI ตลาด/ประมูลแบบแอป — โครงแยกจากเดสก์ท็อปโดยสมบูรณ์
 * หลัก UI/UX: เป้าหมายชัด · เต็มจอ · progressive disclosure · เป้าหมายสัมผัสใหญ่
 */
export function MarketplaceApp({
  zone, auctionView, myId, loading, items,
  cats, provinces,
  search, cat, province, certified, listingSort, auctionSort,
  imgUrl, onZone, onAuctionView, onSearch, onCat, onProvince, onCertified,
  onListingSort, onAuctionSort, onClearFilters, myStatusMap,
}: Props) {
  const router = useRouter();
  const isAuction = zone === 'auction';
  const [filterOpen, setFilterOpen] = useState(false);

  const activeFilters =
    (cat !== 'ทั้งหมด' ? 1 : 0) +
    (province ? 1 : 0) +
    (!isAuction && certified ? 1 : 0);

  return (
    <div className={`mkt-app${isAuction ? ' mkt-app--auction' : ''}`}>
      <header className="mkt-app-top">
        <div className="mkt-app-zones" role="tablist" aria-label="โซนตลาด">
          <button
            type="button"
            role="tab"
            aria-selected={!isAuction}
            className={`mkt-app-zone${!isAuction ? ' is-on' : ''}`}
            onClick={() => onZone('listing')}
          >
            <Icon name="store" size={16} />
            ซื้อขาย
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isAuction}
            className={`mkt-app-zone mkt-app-zone--auction${isAuction ? ' is-on' : ''}`}
            onClick={() => onZone('auction')}
          >
            <span aria-hidden>🔨</span>
            ประมูล
          </button>
        </div>

        <form
          className="mkt-app-search"
          role="search"
          onSubmit={e => e.preventDefault()}
        >
          <Icon name="search" size={18} className="mkt-app-search-ic" />
          <input
            type="search"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder={isAuction ? 'ค้นหาประมูล…' : 'ค้นหาสินค้า…'}
            aria-label="ค้นหาสินค้า"
            enterKeyHint="search"
          />
          <button
            type="button"
            className={`mkt-app-filter-btn${activeFilters ? ' has-badge' : ''}`}
            onClick={() => setFilterOpen(true)}
            aria-label="ตัวกรอง"
          >
            <Icon name="filter" size={18} />
            {activeFilters > 0 && <span className="mkt-app-filter-badge">{activeFilters}</span>}
          </button>
        </form>

        {isAuction && (
          <div className="mkt-app-seg" role="tablist" aria-label="มุมมองประมูล">
            <button
              type="button"
              className={auctionView === 'all' ? 'is-on' : undefined}
              onClick={() => onAuctionView('all')}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              className={auctionView === 'mine' ? 'is-on' : undefined}
              onClick={() => {
                if (!myId) {
                  router.push(`/login?returnTo=${encodeURIComponent('/marketplace?zone=auction&view=mine')}`);
                  return;
                }
                onAuctionView('mine');
              }}
            >
              ของฉัน
            </button>
          </div>
        )}

        <div className="mkt-app-cats" role="tablist" aria-label="หมวดหมู่">
          {cats.map(c => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cat === c}
              className={`mkt-app-cat${cat === c ? ' is-on' : ''}`}
              onClick={() => onCat(c)}
            >
              {c === 'ทั้งหมด' ? 'ทั้งหมด' : c}
            </button>
          ))}
        </div>
      </header>

      <main className="mkt-app-feed">
        <div className="mkt-app-count">
          {loading ? 'กำลังโหลด…' : `${items.length} รายการ`}
        </div>

        {loading ? (
          <div className="mkt-app-loading"><div className="mkt-spinner" /></div>
        ) : items.length === 0 ? (
          <div className="mkt-app-empty">
            <p>
              {isAuction && auctionView === 'mine'
                ? 'ยังไม่มีรายการที่คุณเคย bid'
                : isAuction ? 'ยังไม่มีรายการประมูล' : 'ไม่พบสินค้า'}
            </p>
            <button type="button" className="btn btn-soft btn-sm" onClick={onClearFilters}>
              ล้างตัวกรอง
            </button>
          </div>
        ) : (
          <ul className="mkt-app-list">
            {items.map(item => (
              isAuction && item.auction
                ? <AppAuctionRow key={item.id} listing={item} imgUrl={imgUrl} status={item.myAuctionStatus ?? myStatusMap.get(item.id)} />
                : <AppListingRow key={item.id} listing={item} imgUrl={imgUrl} />
            ))}
          </ul>
        )}
      </main>

      {filterOpen && (
        <div className="mkt-app-sheet" role="dialog" aria-modal="true" aria-label="ตัวกรอง">
          <button type="button" className="mkt-app-sheet-backdrop" aria-label="ปิด" onClick={() => setFilterOpen(false)} />
          <div className="mkt-app-sheet-panel">
            <div className="mkt-app-sheet-handle" />
            <h2 className="mkt-app-sheet-title">ตัวกรอง</h2>

            <label className="mkt-app-field">
              <span>จังหวัด</span>
              <select value={province} onChange={e => onProvince(e.target.value)}>
                <option value="">ทุกจังหวัด</option>
                {provinces.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            <label className="mkt-app-field">
              <span>เรียงลำดับ</span>
              <select
                value={isAuction ? auctionSort : listingSort}
                onChange={e => isAuction ? onAuctionSort(e.target.value) : onListingSort(e.target.value)}
              >
                {(isAuction
                  ? ['ปิดเร็วสุด', 'ราคา: น้อย→มาก', 'ราคา: มาก→น้อย', 'ล่าสุด']
                  : ['ล่าสุด', 'ราคา: น้อย→มาก', 'ราคา: มาก→น้อย']
                ).map(s => <option key={s}>{s}</option>)}
              </select>
            </label>

            {!isAuction && (
              <button
                type="button"
                className={`mkt-app-toggle${certified ? ' is-on' : ''}`}
                aria-pressed={certified}
                onClick={() => onCertified(!certified)}
              >
                ⭐ เฉพาะ Certified
              </button>
            )}

            <div className="mkt-app-sheet-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { onClearFilters(); }}>
                ล้าง
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setFilterOpen(false)}>
                ดูผลลัพธ์
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AppListingRow({ listing, imgUrl }: { listing: MktListing; imgUrl: (id: string) => string }) {
  const first = listing.images?.[0] ? imgUrl(listing.images[0]) : '';
  const certified = isCertifiedMode(listing.selling_mode);
  return (
    <li>
      <Link href={`/marketplace/${listing.id}`} className="mkt-app-row">
        <div className="mkt-app-thumb" style={!first ? { background: 'linear-gradient(135deg,#eef4ff,#dbeafe)' } : undefined}>
          {first ? <img src={first} alt="" loading="lazy" /> : <Icon name="package" size={28} />}
        </div>
        <div className="mkt-app-row-body">
          <div className="mkt-app-row-price">฿{(listing.price || 0).toLocaleString()}</div>
          <h3 className="mkt-app-row-title">{listing.title}</h3>
          <div className="mkt-app-row-meta">
            {certified && <span className="mkt-app-chip">Certified</span>}
            {listing.location && <span>{listing.location}</span>}
            {listing.condition && <span>{listing.condition}</span>}
          </div>
        </div>
        <Icon name="chevronRight" size={18} className="mkt-app-chevron" />
      </Link>
    </li>
  );
}

function AppAuctionRow({
  listing, imgUrl, status,
}: {
  listing: MktListing;
  imgUrl: (id: string) => string;
  status?: MyAuctionStatus;
}) {
  const a = listing.auction!;
  const first = listing.images?.[0] ? imgUrl(listing.images[0]) : '';
  return (
    <li>
      <Link href={`/marketplace/${listing.id}`} className="mkt-app-row mkt-app-row--auction">
        <div className="mkt-app-thumb" style={!first ? { background: 'linear-gradient(135deg,#f5f3ff,#ddd6fe)' } : undefined}>
          {first ? <img src={first} alt="" loading="lazy" /> : <span style={{ fontSize: 28 }}>🔨</span>}
          {status && (
            <span className={`mkt-app-status mkt-app-status--${status}`}>
              {MY_AUCTION_STATUS_LABEL[status]}
            </span>
          )}
        </div>
        <div className="mkt-app-row-body">
          <h3 className="mkt-app-row-title">{listing.title}</h3>
          <div className="mkt-app-row-price mkt-app-row-price--auction">
            ฿{a.leadingPrice.toLocaleString()}
            <span className="mkt-app-row-price-lbl">{a.bidCount > 0 ? 'ปัจจุบัน' : 'เริ่ม'}</span>
          </div>
          <div className="mkt-app-row-meta mkt-app-row-meta--auction">
            {a.phase === 'live' ? (
              <AuctionCountdown endsAt={a.endsAt} endedAt={a.endedAt} variant="card" liveClassName="is-live" />
            ) : (
              <span>ปิดแล้ว</span>
            )}
            <span>·</span>
            <span>{a.uniqueBidderCount} คน bid</span>
          </div>
        </div>
        <Icon name="chevronRight" size={18} className="mkt-app-chevron" />
      </Link>
    </li>
  );
}
