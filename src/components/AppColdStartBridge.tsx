'use client';

import { useEffect, useRef } from 'react';
import { isGlanghubApp } from '@/lib/nativeAuth';
import { handleAppCurrentUrl } from '@/lib/appDeepLinkNav';

/**
 * ตอนแอpp เปิดจาก App Link (เช่น /deal/abc) WebView โหลด URL นั้นทันที
 * — ตรวจ session แล้วส่งไป /login?returnTo=... ก่อน AuthGate แสดง loading ค้าง
 */
export function AppColdStartBridge() {
  const ran = useRef(false);

  useEffect(() => {
    if (!isGlanghubApp() || ran.current) return;
    ran.current = true;
    void handleAppCurrentUrl();
  }, []);

  return null;
}
