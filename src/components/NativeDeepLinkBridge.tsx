'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isGlanghubApp } from '@/lib/nativeAuth';
import { initNativeDeepLinks, setDeepLinkNavigateHandler } from '@/lib/nativeDeepLink';

/** รับ App Links / deep links แล้วนำทาง WebView ไปหน้าที่ถูกต้อง */
export function NativeDeepLinkBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isGlanghubApp()) return;
    setDeepLinkNavigateHandler((path) => router.push(path));
    return () => setDeepLinkNavigateHandler(() => {});
  }, [router]);

  useEffect(() => {
    if (!isGlanghubApp()) return;
    void initNativeDeepLinks();
  }, []);

  return null;
}
