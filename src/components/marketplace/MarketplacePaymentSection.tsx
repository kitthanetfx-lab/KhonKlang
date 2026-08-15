'use client';

import { useRef } from 'react';
import { PaymentMethods } from '@/components/PaymentMethods';
import { marketplaceBuyerPayAmount, marketplaceShippingCost } from '@/lib/marketplaceOrder';

export type MarketplacePaymentDeal = {
  price: number;
  shipping_cost?: number | null;
  buyer_name?: string | null;
  seller_name?: string | null;
  payment_slip_file_id?: string | null;
  status: string;
  list_gross_price?: number | null;
};

type Props = {
  deal: MarketplacePaymentDeal;
  myRole: string;
  awaitingSlip: boolean;
  onUploadSlip: (file: File) => Promise<void>;
};

/** ขั้นโอนเงิน — ตลาดซื้อขายเท่านั้น (ราคาสินค้า + ค่าขนส่ง) */
export function MarketplacePaymentSection({ deal, myRole, awaitingSlip, onUploadSlip }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const shipCost = marketplaceShippingCost(deal);
  const buyerShouldPay = marketplaceBuyerPayAmount(deal);
  const sellerNet = Math.max(0, Math.round(Number(deal.list_gross_price) || deal.price)) + shipCost;

  return (
    <div className="dr-card dr-pay-card mkt-pay-card">
      <div className="dr-card-title">
        {myRole === 'buyer' ? '💳 ยอดที่คุณต้องโอน' : '💳 สรุปการชำระเงิน (ตลาด)'}
      </div>
      <div className="dr-pay-amount">฿{buyerShouldPay.toLocaleString()}</div>

      <div className="mkt-pay-summary">
        <div className="mkt-pay-summary-title">📋 สรุปยอดชำระ</div>
        <div className="mkt-pay-row">
          <span>ราคาสินค้า</span>
          <span>฿{deal.price.toLocaleString()}</span>
        </div>
        {shipCost > 0 && (
          <div className="mkt-pay-row">
            <span>ค่าขนส่ง</span>
            <span>฿{shipCost.toLocaleString()}</span>
          </div>
        )}
        <div className="mkt-pay-row mkt-pay-row-total">
          <span>ยอดที่ต้องชำระ</span>
          <span>฿{buyerShouldPay.toLocaleString()}</span>
        </div>
        <p className="mkt-pay-note">
          = ราคาสินค้า ฿{deal.price.toLocaleString()}
          {shipCost > 0 ? ` + ค่าขนส่ง ฿${shipCost.toLocaleString()}` : ''}
          {' '}(ราคารวมค่าบริการแพลตฟอร์มแล้ว)
        </p>
        <div className="mkt-pay-row mkt-pay-row-total mkt-pay-row-seller">
          <span>ผู้ขายได้รับสุทธิเมื่อสำเร็จ</span>
          <span>฿{sellerNet.toLocaleString()}</span>
        </div>
        {shipCost > 0 && (
          <p className="mkt-pay-note">
            = สินค้า ฿{Math.max(0, Math.round(Number(deal.list_gross_price) || deal.price)).toLocaleString()} + ขนส่ง ฿{shipCost.toLocaleString()}
          </p>
        )}
      </div>

      <div className="mkt-pay-status-rows">
        <div className={`mkt-pay-status${deal.payment_slip_file_id ? ' ok' : ''}`}>
          <span>ผู้ซื้อ {deal.buyer_name || '-'}</span>
          <span>{deal.payment_slip_file_id ? '✅ ส่งสลิปแล้ว' : '⏳ รอส่งสลิป'}</span>
        </div>
        <div className="mkt-pay-status ok">
          <span>ผู้ขาย {deal.seller_name || '-'}</span>
          <span>✅ ไม่ต้องชำระเพิ่ม</span>
        </div>
      </div>

      {awaitingSlip && myRole === 'buyer' && (
        <div className="mkt-pay-bank-box">
          <div className="mkt-pay-bank-title">🏦 ชำระเงินผ่านโอนธนาคาร</div>
          <PaymentMethods
            amount={buyerShouldPay}
            note={`โอน ฿${buyerShouldPay.toLocaleString()} (ราคาสินค้า${shipCost > 0 ? ' + ค่าขนส่ง' : ''}) แล้วอัปโหลดสลิป`}
          />
          <button type="button" className="btn btn-green btn-block" style={{ marginTop: 12 }} onClick={() => inputRef.current?.click()}>
            📎 โอนแล้ว — อัปโหลดสลิป
          </button>
        </div>
      )}

      {deal.status === 'payment_uploaded' && myRole === 'buyer' && (
        <div className="dr-slip-status">✅ ส่งสลิปแล้ว — รอตรวจสอบการชำระเงิน</div>
      )}

      {awaitingSlip && myRole === 'seller' && (
        <p className="mkt-pay-wait-seller">รอผู้ซื้อชำระเงิน</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        style={{ display: 'none' }}
        onChange={async e => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            await onUploadSlip(f);
          } finally {
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}
