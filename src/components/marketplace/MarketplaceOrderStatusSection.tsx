'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { buildTrackingUrl, getLogisticsProviderLabel } from '@/lib/logistics';
import { marketplaceOrderStatusLabel } from '@/lib/marketplaceOrder';
import { fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';

type PackingStep = {
  step: number;
  label: string;
  fileId?: string;
  fileName?: string;
  uploaded?: boolean;
};

type OrderStatus = {
  status: string;
  statusLabel?: string;
  trackingNumber?: string;
  trackingProvider?: string;
  paymentSlipFileId?: string;
  packingSteps?: PackingStep[];
};

type Props = {
  order: OrderStatus;
  acting: boolean;
  onConfirmReceived: () => Promise<void>;
  onCancel?: () => Promise<void>;
};

function mediaUrl(fileId: string) {
  return fileViewUrl(DEAL_BUCKET, fileId);
}

function isVideo(name?: string) {
  return !!name?.match(/\.(mp4|mov|avi|webm)$/i);
}

export function MarketplaceOrderStatusSection({ order, acting, onConfirmReceived, onCancel }: Props) {
  const label = order.statusLabel || marketplaceOrderStatusLabel(order.status);
  const trackingUrl = order.trackingNumber && order.trackingProvider
    ? buildTrackingUrl(order.trackingProvider, order.trackingNumber)
    : '';
  const packingSteps = order.packingSteps || [];
  const packingUploadedCount = packingSteps.filter(s => s.uploaded).length;
  const showPacking = packingUploadedCount > 0
    || ['packing', 'shipped_to_buyer', 'delivered', 'completed'].includes(order.status);

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
        <p className="mkt-co-hint">
          ผู้ขายกำลังแพ็คสินค้า
          {packingUploadedCount > 0 ? ` — อัปโหลดแล้ว ${packingUploadedCount}/3 ขั้น` : ' — จะแจ้งเลขพัสดุเมื่อจัดส่งแล้ว'}
        </p>
      )}

      {showPacking && (
        <div className="mkt-co-packing">
          <div className="mkt-co-packing-title">📷 หลักฐานแพ็คจากผู้ขาย</div>
          {packingUploadedCount === 0 ? (
            <p className="mkt-co-hint">ผู้ขายยังไม่ได้อัปโหลดรูป/วิดีโอแพ็ค — จะแสดงที่นี่เมื่ออัปแล้ว</p>
          ) : (
            <div className="mkt-co-packing-grid">
              {packingSteps.map(step => (
                <div key={step.step} className={`mkt-co-packing-slot${step.uploaded ? ' done' : ''}`}>
                  <div className="mkt-co-packing-label">ขั้น {step.step} · {step.label}</div>
                  <div className="mkt-co-packing-media">
                    {step.uploaded && step.fileId ? (
                      isVideo(step.fileName)
                        ? <video src={mediaUrl(step.fileId)} controls />
                        : <img src={mediaUrl(step.fileId)} alt={step.label} />
                    ) : (
                      <span>{step.step}</span>
                    )}
                  </div>
                  <div className="mkt-co-packing-caption">
                    {step.uploaded ? `✅ ${step.label}` : `⏳ รอ${step.label}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
        <p className="mkt-co-success">✅ คำสั่งซื้อสำเร็จ — ช่วยให้ดาวรีวิวผู้ขายด้านล่างนะคะ</p>
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
