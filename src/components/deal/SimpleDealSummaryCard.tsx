'use client';

import { DealProductGallery } from '@/components/deal/DealProductGallery';

type Props = {
  title: string;
  description?: string;
  price: number;
  shippingCost?: number | null;
  images?: string[];
  warrantyYears?: number | null;
  warrantyMonths?: number | null;
  warrantyDays?: number | null;
  feePayer?: string | null;
};

function feePayerLabel(fp?: string | null) {
  if (fp === 'buyer') return 'ผู้ซื้อ';
  if (fp === 'seller') return 'ผู้ขาย';
  if (fp === 'split') return 'หารครึ่ง';
  return '';
}

/** การ์ดสรุปสินค้า — ใช้ร่วมกันระหว่างผู้สร้างดีล (รอ join) กับผู้เข้าร่วม */
export function SimpleDealSummaryCard({
  title,
  description,
  price,
  shippingCost,
  images,
  warrantyYears,
  warrantyMonths,
  warrantyDays,
  feePayer,
}: Props) {
  const fpLabel = feePayerLabel(feePayer);
  const shipCost = Math.max(0, Math.round(Number(shippingCost) || 0));

  return (
    <div className="dr-card simple-deal-summary">
      <div className="simple-deal-summary-title">{title}</div>
      {description ? <p className="simple-deal-summary-desc">{description}</p> : null}

      <DealProductGallery
        images={images}
        warrantyYears={warrantyYears}
        warrantyMonths={warrantyMonths}
        warrantyDays={warrantyDays}
      />

      <div className="simple-deal-summary-price">
        ฿{(price + shipCost).toLocaleString()}
        {shipCost > 0 && <span className="simple-deal-summary-shipping"> (รวมขนส่ง ฿{shipCost.toLocaleString()})</span>}
      </div>

      {fpLabel && (
        <div className="simple-deal-summary-fee">
          💸 ผู้จ่ายค่าบริการ: <strong>{fpLabel}</strong>
          <span className="simple-deal-summary-fee-note"> (กำหนดตอนสร้างดีล)</span>
        </div>
      )}
    </div>
  );
}
