'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Footer, Nav } from '@/components/Site';
import { Icon } from '@/components/Icon';
import { CartItem, clearCart, getCartItems, removeFromCart, updateCartQuantity } from '@/lib/cart';

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [submitted, setSubmitted] = useState(false);

  function syncCart() {
    setItems(getCartItems());
  }

  useEffect(() => {
    syncCart();
    window.addEventListener('khonklang-cart-updated', syncCart);
    return () => window.removeEventListener('khonklang-cart-updated', syncCart);
  }, []);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );

  if (submitted) {
    return (
      <>
        <Nav active="market" />
        <div className="cart-shell">
          <div className="container">
            <div className="cart-success">
              <div className="cart-success-icon">✅</div>
              <h1>สั่งซื้อเรียบร้อยแล้ว</h1>
              <p>ระบบบันทึกรายการสั่งซื้อแบบไม่ผ่านคนกลางในเครื่องเรียบร้อยแล้ว สำหรับ MVP รอบนี้</p>
              <div className="cart-success-actions">
                <Link href="/marketplace" className="btn btn-primary">กลับไปเลือกสินค้าต่อ</Link>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav active="market" />
      <div className="cart-shell">
        <div className="container cart-layout">
          <section>
            <div className="cart-head">
              <div>
                <div className="kicker">ตะกร้าสินค้า</div>
                <h1 className="mkt-headline" style={{ marginTop: 8 }}>ซื้อโดยไม่ผ่านคนกลาง</h1>
              </div>
              <Link href="/marketplace" className="btn btn-ghost">เลือกสินค้าเพิ่ม</Link>
            </div>

            {items.length === 0 ? (
              <div className="mkt-detail-empty">
                <div className="mkt-empty-ic"><Icon name="package" size={32} /></div>
                <p>ยังไม่มีสินค้าในตะกร้า</p>
                <Link href="/marketplace" className="btn btn-primary">ไปหน้าตลาด</Link>
              </div>
            ) : (
              <div className="cart-list">
                {items.map(item => (
                  <article key={item.dealId} className="cart-item">
                    <div className="cart-thumb">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div className="mkt-detail-fallback"><Icon name="package" size={32} /></div>
                      )}
                    </div>
                    <div className="cart-info">
                      <Link href={`/marketplace/${item.dealId}`} className="cart-title">{item.title}</Link>
                      <div className="cart-meta">
                        <span>{item.sellerName}</span>
                        {item.location && <span>📍 {item.location}</span>}
                      </div>
                      <div className="cart-row">
                        <div className="cart-qty">
                          <button type="button" onClick={() => updateCartQuantity(item.dealId, item.quantity - 1)}>-</button>
                          <span>{item.quantity}</span>
                          <button type="button" onClick={() => updateCartQuantity(item.dealId, item.quantity + 1)}>+</button>
                        </div>
                        <div className="cart-price">฿{(item.price * item.quantity).toLocaleString()}</div>
                      </div>
                    </div>
                    <button type="button" className="cart-remove" onClick={() => removeFromCart(item.dealId)}>ลบ</button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="cart-summary">
            <div className="dr-card">
              <div className="dr-card-title">สรุปรายการ</div>
              <div className="cart-summary-row"><span>จำนวนสินค้า</span><b>{items.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น</b></div>
              <div className="cart-summary-row"><span>ยอดรวมสินค้า</span><b>฿{subtotal.toLocaleString()}</b></div>
              <div className="cart-summary-row"><span>ค่าคนกลาง</span><b>ไม่มี</b></div>
              <div className="cart-summary-total"><span>ยอดชำระรวม</span><strong>฿{subtotal.toLocaleString()}</strong></div>
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={!items.length}
                onClick={() => {
                  clearCart();
                  setSubmitted(true);
                }}
              >
                ยืนยันสั่งซื้อทันที
              </button>
              <p className="cart-summary-note">MVP รอบนี้เป็น flow ซื้อแบบทั่วไปก่อน ยังไม่เชื่อม order backend และแชทหลังบ้าน</p>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </>
  );
}
