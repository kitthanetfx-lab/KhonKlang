'use client';
import Link from 'next/link';

const MODES = [
  { icon: '🛒', bg: '#eef4ff', title: 'ซื้อขายผ่านกลาง (ออนไลน์)', href: '/deal/create',
    desc: 'ซื้อขายออนไลน์ พักเงินกับระบบ คนกลางตรวจสินค้าก่อนส่ง เหมาะกับสินค้าที่จัดส่งได้',
    feats: ['✅ ปลอดภัยทั้งผู้ซื้อ-ผู้ขาย', '✅ คนกลางตรวจของก่อนส่ง', '✅ ชำระผ่านระบบ Escrow', '✅ มีหลักฐานวิดีโอทุกขั้นตอน'] },
  { icon: '⚡', bg: '#fff3e0', title: 'ซื้อขายผ่านกลางแบบง่าย', href: '/service/simple',
    desc: 'ผู้ขายส่งสินค้าตรงถึงผู้ซื้อ พักเงินกับคนกลาง ใช้วิดีโอเป็นหลักฐานแทนการตรวจหน้างาน',
    feats: ['✅ ส่งตรงถึงผู้ซื้อ ไม่ต้องผ่านคนกลาง', '✅ ถ่ายวิดีโอ Serial/เลขชิปเป็นหลักฐาน', '✅ ผู้ซื้อถ่ายวิดีโอก่อนแกะกล่อง', '✅ พักเงินผ่านระบบ Escrow'] },
];
const STEPS = [
  { t: 'สร้างดีล', d: 'ผู้ขายสร้างดีลและส่งลิงก์ให้ผู้ซื้อ' },
  { t: 'ผู้ซื้อเลือกคนกลาง', d: 'ผู้ซื้อเข้าร่วมดีลและเลือกคนกลางที่ไว้วางใจ' },
  { t: 'ทุกฝ่ายยอมรับเงื่อนไข', d: 'ผู้ซื้อ ผู้ขาย และคนกลางยืนยันข้อตกลง' },
  { t: 'ผู้ซื้อโอนเงินให้คนกลาง', d: 'เงินถูกพักไว้กับคนกลาง ไม่ถึงผู้ขายทันที' },
  { t: 'ผู้ขายส่งสินค้าให้คนกลาง', d: 'คนกลางรับพัสดุ ตรวจสอบและถ่ายวิดีโอหลักฐาน' },
  { t: 'คนกลางส่งให้ผู้ซื้อ', d: 'ผู้ซื้อได้รับของ ยืนยัน → ระบบปล่อยเงินให้ผู้ขายอัตโนมัติ' },
];

export default function ServiceTradePage() {
  return (
    <div className="sub-page">
      <header className="sub-header">
        <Link href="/" className="sub-back">←</Link>
        <span className="sub-htitle">บริการผ่านคนกลาง</span>
      </header>
      <div className="svc-inner">
        <div className="svc-hero">
          <div className="svc-hero-icon">🤝</div>
          <h1 className="svc-hero-title">เลือกรูปแบบบริการ</h1>
          <p className="svc-hero-sub">Khonklang มีบริการคนกลาง 2 รูปแบบ เลือกตามลักษณะสินค้าของคุณ</p>
        </div>
        <div className="svc-modes">
          {MODES.map(m => (
            <Link key={m.title} href={m.href} className="svc-mode">
              <div className="svc-mode-icon" style={{ background: m.bg }}>{m.icon}</div>
              <div className="svc-mode-title">{m.title}</div>
              <div className="svc-mode-desc">{m.desc}</div>
              <div className="svc-mode-feats">{m.feats.map(f => <div key={f} className="svc-mode-feat">{f}</div>)}</div>
              <div className="svc-mode-cta">เริ่มต้น <span>→</span></div>
            </Link>
          ))}
        </div>
        <div className="svc-steps">
          <div className="svc-steps-title">ขั้นตอน Escrow อัตโนมัติ</div>
          {STEPS.map((s, i) => (
            <div key={i} className="svc-step-row">
              <div className="svc-step-num">{i + 1}</div>
              <div><div className="svc-step-t">{s.t}</div><div className="svc-step-d">{s.d}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
