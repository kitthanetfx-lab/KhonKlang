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
  images: string[];
  status: string;
}

function imgUrl(fileId: string) {
  return fileViewUrl(DEAL_BUCKET, fileId);
}

export default function MarketplaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myId, setMyId] = useState('');
  const [hdrs, setHdrs] = useState<Record<string, string>>({});
  const [mainImage, setMainImage] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [joining, setJoining] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const syncCart = () => setCartCount(getCartCount());
    syncCart();
    window.addEventListener('khonklang-cart-updated', syncCart);
    return () => window.removeEventListener('khonklang-cart-updated', syncCart);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/deals/${listingId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'ไม่พบสินค้า');
          return;
        }
        setListing(data.deal || null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    })();
  }, [listingId]);

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
  const canDirectBuy = supportsDirectPurchase(listing.selling_mode);
  const canEscrowBuy = supportsEscrowPurchase(listing.selling_mode);
  const canSellerChat = supportsSellerChat(listing.selling_mode);

  return (
    <>
      <Nav active="market" />
      <div className="mkt-detail-shell">
        <div className="container">
          <div className="mkt-detail-top">
            <Link href="/marketplace" className="btn btn-ghost btn-sm"><Icon name="chevronRight" size={16} style={{ transform: 'rotate(180deg)' }} /> กลับสู่ตลาด</Link>
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
                {isCertifiedMode(listing.selling_mode) && <span className="badge badge-amber">⭐ Certified</span>}
              </div>

              <h1 className="mkt-detail-title">{listing.title}</h1>
              <div className="mkt-detail-price">฿{(listing.price || 0).toLocaleString()}</div>
              <div className="mkt-detail-meta">
                <span><Icon name="user" size={15} /> {listing.seller_name || 'ผู้ขาย'}</span>
                {listing.location && <span><Icon name="mapPin" size={15} /> {listing.location}</span>}
              </div>

              {listing.description && <p className="mkt-detail-desc">{listing.description}</p>}

              <div className="mkt-detail-actions">
                {isOwner ? (
                  <Link href={`/deal/${listing.id}`} className="btn btn-primary btn-lg">รายการของคุณ</Link>
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
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
