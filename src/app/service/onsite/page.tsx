'use client';
import Link from 'next/link';
import { HeaderAccountActions } from '@/components/HeaderAccountActions';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { useServiceControls } from '@/lib/useServiceControls';

const EXPERTS = [
  { icon: '🔧', t: 'ช่างยนต์', sub: 'ตรวจรถมือสอง' },
  { icon: '📱', t: 'ช่างมือถือ', sub: 'ทดสอบสมาร์ทโฟน' },
  { icon: '💻', t: 'ช่างคอม', sub: 'ตรวจสเปค+แบต' },
  { icon: '👜', t: 'เซียนแบรนด์', sub: 'ตรวจของแท้' },
  { icon: '🪨', t: 'เซียนพระ', sub: 'ตรวจพระ+ของสะสม' },
  { icon: '🏠', t: 'สถาปนิก', sub: 'ตรวจบ้าน+คอนโด' },
];
const STEPS = [
  { t: 'สร้างงานออนไซต์', d: 'กรอกรายละเอียดสินค้า ที่อยู่ผู้ขาย และงบประมาณ' },
  { t: 'ผู้เชี่ยวชาญรับงาน', d: 'ผู้เชี่ยวชาญในพื้นที่รับงานและยืนยันเวลา' },
  { t: 'เข้าตรวจสถานที่จริง', d: 'ผู้เชี่ยวชาญออกไปตรวจ ณ ที่ตั้งผู้ขาย พร้อมถ่ายวิดีโอ' },
  { t: 'รับรายงานผล', d: 'คุณได้รับรายงานละเอียด ก่อนตัดสินใจซื้อ' },
  { t: 'ตัดสินใจ', d: 'ถ้าพอใจ สร้างดีล Escrow ต่อ หรือยกเลิกได้เลย' },
];

export default function ServiceOnsitePage() {
  const controls = useServiceControls();
  if (!controls.loading && !controls.isEnabled('onsite')) {
    return <ServiceDisabledNotice title="บริการนัดออนไซต์" message={controls.message('onsite')} />;
  }

  return (
    <div className="sub-page service-sub-page">
      <header className="sub-header">
        <Link href="/" className="sub-back" aria-label="ย้อนกลับ">
          <span className="sub-back-arrow">←</span>
          <span className="sub-back-text">ย้อนกลับ</span>
        </Link>
        <span className="sub-htitle">บริการออนไซต์</span>
        <HeaderAccountActions />
      </header>
      <div className="svc-inner">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 14 }}>🔍</div>
          <h1 style={{ fontSize: 'clamp(22px,4vw,30px)', marginBottom: 10 }}>ผู้เชี่ยวชาญตรวจถึงที่</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.6, maxWidth: '44ch', margin: '0 auto' }}>ส่งผู้เชี่ยวชาญไปตรวจสินค้า ณ ที่ตั้งผู้ขายก่อนโอนเงิน เหมาะกับรถ เครื่องจักร บ้าน พระเครื่อง</p>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 12 }}>ผู้เชี่ยวชาญที่มีให้บริการ</div>
        <div className="expert-grid">
          {EXPERTS.map(e => (
            <div key={e.t} className="expert-card"><div className="expert-icon">{e.icon}</div><div className="expert-title">{e.t}</div><div className="expert-sub">{e.sub}</div></div>
          ))}
        </div>
        <div className="how-card">
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 14 }}>วิธีการทำงาน</div>
          {STEPS.map((s, i) => (
            <div key={i} className="how-step"><div className="how-num">{i + 1}</div><div><div className="how-t">{s.t}</div><div className="how-d">{s.d}</div></div></div>
          ))}
        </div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
          💰 ค่าบริการ: ฿200–800 ขึ้นอยู่กับประเภทสินค้าและระยะทาง · จ่ายเฉพาะเมื่อรับงานสำเร็จ
        </div>
        {controls.isEnabled('onsite')
          ? <Link href="/onsite/create" className="btn btn-primary btn-block" style={{ display: 'flex', justifyContent: 'center', textDecoration: 'none' }}>สร้างงานออนไซต์ →</Link>
          : <button type="button" className="btn btn-primary btn-block" disabled>ปิดให้บริการชั่วคราว</button>}
      </div>
    </div>
  );
}
