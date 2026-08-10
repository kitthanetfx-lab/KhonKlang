'use client';

import Link from 'next/link';

type Expert = { icon: string; t: string; sub: string };
type Step = { t: string; d: string };

type Props = {
  experts: Expert[];
  steps: Step[];
  enabled: boolean;
};

/** บริการออนไซต์ — มือถือ */
export function OnsiteApp({ experts, steps, enabled }: Props) {
  return (
    <div className="svc-app">
      <div className="svc-app-hero">
        <div className="svc-app-hero-icon">🔍</div>
        <h2 className="svc-app-hero-title">ผู้เชี่ยวชาญตรวจถึงที่</h2>
        <p className="svc-app-hero-sub">ส่งช่างไปตรวจ ณ ที่ตั้งผู้ขายก่อนโอนเงิน</p>
      </div>

      <h3 className="svc-app-section-label">ผู้เชี่ยวชาญที่มีให้บริการ</h3>
      <div className="svc-app-experts">
        {experts.map(e => (
          <div key={e.t} className="svc-app-expert">
            <span>{e.icon}</span>
            <strong>{e.t}</strong>
            <small>{e.sub}</small>
          </div>
        ))}
      </div>

      <div className="app-card">
        <h3 className="svc-app-section-label">วิธีการทำงาน</h3>
        {steps.map((s, i) => (
          <div key={i} className="svc-app-how">
            <span className="svc-app-how-num">{i + 1}</span>
            <div><strong>{s.t}</strong><p>{s.d}</p></div>
          </div>
        ))}
      </div>

      <p className="svc-app-note">💰 ค่าบริการ ฿200–800 ตามประเภทและระยะทาง</p>

      {enabled
        ? <Link href="/onsite/create" className="btn btn-primary btn-block">สร้างงานออนไซต์ →</Link>
        : <button type="button" className="btn btn-primary btn-block" disabled>ปิดให้บริการชั่วคราว</button>}
    </div>
  );
}

export default OnsiteApp;
