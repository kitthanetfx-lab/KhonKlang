'use client';

import { useEffect } from 'react';
import { isGlanghubApp } from '@/lib/nativeAuth';
import { initNativeDeepLinks, setDeepLinkNavigateHandler } from '@/lib/nativeDeepLink';
import { isAuthCallbackPath } from '@/lib/appAuthHandoff';

/** รับ App Links / deep links แล้วนำทาง WebView ไปหน้าที่ถูกต้อง */
export function NativeDeepLinkBridge() {
  useEffect(() => {
    if (!isGlanghubApp()) return;
    setDeepLinkNavigateHandler((path) => {
      // auth callback — WebView โหลดจาก intent อยู่แล้ว อย่า router.push ซ้ำ (กระพริบ)
      if (isAuthCallbackPath(path)) return;

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (current === path) return;

      const targetPath = path.split('?')[0].split('#')[0];
      if (window.location.pathname === targetPath && !path.includes('?') && !path.includes('#')) return;

      // full navigation — sync session/AuthGate ใหม่
      window.location.replace(path);
    });
    return () => setDeepLinkNavigateHandler(() => {});
  }, []);

  useEffect(() => {
    if (!isGlanghubApp()) return;
    void initNativeDeepLinks();
  }, []);

  return null;
}
