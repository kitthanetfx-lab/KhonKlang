'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { AuctionCountdown } from '@/components/AuctionCountdown';
import { isCertifiedMode, supportsSellerChat } from '@/lib/listingMode';
import { getLogisticsProviderLabel } from '@/lib/logistics';
import type { AuctionPublic } from '@/lib/auction';
import {
  AppPage,
  AppHeader,
  AppFeed,
  AppLoading,
  AppEmpty,
  AppSheet,
} from '@/components/mobile';
import { fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';

interface ListingDetail {
  id: string;
  seller_id: string;
  seller_name: string;
  buyer_id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  location: string;
  selling_mode: string;
  deal_type?: string;
  shipping_cost?: number;
  shipping_providers?: string[];
  images: string[];
  status: string;
}

interface AuctionBid {
  id: string;
  bidder_name: string;
  amount: number;
  created_at: string;
}

export type MarketplaceDetailAppProps = {
  loading?: boolean;
  error?: string;
  listing: ListingDetail | null;
  sellerShop: {
    sellerId?: string;
    name: string;
    location: string;
    address: string;
    tagline?: string;
    avatarFileId?: string;
  } | null;
  images: string[];
  displayImage: string;
  onMainImageChange: (src: string) => void;
  myId: string;
  isOwner: boolean;
  isAuction: boolean;
  auction: AuctionPublic | null;
  auctionBids: AuctionBid[];
  displayPrice: number;
  shippingProviders: string[];
  shippingCost: number;
  buyState: string;
  selectedShipping: string;
  onSelectedShippingChange: (id: string) => void;
  joining: boolean;
  bidding: boolean;
  bidAmount: string;
  onBidAmountChange: (v: string) => void;
  maxBidAmount: string;
  onMaxBidAmountChange: (v: string) => void;
  bidStepAmount: string;
  onBidStepAmountChange: (v: string) => void;
  autoBidOn: boolean;
  onAutoBidToggle: () => void;
  myAutoBidMax: number | null;
  myAutoBidStep: number | null;
  hasLineNotify: boolean;
  lineOaUrl: string;
  bidError: string;
  onBuy: () => void;
  onBid: () => void;
  onSellerChat: () => void;
};

function imgUrl(fileId: string) {
  return fileViewUrl(DEAL_BUCKET, fileId);
}

/** รายละเอียดสินค้า/ประมูล — mobile-first: gallery เลื่อน · sticky ราคา/bid · auto-bid แบบ progressive disclosure */
export function MarketplaceDetailApp({
  loading,
  error,
  listing,
  sellerShop,
  images,
  displayImage,
  onMainImageChange,
  myId,
  isOwner,
  isAuction,
  auction,
  auctionBids,
  displayPrice,
  shippingProviders,
  shippingCost,
  buyState,
  selectedShipping,
  onSelectedShippingChange,
  joining,
  bidding,
  bidAmount,
  onBidAmountChange,
  maxBidAmount,
  onMaxBidAmountChange,
  bidStepAmount,
  onBidStepAmountChange,
  autoBidOn,
  onAutoBidToggle,
  myAutoBidMax,
  myAutoBidStep,
  hasLineNotify,
  lineOaUrl,
  bidError,
  onBuy,
  onBid,
  onSellerChat,
}: MarketplaceDetailAppProps) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [autoBidSheetOpen, setAutoBidSheetOpen] = useState(false);
  const canSellerChat = listing ? supportsSellerChat(listing.selling_mode) : false;

  const syncSlideFromScroll = useCallback(() => {
    const el = galleryRef.current;
    if (!el || images.length === 0) return;
    const w = el.clientWidth || 1;
    const idx = Math.round(el.scrollLeft / w);
    setSlideIndex(Math.min(Math.max(0, idx), images.length - 1));
    const src = images[idx];
    if (src && src !== displayImage) onMainImageChange(src);
  }, [displayImage, images, onMainImageChange]);

  useEffect(() => {
    if (!displayImage || images.length === 0) return;
    const idx = images.indexOf(displayImage);
    if (idx >= 0) setSlideIndex(idx);
  }, [displayImage, images]);

  if (loading) {
    return (
      <AppPage withBottomNav>
        <AppHeader title="รายละเอียด" backHref="/marketplace" />
        <AppLoading />
      </AppPage>
    );
  }

  if (!listing) {
    return (
      <AppPage withBottomNav>
        <AppHeader title="รายละเอียด" backHref="/marketplace" />
        <AppEmpty action={<Link href="/marketplace" className="btn btn-primary">กลับสู่ตลาด</Link>}>
          {error || 'ไม่พบสินค้าที่ต้องการ'}
        </AppEmpty>
      </AppPage>
    );
  }

  const backHref = isAuction ? '/marketplace?zone=auction' : '/marketplace';
  const showAuctionBid =
    isAuction && !isOwner && auction && auction.phase === 'live';
  const showBuySticky =
    !isAuction && !isOwner && (buyState === 'can_buy' || buyState === 'continue_checkout');

  const stickyFooter = (() => {
    if (isOwner) {
      return (
        <Link
          href={listing.status === 'posted' ? `/marketplace/${listing.id}` : `/deal/${listing.id}`}
          className="btn btn-primary btn-block btn-lg"
        >
          รายการของคุณ
        </Link>
      );
    }

    if (showAuctionBid && auction) {
      return (
        <div className="app-detail-sticky">
          <div className="app-detail-sticky-price">
            <span className="app-detail-sticky-lbl">
              {auction.bidCount > 0 ? 'ราคาปัจจุบัน' : 'ราคาเริ่ม'}
            </span>
            <strong className="app-detail-sticky-val">฿{displayPrice.toLocaleString()}</strong>
          </div>
          <div className="app-detail-sticky-row">
            <label className="app-detail-bid-field" htmlFor="app-bid-amount">
              <span className="sr-only">ราคา bid</span>
              <input
                id="app-bid-amount"
                type="number"
                min={auction.minNextBid}
                step={auction.bidIncrement}
                value={bidAmount}
                onChange={e => onBidAmountChange(e.target.value)}
                placeholder={`ขั้นต่ำ ${auction.minNextBid.toLocaleString()}`}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary btn-lg app-detail-sticky-btn"
              onClick={onBid}
              disabled={bidding}
            >
              {bidding ? '…' : 'Bid'}
            </button>
          </div>
          <div className="app-detail-sticky-tools">
            <button
              type="button"
              className={`app-detail-autobid-btn${autoBidOn ? ' is-on' : ''}`}
              onClick={() => {
                onAutoBidToggle();
                if (!autoBidOn) setAutoBidSheetOpen(true);
              }}
              aria-pressed={autoBidOn}
            >
              {autoBidOn ? '✓ Auto-bid' : '+ Auto-bid'}
            </button>
            {canSellerChat && (
              <button type="button" className="app-detail-chat-btn" onClick={onSellerChat}>
                <Icon name="chat" size={16} /> แชท
              </button>
            )}
          </div>
          {bidError && <p className="app-detail-err">{bidError}</p>}
        </div>
      );
    }

    if (showBuySticky) {
      return (
        <div className="app-detail-sticky">
          <div className="app-detail-sticky-price">
            <span className="app-detail-sticky-lbl">ราคา</span>
            <strong className="app-detail-sticky-val">฿{displayPrice.toLocaleString()}</strong>
            {!isAuction && shippingCost > 0 && (
              <span className="app-detail-sticky-ship">+ ขนส่ง ฿{shippingCost.toLocaleString()}</span>
            )}
          </div>
          {buyState === 'continue_checkout' ? (
            <Link href={`/cart/checkout/${listing.id}`} className="btn btn-primary btn-block btn-lg">
              {listing.status === 'payment_uploaded' ? 'ดูสถานะการสั่งซื้อ' : 'ดำเนินการโอนเงิน'}
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              onClick={onBuy}
              disabled={joining}
            >
              {joining ? 'กำลังเข้าระบบ…' : 'ซื้อทันที'}
            </button>
          )}
        </div>
      );
    }

    if (isAuction && !isOwner && auction && auction.phase !== 'live' && myId && listing.buyer_id === myId) {
      return (
        <Link href={`/cart/checkout/${listing.id}`} className="btn btn-primary btn-block btn-lg">
          ไปชำระเงิน / ติดตามสถานะ
        </Link>
      );
    }

    return null;
  })();

  return (
    <AppPage accent={isAuction ? 'auction' : 'default'} withBottomNav stickyFooter={stickyFooter}>
      <AppHeader
        title={isAuction ? 'ประมูล' : 'รายละเอียด'}
        backHref={backHref}
      />

      <AppFeed>
        <div className="app-detail-gallery-wrap">
          {images.length > 0 ? (
            <>
              <div
                ref={galleryRef}
                className="app-detail-gallery"
                onScroll={syncSlideFromScroll}
              >
                {images.map(src => (
                  <div key={src} className="app-detail-slide">
                    <img src={src} alt={listing.title} draggable={false} />
                  </div>
                ))}
              </div>
              {images.length > 1 && (
                <div className="app-detail-dots" aria-hidden>
                  {images.map((src, i) => (
                    <span key={src} className={i === slideIndex ? 'is-on' : undefined} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="app-detail-slide app-detail-slide--empty">
              <Icon name="package" size={48} />
            </div>
          )}
        </div>

        <div className="app-detail-tags">
          {listing.category && <span className="badge badge-gray">{listing.category}</span>}
          {listing.condition && <span className="badge badge-gray">{listing.condition}</span>}
          {isAuction && <span className="badge badge-purple">🔨 ประมูล</span>}
          {isCertifiedMode(listing.selling_mode) && <span className="badge badge-amber">⭐ Certified</span>}
        </div>

        <h2 className="app-detail-title">{listing.title}</h2>

        {!showAuctionBid && !showBuySticky && (
          <div className="app-detail-price-inline">
            <span>{isAuction && auction && auction.bidCount > 0 ? 'ราคาปัจจุบัน' : 'ราคา'}</span>
            <strong>฿{displayPrice.toLocaleString()}</strong>
          </div>
        )}

        {isAuction && auction && (
          <div className="app-card app-detail-auction-stats">
            <div className="app-detail-stat">
              <span>เหลือเวลา</span>
              <strong>
                <AuctionCountdown endsAt={auction.endsAt} endedAt={auction.endedAt} liveClassName="is-live" />
              </strong>
            </div>
            <div className="app-detail-stat">
              <span>ผู้ประมูล</span>
              <strong>{auction.uniqueBidderCount} คน · {auction.bidCount} bid</strong>
            </div>
            <div className="app-detail-stat">
              <span>นำอยู่</span>
              <strong>{auction.currentBidderName || '— ยังไม่มี'}</strong>
            </div>
            <div className="app-detail-stat">
              <span>บิทครั้งละ</span>
              <strong>฿{auction.bidIncrement.toLocaleString()}</strong>
            </div>
          </div>
        )}

        {isAuction && !isOwner && auction && auction.phase !== 'live' && (
          <div className="app-card app-detail-note">
            <strong>
              {listing.buyer_id || auction.endedAt ? 'ขายแล้ว · ประมูลปิด' : 'ประมูลปิดแล้ว'}
            </strong>
            <p>
              {auction.currentBidderName
                ? `ผู้ชนะ: ${auction.currentBidderName} · ฿${(auction.currentBid || displayPrice).toLocaleString()}`
                : 'ไม่มีผู้ bid'}
            </p>
          </div>
        )}

        {!isAuction && (
          <div className="app-detail-meta-row">
            <span>ค่าขนส่ง</span>
            <strong>{shippingCost > 0 ? `฿${shippingCost.toLocaleString()}` : 'ฟรี'}</strong>
          </div>
        )}

        <div className="app-detail-meta-row app-detail-meta-row--soft">
          <span><Icon name="user" size={14} /> {listing.seller_name || 'ผู้ขาย'}</span>
          {listing.location && <span><Icon name="mapPin" size={14} /> {listing.location}</span>}
        </div>

        {listing.description && (
          <div className="app-card app-detail-desc">{listing.description}</div>
        )}

        {sellerShop && (
          <Link href={`/shop/${sellerShop.sellerId || listing.seller_id}`} className="app-card app-detail-shop">
            {sellerShop.avatarFileId ? (
              <img className="app-detail-shop-av" src={imgUrl(sellerShop.avatarFileId)} alt="" />
            ) : (
              <div className="app-detail-shop-av app-detail-shop-av--empty">🏪</div>
            )}
            <div className="app-detail-shop-body">
              <strong>{sellerShop.name}</strong>
              {sellerShop.tagline && <span>{sellerShop.tagline}</span>}
              {sellerShop.location && <span>📍 {sellerShop.location}</span>}
            </div>
            <Icon name="chevronRight" size={18} className="app-chevron" />
          </Link>
        )}

        {!isAuction && !isOwner && buyState === 'can_buy' && shippingProviders.length > 0 && (
          <div className="app-card">
            <div className="app-detail-ship-lbl">เลือกขนส่ง</div>
            <div className="app-detail-ship-chips">
              {shippingProviders.map(id => (
                <button
                  key={id}
                  type="button"
                  className={`app-detail-ship-chip${selectedShipping === id ? ' is-active' : ''}`}
                  onClick={() => onSelectedShippingChange(id)}
                >
                  {getLogisticsProviderLabel(id)}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isAuction && !isOwner && buyState === 'can_buy' && (
          <p className="app-detail-hint">
            กดซื้อแล้วระบบพาไปยืนยันที่อยู่และชำระเงิน — ผู้ขายจัดส่งตรงถึงคุณ
          </p>
        )}

        {!isAuction && !isOwner && (buyState === 'sold' || buyState === 'reserved') && (
          <div className="app-card app-detail-note">
            <strong>{buyState === 'sold' ? 'สินค้าขายแล้ว' : 'มีผู้จองแล้ว'}</strong>
            <p>
              {buyState === 'sold'
                ? 'สินค้านี้กำลังอยู่ในขั้นตอนจัดส่งหรือเสร็จสิ้นแล้ว'
                : 'ผู้ซื้ออัปสลิปแล้ว รอทีมงานตรวจสอบ'}
            </p>
            {canSellerChat && (
              <button type="button" className="btn btn-soft btn-block" onClick={onSellerChat}>
                <Icon name="chat" size={16} /> แชทกับผู้ขาย
              </button>
            )}
          </div>
        )}

        {!isAuction && !isOwner && buyState === 'continue_checkout' && canSellerChat && (
          <button type="button" className="btn btn-soft btn-block" onClick={onSellerChat}>
            <Icon name="chat" size={16} /> แชทกับผู้ขาย
          </button>
        )}

        {showAuctionBid && myId && (
          <div className="app-card app-detail-line">
            {hasLineNotify ? (
              <p className="app-detail-line-ok">✓ พร้อมรับแจ้ง overbid ผ่าน LINE OA</p>
            ) : (
              <>
                <p><strong>รับแจ้งเตือนเมื่อถูกประมูลสูงกว่า</strong></p>
                <p className="app-detail-hint">เพิ่มเพื่อน LINE OA แล้วเข้าสู่ระบบด้วย LINE หนึ่งครั้ง</p>
                <div className="app-detail-line-actions">
                  {lineOaUrl ? (
                    <a className="btn btn-soft btn-sm" href={lineOaUrl} target="_blank" rel="noreferrer">
                      เพิ่มเพื่อน LINE OA
                    </a>
                  ) : null}
                  <a
                    className="btn btn-soft btn-sm"
                    href={`/api/auth/line?returnTo=${encodeURIComponent(`/marketplace/${listing.id}`)}`}
                  >
                    เชื่อมด้วย LINE Login
                  </a>
                </div>
              </>
            )}
          </div>
        )}

        {isAuction && auctionBids.length > 0 && (
          <div className="app-card">
            <h3 className="app-detail-section-title">ประวัติ bid ล่าสุด</h3>
            <ul className="app-detail-bid-list">
              {auctionBids.map(b => (
                <li key={b.id}>
                  <span>{b.bidder_name}</span>
                  <strong>฿{b.amount.toLocaleString()}</strong>
                  <time>{new Date(b.created_at).toLocaleString('th-TH')}</time>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="app-detail-scroll-pad" aria-hidden />
      </AppFeed>

      {showAuctionBid && auction && (
        <AppSheet
          open={autoBidSheetOpen && autoBidOn}
          title="Auto-bid"
          onClose={() => setAutoBidSheetOpen(false)}
          footer={
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              onClick={() => setAutoBidSheetOpen(false)}
            >
              บันทึกการตั้งค่า
            </button>
          }
        >
          <label className="app-field" htmlFor="app-max-bid">
            ราคาสูงสุดที่สู้ (เพดาน)
            <input
              id="app-max-bid"
              type="number"
              min={auction.minNextBid}
              step={auction.bidIncrement}
              value={maxBidAmount}
              onChange={e => onMaxBidAmountChange(e.target.value)}
              placeholder={`เช่น ${(auction.minNextBid + auction.bidIncrement * 5).toLocaleString()}`}
            />
          </label>
          <label className="app-field" htmlFor="app-bid-step">
            จำนวนเงินต่อบิด (อย่างน้อย ฿{auction.bidIncrement.toLocaleString()})
            <input
              id="app-bid-step"
              type="number"
              min={auction.bidIncrement}
              step={auction.bidIncrement}
              value={bidStepAmount || String(auction.bidIncrement)}
              onChange={e => onBidStepAmountChange(e.target.value)}
            />
          </label>
          <p className="app-detail-hint" style={{ marginTop: 10 }}>
            ถูก overbid แล้วระบบจะสู้เพิ่มทีละจำนวนนี้ จนถึงเพดาน — ทำงานแม้ปิดเว็บ
          </p>
          {myAutoBidMax != null && (
            <p className="app-detail-hint">
              บันทึกไว้เพดาน ฿{myAutoBidMax.toLocaleString()}
              {myAutoBidStep ? ` · ต่อบิด ฿${myAutoBidStep.toLocaleString()}` : ''}
              {' — กด Bid เพื่ออัปเดต'}
            </p>
          )}
        </AppSheet>
      )}
    </AppPage>
  );
}

export default MarketplaceDetailApp;
