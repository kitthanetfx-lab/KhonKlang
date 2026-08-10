'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import {
  AppPage,
  AppHeader,
  AppSegment,
  AppFeed,
  AppEmpty,
} from '@/components/mobile';
import type { CartItem } from '@/lib/cart';

export type CartTab = 'cart' | 'orders';

type Props = {
  tab: CartTab;
  items: CartItem[];
  subtotal: number;
  submitted?: boolean;
  onSetTab: (tab: CartTab) => void;
  onUpdateQuantity: (dealId: string, qty: number) => void;
  onRemove: (dealId: string) => void;
  onSubmit: () => void;
  ordersPanel: ReactNode;
};

export function CartApp({
  tab,
  items,
  subtotal,
  submitted,
  onSetTab,
  onUpdateQuantity,
  onRemove,
  onSubmit,
  ordersPanel,
}: Props) {
  if (submitted) {
    return (
      <AppPage withBottomNav>
        <AppHeader title="สั่งซื้อสำเร็จ" />
        <AppFeed>
          <div className="cart-app-success">
            <div className="cart-app-success-icon" aria-hidden>✅</div>
            <h2>สั่งซื้อเรียบร้อยแล้ว</h2>
            <p>ระบบบันทึกรายการสั่งซื้อแบบไม่ผ่านคนกลางในเครื่องเรียบร้อยแล้ว สำหรับ MVP รอบนี้</p>
            <Link href="/marketplace" className="btn btn-primary btn-block cart-app-cta">
              กลับไปเลือกสินค้าต่อ
            </Link>
          </div>
        </AppFeed>
      </AppPage>
    );
  }

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartLabel = items.length > 0 ? `ตะกร้า (${items.length})` : 'ตะกร้า';

  return (
    <AppPage
      withBottomNav
      stickyFooter={
        tab === 'cart' && items.length > 0 ? (
          <div className="cart-app-bar">
            <div className="cart-app-bar-total">
              <span>ยอดชำระรวม</span>
              <strong>฿{subtotal.toLocaleString()}</strong>
            </div>
            <button type="button" className="btn btn-primary btn-block cart-app-cta" onClick={onSubmit}>
              ยืนยันสั่งซื้อทันที
            </button>
            <p className="cart-app-bar-note">สินค้าในตะกร้ายังไม่ได้สั่งจริง — กดซื้อจากหน้ารายละเอียดเพื่อสร้างคำสั่งซื้อ</p>
          </div>
        ) : undefined
      }
    >
      <AppHeader
        title="ตะกร้า & คำสั่งซื้อ"
        right={
          <Link href="/marketplace" className="cart-app-head-link" aria-label="เลือกสินค้าเพิ่ม">
            <Icon name="plus" size={20} />
          </Link>
        }
      />

      <AppSegment<CartTab>
        items={[
          { id: 'cart', label: cartLabel },
          { id: 'orders', label: 'คำสั่งซื้อ' },
        ]}
        value={tab}
        onChange={onSetTab}
        ariaLabel="มุมมองตะกร้า"
      />

      <AppFeed>
        {tab === 'cart' ? (
          items.length === 0 ? (
            <AppEmpty action={<Link href="/marketplace" className="btn btn-primary cart-app-cta">ไปหน้าตลาด</Link>}>
              ยังไม่มีสินค้าในตะกร้า
            </AppEmpty>
          ) : (
            <ul className="cart-app-list">
              {items.map(item => (
                <li key={item.dealId} className="cart-app-item">
                  <Link href={`/marketplace/${item.dealId}`} className="cart-app-thumb">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} />
                    ) : (
                      <Icon name="package" size={28} />
                    )}
                  </Link>
                  <div className="cart-app-body">
                    <Link href={`/marketplace/${item.dealId}`} className="cart-app-title">
                      {item.title}
                    </Link>
                    <div className="cart-app-meta">
                      <span>{item.sellerName}</span>
                      {item.location && <span>📍 {item.location}</span>}
                    </div>
                    <div className="cart-app-row">
                      <div className="cart-app-qty">
                        <button
                          type="button"
                          aria-label="ลดจำนวน"
                          onClick={() => onUpdateQuantity(item.dealId, item.quantity - 1)}
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          aria-label="เพิ่มจำนวน"
                          onClick={() => onUpdateQuantity(item.dealId, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <div className="cart-app-price">฿{(item.price * item.quantity).toLocaleString()}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="cart-app-remove"
                    aria-label="ลบสินค้า"
                    onClick={() => onRemove(item.dealId)}
                  >
                    ลบ
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="cart-app-orders">{ordersPanel}</div>
        )}

        {tab === 'cart' && items.length > 0 && (
          <div className="cart-app-summary">
            <div className="cart-app-summary-row">
              <span>จำนวนสินค้า</span>
              <b>{itemCount} ชิ้น</b>
            </div>
            <div className="cart-app-summary-row">
              <span>ยอดรวมสินค้า</span>
              <b>฿{subtotal.toLocaleString()}</b>
            </div>
          </div>
        )}
      </AppFeed>
    </AppPage>
  );
}

export default CartApp;
