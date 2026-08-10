'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Nav, Footer } from '@/components/Site';
import { Icon } from '@/components/Icon';
import { supabase, authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { isCertifiedMode, supportsSellerChat } from '@/lib/listingMode';
import { getLogisticsProviderLabel } from '@/lib/logistics';
import { marketplaceListingBuyState } from '@/lib/marketplaceOrder';
import { AuctionCountdown } from '@/components/AuctionCountdown';
import type { AuctionPublic } from '@/lib/auction';

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

function imgUrl(fileId: string) {
  return fileViewUrl(DEAL_BUCKET, fileId);
}

export default function MarketplaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [sellerShop, setSellerShop] = useState<{
    sellerId?: string; name: string; location: string; address: string;
    tagline?: string; avatarFileId?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myId, setMyId] = useState('');
  const [hdrs, setHdrs] = useState<Record<string, string>>({});
  const [mainImage, setMainImage] = useState('');
  const [joining, setJoining] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState('');
  const [auction, setAuction] = useState<AuctionPublic | null>(null);
  const [auctionBids, setAuctionBids] = useState<AuctionBid[]>([]);
  const [bidAmount, setBidAmount] = useState('');
  const [maxBidAmount, setMaxBidAmount] = useState('');
  const [myAutoBidMax, setMyAutoBidMax] = useState<number | null>(null);
  const [bidding, setBidding] = useState(false);
  const [bidError, setBidError] = useState('');

  async function loadListing() {
    const res = await fetch(`/api/deals/${listingId}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'ไม่พบสินค้า');
      return;
    }
    setListing(data.deal || null);
    setSellerShop(data.sellerShop || null);
    setAuction(data.auction || null);
    setAuctionBids(data.auctionBids || []);
    setMyAutoBidMax(data.myAutoBidMax ?? null);
    if (data.myAutoBidMax) setMaxBidAmount(String(data.myAutoBidMax));
    const providers = Array.isArray(data.deal?.shipping_providers) ? data.deal.shipping_providers : [];
    setSelectedShipping(prev => (prev && providers.includes(prev) ? prev : providers[0] || ''));
    if (data.auction?.minNextBid) setBidAmount(String(data.auction.minNextBid));
  }

  useEffect(() => {
    (async () => {
      try {
        await loadListing();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    })();
  }, [listingId]);

  useEffect(() => {
    if (!auction || auction.phase !== 'live') return;
    const t = setInterval(() => { void loadListing(); }, 15000);
    return () => clearInterval(t);
  }, [auction?.phase, listingId]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setMyId(user.id);
        setHdrs(await authHeaders());
      }
      // Guests can still view details and use local cart.
    })();
  }, []);

  const images = useMemo(() => {
    if (!listing) return [] as string[];
    return (listing.images || []).map(imgUrl);
  }, [listing]);

  const displayImage = mainImage || images[0] || '';

  async function buyViaEscrow() {
    if (!listing) return;
    if (!myId) {
      router.push(`/login?returnTo=${encodeURIComponent(`/marketplace/${listing.id}`)}`);
      return;
    }
    const providers = listing.shipping_providers || [];
    if (providers.length > 0 && !selectedShipping) {
      alert('กรุณาเลือกขนส่ง');
      return;
    }
    setJoining(true);
    try {
      const headers = Object.keys(hdrs).length ? hdrs : await authHeaders();
      const res = await fetch(`/api/deals/${listing.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join_as_buyer',
          ...(selectedShipping ? { shippingProvider: selectedShipping } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'ยังไม่สามารถซื้อได้');
        return;
      }
      router.push(`/cart/checkout/${listing.id}`);
    } finally {
      setJoining(false);
    }
  }

  function sellerChatHref() {
    if (!listing) return;
    if (!myId) {
      router.push(`/login?returnTo=${encodeURIComponent(`/messages?to=${listing.seller_id}&name=${encodeURIComponent(listing.seller_name || 'ผู้ขาย')}`)}`);
      return;
    }
    router.push(`/messages?to=${listing.seller_id}&name=${encodeURIComponent(listing.seller_name || 'ผู้ขาย')}`);
  }

  async function placeBid() {
    if (!listing || !auction) return;
    if (!myId) {
      router.push(`/login?returnTo=${encodeURIComponent(`/marketplace/${listing.id}`)}`);
      return;
    }
    setBidding(true);
    setBidError('');
    try {
      const headers = Object.keys(hdrs).length ? hdrs : await authHeaders();
      const res = await fetch(`/api/auctions/${listing.id}/bid`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(bidAmount) || auction.minNextBid,
          ...(maxBidAmount ? { maxBid: Number(maxBidAmount) } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Bid ไม่สำเร็จ');
      if (data.auction) {
        setAuction(data.auction);
        setBidAmount(String(data.auction.minNextBid));
      }
      await loadListing();
    } catch (err: unknown) {
      setBidError(err instanceof Error ? err.message : 'Bid ไม่สำเร็จ');
    } finally {
      setBidding(false);
    }
  }

  if (loading) {
    return (
      <>
        <Nav active="market" />
        <div className="mkt-detail-shell">
          <div className="mkt-detail-loading" />
        </div>
      </>
    );
  }

  if (!listing) {
    return (
      <>
        <Nav active="market" />
        <div className="mkt-detail-shell">
          <div className="mkt-detail-empty">
            <div className="mkt-empty-ic"><Icon name="search" size={32} /></div>
            <p>{error || 'ไม่พบสินค้าที่ต้องการ'}</p>
            <Link href="/marketplace" className="btn btn-primary">กลับสู่ตลาด</Link>
          </div>
        </div>
      </>
    );
  }

  const isOwner = listing.seller_id === myId;
  const isAuction = listing.deal_type === 'auction' && auction;
  const canSellerChat = supportsSellerChat(listing.selling_mode);
  const displayPrice = isAuction ? auction.leadingPrice : (listing.price || 0);
  const shippingProviders = listing.shipping_providers || [];
  const shippingCost = listing.shipping_cost ?? 0;
  const buyState = marketplaceListingBuyState(listing, myId || undefined);

  return (
    <>
      <Nav active="market" />
      <div className="mkt-detail-shell">
        <div className="container">
          <div className="mkt-detail-top">
            <Link href={isAuction ? '/marketplace?zone=auction' : '/marketplace'} className="btn btn-ghost btn-sm"><Icon name="chevronRight" size={16} style={{ transform: 'rotate(180deg)' }} /> {isAuction ? 'กลับตลาดประมูล' : 'กลับตลาดซื้อขาย'}</Link>
          </div>

          {isAuction ? (
            <article className="mkt-detail-card mkt-detail-card--auction">
              <header className="mkt-detail-header">
                <div className="mkt-detail-badges">
                  {listing.category && <span className="badge badge-gray">{listing.category}</span>}
                  {listing.condition && <span className="badge badge-gray">{listing.condition}</span>}
                  <span className="badge badge-purple">🔨 ประมูล</span>
                </div>
                <h1 className="mkt-detail-title">{listing.title}</h1>
                <div className="mkt-detail-summary">
                  <span className="mkt-detail-summary-price">
                    {auction.bidCount > 0 ? '฿' : 'เริ่ม ฿'}{displayPrice.toLocaleString()}
                  </span>
                  <span className="mkt-detail-summary-sep">·</span>
                  <span className="mkt-detail-summary-time">
                    <AuctionCountdown endsAt={auction.endsAt} endedAt={auction.endedAt} variant="card" liveClassName="is-live" />
                  </span>
                  <span className="mkt-detail-summary-sep">·</span>
                  <span className="mkt-detail-summary-leader">
                    🏆 {auction.currentBidderName || 'ยังไม่มี bid'}
                  </span>
                  <span className="mkt-detail-summary-sep">·</span>
                  <span>👥 {auction.uniqueBidderCount} คน · +฿{auction.bidIncrement.toLocaleString()}/bid</span>
                </div>
              </header>

              <div className="mkt-detail-body">
                <section className="mkt-detail-gallery">
                  <div className="mkt-detail-main">
                    {displayImage ? (
                      <img src={displayImage} alt={listing.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div className="mkt-detail-fallback"><Icon name="package" size={40} /></div>
                    )}
                  </div>
                  {images.length > 1 && (
                    <div className="mkt-detail-thumbs">
                      {images.map(src => (
                        <button key={src} type="button" className={`mkt-detail-thumb${displayImage === src ? ' active' : ''}`} onClick={() => setMainImage(src)}>
                          <img src={src} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="mkt-detail-main-col">
                  {isOwner ? (
                    <Link href={listing.status === 'posted' ? `/marketplace/${listing.id}` : `/deal/${listing.id}`} className="btn btn-primary btn-lg">รายการของคุณ</Link>
                  ) : auction.phase === 'live' ? (
                    <>
                      <div className="mkt-detail-bid-panel">
                        <h2 className="mkt-detail-bid-title">🔨 วาง Bid</h2>
                        <div className="mkt-bid-form">
                          <label>ราคา bid ครั้งนี้ (ขั้นต่ำ ฿{auction.minNextBid.toLocaleString()})</label>
                          <div className="mkt-bid-row mkt-bid-row--primary">
                            <input type="number" min={auction.minNextBid} step={auction.bidIncrement} value={bidAmount} onChange={e => setBidAmount(e.target.value)} />
                            <button type="button" className="btn btn-primary btn-lg" onClick={placeBid} disabled={bidding}>
                              {bidding ? 'กำลัง bid...' : 'Bid'}
                            </button>
                          </div>
                          <label className="mkt-bid-max-label">
                            ราคาสูงสุดที่สู้ (auto-bid)
                            <span className="mkt-bid-max-hint">สู้ให้อัตโนมัติเมื่อถูก overbid จนถึงเพดาน</span>
                          </label>
                          <div className="mkt-bid-row">
                            <input
                              type="number"
                              min={auction.minNextBid}
                              step={auction.bidIncrement}
                              value={maxBidAmount}
                              onChange={e => setMaxBidAmount(e.target.value)}
                              placeholder={`เช่น ${(auction.minNextBid + auction.bidIncrement * 5).toLocaleString()}`}
                            />
                          </div>
                          {myAutoBidMax != null && (
                            <p className="mkt-bid-auto-active">🤖 ตั้ง auto-bid ไว้สูงสุด ฿{myAutoBidMax.toLocaleString()}</p>
                          )}
                          {bidError && <p className="mkt-bid-error">{bidError}</p>}
                        </div>
                      </div>
                      {canSellerChat && (
                        <button type="button" className="btn btn-soft btn-sm mkt-detail-chat-btn" onClick={sellerChatHref}>
                          <Icon name="chat" size={16} /> แชทผู้ขาย
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="mkt-detail-note-card">
                      <div className="mkt-detail-note-title">
                        {listing.buyer_id || auction.endedAt ? 'ขายแล้ว · ประมูลปิด' : 'ประมูลปิดแล้ว'}
                      </div>
                      <p>{auction.currentBidderName ? `ผู้ชนะ: ${auction.currentBidderName} · ฿${(auction.currentBid || displayPrice).toLocaleString()}` : 'ไม่มีผู้ bid'}</p>
                      {myId && listing.buyer_id === myId && (
                        <Link href={`/cart/checkout/${listing.id}`} className="btn btn-primary btn-lg" style={{ marginTop: 12 }}>
                          ไปชำระเงิน →
                        </Link>
                      )}
                    </div>
                  )}

                  {auctionBids.length > 0 && (
                    <div className="mkt-bid-history">
                      <h3>ประวัติ bid ล่าสุด</h3>
                      <ul>
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

                  <details className="mkt-detail-more">
                    <summary>รายละเอียดและร้านค้า</summary>
                    <div className="mkt-detail-more-body">
                      <div className="mkt-detail-meta">
                        <span><Icon name="user" size={15} /> {listing.seller_name || 'ผู้ขาย'}</span>
                        {listing.location && <span><Icon name="mapPin" size={15} /> {listing.location}</span>}
                      </div>
                      {listing.description && <p className="mkt-detail-desc">{listing.description}</p>}
                      {sellerShop && (
                        <Link href={`/shop/${sellerShop.sellerId || listing.seller_id}`} className="mkt-detail-shop-link">
                          🏪 {sellerShop.name} →
                        </Link>
                      )}
                    </div>
                  </details>
                </section>
              </div>
            </article>
          ) : (
          <div className="mkt-detail-grid">
            <section className="mkt-detail-gallery">
              <div className="mkt-detail-main">
                {displayImage ? (
                  <img src={displayImage} alt={listing.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className="mkt-detail-fallback"><Icon name="package" size={56} /></div>
                )}
              </div>
              {images.length > 1 && (
                <div className="mkt-detail-thumbs">
                  {images.map(src => (
                    <button key={src} type="button" className={`mkt-detail-thumb${displayImage === src ? ' active' : ''}`} onClick={() => setMainImage(src)}>
                      <img src={src} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="mkt-detail-info">
              <div className="mkt-detail-badges">
                {listing.category && <span className="badge badge-gray">{listing.category}</span>}
                {listing.condition && <span className="badge badge-gray">{listing.condition}</span>}
                {isCertifiedMode(listing.selling_mode) && <span className="badge badge-amber">⭐ Certified</span>}
              </div>

              <h1 className="mkt-detail-title">{listing.title}</h1>
              <div className="mkt-detail-price">฿{displayPrice.toLocaleString()}</div>
              <div className="mkt-detail-shipping">
                <span>ค่าขนส่ง</span>
                <strong>{shippingCost > 0 ? `฿${shippingCost.toLocaleString()}` : 'ฟรี'}</strong>
              </div>
              <div className="mkt-detail-meta">
                <span><Icon name="user" size={15} /> {listing.seller_name || 'ผู้ขาย'}</span>
                {listing.location && <span><Icon name="mapPin" size={15} /> {listing.location}</span>}
              </div>

              {listing.description && <p className="mkt-detail-desc">{listing.description}</p>}

              {sellerShop && (
                <Link href={`/shop/${sellerShop.sellerId || listing.seller_id}`} className="mkt-detail-shop-link">
                  🏪 {sellerShop.name} →
                </Link>
              )}

              <div className="mkt-detail-actions">
                {isOwner ? (
                  <Link href={listing.status === 'posted' ? `/marketplace/${listing.id}` : `/deal/${listing.id}`} className="btn btn-primary btn-lg">รายการของคุณ</Link>
                ) : buyState === 'sold' || buyState === 'reserved' ? (
                  <div className="mkt-detail-note-card">
                    <div className="mkt-detail-note-title">
                      {buyState === 'sold' ? 'สินค้าขายแล้ว' : 'มีผู้จองแล้ว'}
                    </div>
                    <p>{buyState === 'sold' ? 'สินค้านี้กำลังอยู่ในขั้นตอนจัดส่งหรือเสร็จสิ้นแล้ว' : 'ผู้ซื้ออัปสลิปแล้ว รอทีมงานตรวจสอบ'}</p>
                    {canSellerChat && (
                      <button type="button" className="btn btn-soft btn-lg" style={{ marginTop: 12 }} onClick={sellerChatHref}>
                        <Icon name="chat" size={18} /> แชทกับผู้ขาย
                      </button>
                    )}
                  </div>
                ) : buyState === 'continue_checkout' ? (
                  <>
                    <Link href={`/cart/checkout/${listing.id}`} className="btn btn-primary btn-lg">
                      {listing.status === 'payment_uploaded' ? 'ดูสถานะการสั่งซื้อ →' : 'ดำเนินการโอนเงิน →'}
                    </Link>
                    {canSellerChat && (
                      <button type="button" className="btn btn-soft btn-lg" onClick={sellerChatHref}>
                        <Icon name="chat" size={18} /> แชทกับผู้ขาย
                      </button>
                    )}
                  </>
                ) : buyState === 'can_buy' ? (
                  <>
                    {shippingProviders.length > 0 && (
                      <div className="mkt-shipping-pick">
                        <div className="mkt-shipping-pick-lbl">เลือกขนส่ง</div>
                        <div className="mkt-shipping-pick-list">
                          {shippingProviders.map(id => (
                            <button
                              key={id}
                              type="button"
                              className={`mkt-shipping-chip${selectedShipping === id ? ' active' : ''}`}
                              onClick={() => setSelectedShipping(id)}
                            >
                              {getLogisticsProviderLabel(id)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <button type="button" className="btn btn-primary btn-lg" onClick={buyViaEscrow} disabled={joining}>
                      {joining ? 'กำลังเข้าระบบซื้อขาย...' : 'ซื้อทันที'}
                    </button>
                    {canSellerChat && (
                      <button type="button" className="btn btn-soft btn-lg" onClick={sellerChatHref}>
                        <Icon name="chat" size={18} /> แชทกับผู้ขาย
                      </button>
                    )}
                    <p className="mkt-detail-escrow-note">
                      เมื่อกดซื้อ ระบบจะพาไปยืนยันที่อยู่จัดส่งและชำระเงิน — ไม่มีคนกลาง ผู้ขายจัดส่งตรงถึงคุณ
                    </p>
                  </>
                ) : (
                  <div className="mkt-detail-note-card">
                    <div className="mkt-detail-note-title">สินค้าไม่พร้อมขาย</div>
                    <p>รายการนี้ไม่เปิดขายบนตลาดแล้ว</p>
                    <Link href="/marketplace" className="btn btn-soft btn-lg" style={{ marginTop: 12 }}>กลับตลาดซื้อขาย</Link>
                  </div>
                )}
              </div>
            </section>
          </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
