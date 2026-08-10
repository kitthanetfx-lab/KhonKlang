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
  const [bidStepAmount, setBidStepAmount] = useState('');
  const [autoBidOn, setAutoBidOn] = useState(false);
  const [myAutoBidMax, setMyAutoBidMax] = useState<number | null>(null);
  const [myAutoBidStep, setMyAutoBidStep] = useState<number | null>(null);
  const [hasLineNotify, setHasLineNotify] = useState(false);
  const [lineOaUrl, setLineOaUrl] = useState('');
  const [bidding, setBidding] = useState(false);
  const [bidError, setBidError] = useState('');

  async function loadListing(authOverride?: Record<string, string>) {
    const headers = authOverride
      || (Object.keys(hdrs).length ? hdrs : await authHeaders());
    const res = await fetch(`/api/deals/${listingId}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'ไม่พบสินค้า');
      return;
    }
    setListing(data.deal || null);
    setSellerShop(data.sellerShop || null);
    setAuction(data.auction || null);
    setAuctionBids(data.auctionBids || []);
    setHasLineNotify(Boolean(data.hasLineNotify));
    setLineOaUrl(String(data.lineOaUrl || ''));
    const autoMax = data.myAutoBidMax ?? null;
    const autoStep = data.myAutoBidStep != null ? Number(data.myAutoBidStep) : null;
    setMyAutoBidMax(autoMax);
    setMyAutoBidStep(autoStep && autoStep > 0 ? autoStep : null);
    if (autoMax != null) {
      setMaxBidAmount(String(autoMax));
      setAutoBidOn(true);
      if (autoStep && autoStep > 0) setBidStepAmount(String(autoStep));
      else if (data.auction?.bidIncrement) setBidStepAmount(String(data.auction.bidIncrement));
    }
    const providers = Array.isArray(data.deal?.shipping_providers) ? data.deal.shipping_providers : [];
    setSelectedShipping(prev => (prev && providers.includes(prev) ? prev : providers[0] || ''));
    if (data.auction?.minNextBid) setBidAmount(String(data.auction.minNextBid));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let headers: Record<string, string> = {};
        if (user) {
          headers = await authHeaders();
          if (!cancelled) {
            setMyId(user.id);
            setHdrs(headers);
          }
        }
        if (!cancelled) await loadListing(headers);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [listingId]);

  useEffect(() => {
    if (!auction || auction.phase !== 'live') return;
    const t = setInterval(() => { void loadListing(); }, 15000);
    return () => clearInterval(t);
  }, [auction?.phase, listingId]);

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
    if (autoBidOn && !maxBidAmount) {
      setBidError('กรุณาใส่ราคาสูงสุดสำหรับ Auto-bid หรือปิด Auto-bid');
      return;
    }
    if (autoBidOn && bidStepAmount && Number(bidStepAmount) < auction.bidIncrement) {
      setBidError(`จำนวนเงินต่อบิดต้องไม่ต่ำกว่า ฿${auction.bidIncrement.toLocaleString()}`);
      return;
    }
    setBidding(true);
    setBidError('');
    try {
      const headers = Object.keys(hdrs).length ? hdrs : await authHeaders();
      const payload: Record<string, unknown> = {
        amount: Number(bidAmount) || auction.minNextBid,
      };
      if (autoBidOn) {
        payload.maxBid = Number(maxBidAmount);
        if (bidStepAmount) payload.stepAmount = Number(bidStepAmount);
      } else if (myAutoBidMax != null) {
        // ลบเฉพาะเมื่อเคยมี Auto-bid ใน DB แล้วผู้ใช้กดปิด
        payload.clearAutoBid = true;
      }
      const res = await fetch(`/api/auctions/${listing.id}/bid`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Bid ไม่สำเร็จ');
      if (data.auction) {
        setAuction(data.auction);
        setBidAmount(String(data.auction.minNextBid));
      }
      if (!autoBidOn) {
        setMyAutoBidMax(null);
        setMyAutoBidStep(null);
        setMaxBidAmount('');
        setBidStepAmount('');
      }
      await loadListing(headers);
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
        <div className="pd-shell"><div className="pd-loading" /></div>
      </>
    );
  }

  if (!listing) {
    return (
      <>
        <Nav active="market" />
        <div className="pd-shell">
          <div className="pd-empty">
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
      <div className="pd-shell">
        <div className="container">
          <Link
            href={isAuction ? '/marketplace?zone=auction' : '/marketplace'}
            className="pd-back"
          >
            <Icon name="chevronRight" size={16} style={{ transform: 'rotate(180deg)' }} />
            {isAuction ? 'กลับตลาดประมูล' : 'กลับตลาดซื้อขาย'}
          </Link>

          {/* โครงแบบ Shopee: การ์ดเดียว · ซ้ายแกลเลอรี · ขวาข้อมูล */}
          <div className="pd-panel">
            <aside className="pd-media">
              <div className="pd-main">
                {displayImage ? (
                  <img src={displayImage} alt={listing.title} />
                ) : (
                  <div className="pd-main-empty"><Icon name="package" size={56} /></div>
                )}
              </div>
              {images.length > 0 && (
                <div className="pd-thumbs" role="list">
                  {images.map(src => (
                    <button
                      key={src}
                      type="button"
                      role="listitem"
                      className={`pd-thumb${displayImage === src ? ' is-active' : ''}`}
                      onClick={() => setMainImage(src)}
                      aria-label="ดูรูปนี้"
                    >
                      <img src={src} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </aside>

            <section className={`pd-info${isAuction ? ' pd-info--auction' : ''}`}>
              <div className="pd-tags">
                {listing.category && <span className="badge badge-gray">{listing.category}</span>}
                {listing.condition && <span className="badge badge-gray">{listing.condition}</span>}
                {isAuction && <span className="badge badge-purple">🔨 ประมูล</span>}
                {isCertifiedMode(listing.selling_mode) && <span className="badge badge-amber">⭐ Certified</span>}
              </div>

              <h1 className="pd-title">{listing.title}</h1>

              <div className="pd-price-box">
                <span className="pd-price-lbl">
                  {isAuction && auction.bidCount > 0 ? 'ราคาปัจจุบัน' : isAuction ? 'ราคาเริ่ม' : 'ราคา'}
                </span>
                <span className="pd-price">฿{displayPrice.toLocaleString()}</span>
              </div>

              {isAuction && (
                <div className="pd-auction">
                  <div className="pd-auction-cell">
                    <span className="pd-auction-lbl">เหลือเวลา</span>
                    <strong className="pd-auction-val">
                      <AuctionCountdown endsAt={auction.endsAt} endedAt={auction.endedAt} liveClassName="is-live" />
                    </strong>
                  </div>
                  <div className="pd-auction-cell">
                    <span className="pd-auction-lbl">ผู้ประมูล</span>
                    <strong className="pd-auction-val">{auction.uniqueBidderCount} คน · {auction.bidCount} bid</strong>
                  </div>
                  <div className="pd-auction-cell">
                    <span className="pd-auction-lbl">นำอยู่</span>
                    <strong className="pd-auction-val">{auction.currentBidderName || '— ยังไม่มี'}</strong>
                  </div>
                  <div className="pd-auction-cell">
                    <span className="pd-auction-lbl">บิทครั้งละ</span>
                    <strong className="pd-auction-val">฿{auction.bidIncrement.toLocaleString()}</strong>
                  </div>
                </div>
              )}

              {/* ประมูล: กล่อง Bid — เพดาน Auto-bid เหนือปุ่ม Bid (ลำดับสายตา + contrast) */}
              {isAuction && !isOwner && auction.phase === 'live' && (
                <div className="pd-bid">
                  <div className="pd-autobid">
                    <button
                      type="button"
                      className={`pd-autobid-toggle${autoBidOn ? ' is-on' : ''}`}
                      onClick={() => setAutoBidOn(v => !v)}
                      aria-pressed={autoBidOn}
                    >
                      {autoBidOn ? '✓ Auto-bid เปิดอยู่' : '+ เปิด Auto-bid'}
                    </button>
                    {autoBidOn && (
                      <div className="pd-autobid-panel">
                        <label className="pd-bid-lbl pd-bid-lbl--max" htmlFor="pd-max-bid">
                          ราคาสูงสุดที่สู้ (เพดาน Auto-bid)
                        </label>
                        <input
                          id="pd-max-bid"
                          className="pd-bid-input pd-bid-input--max"
                          type="number"
                          min={auction.minNextBid}
                          step={auction.bidIncrement}
                          value={maxBidAmount}
                          onChange={e => setMaxBidAmount(e.target.value)}
                          placeholder={`เช่น ${(auction.minNextBid + auction.bidIncrement * 5).toLocaleString()}`}
                        />
                        <label className="pd-bid-lbl" htmlFor="pd-bid-step" style={{ marginTop: 8 }}>
                          จำนวนเงินต่อบิด (อย่างน้อย ฿{auction.bidIncrement.toLocaleString()})
                        </label>
                        <input
                          id="pd-bid-step"
                          className="pd-bid-input"
                          type="number"
                          min={auction.bidIncrement}
                          step={auction.bidIncrement}
                          value={bidStepAmount || String(auction.bidIncrement)}
                          onChange={e => setBidStepAmount(e.target.value)}
                        />
                        <p className="pd-bid-hint">
                          ถูก overbid แล้วระบบจะสู้เพิ่มทีละจำนวนนี้ จนถึงเพดาน — ทำงานแม้ปิดเว็บ
                        </p>
                        {myAutoBidMax != null && (
                          <p className="pd-bid-auto">
                            บันทึกไว้เพดาน ฿{myAutoBidMax.toLocaleString()}
                            {myAutoBidStep ? ` · ต่อบิด ฿${myAutoBidStep.toLocaleString()}` : ''}
                            {' — กด Bid เพื่ออัปเดต'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {myId && (
                    <div className="pd-line-oa">
                      {hasLineNotify ? (
                        <p className="pd-line-oa-ok">✓ พร้อมรับแจ้ง overbid ผ่าน LINE OA</p>
                      ) : (
                        <>
                          <p className="pd-line-oa-title">รับแจ้งเตือนเมื่อถูกประมูลสูงกว่า</p>
                          <p className="pd-bid-hint">เพิ่มเพื่อน LINE OA แล้วเข้าสู่ระบบด้วย LINE หนึ่งครั้งเพื่อผูกบัญชี</p>
                          <div className="pd-line-oa-actions">
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

                  <div className="pd-bid-row">
                    <div className="pd-bid-field">
                      <label className="pd-bid-lbl" htmlFor="pd-bid-amount">ราคา bid (ขั้นต่ำ ฿{auction.minNextBid.toLocaleString()})</label>
                      <input
                        id="pd-bid-amount"
                        className="pd-bid-input"
                        type="number"
                        min={auction.minNextBid}
                        step={auction.bidIncrement}
                        value={bidAmount}
                        onChange={e => setBidAmount(e.target.value)}
                      />
                    </div>
                    <button type="button" className="btn btn-primary btn-lg pd-bid-btn" onClick={placeBid} disabled={bidding}>
                      {bidding ? '...' : '🔨 Bid'}
                    </button>
                  </div>

                  <div className="pd-bid-foot">
                    {canSellerChat && (
                      <button type="button" className="pd-chat-link" onClick={sellerChatHref}>
                        <Icon name="chat" size={15} /> แชทกับผู้ขาย
                      </button>
                    )}
                    {bidError && <p className="pd-bid-err">{bidError}</p>}
                  </div>
                </div>
              )}

              {isAuction && !isOwner && auction.phase !== 'live' && (
                <div className="pd-note">
                  <div className="pd-note-title">
                    {listing.buyer_id || auction.endedAt ? 'ขายแล้ว · ประมูลปิด' : 'ประมูลปิดแล้ว'}
                  </div>
                  <p>{auction.currentBidderName ? `ผู้ชนะ: ${auction.currentBidderName} · ฿${(auction.currentBid || displayPrice).toLocaleString()}` : 'ไม่มีผู้ bid'}</p>
                  {myId && listing.buyer_id === myId && (
                    <Link href={`/cart/checkout/${listing.id}`} className="btn btn-primary btn-lg" style={{ marginTop: 12 }}>
                      ไปชำระเงิน / ติดตามสถานะ →
                    </Link>
                  )}
                </div>
              )}

              {!isAuction && (
                <div className="pd-row">
                  <span className="pd-row-lbl">ค่าขนส่ง</span>
                  <strong>{shippingCost > 0 ? `฿${shippingCost.toLocaleString()}` : 'ฟรี'}</strong>
                </div>
              )}

              <div className="pd-meta">
                <span><Icon name="user" size={15} /> {listing.seller_name || 'ผู้ขาย'}</span>
                {listing.location && <span><Icon name="mapPin" size={15} /> {listing.location}</span>}
              </div>

              {listing.description && <p className="pd-desc">{listing.description}</p>}

              {sellerShop && (
                <Link href={`/shop/${sellerShop.sellerId || listing.seller_id}`} className="pd-shop">
                  {sellerShop.avatarFileId ? (
                    <img className="pd-shop-av" src={fileViewUrl(DEAL_BUCKET, sellerShop.avatarFileId)} alt="" />
                  ) : (
                    <div className="pd-shop-av pd-shop-av--empty">🏪</div>
                  )}
                  <div className="pd-shop-body">
                    <div className="pd-shop-name">{sellerShop.name}</div>
                    {sellerShop.tagline && <p className="pd-shop-tag">{sellerShop.tagline}</p>}
                    {sellerShop.location && <p className="pd-shop-loc">📍 {sellerShop.location}</p>}
                    <span className="pd-shop-go">เข้าชมหน้าร้าน →</span>
                  </div>
                </Link>
              )}

              {/* ตลาดปกติ / เจ้าของ — ปุ่มซื้อด้านล่าง */}
              <div className="pd-actions">
                {isOwner ? (
                  <Link href={listing.status === 'posted' ? `/marketplace/${listing.id}` : `/deal/${listing.id}`} className="btn btn-primary btn-lg">รายการของคุณ</Link>
                ) : isAuction ? null : buyState === 'sold' || buyState === 'reserved' ? (
                  <div className="pd-note">
                    <div className="pd-note-title">
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
                      <div className="pd-ship">
                        <div className="pd-ship-lbl">เลือกขนส่ง</div>
                        <div className="pd-ship-list">
                          {shippingProviders.map(id => (
                            <button
                              key={id}
                              type="button"
                              className={`pd-ship-chip${selectedShipping === id ? ' is-active' : ''}`}
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
                    <p className="pd-escrow-note">
                      เมื่อกดซื้อ ระบบจะพาไปยืนยันที่อยู่จัดส่งและชำระเงิน — ไม่มีคนกลาง ผู้ขายจัดส่งตรงถึงคุณ
                    </p>
                  </>
                ) : (
                  <div className="pd-note">
                    <div className="pd-note-title">สินค้าไม่พร้อมขาย</div>
                    <p>รายการนี้ไม่เปิดขายบนตลาดแล้ว</p>
                    <Link href="/marketplace" className="btn btn-soft btn-lg" style={{ marginTop: 12 }}>กลับตลาดซื้อขาย</Link>
                  </div>
                )}
              </div>

              {isAuction && auctionBids.length > 0 && (
                <div className="pd-history">
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
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
