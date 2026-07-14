'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

const PIXEL_ID = '1540440747816037';

/**
 * Meta Pixel แบบ consent-gated (ตาม PDPA) — โหลดสคริปต์ติดตาม
 * เฉพาะเมื่อผู้ใช้กด "ยอมรับ" ที่แถบคุกกี้แล้วเท่านั้น
 * - เคยกดยอมรับแล้ว (localStorage 'kk.cookie.consent') → โหลดทันทีตอนเปิดเว็บ
 * - เพิ่งกดยอมรับตอนนี้ → CookieConsent ยิง event 'kk:cookie-consent' → โหลดทันที
 * ไม่ใส่ <noscript> fallback เพราะการยินยอมต้องอาศัย JS อยู่แล้ว
 */
export function MetaPixel() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('kk.cookie.consent')) setConsented(true);
    } catch { /* ignore */ }
    const onConsent = () => setConsented(true);
    window.addEventListener('kk:cookie-consent', onConsent);
    return () => window.removeEventListener('kk:cookie-consent', onConsent);
  }, []);

  if (!consented) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${PIXEL_ID}');
        fbq('track', 'PageView');
      `}
    </Script>
  );
}

export default MetaPixel;
