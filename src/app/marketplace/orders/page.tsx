'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** redirect — คำสั่งซื้ออยู่ที่ /cart?tab=orders ไม่ปนกับตลาด */
export default function MarketplaceOrdersRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/cart?tab=orders');
  }, [router]);
  return null;
}
