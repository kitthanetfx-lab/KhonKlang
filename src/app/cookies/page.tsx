'use client';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { useAppPreferences } from '@/components/AppPreferences';

export default function Cookies() {
  const { locale } = useAppPreferences();
  return (
    <PageShell
      kicker={{ th: 'ข้อกฎหมาย', en: 'Legal' }}
      title={{ th: 'นโยบายคุกกี้', en: 'Cookie Policy' }}
      lead={{ th: 'อัปเดตล่าสุด: มิถุนายน 2569 — เราใช้คุกกี้เท่าที่จำเป็นต่อการทำงานของระบบเท่านั้น', en: 'Last updated: June 2026. We only use cookies that are necessary for the platform to work properly.' }}
    >
      <div className="prose-card">
        <h2>{locale === 'th' ? 'คุกกี้ที่เราใช้' : 'Cookies We Use'}</h2>
        <ul>
          {locale === 'th' ? (
            <>
              <li><b>คุกกี้จำเป็น (Strictly necessary)</b> — ใช้จดจำสถานะการเข้าสู่ระบบ (session) เพื่อให้คุณใช้งานบัญชี ดีล และแชทได้อย่างต่อเนื่อง ปิดไม่ได้เพราะระบบจะทำงานไม่สมบูรณ์</li>
              <li><b>การจัดเก็บในเครื่อง (Local storage)</b> — ใช้เก็บข้อมูลชั่วคราว เช่น ตะกร้าสินค้าและการตั้งค่าการแสดงผล ข้อมูลอยู่ในอุปกรณ์ของคุณเอง</li>
            </>
          ) : (
            <>
              <li><b>Strictly necessary cookies</b> — used to remember your login session so you can continue using your account, deals, and chat without interruption. These cannot be disabled because core system functions would break.</li>
              <li><b>Local storage</b> — used to store temporary data such as cart items and display preferences. This data stays on your own device.</li>
            </>
          )}
        </ul>
      </div>
      <div className="prose-card">
        <h2>{locale === 'th' ? 'สิ่งที่เราไม่ทำ' : 'What We Do Not Do'}</h2>
        <ul>
          {locale === 'th' ? (
            <>
              <li>ไม่ใช้คุกกี้โฆษณาหรือติดตามพฤติกรรมข้ามเว็บไซต์</li>
              <li>ไม่ขายหรือแบ่งปันข้อมูลคุกกี้ให้บุคคลภายนอก</li>
            </>
          ) : (
            <>
              <li>We do not use advertising cookies or cross-site behavior tracking cookies.</li>
              <li>We do not sell or share cookie data with third parties.</li>
            </>
          )}
        </ul>
      </div>
      <div className="prose-card">
        <h2>{locale === 'th' ? 'การจัดการคุกกี้' : 'Managing Cookies'}</h2>
        <p>
          {locale === 'th' ? <>คุณลบหรือบล็อกคุกกี้ได้จากการตั้งค่าเบราว์เซอร์ แต่การบล็อกคุกกี้จำเป็นจะทำให้เข้าสู่ระบบไม่ได้ อ่านเพิ่มเติมเกี่ยวกับข้อมูลส่วนตัวได้ที่ <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link> หรือสอบถามที่ <a href="mailto:runandyaow002@gmail.com">runandyaow002@gmail.com</a></> : <>You can delete or block cookies through your browser settings. However, blocking necessary cookies may prevent you from logging in. For more details about personal data, read the <Link href="/privacy">privacy policy</Link> or contact <a href="mailto:runandyaow002@gmail.com">runandyaow002@gmail.com</a>.</>}
        </p>
      </div>
    </PageShell>
  );
}
