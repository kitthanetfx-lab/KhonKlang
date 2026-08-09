'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { Icon } from './Icon';

/** ไอคอนตะกร้า — จำนวนคำสั่งซื้อตลาดที่ยังดำเนินการ */
export function MarketplaceOrdersIcon() {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const headers = await authHeaders();
      if (!headers.Authorization) { setCount(0); return; }
      const r = await fetch('/api/marketplace/orders?count=1', { headers });
      if (r.ok) {
        const d = await r.json();
        setCount(d.count || 0);
      }
    } catch { /* not logged in */ }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const t = setInterval(() => { void load(); }, 25000);
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearTimeout(timer);
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  return (
    <Link
      href="/cart?tab=orders"
      className="nb-btn"
      style={{ position: 'relative', flex: '0 0 auto' }}
      aria-label={count > 0 ? `คำสั่งซื้อ ${count} รายการ` : 'คำสั่งซื้อของฉัน'}
    >
      <Icon name="shoppingCart" size={19} />
      {count > 0 && <span className="nb-badge">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}

export default MarketplaceOrdersIcon;
