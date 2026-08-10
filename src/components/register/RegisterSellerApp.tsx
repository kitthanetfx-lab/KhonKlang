'use client';

/* eslint-disable @next/next/no-img-element */

import { Check, Copy, Plus, AlertTriangle } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import type { FeeConfig } from '@/lib/fees';
import { RegisterBranchForm, type BranchData } from './RegisterBranchForm';

export const SELLER_TYPES = [
  { value: 'freelance', label: 'ผู้ค้าอิสระ', icon: '🛒', desc: 'ขายสินค้าออนไลน์ ไม่มีหน้าร้านถาวร' },
  { value: 'physical', label: 'ผู้ขายมีหน้าร้าน', icon: '🏪', desc: 'มีร้านค้าจริง หรือตลาดนัด' },
  { value: 'distributor', label: 'ตัวแทนจำหน่าย', icon: '📦', desc: 'จัดจำหน่ายสินค้าจากแบรนด์/โรงงาน' },
  { value: 'corporate', label: 'บริษัท / นิติบุคคล', icon: '🏢', desc: 'จดทะเบียนธุรกิจถูกต้องตามกฎหมาย' },
];

export type RegisterSellerAppProps = {
  step: number;
  provinces: string[];
  banks: string[];
  displayName: string;
  oauthEmail: string;
  sellerType: string;
  onSellerType: (v: string) => void;
  fullNameId: string;
  onFullNameId: (v: string) => void;
  idNumber: string;
  onIdNumber: (v: string) => void;
  shopName: string;
  onShopName: (v: string) => void;
  shopTagline: string;
  onShopTagline: (v: string) => void;
  shopLogoFile: File | null;
  onShopLogoFile: (f: File | null) => void;
  isCorporate: boolean;
  companyName: string;
  onCompanyName: (v: string) => void;
  companyRegNum: string;
  onCompanyRegNum: (v: string) => void;
  branches: BranchData[];
  profileAddress: string;
  onUpdateBranch: (id: string, b: BranchData) => void;
  onRemoveBranch: (id: string) => void;
  onAddBranch: () => void;
  onFillBranchFromProfile: (id: string) => void;
  onlineLink: string;
  onOnlineLink: (v: string) => void;
  idCardFile: File | null;
  onIdCardFile: (f: File | null) => void;
  bookbankFile: File | null;
  onBookbankFile: (f: File | null) => void;
  companyCertFile: File | null;
  onCompanyCertFile: (f: File | null) => void;
  bankAcct: string;
  onBankAcct: (v: string) => void;
  bankName: string;
  onBankName: (v: string) => void;
  bankOwner: string;
  onBankOwner: (v: string) => void;
  companyBankAcct: string;
  onCompanyBankAcct: (v: string) => void;
  companyBankName: string;
  onCompanyBankName: (v: string) => void;
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

/** UI สมัครผู้ขายมือถือ — markup ใหม่ ไม่ใช้ glass-panel */
export function RegisterSellerApp(p: RegisterSellerAppProps) {
  if (p.step === 1) {
    return (
      <div className="reg-app-step">
        <StepHead title="ข้อมูลพื้นฐาน" sub="เลือกประเภทผู้ขายและกรอกข้อมูลตามบัตรประชาชน" />
        {(p.displayName || p.oauthEmail) && (
          <div className="reg-app-info">
            <span className="reg-app-info-k">บัญชีล็อกอิน</span>
            {p.displayName && <div><b>ชื่อ</b> {p.displayName}</div>}
            {p.oauthEmail && <div><b>อีเมล</b> {p.oauthEmail}</div>}
          </div>
        )}
        <div className="reg-app-choice-list">
          <span className="reg-app-choice-lbl">ประเภทผู้ขาย *</span>
          {SELLER_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              className={`reg-app-choice${p.sellerType === t.value ? ' is-on' : ''}`}
              onClick={() => p.onSellerType(t.value)}
            >
              <span className="reg-app-choice-ic">{t.icon}</span>
              <span className="reg-app-choice-tx">
                <strong>{t.label}</strong>
                <small>{t.desc}</small>
              </span>
            </button>
          ))}
        </div>
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
          <small className="reg-app-hint">ตัวเลข 13 หลัก ไม่ต้องใส่ขีด</small>
        </label>
        <div className="reg-app-card reg-app-card--soft">
          <h3 className="reg-app-card-title">🏪 ป้ายร้าน</h3>
          <p className="reg-app-card-sub">ตั้งตอนนี้หรือแก้ทีหลังได้ — แสดงเมื่อได้รับอนุมัติ</p>
          <label className="app-field">
            <span>ชื่อร้าน</span>
            <input value={p.shopName} onChange={e => p.onShopName(e.target.value)} placeholder="Kitt IT Shop" maxLength={120} />
          </label>
          <label className="app-field">
            <span>คำโปรยร้าน</span>
            <input value={p.shopTagline} onChange={e => p.onShopTagline(e.target.value)} placeholder="ของมือสองคุณภาพ ส่งไวทั่วไทย" maxLength={200} />
          </label>
          <FileUpload label="โลโก้ร้าน (ไม่บังคับ)" accept="image/*" hint="PNG/JPG 512×512" file={p.shopLogoFile} onChange={p.onShopLogoFile} />
        </div>
      </div>
    );
  }

  if (p.step === 2) {
    return (
      <div className="reg-app-step">
        <StepHead title="ข้อมูลผู้ขาย" sub="ระบุที่ตั้งร้านหรือพื้นที่ขายสินค้า" />
        {p.isCorporate && (
          <>
            <label className="app-field">
              <span>ชื่อบริษัท / นิติบุคคล *</span>
              <input value={p.companyName} onChange={e => p.onCompanyName(e.target.value)} placeholder="บริษัท ตัวอย่าง จำกัด" />
            </label>
            <label className="app-field">
              <span>เลขทะเบียนนิติบุคคล *</span>
              <input
                value={p.companyRegNum}
                onChange={e => p.onCompanyRegNum(e.target.value.replace(/\D/g, '').slice(0, 13))}
                placeholder="1234567890123"
                maxLength={13}
                inputMode="numeric"
              />
            </label>
          </>
        )}
        {p.branches.map((b, i) => (
          <RegisterBranchForm
            key={b.id}
            branch={b}
            provinces={p.provinces}
            onChange={updated => p.onUpdateBranch(b.id, updated)}
            onRemove={() => p.onRemoveBranch(b.id)}
            showRemove={p.branches.length > 1 && i > 0}
            profileAddress={p.profileAddress}
            onFillFromProfile={p.profileAddress ? () => p.onFillBranchFromProfile(b.id) : undefined}
          />
        ))}
        <button type="button" className="reg-app-add-btn" onClick={p.onAddBranch}>
          <Plus size={18} /> เพิ่มสาขา / ที่อยู่อื่น
        </button>
        <label className="app-field">
          <span>ลิงก์หน้าร้านออนไลน์ (ถ้ามี)</span>
          <input value={p.onlineLink} onChange={e => p.onOnlineLink(e.target.value)} placeholder="Facebook / Shopee / TikTok" type="url" />
        </label>
      </div>
    );
  }

  if (p.step === 3) {
    return (
      <div className="reg-app-step">
        <StepHead title="ยืนยันตัวตน" sub="อัปโหลดเอกสารและข้อมูลบัญชีธนาคาร" />
        <FileUpload label="ภาพบัตรประชาชน *" accept="image/*" file={p.idCardFile} onChange={p.onIdCardFile} hint="JPG / PNG / HEIC ≤ 10 MB" required />
        <FileUpload label="หน้าสมุดบัญชี (Bookbank) *" accept="image/*,.pdf" file={p.bookbankFile} onChange={p.onBookbankFile} hint="JPG / PNG / PDF" required />
        {p.isCorporate && (
          <FileUpload label="หนังสือรับรองบริษัท *" accept="image/*,.pdf" file={p.companyCertFile} onChange={p.onCompanyCertFile} hint="อายุไม่เกิน 6 เดือน" required />
        )}
        <div className="reg-app-card">
          <h3 className="reg-app-card-title">บัญชีรับเงินส่วนตัว</h3>
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
            <span>ชื่อบัญชี (ตรงบัตร) *</span>
            <input value={p.bankOwner} onChange={e => p.onBankOwner(e.target.value)} placeholder="ชื่อ นามสกุล" />
          </label>
        </div>
        {p.isCorporate && (
          <div className="reg-app-card">
            <h3 className="reg-app-card-title">บัญชีธนาคารบริษัท</h3>
            <label className="app-field">
              <span>เลขที่บัญชีบริษัท *</span>
              <input value={p.companyBankAcct} onChange={e => p.onCompanyBankAcct(e.target.value)} placeholder="xxx-x-xxxxx-x" />
            </label>
            <label className="app-field">
              <span>ธนาคาร *</span>
              <select value={p.companyBankName} onChange={e => p.onCompanyBankName(e.target.value)}>
                <option value="">เลือกธนาคาร</option>
                {p.banks.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="reg-app-step">
      <StepHead title="ชำระค่าสมัคร" sub="ชำระเพื่อเปิดใช้งานสิทธิ์ผู้ขาย" />
      <div className="reg-app-warn">
        <AlertTriangle size={18} />
        <div>
          <strong>ข้อควรทราบ</strong>
          <p>หากมีประวัติการโกง แพลตฟอร์ม<strong>ไม่คืนเงินค่าสมัครทุกกรณี</strong></p>
        </div>
      </div>
      {p.promoActive && p.fees.promoLabel && (
        <div className="reg-app-promo">🎉 {p.fees.promoLabel}</div>
      )}
      <div className="reg-app-fee-box">
        <span>ค่าสมัครผู้ขาย</span>
        {p.promoActive && p.membershipFee !== p.fees.sellerRegFee && (
          <del>฿{p.fees.sellerRegFee.toLocaleString()}</del>
        )}
        <strong className={p.membershipFee === 0 ? 'is-free' : ''}>
          {p.membershipFee === 0 ? 'ฟรี!' : `฿${p.membershipFee.toLocaleString()}`}
        </strong>
        <small>ชำระครั้งเดียว (ต่ออายุรายปี)</small>
      </div>
      {p.membershipFee > 0 && p.qrSrc && (
        <div className="reg-app-qr">
          <p>สแกน QR PromptPay</p>
          <img src={p.qrSrc} alt="QR PromptPay" />
          {p.ppDigits && (
            <div className="reg-app-copy-row">
              <code>{p.fees.companyPromptPay}</code>
              <button type="button" onClick={() => p.onCopyText(p.fees.companyPromptPay, 'pp')} aria-label="คัดลอก">
                {p.copied === 'pp' ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
              </button>
            </div>
          )}
        </div>
      )}
      {p.membershipFee > 0 && (p.fees.companyBankAcct ? (
        <div className="reg-app-card">
          <h3 className="reg-app-card-title">โอนผ่านธนาคาร</h3>
          <div className="reg-app-kv"><span>ธนาคาร</span><b>{p.fees.companyBankName}</b></div>
          <div className="reg-app-kv">
            <span>เลขบัญชี</span>
            <div className="reg-app-copy-row">
              <code>{p.fees.companyBankAcct}</code>
              <button type="button" onClick={() => p.onCopyText(p.fees.companyBankAcct, 'acct')} aria-label="คัดลอก">
                {p.copied === 'acct' ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          <div className="reg-app-kv"><span>ชื่อบัญชี</span><b>{p.fees.companyBankHolder}</b></div>
          <div className="reg-app-kv"><span>จำนวน</span><b className="reg-app-price">฿{p.membershipFee}</b></div>
        </div>
      ) : !p.qrSrc && (
        <p className="reg-app-err-inline">⚠️ ยังไม่ได้ตั้งบัญชีรับเงิน — ติดต่อแอดมินก่อนโอน</p>
      ))}
      {p.membershipFee > 0 ? (
        <FileUpload label="แนบสลิปโอนเงิน *" accept="image/*,.pdf" file={p.slipFile} onChange={p.onSlipFile} hint="JPG / PNG / PDF" required />
      ) : (
        <div className="reg-app-promo reg-app-promo--green">🎉 ฟรีค่าสมัคร — กดยืนยันได้เลย</div>
      )}
      {p.error && <p className="reg-app-err-inline">{p.error}</p>}
      <label className="reg-app-consent">
        <input type="checkbox" checked={p.pdpaConsent} onChange={e => p.onPdpaConsent(e.target.checked)} />
        <span>ยินยอมให้เก็บข้อมูลส่วนบุคคลตาม<a href="/privacy" target="_blank">นโยบายความเป็นส่วนตัว</a></span>
      </label>
      <button
        type="button"
        className="btn btn-primary btn-block reg-app-submit"
        disabled={p.submitting || (p.membershipFee > 0 && !p.slipFile) || !p.pdpaConsent}
        onClick={p.onSubmit}
      >
        {p.submitting ? 'กำลังส่งใบสมัคร…' : p.membershipFee > 0 ? 'ยืนยันและแนบสลิปแล้ว' : 'ยืนยันการสมัคร'}
      </button>
    </div>
  );
}

export default RegisterSellerApp;
