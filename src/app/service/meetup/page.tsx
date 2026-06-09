'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function MeetupPage() {
  const [mode, setMode] = useState<string | null>(null);
  const [feeWho, setFeeWho] = useState('split');
  const PLATFORM = 50, MM_FEE = 300;
  const total = mode === 'safezone' ? PLATFORM + MM_FEE : PLATFORM;
  const buyerShare = feeWho === 'split' ? total / 2 : feeWho === 'buyer' ? total : 0;
  const sellerShare = feeWho === 'split' ? total / 2 : feeWho === 'seller' ? total : 0;

  return (
    <div className="sub-page">
      <header className="sub-header">
        <Link href="/" className="sub-back">←</Link>
        <span className="sub-htitle">นัดรับผ่านกลาง</span>
      </header>
      <div className="svc-inner">
        <h2 style={{ marginBottom: 6 }}>เลือกรูปแบบนัดรับ</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 24, lineHeight: 1.6 }}>คนกลางช่วยจัดการจุดนัดพบให้ปลอดภัย ไม่ต้องเจอกันสองต่อสองโดยไม่มีพยาน</p>

        {[
          { k: 'guarantee', icon: '🚗', title: 'รับประกันเดินทาง', sub: 'คนกลางรับประกันว่าทั้งสองฝ่ายจะมาตามนัด วางเงินประกันจะสูญถ้าผิดนัด', fee: PLATFORM },
          { k: 'safezone', icon: '🏪', title: 'Safe Zone (จุดนัดพบปลอดภัย)', sub: 'คนกลางเป็นผู้ดูแลสถานที่นัดพบ เช่น ร้านมือถือ อู่รถ หน้าร้านค้า', fee: PLATFORM + MM_FEE },
        ].map(o => (
          <div key={o.k} className={`svc-card${mode === o.k ? ' sel' : ''}`} onClick={() => setMode(o.k)}>
            <div className="svc-card-head">
              <div className="svc-card-icon">{o.icon}</div>
              <div><div className="svc-card-title">{o.title}</div><div className="svc-card-sub">{o.sub}</div></div>
            </div>
            {mode === o.k && (
              <div className="svc-fee-box">
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>ค่าใช้จ่าย</div>
                <div className="svc-fee-row"><span className="svc-fee-lbl">ค่าธรรมเนียมแพลตฟอร์ม</span><span className="svc-fee-val">฿{PLATFORM}</span></div>
                {o.k === 'safezone' && <div className="svc-fee-row"><span className="svc-fee-lbl">ค่าบริการคนกลาง</span><span className="svc-fee-val">฿{MM_FEE}</span></div>}
                <div className="svc-fee-total"><span className="svc-fee-lbl">รวม</span><span className="svc-fee-val">฿{o.fee}</span></div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 7 }}>ใครออกค่าใช้จ่าย?</div>
                  <div className="svc-who-chips">
                    {[{ k: 'split', l: 'หารกัน' }, { k: 'buyer', l: 'ผู้ซื้อออก' }, { k: 'seller', l: 'ผู้ขายออก' }].map(w => (
                      <button key={w.k} className={`svc-chip${feeWho === w.k ? ' sel' : ''}`} onClick={e => { e.stopPropagation(); setFeeWho(w.k); }}>{w.l}</button>
                    ))}
                  </div>
                  {feeWho === 'split' && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>ผู้ซื้อออก ฿{buyerShare} · ผู้ขายออก ฿{sellerShare}</p>}
                </div>
              </div>
            )}
          </div>
        ))}

        {mode && <Link href="/deal/create" className="btn btn-primary btn-block" style={{ marginTop: 8, display: 'flex', textDecoration: 'none', justifyContent: 'center' }}>สร้างดีลนัดรับ →</Link>}
      </div>
    </div>
  );
}
