'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Nav, Footer } from '@/components/Site';
import { Icon } from '@/components/Icon';
import { supabase, authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { addToCart, getCartCount } from '@/lib/cart';
import { isCertifiedMode, supportsDirectPurchase, supportsEscrowPurchase, supportsSellerChat } from '@/lib/listingMode';
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
  const [cartCount, setCartCount] = useState(0);
  const [joining, setJoining] = useState(false);
  const [adding, setAdding] = useState(false);
  const [auction, setAuction] = useState<AuctionPublic | null>(null);
  const [auctionBids, setAuctionBids] = useState<AuctionBid[]>([]);
  const [bidAmount, setBidAmount] = useState('');
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
    if (data.auction?.minNextBid) setBidAmount(String(data.auction.minNextBid));
  }

  useEffect(() => {
    const syncCart = () => setCartCount(getCartCount());
    syncCart();
    window.addEventListener('khonklang-cart-updated', syncCart);
    return () => window.removeEventListener('khonklang-cart-updated', syncCart);
  }, []);

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

  function pushToCart(goToCart = false) {
    if (!listing) return;
    setAdding(true);
    addToCart({
      dealId: listing.id,
      title: listing.title,
      price: listing.price,
      imageUrl: images[0] || '',
      sellerName: listing.seller_name || 'ผู้ขาย',
      location: listing.location || '',
    });
    setCartCount(getCartCount());
    setAdding(false);
    if (goToCart) router.push('/cart');
  }

  async function buyViaEscrow() {
    if (!listing) return;
    if (!myId) {
      router.push(`/login?returnTo=${encodeURIComponent(`/marketplace/${listing.id}`)}`);
      return;
    }
    setJoining(true);
    try {
      const headers = Object.keys(hdrs).length ? hdrs : await authHeaders();
      const res = await fetch(`/api/deals/${listing.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join_as_buyer' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'ยังไม่สามารถซื้อผ่านคนกลางได้');
        return;
      }
      router.push(`/deal/${listing.id}`);
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
        body: JSON.stringify({ amount: Number(bidAmount) || auction.minNextBid }),
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
  const canDirectBuy = !isAuction && supportsDirectPurchase(listing.selling_mode);
  const canEscrowBuy = !isAuction && supportsEscrowPurchase(listing.selling_mode);
  const canSellerChat = supportsSellerChat(listing.selling_mode);
  const displayPrice = isAuction ? auction.leadingPrice : (listing.price || 0);

  return (
    <>
      <Nav active="market" />
      <div className="mkt-detail-shell">
        <div className="container">
          <div className="mkt-detail-top">
            <Link href={isAuction ? '/marketplace?zone=auction' : '/marketplace'} className="btn btn-ghost btn-sm"><Icon name="chevronRight" size={16} style={{ transform: 'rotate(180deg)' }} /> {isAuction ? 'กลับตลาดประมูล' : 'กลับตลาดซื้อขาย'}</Link>
            <Link href="/cart" className="btn btn-soft btn-sm"><Icon name="package" size={16} /> ตะกร้า {cartCount > 0 ? `(${cartCount})` : ''}</Link>
          </div>

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
                {isAuction && <span className="badge badge-purple">🔨 ประมูล</span>}
                {isCertifiedMode(listing.selling_mode) && <span className="badge badge-amber">⭐ Certified</span>}
              </div>

              <h1 className="mkt-detail-title">{listing.title}</h1>
              <div className="mkt-detail-price">
                {isAuction && auction.bidCount > 0 ? 'ราคาปัจจุบัน ' : isAuction ? 'ราคาเริ่ม ' : ''}
                ฿{displayPrice.toLocaleString()}
              </div>

              {isAuction && (
                <div className="mkt-auction-panel">
                  <div className="mkt-auction-stat">
                    <span className="mkt-auction-stat-lbl">เหลือเวลา</span>
                    <strong className="mkt-auction-countdown">
                      <AuctionCountdown endsAt={auction.endsAt} endedAt={auction.endedAt} liveClassName="is-live" />
                    </strong>
                  </div>
                  <div className="mkt-auction-stat">
                    <span className="mkt-auction-stat-lbl">ผู้ประมูล</span>
                    <strong>{auction.uniqueBidderCount} คน · {auction.bidCount} bid</strong>
                  </div>
                  <div className="mkt-auction-stat">
                    <span className="mkt-auction-stat-lbl">นำอยู่</span>
                    <strong>{auction.currentBidderName || '— ยังไม่มี'}</strong>
                  </div>
                  <div className="mkt-auction-stat">
                    <span className="mkt-auction-stat-lbl">บิทครั้งละ</span>
                    <strong>฿{auction.bidIncrement.toLocaleString()}</strong>
                  </div>
                </div>
              )}
              <div className="mkt-detail-meta">
                <span><Icon name="user" size={15} /> {listing.seller_name || 'ผู้ขาย'}</span>
                {listing.location && <span><Icon name="mapPin" size={15} /> {listing.location}</span>}
              </div>

              {listing.description && <p className="mkt-detail-desc">{listing.description}</p>}

              {sellerShop && (
                <Link href={`/shop/${sellerShop.sellerId || listing.seller_id}`} className="mkt-detail-note-card shop-detail-link" style={{ background: 'var(--accent-soft)', borderColor: 'color-mix(in srgb, var(--accent) 24%, var(--line))', textDecoration: 'none', display: 'block' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {sellerShop.avatarFileId ? (
                      <img src={fileViewUrl(DEAL_BUCKET, sellerShop.avatarFileId)} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface)', display: 'grid', placeItems: 'center', fontSize: 22 }}>🏪</div>
                    )}
                    <div>
                      <div className="mkt-detail-note-title">🏪 {sellerShop.name}</div>
                      {sellerShop.tagline && <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--ink-2)' }}>{sellerShop.tagline}</p>}
                      {sellerShop.location && <p style={{ margin: '4px 0 0', fontSize: 14 }}>📍 {sellerShop.location}</p>}
                    </div>
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>เข้าชมหน้าร้าน →</p>
                </Link>
              )}

              <div className="mkt-detail-actions">
                {isOwner ? (
                  <Link href={listing.status === 'posted' ? `/marketplace/${listing.id}` : `/deal/${listing.id}`} className="btn btn-primary btn-lg">รายการของคุณ</Link>
                ) : isAuction ? (
                  auction.phase === 'live' ? (
                    <>
                      <div className="mkt-bid-form">
                        <label>ราคา bid (ขั้นต่ำ ฿{auction.minNextBid.toLocaleString()})</label>
                        <div className="mkt-bid-row">
                          <input type="number" min={auction.minNextBid} step={auction.bidIncrement} value={bidAmount} onChange={e => setBidAmount(e.target.value)} />
                          <button type="button" className="btn btn-primary btn-lg" onClick={placeBid} disabled={bidding}>
                            {bidding ? 'กำลัง bid...' : '🔨 Bid'}
                          </button>
                        </div>
                        {bidError && <p className="mkt-bid-error">{bidError}</p>}
                      </div>
                      {canSellerChat && (
                        <button type="button" className="btn btn-soft btn-lg" onClick={sellerChatHref}>
                          <Icon name="chat" size={18} /> แชทกับผู้ขาย
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="mkt-detail-note-card">
                      <div className="mkt-detail-note-title">ประมูลปิดแล้ว</div>
                      <p>{auction.currentBidderName ? `ผู้ชนะ: ${auction.currentBidderName} · ฿${(auction.currentBid || displayPrice).toLocaleString()}` : 'ไม่มีผู้ bid'}</p>
                      {listing.status !== 'posted' && myId && listing.buyer_id === myId && (
                        <Link href={`/deal/${listing.id}`} className="btn btn-primary btn-lg" style={{ marginTop: 12 }}>เข้าห้องดีล →</Link>
                      )}
                    </div>
                  )
                ) : (
                  <>
                    {canDirectBuy && (
                      <>
                        <button type="button" className="btn btn-ghost btn-lg" onClick={() => pushToCart(false)} disabled={adding}>
                          <Icon name="package" size={18} /> {adding ? 'กำลังเพิ่ม...' : 'หยิบใส่ตะกร้า'}
                        </button>
                        <button type="button" className="btn btn-primary btn-lg" onClick={() => pushToCart(true)}>
                          ซื้อทันที
                        </button>
                      </>
                    )}
                    {canEscrowBuy && (
                      <button type="button" className="btn btn-dark btn-lg" onClick={buyViaEscrow} disabled={joining}>
                        <Icon name="shieldCheck" size={18} /> {joining ? 'กำลังเข้าห้องดีล...' : 'ซื้อขายผ่านคนกลาง'}
                      </button>
                    )}
                    {canSellerChat && (
                      <button type="button" className="btn btn-soft btn-lg" onClick={sellerChatHref}>
                        <Icon name="chat" size={18} /> แชทกับผู้ขาย
                      </button>
                    )}
                    <Link href={`/service/meetup?step=2&role=buyer&title=${encodeURIComponent(listing.title)}&price=${listing.price}&inviteUserId=${listing.seller_id}`} className="btn btn-soft btn-lg">
                      🚗 นัดรับ + ประกันเดินทาง
                    </Link>
                    <Link href={`/messages?to=${listing.seller_id}&name=${encodeURIComponent(listing.seller_name || 'ผู้ขาย')}`} className="btn btn-ghost btn-lg">
                      <Icon name="message" size={18} /> ฝากข้อความถึงผู้ขาย
                    </Link>
                  </>
                )}
              </div>

              {isAuction && auctionBids.length > 0 && (
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

              {!isAuction && (
              <div className="mkt-detail-note">
                <div className="mkt-detail-note-card">
                  <div className="mkt-detail-note-title">ซื้อโดยไม่ผ่านคนกลาง</div>
                  <p>เหมาะกับสินค้าทั่วไปที่คุณต้องการ checkout แบบรวดเร็ว เพิ่มลงตะกร้าหรือซื้อทันทีได้เลย</p>
                </div>
                <div className="mkt-detail-note-card escrow">
                  <div className="mkt-detail-note-title">ซื้อขายผ่านคนกลาง</div>
                  <p>เหมาะกับสินค้ามูลค่าสูงหรืออยากให้มีคนกลางตรวจสอบ โดยจะพาไปห้องดีล 3 ฝ่ายทันที</p>
                </div>
              </div>
              )}
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
