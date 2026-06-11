'use client';
import React, { useEffect, useState } from 'react';
import { detectInApp, IN_APP_LABEL, withExternalBrowserParam, tryAutoEscape, InAppKind } from '@/lib/inApp';

/**
 * แบนเนอร์เมื่อเปิดผ่านเบราว์เซอร์ใน LINE/Messenger ฯลฯ
 * - LINE: ปุ่มเดียวเด้งไปเปิดเบราว์เซอร์หลักทันที (openExternalBrowser=1)
 * - แอปอื่น: แนะนำเมนู "เปิดในเบราว์เซอร์" + ปุ่มคัดลอกลิงก์
 * ปิดได้ และจำการปิดไว้ตลอด session
 */
export function InAppBanner() {
  const [kind] = useState<InAppKind>(() => {
    if (typeof window === 'undefined') return '';
    try {
      if (sessionStorage.getItem('kk.iab.dismiss')) return '';
    } catch {}
    return detectInApp();
  });
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const k = detectInApp();
    if (!k) return;
    // เด้งออกไปเบราว์เซอร์หลัก "อัตโนมัติ" ครั้งแรกที่เจอ — ลองครั้งเดียวต่อ session กันลูป
    try {
      const url = new URL(window.location.href);
      const alreadyTried = sessionStorage.getItem('kk.iab.auto') || url.searchParams.get('openExternalBrowser');
      if (!alreadyTried) {
        sessionStorage.setItem('kk.iab.auto', '1');
        if (tryAutoEscape(k)) {
          // กำลังเด้งออก — ยังแสดงแบนเนอร์ไว้เผื่อระบบบล็อกการเด้ง
        }
      }
    } catch {}
  }, [kind]);

  if (!kind || hidden) return null;

  function dismiss() {
    setHidden(true);
    try { sessionStorage.setItem('kk.iab.dismiss', '1'); } catch {}
  }

  function openExternal() {
    window.location.href = withExternalBrowserParam(window.location.href);
  }

  async function copyUrl() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }

  return (
    <div className="iab-banner" role="status">
      <span className="iab-tx">
        📱 กำลังเปิดผ่านเบราว์เซอร์ใน <b>{IN_APP_LABEL[kind]}</b> — ถ้าเคยล็อกอินไว้ใน Chrome/Safari ระบบจะมองไม่เห็น
        {kind === 'line' ? ' (เข้าสู่ระบบด้วย LINE ได้เลย หรือเปิดในเบราว์เซอร์หลัก)' : ''}
      </span>
      <span className="iab-acts">
        {kind === 'line' ? (
          <button type="button" className="iab-btn primary" onClick={openExternal}>เปิดในเบราว์เซอร์</button>
        ) : (
          <>
            <span className="iab-hint">แตะ ⋯ มุมขวาบน → &ldquo;เปิดในเบราว์เซอร์&rdquo;</span>
            <button type="button" className="iab-btn" onClick={copyUrl}>{copied ? '✅ คัดลอกแล้ว' : '📋 คัดลอกลิงก์'}</button>
          </>
        )}
        <button type="button" className="iab-btn" onClick={dismiss} aria-label="ปิดแจ้งเตือนนี้">✕</button>
      </span>
    </div>
  );
}

export default InAppBanner;
