'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';

// ── ช่องทางรับเงินของบริษัท — ตั้งค่าจริงผ่าน env บน Vercel ──
// NEXT_PUBLIC_PROMPTPAY_ID = เบอร์/เลขผู้เสียภาษีพร้อมเพย์ของบริษัท
// NEXT_PUBLIC_COMPANY_BANK / _BANK_ACCT / _BANK_HOLDER = บัญชีธนาคาร
const PP_ID = process.env.NEXT_PUBLIC_PROMPTPAY_ID || '0000000000';
const BANK_NAME = process.env.NEXT_PUBLIC_COMPANY_BANK || 'ธนาคารกสิกรไทย (KBANK)';
const BANK_ACCT = process.env.NEXT_PUBLIC_COMPANY_BANK_ACCT || '123-4-56789-0';
const BANK_HOLDER = process.env.NEXT_PUBLIC_COMPANY_BANK_HOLDER || 'บริษัท คนกลาง จำกัด';

/**
 * กล่องช่องทางชำระเงินของบริษัท — แสดง "ก่อน" ให้อัปสลิปเสมอ
 * QR พร้อมเพย์ระบุยอดอัตโนมัติ + ปุ่มคัดลอกเลข/บันทึกรูป QR ไว้เปิดในแอปธนาคาร
 * อนาคตต่อ Payment Gateway: เพิ่มช่องทาง (บัตร/วอลเล็ต) ในคอมโพเนนต์นี้ที่เดียว
 */
export function PaymentMethods({ amount, note }: { amount: number; note?: string }) {
  const [copied, setCopied] = useState('');
  const ppDigits = PP_ID.replace(/\D/g, '');
  // promptpay.io สร้างรูป QR มาตรฐาน EMV พร้อมยอดเงิน
  const qrUrl = `https://promptpay.io/${ppDigits}/${Math.max(0, amount)}.png`;

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  async function saveQr() {
    try {
      const r = await fetch(qrUrl);
      if (!r.ok) throw new Error('fetch failed');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `khonklang-promptpay-${amount}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      window.open(qrUrl, '_blank', 'noopener'); // CORS ไม่ให้ → เปิดรูปให้กดบันทึกเอง
    }
  }

  return (
    <div className="pm-box">
      <div className="pm-head">💳 ช่องทางชำระเงิน — บริษัท คนกลาง จำกัด</div>
      <div className="pm-amount">ยอดที่ต้องโอน <b>฿{amount.toLocaleString()}</b></div>

      <div className="pm-qr-wrap">
        <img src={qrUrl} alt={`QR พร้อมเพย์ ยอด ฿${amount.toLocaleString()}`} className="pm-qr" loading="lazy" />
        <div className="pm-qr-acts">
          <span className="pm-label">พร้อมเพย์ (สแกนหรือเปิดในแอปธนาคาร)</span>
          <div className="pm-row">
            <span className="mono pm-num">{PP_ID}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(ppDigits, 'pp')}>
              {copied === 'pp' ? '✅ คัดลอกแล้ว' : '📋 คัดลอกเลข'}
            </button>
          </div>
          <button type="button" className="btn btn-soft btn-sm" onClick={saveQr}>💾 บันทึกรูป QR ลงเครื่อง</button>
        </div>
      </div>

      <div className="pm-bank">
        <span className="pm-label">หรือโอนผ่านบัญชีธนาคาร</span>
        <div className="pm-row"><span>{BANK_NAME}</span></div>
        <div className="pm-row">
          <span className="mono pm-num">{BANK_ACCT}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(BANK_ACCT.replace(/\D/g, ''), 'acct')}>
            {copied === 'acct' ? '✅ คัดลอกแล้ว' : '📋 คัดลอกเลขบัญชี'}
          </button>
        </div>
        <div className="pm-row"><span style={{ color: 'var(--muted)', fontSize: 12.5 }}>ชื่อบัญชี: {BANK_HOLDER}</span></div>
      </div>

      {note && <p className="pm-note">{note}</p>}
      <p className="pm-note">⚠️ โอนตามยอดที่ระบุเท่านั้น แล้วกดอัปโหลดสลิปด้านล่าง — อย่าโอนเข้าบัญชีบุคคลอื่นเด็ดขาด</p>
    </div>
  );
}

export default PaymentMethods;
