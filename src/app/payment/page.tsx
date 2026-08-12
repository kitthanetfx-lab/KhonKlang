'use client';
import { useState } from 'react';
import Link from 'next/link';
import { SubPageHeader } from '@/components/mobile/SubPageHeader';

const PAYMENT = { label: 'ค่าสมาชิกผู้ขาย', amount: 199, period: '1 ปี', features: ['ลงประกาศไม่จำกัด', 'Dashboard จัดการดีล', 'Badge ผู้ขายรับรอง', 'สิทธิ์ขาย Certified'] };
const BANK = { name: 'ธนาคารกสิกรไทย (KBANK)', acct: '123-4-56789-0', owner: 'บริษัท กลางฮับ จำกัด', pp: '0800000000' };

export default function PaymentPage() {
  const [slipUploaded, setSlipUploaded] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) return (
    <div className="sub-page">
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 style={{ marginBottom: 8 }}>ส่งสลิปแล้ว!</h2>
        <p style={{ color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>ทีมงานจะตรวจสอบและเปิดใช้งานบัญชีของคุณภายใน 1–3 วันทำการ</p>
        <Link href="/profile" className="btn btn-primary btn-block" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center' }}>ดูสถานะใบสมัคร</Link>
      </div>
    </div>
  );

  return (
    <div className="sub-page">
      <SubPageHeader backHref="/register/seller" title="ชำระเงิน" titleIcon="banknote" />
      <div className="pay-inner">
        <div className="pay-summary-card">
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{PAYMENT.label}</div>
          <div className="pay-amount">฿{PAYMENT.amount}</div>
          <div className="pay-desc">ต่ออายุ {PAYMENT.period} อัตโนมัติ · ยกเลิกได้ทุกเมื่อ</div>
          <div className="pay-rows">
            {PAYMENT.features.map(f => <div key={f} className="pay-row"><span>✅ {f}</span></div>)}
          </div>
        </div>

        <div className="bank-card">
          <div className="bank-title">ข้อมูลการโอนเงิน</div>
          <div className="bank-row"><span className="bank-lbl">ธนาคาร</span><span className="bank-val">{BANK.name}</span></div>
          <div className="bank-row"><span className="bank-lbl">เลขบัญชี</span><span className="bank-acct">{BANK.acct}</span></div>
          <div className="bank-row"><span className="bank-lbl">ชื่อบัญชี</span><span className="bank-val">{BANK.owner}</span></div>
          <div className="bank-row"><span className="bank-lbl">PromptPay</span><span className="bank-acct">{BANK.pp}</span></div>
          <div className="qr-box">
            <svg width="110" height="110" viewBox="0 0 10 10" shapeRendering="crispEdges">
              {[0,1,2,3,4,5,6,7,8,9].map(r => [0,1,2,3,4,5,6,7,8,9].map(c => {
                const v = ((r < 3 || r > 6) && (c < 3 || c > 6)) || (Math.sin(r * 2.9 + c * 3.7 + 1.1) > 0.05);
                return v ? <rect key={`${r}-${c}`} x={c} y={r} width="0.9" height="0.9" fill="#0d1b3e" /> : null;
              }))}
            </svg>
            <span className="qr-label">สแกน PromptPay ฿{PAYMENT.amount}</span>
          </div>
        </div>

        <div className="upload-card">
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 14 }}>อัปโหลดสลิปโอนเงิน</div>
          <div className="upload-zone" style={slipUploaded ? { borderColor: 'var(--green-400)', background: 'var(--green-50)' } : {}} onClick={() => setSlipUploaded(v => !v)}>
            <div className="upload-zone-icon">{slipUploaded ? '✅' : '🧾'}</div>
            <div className="upload-zone-t">{slipUploaded ? 'อัปโหลดสลิปแล้ว — คลิกเพื่อเปลี่ยน' : 'คลิกเพื่ออัปโหลดสลิปการโอนเงิน'}</div>
            <div className="upload-zone-sub">PNG, JPG — ยอดโอน ฿{PAYMENT.amount}</div>
          </div>
        </div>

        <button className="btn btn-primary btn-block" disabled={!slipUploaded} style={{ opacity: slipUploaded ? 1 : .5 }} onClick={() => setSubmitted(true)}>ยืนยันการชำระเงิน</button>
        <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--muted)', marginTop: 12, lineHeight: 1.6 }}>ทีมงานจะตรวจสอบและเปิดใช้งานภายใน 1–3 วันทำการ</p>
      </div>
    </div>
  );
}
