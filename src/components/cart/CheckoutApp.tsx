'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import {
  AppPage,
  AppHeader,
  AppFeed,
  AppLoading,
  AppEmpty,
} from '@/components/mobile';

const STEP_LABELS = ['ที่อยู่จัดส่ง', 'ชำระเงิน', 'ติดตามสถานะ'];

type OrderSummary = {
  title: string;
  price: number;
  shippingCost: number;
  payAmount: number;
  sellerName: string;
  shippingProviderLabel?: string;
};

type Props = {
  loading?: boolean;
  error?: string;
  stepIdx: number;
  order?: OrderSummary;
  thumb?: string;
  children?: ReactNode;
  backHref?: string;
};

export function CheckoutApp({
  loading,
  error,
  stepIdx,
  order,
  thumb,
  children,
  backHref = '/cart?tab=orders',
}: Props) {
  if (loading) {
    return (
      <AppPage withBottomNav={false}>
        <AppHeader title="ยืนยันคำสั่งซื้อ" backHref={backHref} />
        <AppLoading />
      </AppPage>
    );
  }

  if (!order) {
    return (
      <AppPage withBottomNav={false}>
        <AppHeader title="ยืนยันคำสั่งซื้อ" backHref={backHref} />
        <AppFeed>
          <AppEmpty action={<Link href={backHref} className="btn btn-primary co-app-cta">กลับตะกร้า</Link>}>
            {error || 'ไม่พบคำสั่งซื้อ'}
          </AppEmpty>
        </AppFeed>
      </AppPage>
    );
  }

  return (
    <AppPage withBottomNav={false}>
      <AppHeader title="ยืนยันคำสั่งซื้อ" backHref={backHref} />

      <div className="co-app-steps" aria-label="ขั้นตอนชำระเงิน">
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className={`co-app-step${i + 1 <= stepIdx ? ' is-done' : ''}${i + 1 === stepIdx ? ' is-current' : ''}`}
          >
            <span className="co-app-step-num">{i + 1}</span>
            <span className="co-app-step-label">{label}</span>
          </div>
        ))}
      </div>

      <AppFeed>
        <div className="co-app-product app-card">
          <div className="co-app-product-thumb">
            {thumb ? <img src={thumb} alt="" /> : <Icon name="package" size={28} />}
          </div>
          <div className="co-app-product-body">
            <div className="co-app-product-title">{order.title}</div>
            <div className="co-app-product-meta">ผู้ขาย: {order.sellerName}</div>
            {order.shippingProviderLabel && (
              <div className="co-app-product-meta">ขนส่ง: {order.shippingProviderLabel}</div>
            )}
          </div>
        </div>

        <div className="co-app-summary app-card">
          <div className="co-app-summary-row">
            <span>ราคาสินค้า</span>
            <span>฿{order.price.toLocaleString()}</span>
          </div>
          {order.shippingCost > 0 && (
            <div className="co-app-summary-row">
              <span>ค่าขนส่ง</span>
              <span>฿{order.shippingCost.toLocaleString()}</span>
            </div>
          )}
          <div className="co-app-summary-total">
            <span>ยอดชำระ</span>
            <strong>฿{order.payAmount.toLocaleString()}</strong>
          </div>
        </div>

        {error && <p className="rv-error co-app-error">{error}</p>}

        <div className="co-app-main">{children}</div>
      </AppFeed>
    </AppPage>
  );
}

export default CheckoutApp;
