'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';

// ── ค่าสำรอง (ถ้าแอดมินยังไม่ตั้งใน /admin/settings) ──
const ENV_PP = process.env.NEXT_PUBLIC_PROMPTPAY_ID || '';
const ENV_BANK = process.env.NEXT_PUBLIC_COMPANY_BANK || '';
const ENV_ACCT = process.env.NEXT_PUBLIC_COMPANY_BANK_ACCT || '';
const ENV_HOLDER = process.env.NEXT_PUBLIC_COMPANY_BANK_HOLDER || 'บริษัท กลางฮับ จำกัด';
import { fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
const fileUrl = (id: string) => fileViewUrl(DEAL_BUCKET, id);

interface PayCfg { promptPay: string; bankName: string; bankAcct: string; bankHolder: string; qrFileId: string; }

/**
 * กล่องช่องทางชำระเงินของบริษัท — ดึงบัญชีรับเงินจากที่แอดมินตั้งไว้ (/admin/settings)
 * ถ้ามีรูป QR ที่อัปโหลดไว้ → ใช้รูปนั้น ; ถ้าไม่มี → สร้าง QR พร้อมเพย์พร้อมยอดอัตโนมัติ
 */
export function PaymentMethods({ amount, note }: { amount: number; note?: string }) {
  const [copied, setCopied] = useState('');
  const [cfg, setCfg] = useState<PayCfg>({ promptPay: ENV_PP, bankName: ENV_BANK, bankAcct: ENV_ACCT, bankHolder: ENV_HOLDER, qrFileId: '' });

  useEffect(() => {
    fetch('/api/fees').then(r => r.json()).then(d => {
      const f = d.fees || {};
      setCfg({
        promptPay: f.companyPromptPay || ENV_PP,
        bankName: f.companyBankName || ENV_BANK,
        bankAcct: f.companyBankAcct || ENV_ACCT,
        bankHolder: f.companyBankHolder || ENV_HOLDER,
        qrFileId: f.companyQrFileId || '',
      });
    }).catch(() => {});
  }, []);

  const ppDigits = cfg.promptPay.replace(/\D/g, '');
  const autoQr = ppDigits ? `https://promptpay.io/${ppDigits}/${Math.max(0, amount)}.png` : '';
  const qrSrc = cfg.qrFileId ? fileUrl(cfg.qrFileId) : autoQr;
  const notSet = !cfg.qrFileId && !ppDigits && !cfg.bankAcct;

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  async function saveQr() {
    if (!qrSrc) return;
    try {
      const r = await fetch(qrSrc);
      if (!r.ok) throw new Error('fetch failed');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `glanghub-qr-${amount}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      window.open(qrSrc, '_blank', 'noopener');
    }
  }

  if (notSet) {
    return (
      <div className="pm-box">
        <div className="pm-head">💳 ช่องทางชำระเงิน</div>
        <p className="pm-note">⚠️ ยังไม่ได้ตั้งบัญชีรับเงินของบริษัท — กรุณาแจ้งทีมงาน/แอดมินตั้งค่าบัญชีในระบบก่อนทำการโอน</p>
      </div>
    );
  }

  return (
    <div className="pm-box">
      <div className="pm-head">💳 ช่องทางชำระเงิน — {cfg.bankHolder || 'บริษัท กลางฮับ จำกัด'}</div>
      <div className="pm-amount">ยอดที่ต้องโอน <b>฿{amount.toLocaleString()}</b></div>

      {qrSrc && (
        <div className="pm-qr-wrap">
          <img src={qrSrc} alt={`QR ยอด ฿${amount.toLocaleString()}`} className="pm-qr" loading="lazy" />
          <div className="pm-qr-acts">
            <span className="pm-label">{cfg.qrFileId ? 'สแกน QR เพื่อชำระ' : 'พร้อมเพย์ (สแกนหรือเปิดในแอปธนาคาร)'}</span>
            {ppDigits && (
              <div className="pm-row">
                <span className="mono pm-num">{cfg.promptPay}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(ppDigits, 'pp')}>
                  {copied === 'pp' ? '✅ คัดลอกแล้ว' : '📋 คัดลอกเลข'}
                </button>
              </div>
            )}
            <button type="button" className="btn btn-soft btn-sm" onClick={saveQr}>💾 บันทึกรูป QR ลงเครื่อง</button>
          </div>
        </div>
      )}

      {cfg.bankAcct && (
        <div className="pm-bank">
          <span className="pm-label">หรือโอนผ่านบัญชีธนาคาร</span>
          {cfg.bankName && <div className="pm-row"><span>{cfg.bankName}</span></div>}
          <div className="pm-row">
            <span className="mono pm-num">{cfg.bankAcct}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(cfg.bankAcct.replace(/\D/g, ''), 'acct')}>
              {copied === 'acct' ? '✅ คัดลอกแล้ว' : '📋 คัดลอกเลขบัญชี'}
            </button>
          </div>
          {cfg.bankHolder && <div className="pm-row"><span style={{ color: 'var(--muted)', fontSize: 12.5 }}>ชื่อบัญชี: {cfg.bankHolder}</span></div>}
        </div>
      )}

      {note && <p className="pm-note">{note}</p>}
      <p className="pm-note">⚠️ โอนตามยอดที่ระบุเท่านั้น แล้วกดอัปโหลดสลิปด้านล่าง — อย่าโอนเข้าบัญชีบุคคลอื่นเด็ดขาด</p>
    </div>
  );
}
