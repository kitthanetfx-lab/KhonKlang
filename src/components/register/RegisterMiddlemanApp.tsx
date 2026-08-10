'use client';

/* eslint-disable @next/next/no-img-element */

import { Check, Copy, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import type { FeeConfig } from '@/lib/fees';

export const MM_CATEGORIES = [
  { id: 'it', label: 'อุปกรณ์ไอที / มือถือ', icon: '📱' },
  { id: 'amulet', label: 'พระเครื่อง / วัตถุมงคล', icon: '🪬' },
  { id: 'luxury', label: 'แบรนด์เนม / กระเป๋า / นาฬิกา', icon: '👜' },
  { id: 'vehicle', label: 'รถมอเตอร์ไซค์ / รถยนต์', icon: '🏍️' },
  { id: 'game', label: 'ไอดีเกม / บัญชีเกม', icon: '🎮' },
  { id: 'appliance', label: 'เครื่องใช้ไฟฟ้า', icon: '🖥️' },
  { id: 'jewelry', label: 'อัญมณี / ทองคำ', icon: '💍' },
  { id: 'general', label: 'สินค้าทั่วไป', icon: '📦' },
];

export type RegisterMiddlemanAppProps = {
  step: number;
  provinces: string[];
  banks: string[];
  displayName: string;
  oauthEmail: string;
  fullNameId: string;
  onFullNameId: (v: string) => void;
  idNumber: string;
  onIdNumber: (v: string) => void;
  categories: string[];
  onToggleCategory: (id: string) => void;
  workProvince: string;
  onWorkProvince: (v: string) => void;
  profileProvince: string;
  terms: string;
  onTerms: (v: string) => void;
  idCardFile: File | null;
  onIdCardFile: (f: File | null) => void;
  bookbankFile: File | null;
  onBookbankFile: (f: File | null) => void;
  bankAcct: string;
  onBankAcct: (v: string) => void;
  bankName: string;
  onBankName: (v: string) => void;
  bankOwner: string;
  onBankOwner: (v: string) => void;
  fees: FeeConfig;
  membershipFee: number;
  promoActive: boolean;
  qrSrc: string;
  ppDigits: string;
  copied: 'acct' | 'pp' | null;
  onCopyText: (text: string, key: 'acct' | 'pp') => void;
  slipFile: File | null;
  onSlipFile: (f: File | null) => void;
  pdpaConsent: boolean;
  onPdpaConsent: (v: boolean) => void;
  error: string;
  submitting: boolean;
  onSubmit: () => void;
};

function StepHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="reg-app-section-head">
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
  );
}

