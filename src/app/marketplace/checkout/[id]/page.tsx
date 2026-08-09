'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Nav, Footer } from '@/components/Site';
import { Icon } from '@/components/Icon';
import { MarketplacePaymentSection } from '@/components/marketplace/MarketplacePaymentSection';
import { MarketplaceShippingSection } from '@/components/marketplace/MarketplaceShippingSection';
import { MarketplaceOrderStatusSection } from '@/components/marketplace/MarketplaceOrderStatusSection';
import { authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { compressImage } from '@/lib/imageCompress';
import { marketplaceCheckoutStepIndex, type MarketplaceCheckoutPhase } from '@/lib/marketplaceOrder';
import type { ProfileAddressFields } from '@/lib/profileAddress';

interface CheckoutData {
  order: {
    id: string;
    title: string;
    price: number;
    shippingCost: number;
    payAmount: number;
    status: string;
    statusLabel: string;
    sellerName: string;
    paymentSlipFileId: string;
    shippingProviderLabel: string;
    trackingNumber: string;
    trackingProvider: string;
    listGrossPrice?: number | null;
  };
  profile: {
    displayName: string;
    phone: string;
    address: string;
  };
  shippingConfirmed: boolean;
  phase: MarketplaceCheckoutPhase;
  imageFileId: string;
}

const STEP_LABELS = ['ที่อยู่จัดส่ง', 'ชำระเงิน', 'ติดตามสถานะ'];

function imgUrl(fileId: string) {
  return fileViewUrl(DEAL_BUCKET, fileId);
}

export default function MarketplaceCheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [data, setData] = useState<CheckoutData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers.Authorization) {
      router.replace(`/login?returnTo=${encodeURIComponent(`/marketplace/checkout/${orderId}`)}`);
      return null;
    }
    const r = await fetch(`/api/marketplace/checkout/${orderId}`, { headers });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'โหลดไม่สำเร็จ');
    return d as CheckoutData;
  }, [orderId, router]);

  useEffect(() => {
    (async () => {
      try {
        const d = await load();
        if (d) setData(d);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'โหลดไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  async function refresh() {
    const d = await load();
    if (d) setData(d);
  }

  async function confirmShipping(payload: { phone: string } & ProfileAddressFields) {
    setSaving(true);
    setError('');
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/marketplace/checkout/${orderId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_shipping', ...payload }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'บันทึกไม่สำเร็จ');
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function uploadSlip(file: File) {
    setActing(true);
    try {
      const headers = await authHeaders();
      const prepared = await compressImage(file);
      const form = new FormData();
      form.append('file', prepared);
      const up = await fetch('/api/upload-deal', { method: 'POST', headers, body: form });
      const upData = await up.json();
      if (!up.ok) throw new Error(upData.error || 'อัปโหลดไม่สำเร็จ');
      const r = await fetch(`/api/deals/${orderId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upload_payment', fileId: upData.fileId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'ส่งสลิปไม่สำเร็จ');
      await refresh();
    } finally {
      setActing(false);
    }
  }

  async function confirmReceived() {
    if (!confirm('ยืนยันว่าได้รับสินค้าแล้ว?')) return;
    setActing(true);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/deals/${orderId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'buyer_received' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'ยืนยันไม่สำเร็จ');
      await refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'ยืนยันไม่สำเร็จ');
    } finally {
      setActing(false);
    }
  }

  async function cancelOrder() {
    if (!confirm('ยกเลิกคำสั่งซื้อนี้? สินค้าจะกลับไปเปิดขายบนตลาด')) return;
    setActing(true);
    try {
      const headers = await authHeaders();
      const r = await fetch(`/api/deals/${orderId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'ยกเลิกไม่สำเร็จ');
      router.push('/cart?tab=orders');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'ยกเลิกไม่สำเร็จ');
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <>
        <Nav />
        <div className="mkt-co-shell"><div className="mkt-detail-loading" /></div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Nav />
        <div className="mkt-co-shell">
          <div className="container">
            <p className="rv-error">{error || 'ไม่พบคำสั่งซื้อ'}</p>
            <Link href="/cart?tab=orders" className="btn btn-primary">กลับตะกร้า</Link>
          </div>
        </div>
      </>
    );
  }

  const { order, profile, phase } = data;
  const stepIdx = marketplaceCheckoutStepIndex(phase);
  const thumb = data.imageFileId ? imgUrl(data.imageFileId) : '';
  const awaitingSlip = !order.paymentSlipFileId && ['posted', 'payment_pending'].includes(order.status);

  return (
    <>
      <Nav />
      <div className="mkt-co-shell">
        <div className="container mkt-co-layout">
          <div className="mkt-co-head">
            <Link href="/cart?tab=orders" className="btn btn-ghost btn-sm">
              <Icon name="chevronRight" size={16} style={{ transform: 'rotate(180deg)' }} /> ตะกร้า
            </Link>
            <h1>ยืนยันคำสั่งซื้อ</h1>
          </div>

          <div className="mkt-co-steps">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className={`mkt-co-step${i + 1 <= stepIdx ? ' active' : ''}${i + 1 === stepIdx ? ' current' : ''}`}>
                <span className="mkt-co-step-num">{i + 1}</span>
                <span className="mkt-co-step-label">{label}</span>
              </div>
            ))}
          </div>

          <div className="mkt-co-grid">
            <aside className="mkt-co-summary">
              <div className="mkt-co-product">
                <div className="mkt-co-product-thumb">
                  {thumb ? <img src={thumb} alt="" /> : <Icon name="package" size={28} />}
                </div>
                <div>
                  <div className="mkt-co-product-title">{order.title}</div>
                  <div className="mkt-co-product-meta">ผู้ขาย: {order.sellerName}</div>
                  {order.shippingProviderLabel && (
                    <div className="mkt-co-product-meta">ขนส่ง: {order.shippingProviderLabel}</div>
                  )}
                </div>
              </div>
              <div className="mkt-co-summary-rows">
                <div><span>ราคาสินค้า</span><span>฿{order.price.toLocaleString()}</span></div>
                {order.shippingCost > 0 && (
                  <div><span>ค่าขนส่ง</span><span>฿{order.shippingCost.toLocaleString()}</span></div>
                )}
                <div className="mkt-co-summary-total">
                  <span>ยอดชำระ</span>
                  <strong>฿{order.payAmount.toLocaleString()}</strong>
                </div>
              </div>
            </aside>

            <main className="mkt-co-main">
              {error && <p className="rv-error">{error}</p>}

              {phase === 'address' && (
                <MarketplaceShippingSection
                  displayName={profile.displayName}
                  phone={profile.phone}
                  address={profile.address}
                  shippingProviderLabel={order.shippingProviderLabel}
                  saving={saving}
                  onConfirm={confirmShipping}
                />
              )}

              {phase === 'payment' && (
                <>
                  <div className="mkt-co-card mkt-co-addr-mini">
                    <div className="mkt-co-card-head">
                      <h2>📍 จัดส่งไปที่</h2>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={async () => {
                        const headers = await authHeaders();
                        const r = await fetch(`/api/marketplace/checkout/${orderId}`, {
                          method: 'PATCH',
                          headers: { ...headers, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'edit_shipping' }),
                        });
                        if (r.ok) await refresh();
                      }}>แก้ไข</button>
                    </div>
                    <div className="mkt-co-addr-line">{profile.displayName}</div>
                    <div className="mkt-co-addr-line">{profile.phone}</div>
                    <div className="mkt-co-addr-line">{profile.address}</div>
                  </div>
                  <MarketplacePaymentSection
                    deal={{
                      price: order.price,
                      shipping_cost: order.shippingCost,
                      buyer_name: profile.displayName,
                      seller_name: order.sellerName,
                      payment_slip_file_id: order.paymentSlipFileId,
                      status: order.status,
                      list_gross_price: order.listGrossPrice,
                    }}
                    myRole="buyer"
                    awaitingSlip={awaitingSlip}
                    onUploadSlip={uploadSlip}
                  />
                  {!order.paymentSlipFileId && (
                    <button type="button" className="btn btn-ghost btn-block" disabled={acting} onClick={cancelOrder} style={{ color: '#b22441', marginTop: 8 }}>
                      ยกเลิกคำสั่งซื้อ
                    </button>
                  )}
                </>
              )}

              {phase === 'status' && (
                <MarketplaceOrderStatusSection
                  order={{
                    status: order.status,
                    statusLabel: order.statusLabel,
                    trackingNumber: order.trackingNumber,
                    trackingProvider: order.trackingProvider,
                    paymentSlipFileId: order.paymentSlipFileId,
                  }}
                  acting={acting}
                  onConfirmReceived={confirmReceived}
                  onCancel={['posted', 'payment_pending'].includes(order.status) && !order.paymentSlipFileId ? cancelOrder : undefined}
                />
              )}
            </main>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
