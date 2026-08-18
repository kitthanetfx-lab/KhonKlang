'use client';

import { useLayoutEffect, useRef } from 'react';
import { isGlanghubApp } from '@/lib/nativeAuth';
import { redirectAppEntrySync } from '@/lib/appDeepLinkNav';

/** สำรองกรณี beforeInteractive script ไม่ทัน — redirect ก่อน paint */
export function AppColdStartBridge() {
  const ran = useRef(false);

  useLayoutEffect(() => {
    if (!isGlanghubApp() || ran.current) return;
    ran.current = true;
    const path = `${window.location.pathname}${window.location.search}`;
    redirectAppEntrySync(path);
  }, []);

  return null;
}
