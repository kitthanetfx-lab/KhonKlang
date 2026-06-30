'use client';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';
import { Icon } from '@/components/Icon';

export default function Contact() {
  return (
    <PageShell
      kicker="ติดต่อทีมงาน"
      title="เราพร้อมช่วยเหลือคุณ"
      lead="ติดต่อได้ทุกเรื่อง — ปัญหาดีล การสมัครคนกลาง รายงานคนโกง หรือข้อเสนอแนะการใช้งาน"
    >
      <div className="contact-grid">
        <a className="contact-card" href="mailto:runandyaow002@gmail.com">
          <span className="icon-tile"><Icon name="message" /></span>
          <div><b>อีเมลทีมงาน</b><p>runandyaow002@gmail.com — ตอบกลับภายใน 24 ชั่วโมงทำการ</p></div>
        </a>
        <Link className="contact-card" href="/check-scam">
          <span className="icon-tile amber"><Icon name="search" /></span>
          <div><b>รายงาน / เช็คคนโกง</b><p>ตรวจสอบชื่อ เลขบัญชี เบอร์โทร จากฐานข้อมูลแบล็กลิสต์</p></div>
        </Link>
        <Link className="contact-card" href="/status">
          <span className="icon-tile green"><Icon name="zap" /></span>
          <div><b>สถานะระบบ</b><p>ตรวจสอบว่าระบบทำงานปกติหรือมีการแจ้งปิดปรับปรุง</p></div>
        </Link>
        <Link className="contact-card" href="/faq">
          <span className="icon-tile violet"><Icon name="info" /></span>
          <div><b>คำถามที่พบบ่อย</b><p>คำตอบเรื่องความปลอดภัย ค่าบริการ และขั้นตอนการใช้งาน</p></div>
        </Link>
      </div>
      <div className="prose-card" style={{ marginTop: 24 }}>
        <h2>ปัญหาเกี่ยวกับดีลที่กำลังดำเนินอยู่</h2>
        <p>
          เพื่อให้ทีมงานช่วยได้เร็วที่สุด ให้กดปุ่ม &ldquo;แจ้งปัญหา&rdquo; ภายในห้องดีลโดยตรง
          ระบบจะหยุดการปล่อยเงินไว้ก่อนและแนบหลักฐานทั้งหมดในดีลให้ทีมงานอัตโนมัติ
          จากนั้นอีเมลแจ้งหมายเลขดีลมาที่ทีมงานเพื่อเร่งติดตามได้ทันที
        </p>
      </div>
    </PageShell>
  );
}
