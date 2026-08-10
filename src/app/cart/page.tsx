'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Footer, Nav } from '@/components/Site';
import { Icon } from '@/components/Icon';
import { MarketplaceOrdersPanel } from '@/components/marketplace/MarketplaceOrdersPanel';
import { CartApp } from '@/components/cart/CartApp';
import { ResponsiveShell } from '@/components/mobile';
import { CartItem, clearCart, getCartItems, removeFromCart, updateCartQuantity } from '@/lib/cart';

type CartTab = 'cart' | 'orders';

function CartPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: CartTab = searchParams.get('tab') === 'orders' ? 'orders' : 'cart';

  const [items, setItems] = useState<CartItem[]>([]);
  const [submitted, setSubmitted] = useState(false);

  function syncCart() {
    setItems(getCartItems());
  }

  useEffect(() => {
    const timer = window.setTimeout(syncCart, 0);
    window.addEventListener('khonklang-cart-updated', syncCart);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('khonklang-cart-updated', syncCart);
    };
  }, []);

  function setTab(next: CartTab) {
    router.replace(next === 'orders' ? '/cart?tab=orders' : '/cart');
  }

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );

  function handleSubmit() {
    clearCart();
    setSubmitted(true);
  }

  const mobile = (
    <CartApp
      tab={tab}
      items={items}
      subtotal={subtotal}
      submitted={submitted}
      onSetTab={setTab}
      onUpdateQuantity={updateCartQuantity}
      onRemove={removeFromCart}
      onSubmit={handleSubmit}
      ordersPanel={<MarketplaceOrdersPanel />}
    />
  );

  if (submitted) {
    return (
      <>
        <Nav />
        <ResponsiveShell mobile={mobile} desktop={
          <>
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
        } />
      </>
    );
  }

  return (
    <>
      <Nav />
      <ResponsiveShell
        mobile={mobile}
        desktop={
          <>
            <div className="cart-shell">
              <div className="container">
                <div className="cart-page-head">
                  <h1><Icon name="shoppingCart" size={24} /> ตะกร้า & คำสั่งซื้อ</h1>
                  <Link href="/marketplace" className="btn btn-ghost btn-sm">เลือกสินค้าเพิ่ม</Link>
                </div>

                <div className="cart-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'cart'}
                    className={`cart-tab${tab === 'cart' ? ' active' : ''}`}
                    onClick={() => setTab('cart')}
                  >
                    รายการในตะกร้า {items.length > 0 && `(${items.length})`}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'orders'}
                    className={`cart-tab${tab === 'orders' ? ' active' : ''}`}
                    onClick={() => setTab('orders')}
                  >
                    คำสั่งซื้อของฉัน
                  </button>
                </div>

                {tab === 'cart' ? (
                  <div className="cart-layout">
                    <section>
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
                        <div className="cart-summary-total"><span>ยอดชำระรวม</span><strong>฿{subtotal.toLocaleString()}</strong></div>
                        <button
                          type="button"
                          className="btn btn-primary btn-block"
                          disabled={!items.length}
                          onClick={handleSubmit}
                        >
                          ยืนยันสั่งซื้อทันที
                        </button>
                        <p className="cart-summary-note">สินค้าในตะกร้านี้ยังไม่ได้สั่งจริง — กดซื้อจากหน้ารายละเอียดสินค้าเพื่อสร้างคำสั่งซื้อ</p>
                      </div>
                    </aside>
                  </div>
                ) : (
                  <MarketplaceOrdersPanel />
                )}
              </div>
            </div>
            <Footer />
          </>
        }
      />
    </>
  );
}

export default function CartPage() {
  return (
    <Suspense fallback={
      <>
        <Nav />
        <div className="cart-shell"><div className="container"><div className="mkt-detail-loading" /></div></div>
      </>
    }>
      <CartPageInner />
    </Suspense>
  );
}
