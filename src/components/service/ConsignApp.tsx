'use client';

import Link from 'next/link';

type Step = { icon: string; bg: string; t: string; d: string };

type Props = {
  steps: Step[];
  feeRows: [string, string][];
  enabled: boolean;
};

/** ฝากขายผ่านกลาง — มือถือ */
export function ConsignApp({ steps, feeRows, enabled }: Props) {
  return (
    <div className="svc-app">
      <div className="svc-app-hero">
        <div className="svc-app-hero-icon">🏪</div>
        <h2 className="svc-app-hero-title">ฝากขายผ่านคนกลาง</h2>
        <p className="svc-app-hero-sub">คนกลางช่วยถ่ายรูป ลงขาย และจัดส่งให้ทั้งหมด</p>
      </div>

      <div className="app-card svc-app-fee">
        <strong>💰 ค่าบริการฝากขาย</strong>
        {feeRows.map(([l, v]) => (
          <div key={l} className="svc-app-fee-row">
            <span>{l}</span><span>{v}</span>
          </div>
        ))}
      </div>

      <h3 className="svc-app-section-label">ขั้นตอนฝากขาย</h3>
      <div className="svc-app-steps">
        {steps.map((s, i) => (
          <div key={i} className="svc-app-step">
            <div className="svc-app-step-dot" style={{ background: s.bg }}>{s.icon}</div>
            <div>
              <strong>{s.t}</strong>
              <p>{s.d}</p>
            </div>
          </div>
        ))}
      </div>

      {enabled
        ? <Link href="/marketplace" className="btn btn-primary btn-block">เริ่มฝากขาย →</Link>
        : <button type="button" className="btn btn-primary btn-block" disabled>ปิดให้บริการชั่วคราว</button>}
    </div>
  );
}

export default ConsignApp;
