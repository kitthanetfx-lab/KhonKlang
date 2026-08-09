'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';

export interface MarketplaceOrder {
  id: string;
  title: string;
  price: number;
  status: string;
  statusLabel: string;
  shippingCost: number;
  payAmount: number;
  sellerName: string;
  hasSlip: boolean;
  createdAt: string;
  imageFileId: string;
  isActive: boolean;
}

function imgUrl(fileId: string) {
  return fileViewUrl(DEAL_BUCKET, fileId);
}

function OrderCard({ order }: { order: MarketplaceOrder }) {
  const href = `/marketplace/checkout/${order.id}`;
  const thumb = order.imageFileId ? imgUrl(order.imageFileId) : '';
  return (
    <Link href={href} className="mkt-order-card">
      <div className="mkt-order-thumb">
        {thumb ? <img src={thumb} alt="" /> : <Icon name="package" size={28} />}
      </div>
      <div className="mkt-order-body">
        <div className="mkt-order-title">{order.title}</div>
        <div className="mkt-order-meta">
          <span className={`mkt-order-status${order.isActive ? ' active' : ''}`}>{order.statusLabel}</span>
          <span>฿{order.payAmount.toLocaleString()}</span>
          {order.sellerName && <span>ผู้ขาย: {order.sellerName}</span>}
        </div>
      </div>
      <Icon name="chevronRight" size={18} />
    </Link>
  );
}

/** รายการคำสั่งซื้อตลาด — ใช้ในแท็บตะกร้า */
export function MarketplaceOrdersPanel() {
  const router = useRouter();
  const [orders, setOrders] = useState<MarketplaceOrder[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const headers = await authHeaders();
      if (!headers.Authorization) {
        router.push(`/login?returnTo=${encodeURIComponent('/cart?tab=orders')}`);
        return;
      }
      try {
        const r = await fetch('/api/marketplace/orders', { headers });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'โหลดไม่สำเร็จ');
        setOrders(d.orders || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'โหลดไม่สำเร็จ');
      }
    })();
  }, [router]);

  const active = (orders || []).filter(o => o.isActive);
  const done = (orders || []).filter(o => !o.isActive && o.status === 'completed');
  const other = (orders || []).filter(o => !o.isActive && o.status !== 'completed');

  if (error) return <p className="rv-error">{error}</p>;
  if (orders === null) return <div className="mkt-detail-loading" />;

  if (orders.length === 0) {
    return (
      <div className="mkt-orders-empty">
        <Icon name="shoppingCart" size={40} />
        <p>ยังไม่มีคำสั่งซื้อ</p>
        <Link href="/marketplace" className="btn btn-primary">ไปเลือกซื้อสินค้า</Link>
      </div>
    );
  }

  return (
    <div className="cart-orders-panel">
      {active.length > 0 && (
        <section className="mkt-orders-section">
          <h2>กำลังดำเนินการ ({active.length})</h2>
          <div className="mkt-orders-list">
            {active.map(o => <OrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}
      {done.length > 0 && (
        <section className="mkt-orders-section">
          <h2>สำเร็จแล้ว ({done.length})</h2>
          <div className="mkt-orders-list">
            {done.map(o => <OrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}
      {other.length > 0 && (
        <section className="mkt-orders-section">
          <h2>ยกเลิก / อื่นๆ ({other.length})</h2>
          <div className="mkt-orders-list">
            {other.map(o => <OrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}
    </div>
  );
}