/** UI สมัครคนกลางมือถือ — markup ใหม่แบบ mkt-app */
export function RegisterMiddlemanApp(p: RegisterMiddlemanAppProps) {
  if (p.step === 1) {
    return (
      <div className="reg-app-step">
        <StepHead title="ข้อมูลพื้นฐาน" sub="กรอกข้อมูลตามบัตรประชาชน" />
        {(p.displayName || p.oauthEmail) && (
          <div className="reg-app-info">
            <span className="reg-app-info-k">บัญชีล็อกอิน</span>
            {p.displayName && <div><b>ชื่อ</b> {p.displayName}</div>}
            {p.oauthEmail && <div><b>อีเมล</b> {p.oauthEmail}</div>}
          </div>
        )}
        <label className="app-field">
          <span>ชื่อ-นามสกุล (ตรงบัตร) *</span>
          <input value={p.fullNameId} onChange={e => p.onFullNameId(e.target.value)} placeholder="ชื่อ นามสกุล" />
        </label>
        <label className="app-field">
          <span>เลขประจำตัวประชาชน *</span>
          <input
            value={p.idNumber}
            onChange={e => p.onIdNumber(e.target.value.replace(/\D/g, '').slice(0, 13))}
            placeholder="1234567890123"
            maxLength={13}
            inputMode="numeric"
          />
          <small className="reg-app-hint">ตัวเลข 13 หลัก</small>
        </label>
      </div>
    );
  }

  if (p.step === 2) {
    return (
      <div className="reg-app-step">
        <StepHead title="ข้อมูลคนกลาง" sub="ความเชี่ยวชาญและพื้นที่รับงาน" />
        <div className="reg-app-info reg-app-info--purple">
          <Shield size={18} />
          <div>
            <strong>เงินค้ำประกัน</strong>
            <p>โอนได้หลังผ่าน KYC ผ่านบอร์ดคนกลาง — โอนเท่าไหร่ใช้เป็นเครดิตได้เต็มจำนวน ไม่มีขั้นต่ำ</p>
          </div>
        </div>
        <div className="reg-app-choice-list">
          <span className="reg-app-choice-lbl">ประเภทสินค้าที่เชี่ยวชาญ * (เลือกได้หลายอย่าง)</span>
          {MM_CATEGORIES.map(cat => {
            const sel = p.categories.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                className={`reg-app-choice reg-app-choice--compact${sel ? ' is-on' : ''}`}
                onClick={() => p.onToggleCategory(cat.id)}
              >
                <span className="reg-app-choice-ic">{cat.icon}</span>
                <span className="reg-app-choice-tx"><strong>{cat.label}</strong></span>
                {sel && <CheckCircle2 size={18} className="reg-app-choice-check" />}
              </button>
            );
          })}
        </div>
        <label className="app-field">
          <span>จังหวัดหลักที่สะดวกรับงาน *</span>
          {p.profileProvince && (
            <button type="button" className="reg-app-chip-btn reg-app-chip-btn--block" onClick={() => p.onWorkProvince(p.profileProvince)}>
              ใช้จากโปรไฟล์ ({p.profileProvince})
            </button>
          )}
          <select value={p.workProvince} onChange={e => p.onWorkProvince(e.target.value)}>
            <option value="">เลือกจังหวัด</option>
            {p.provinces.map(pr => <option key={pr} value={pr}>{pr}</option>)}
          </select>
        </label>
        <label className="app-field">
          <span>เงื่อนไขเพิ่มเติม (ไม่บังคับ)</span>
          <textarea value={p.terms} onChange={e => p.onTerms(e.target.value)} rows={4} placeholder="เช่น อัตราค่าบริการ 1-3%, รับงาน 9:00-18:00" />
        </label>
      </div>
    );
  }

  if (p.step === 3) {
    return (
      <div className="reg-app-step">
        <StepHead title="ยืนยันตัวตน" sub="อัปโหลดเอกสารและบัญชีธนาคาร" />
        <FileUpload label="ภาพบัตรประชาชน *" accept="image/*" file={p.idCardFile} onChange={p.onIdCardFile} hint="JPG / PNG / HEIC" required />
        <FileUpload label="หน้าสมุดบัญชี *" accept="image/*,.pdf" file={p.bookbankFile} onChange={p.onBookbankFile} hint="JPG / PNG / PDF" required />
        <div className="reg-app-card">
          <h3 className="reg-app-card-title">บัญชีรับ-คืนเงิน</h3>
          <label className="app-field">
            <span>เลขที่บัญชี *</span>
            <input value={p.bankAcct} onChange={e => p.onBankAcct(e.target.value)} placeholder="xxx-x-xxxxx-x" />
          </label>
          <label className="app-field">
            <span>ธนาคาร *</span>
            <select value={p.bankName} onChange={e => p.onBankName(e.target.value)}>
              <option value="">เลือกธนาคาร</option>
              {p.banks.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label className="app-field">
            <span>ชื่อบัญชี *</span>
            <input value={p.bankOwner} onChange={e => p.onBankOwner(e.target.value)} placeholder="ชื่อ นามสกุล" />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="reg-app-step">
      <StepHead title="ชำระค่าสมัคร" sub="ชำระเพื่อเปิดใช้งานสิทธิ์คนกลาง" />
      <div className="reg-app-warn">
        <AlertTriangle size={18} />
        <div>
          <strong>ข้อควรทราบ</strong>
          <p>หากมีประวัติการโกง <strong>ไม่คืนเงินค่าสมัครทุกกรณี</strong></p>
        </div>
      </div>
      {p.promoActive && p.fees.promoLabel && <div className="reg-app-promo">🎉 {p.fees.promoLabel}</div>}
      <div className="reg-app-fee-box reg-app-fee-box--purple">
        <span>ค่าสมัครคนกลาง</span>
        {p.promoActive && p.membershipFee !== p.fees.middlemanRegFee && (
          <del>฿{p.fees.middlemanRegFee.toLocaleString()}</del>
        )}
        <strong className={p.membershipFee === 0 ? 'is-free' : ''}>
          {p.membershipFee === 0 ? 'ฟรี!' : `฿${p.membershipFee.toLocaleString()}`}
        </strong>
      </div>
      {p.membershipFee > 0 && p.qrSrc && (
        <div className="reg-app-qr">
          <p>สแกน QR PromptPay</p>
          <img src={p.qrSrc} alt="QR" />
          {p.ppDigits && (
            <div className="reg-app-copy-row">
              <code>{p.fees.companyPromptPay}</code>
              <button type="button" onClick={() => p.onCopyText(p.fees.companyPromptPay, 'pp')}>
                {p.copied === 'pp' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          )}
        </div>
      )}
      {p.membershipFee > 0 ? (
        <FileUpload label="แนบสลิป *" accept="image/*,.pdf" file={p.slipFile} onChange={p.onSlipFile} required />
      ) : (
        <div className="reg-app-promo reg-app-promo--green">🎉 ฟรีค่าสมัคร</div>
      )}
      {p.error && <p className="reg-app-err-inline">{p.error}</p>}
      <label className="reg-app-consent">
        <input type="checkbox" checked={p.pdpaConsent} onChange={e => p.onPdpaConsent(e.target.checked)} />
        <span>ยินยอมตาม<a href="/privacy" target="_blank">นโยบายความเป็นส่วนตัว</a></span>
      </label>
      <button
        type="button"
        className="btn btn-primary btn-block reg-app-submit"
        disabled={p.submitting || (p.membershipFee > 0 && !p.slipFile) || !p.pdpaConsent}
        onClick={p.onSubmit}
      >
        {p.submitting ? 'กำลังส่ง…' : 'ยืนยันการสมัคร'}
      </button>
    </div>
  );
}

export default RegisterMiddlemanApp;
