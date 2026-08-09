'use client';

import Link from 'next/link';
import { buildTrackingUrl, getLogisticsProviderLabel } from '@/lib/logistics';
import { marketplaceOrderStatusLabel } from '@/lib/marketplaceOrder';

type OrderStatus = {
  status: string;
  statusLabel?: string;
  trackingNumber?: string;
  trackingProvider?: string;
  paymentSlipFileId?: string;
};

type Props = {
  order: OrderStatus;
  acting: boolean;
  onConfirmReceived: () => Promise<void>;
  onCancel?: () => Promise<void>;
};

export function MarketplaceOrderStatusSection({ order, acting, onConfirmReceived, onCancel }: Props) {
  const label = order.statusLabel || marketplaceOrderStatusLabel(order.status);
  const trackingUrl = order.trackingNumber && order.trackingProvider
    ? buildTrackingUrl(order.trackingProvider, order.trackingNumber)
    : '';

  const steps = [
    { key: 'pay', label: 'ชำระเงิน', done: !!order.paymentSlipFileId || !['posted', 'payment_pending'].includes(order.status) },
    { key: 'verify', label: 'ตรวจสอบ', done: ['packing', 'shipped_to_buyer', 'delivered', 'completed'].includes(order.status) },
    { key: 'pack', label: 'แพ็ค/จัดส่ง', done: ['shipped_to_buyer', 'delivered', 'completed'].includes(order.status) },
    { key: 'done', label: 'สำเร็จ', done: order.status === 'completed' },
  ];

  return (
    <div className="mkt-co-card">
      <h2>📦 สถานะคำสั่งซื้อ</h2>
      <div className="mkt-co-status-badge">{label}</div>

      <div className="mkt-co-timeline">
        {steps.map((s, i) => (
          <div key={s.key} className={`mkt-co-timeline-item${s.done ? ' done' : ''}`}>
            <div className="mkt-co-timeline-dot">{s.done ? '✓' : i + 1}</div>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {order.status === 'payment_uploaded' && (
        <p className="mkt-co-hint">ส่งสลิปแล้ว — รอทีมงานตรวจสอบการชำระเงิน (โดยปกติไม่เกิน 1 วันทำการ)</p>
      )}
      {order.status === 'packing' && (
        <p className="mkt-co-hint">ผู้ขายกำลังแพ็คสินค้า — จะแจ้งเลขพัสดุเมื่อจัดส่งแล้ว</p>
      )}
      {(order.status === 'shipped_to_buyer' || order.status === 'delivered') && order.trackingNumber && (
        <div className="mkt-co-tracking">
          <div className="mkt-co-tracking-title">🚚 เลขพัสดุ</div>
          <div className="mkt-co-tracking-row">
            <span>{getLogisticsProviderLabel(order.trackingProvider || '')}</span>
            <strong>{order.trackingNumber}</strong>
          </div>
          {trackingUrl && (
            <a href={trackingUrl} target="_blank" rel="noreferrer" className="btn btn-soft btn-sm">
              ติดตามพัสดุ →
            </a>
          )}
        </div>
      )}

      {(order.status === 'shipped_to_buyer' || order.status === 'delivered') && (
        <button type="button" className="btn btn-green btn-block btn-lg" disabled={acting} onClick={onConfirmReceived}>
          {acting ? 'กำลังยืนยัน...' : '🎉 ได้รับสินค้าแล้ว'}
        </button>
      )}

      {order.status === 'completed' && (
        <p className="mkt-co-success">✅ คำสั่งซื้อสำเร็จ — ขอบคุณที่ใช้บริการ</p>
      )}

      {order.status === 'cancelled' && (
        <p className="mkt-co-hint">คำสั่งซื้อนี้ถูกยกเลิกแล้ว</p>
      )}

      {onCancel && ['posted', 'payment_pending'].includes(order.status) && !order.paymentSlipFileId && (
        <button type="button" className="btn btn-ghost btn-block" disabled={acting} onClick={onCancel} style={{ color: '#b22441', marginTop: 8 }}>
          ยกเลิกคำสั่งซื้อ
        </button>
      )}

      <Link href="/cart?tab=orders" className="btn btn-ghost btn-block" style={{ marginTop: 8 }}>
        ดูคำสั่งซื้อทั้งหมด
      </Link>
    </div>
  );
}
