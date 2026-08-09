'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** redirect — checkout อยู่ที่ /cart/checkout/[id] */
export default function MarketplaceCheckoutRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/cart/checkout/${id}`);
  }, [router, id]);

  return null;
}
