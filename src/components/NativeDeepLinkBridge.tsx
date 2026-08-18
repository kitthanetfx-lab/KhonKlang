'use client';

import { useEffect } from 'react';
import { isGlanghubApp } from '@/lib/nativeAuth';
import { initNativeDeepLinks, setDeepLinkNavigateHandler } from '@/lib/nativeDeepLink';
import { handleAppExternalLink } from '@/lib/appDeepLinkNav';

/** รับ App Links / deep links ขณะแอpp เปิดอยู่แล้ว */
export function NativeDeepLinkBridge() {
  useEffect(() => {
    if (!isGlanghubApp()) return;

    setDeepLinkNavigateHandler((path) => {
      const current = `${window.location.pathname}${window.location.search}`;
      if (current === path) return;
      void handleAppExternalLink(path);
    });

    void initNativeDeepLinks();

    return () => setDeepLinkNavigateHandler(() => {});
  }, []);

  return null;
}
