'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Nav, Footer } from '@/components/Site';
import { Icon } from '@/components/Icon';
import { account } from '@/lib/appwrite';
import { addToCart, getCartCount } from '@/lib/cart';
import { isCertifiedMode, supportsDirectPurchase, supportsEscrowPurchase, supportsSellerChat } from '@/lib/listingMode';

interface ListingDetail {
  $id: string;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  location: string;
  sellingMode: string;
  imageFileIds: string;
  status: string;
}

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const BUCKET_ID = 'deal_files';

function imgUrl(fileId: string) {
  return `${ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileId}/view?project=${PROJECT}`;
}

export default function MarketplaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myId, setMyId] = useState('');
  const [jwt, setJwt] = useState('');
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
      try {
        const user = await account.get();
        setMyId(user.$id);
        const token = (await account.createJWT()).jwt;
        setJwt(token);
      } catch {
        // Guests can still view details and use local cart.
      }
    })();
  }, []);

  const images = useMemo(() => {
    if (!listing) return [] as string[];
    try {
      const ids = JSON.parse(listing.imageFileIds || '[]') as string[];
      return ids.map(imgUrl);
    } catch {
      return [];
    }
  }, [listing]);

  useEffect(() => {
    if (images.length && !mainImage) setMainImage(images[0]);
  }, [images, mainImage]);

  function pushToCart(goToCart = false) {
    if (!listing) return;
    setAdding(true);
    addToCart({
      dealId: listing.$id,
      title: listing.title,
      price: listing.price,
      imageUrl: images[0] || '',
      sellerName: listing.sellerName || 'ผู้ขาย',
      location: listing.location || '',
    });
    setCartCount(getCartCount());
    setAdding(false);
    if (goToCart) router.push('/cart');
  }

  async function buyViaEscrow() {
    if (!listing) return;
    if (!myId) {
      router.push(`/login?returnTo=${encodeURIComponent(`/marketplace/${listing.$id}`)}`);
      return;
    }
    setJoining(true);
    try {
      const token = jwt || (await account.createJWT()).jwt;
      const res = await fetch(`/api/deals/${listing.$id}`, {
        method: 'PATCH',
        headers: { 'x-session-jwt': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join_as_buyer' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'ยังไม่สามารถซื้อผ่านคนกลางได้');
        return;
      }
      router.push(`/deal/${listing.$id}`);
    } finally {
      setJoining(false);
    }
  }

  async function openSellerChat() {
    if (!listing) return;
    if (!myId) {
      router.push(`/login?returnTo=${encodeURIComponent(`/marketplace/${listing.$id}`)}`);
      return;
    }
    setJoining(true);
    try {
      const token = jwt || (await account.createJWT()).jwt;
      const res = await fetch(`/api/deals/${listing.$id}`, {
        method: 'PATCH',
        headers: { 'x-session-jwt': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join_as_buyer' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !String(data.error || '').includes('มีผู้ซื้อแล้ว')) {
        alert(data.error || 'ยังไม่สามารถเปิดแชทกับผู้ขายได้');
        return;
      }
      router.push(`/deal/${listing.$id}?tab=chat`);
    } finally {
      setJoining(false);
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

  const isOwner = listing.sellerId === myId;
  const canDirectBuy = supportsDirectPurchase(listing.sellingMode);
  const canEscrowBuy = supportsEscrowPurchase(listing.sellingMode);
  const canSellerChat = supportsSellerChat(listing.sellingMode);

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
                {mainImage ? (
                  <Image src={mainImage} alt={listing.title} fill sizes="(max-width: 1040px) 100vw, 560px" style={{ objectFit: 'cover' }} />
                ) : (
                  <div className="mkt-detail-fallback"><Icon name="package" size={56} /></div>
                )}
              </div>
              {images.length > 1 && (
                <div className="mkt-detail-thumbs">
                  {images.map(src => (
                    <button key={src} type="button" className={`mkt-detail-thumb${mainImage === src ? ' active' : ''}`} onClick={() => setMainImage(src)}>
                      <Image src={src} alt={listing.title} width={84} height={84} style={{ objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="mkt-detail-info">
              <div className="mkt-detail-badges">
                {listing.category && <span className="badge badge-gray">{listing.category}</span>}
                {listing.condition && <span className="badge badge-gray">{listing.condition}</span>}
                {isCertifiedMode(listing.sellingMode) && <span className="badge badge-amber">⭐ Certified</span>}
              </div>

              <h1 className="mkt-detail-title">{listing.title}</h1>
              <div className="mkt-detail-price">฿{(listing.price || 0).toLocaleString()}</div>
              <div className="mkt-detail-meta">
                <span><Icon name="user" size={15} /> {listing.sellerName || 'ผู้ขาย'}</span>
                {listing.location && <span><Icon name="mapPin" size={15} /> {listing.location}</span>}
              </div>

              {listing.description && <p className="mkt-detail-desc">{listing.description}</p>}

              <div className="mkt-detail-actions">
                {isOwner ? (
                  <Link href={`/deal/${listing.$id}`} className="btn btn-primary btn-lg">รายการของคุณ</Link>
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
                      <button type="button" className="btn btn-soft btn-lg" onClick={openSellerChat} disabled={joining}>
                        <Icon name="chat" size={18} /> {joining ? 'กำลังเปิดแชท...' : 'แชทกับผู้ขาย'}
                      </button>
                    )}
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
