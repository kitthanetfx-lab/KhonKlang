'use client';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';

export default function Cookies() {
  return (
    <PageShell
      kicker="ข้อกฎหมาย"
      title="นโยบายคุกกี้"
      lead="อัปเดตล่าสุด: มิถุนายน 2569 — เราใช้คุกกี้เท่าที่จำเป็นต่อการทำงานของระบบเท่านั้น"
    >
      <div className="prose-card">
        <h2>คุกกี้ที่เราใช้</h2>
        <ul>
          <li><b>คุกกี้จำเป็น (Strictly necessary)</b> — ใช้จดจำสถานะการเข้าสู่ระบบ (session) เพื่อให้คุณใช้งานบัญชี ดีล และแชทได้อย่างต่อเนื่อง ปิดไม่ได้เพราะระบบจะทำงานไม่สมบูรณ์</li>
          <li><b>การจัดเก็บในเครื่อง (Local storage)</b> — ใช้เก็บข้อมูลชั่วคราว เช่น ตะกร้าสินค้าและการตั้งค่าการแสดงผล ข้อมูลอยู่ในอุปกรณ์ของคุณเอง</li>
        </ul>
      </div>
      <div className="prose-card">
        <h2>สิ่งที่เราไม่ทำ</h2>
        <ul>
          <li>ไม่ใช้คุกกี้โฆษณาหรือติดตามพฤติกรรมข้ามเว็บไซต์</li>
          <li>ไม่ขายหรือแบ่งปันข้อมูลคุกกี้ให้บุคคลภายนอก</li>
        </ul>
      </div>
      <div className="prose-card">
        <h2>การจัดการคุกกี้</h2>
        <p>
          คุณลบหรือบล็อกคุกกี้ได้จากการตั้งค่าเบราว์เซอร์ แต่การบล็อกคุกกี้จำเป็นจะทำให้เข้าสู่ระบบไม่ได้
          อ่านเพิ่มเติมเกี่ยวกับข้อมูลส่วนตัวได้ที่<Link href="/privacy">นโยบายความเป็นส่วนตัว</Link>{' '}
          หรือสอบถามที่ <a href="mailto:runandyaow002@gmail.com">runandyaow002@gmail.com</a>
        </p>
      </div>
    </PageShell>
  );
}
