'use client';
import Link from 'next/link';
import { HeaderAccountActions } from '@/components/HeaderAccountActions';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { useServiceControls } from '@/lib/useServiceControls';

const STEPS = [
  { icon: '📦', bg: '#eef4ff', t: 'ส่งสินค้าให้คนกลาง', d: 'นำสินค้าฝากไว้ที่คนกลาง พร้อมเอกสารประกอบ' },
  { icon: '📸', bg: '#e9faf2', t: 'คนกลางถ่ายรูป+ลงขาย', d: 'คนกลางถ่ายภาพ เขียนรายละเอียด และลงขายในตลาด KhonGlang' },
  { icon: '💳', bg: '#f1edff', t: 'ผู้ซื้อโอนเงิน', d: 'ผู้ซื้อชำระเงินให้คนกลางดูแล พักไว้ในระบบ Escrow' },
  { icon: '🚚', bg: '#fef5e3', t: 'คนกลางตรวจและจัดส่ง', d: 'คนกลางตรวจสภาพสินค้าอีกครั้ง แล้วจัดส่งให้ผู้ซื้อ' },
  { icon: '✅', bg: '#e9faf2', t: 'โอนเงินให้ผู้ขาย', d: 'ผู้ซื้อยืนยันรับสินค้า ระบบปล่อยเงินหักค่าบริการให้ผู้ขายทันที' },
];

export default function ConsignPage() {
  const controls = useServiceControls();
  if (!controls.loading && !controls.isEnabled('consign')) {
    return <ServiceDisabledNotice title="ฝากขายผ่านกลาง" message={controls.message('consign')} />;
  }

  return (
    <div className="sub-page">
      <header className="sub-header">
        <Link href="/" className="sub-back">←</Link>
        <span className="sub-htitle">ฝากขายผ่านกลาง</span>
        <HeaderAccountActions />
      </header>
      <div className="svc-inner">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 14 }}>🏪</div>
          <h1 style={{ fontSize: 'clamp(22px,4vw,30px)', marginBottom: 10 }}>ฝากขายผ่านคนกลาง</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.6, maxWidth: '44ch', margin: '0 auto' }}>ให้คนกลางช่วยถ่ายรูป ลงขาย และจัดส่งให้ทั้งหมด คุณแค่นำสินค้ามาฝาก</p>
        </div>
        <div className="fee-card">
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 12 }}>💰 ค่าบริการฝากขาย</div>
          {[['ค่าฝากขาย', '2–3% ของราคาขาย'], ['ค่าจัดส่ง', 'ตามระยะทางจริง'], ['ค่าถ่ายรูป+ลงขาย', 'ฟรี'], ['ระยะเวลาฝาก', 'สูงสุด 90 วัน']].map(([l, v]) => (
            <div key={l} className="fee-row"><span className="fee-lbl">{l}</span><span className="fee-val">{v}</span></div>
          ))}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 18 }}>ขั้นตอนฝากขาย</div>
        <div className="step-timeline">
          {STEPS.map((s, i) => (
            <div key={i} className="step-item">
              <div className="step-dot" style={{ background: s.bg }}>{s.icon}</div>
              <div className="step-content"><div className="step-title">{s.t}</div><div className="step-desc">{s.d}</div></div>
            </div>
          ))}
        </div>
        {controls.isEnabled('consign')
          ? <Link href="/marketplace" className="btn btn-primary btn-block" style={{ display: 'flex', justifyContent: 'center', textDecoration: 'none' }}>เริ่มฝากขาย →</Link>
          : <button type="button" className="btn btn-primary btn-block" disabled>ปิดให้บริการชั่วคราว</button>}
      </div>
    </div>
  );
}
