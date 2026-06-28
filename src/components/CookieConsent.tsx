'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useAppPreferences } from './AppPreferences';

/** แบนเนอร์ cookie consent ตาม PDPA — แสดงครั้งเดียว จำการยอมรับใน localStorage */
export function CookieConsent() {
  const { locale } = useAppPreferences();
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !localStorage.getItem('kk.cookie.consent');
    } catch {
      return false;
    }
  });

  function accept() {
    try { localStorage.setItem('kk.cookie.consent', new Date().toISOString()); } catch {}
    setShow(false);
  }

  if (!show) return null;
  return (
    <div className="cc-banner" role="dialog" aria-label={locale === 'th' ? 'การใช้คุกกี้' : 'Cookie usage'}>
      <span className="cc-tx">
        {locale === 'th'
          ? <>🍪 เราใช้คุกกี้ที่จำเป็นเพื่อให้ระบบเข้าสู่ระบบและใช้งานได้ — ไม่มีคุกกี้โฆษณา/ติดตาม อ่าน<Link href="/cookies">นโยบายคุกกี้</Link>และ<Link href="/privacy">ความเป็นส่วนตัว</Link></>
          : <>🍪 We only use essential cookies so login and core features work properly. No advertising or tracking cookies. Read our<Link href="/cookies">Cookie Policy</Link>and<Link href="/privacy">Privacy Policy</Link></>}
      </span>
      <button type="button" className="cc-btn" onClick={accept}>{locale === 'th' ? 'ยอมรับ' : 'Accept'}</button>
    </div>
  );
}

export default CookieConsent;
