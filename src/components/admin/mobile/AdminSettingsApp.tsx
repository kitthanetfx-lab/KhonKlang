'use client';

import { THAI_BANKS } from '@/lib/banks';
import type { FeeConfig } from '@/lib/fees';
import { AdminAppFrame, AdminAppSection } from './AdminAppFrame';

type TabId = 'trade' | 'services' | 'members' | 'account';

const TABS: { id: TabId; label: string }[] = [
  { id: 'trade', label: 'ตลาด & GP' },
  { id: 'services', label: 'บริการเสริม' },
  { id: 'members', label: 'สมาชิก' },
  { id: 'account', label: 'บัญชี' },
];

type Props = {
  fees: FeeConfig | null;
  loading: boolean;
  error?: string;
  tab: TabId;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  fieldErrors: Partial<Record<string, string>>;
  qrUploading: boolean;
  qrUrl: (id: string) => string;
  onTab: (t: TabId) => void;
  onSave: () => void;
  setField: (k: string, v: string) => void;
  setStr: (k: string, v: string) => void;
  setBool: (k: string, v: boolean) => void;
  uploadQr: (file: File) => void;
};

function NumField({ label, unit, value, onChange, error }: {
  label: string; unit?: string; value: number; onChange: (v: string) => void; error?: string;
}) {
  return (
    <label className="admin-app-field">
      <span>{label}{unit ? ` (${unit})` : ''}</span>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} />
      {error && <em className="text-xs text-red-600 not-italic">{error}</em>}
    </label>
  );
}

export function AdminSettingsApp({
  fees, loading, error, tab, dirty, saving, saved, fieldErrors, qrUploading, qrUrl,
  onTab, onSave, setField, setStr, setBool, uploadQr,
}: Props) {
  return (
    <>
      <AdminAppFrame
        title="ตั้งค่าค่าธรรมเนียม"
        subtitle="อัตราค่าบริการและบัญชีรับเงิน"
        filters={
          <div className="admin-app-tabs">
            {TABS.map(t => (
              <button key={t.id} type="button" className={`admin-app-tab${tab === t.id ? ' is-on' : ''}`} onClick={() => onTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        }
      >
        {error && <div className="admin-app-alert">{error}</div>}
        {loading && !fees ? (
          <div className="app-loading"><div className="mkt-spinner" /></div>
        ) : fees && tab === 'trade' ? (
          <>
            <AdminAppSection title="ดีลผ่านคนกลาง">
              <div className="admin-app-form-card">
                <NumField label="ค่าธรรมเนียมระบบ" unit="%" value={fees.escrowFeePercent} onChange={v => setField('escrowFeePercent', v)} error={fieldErrors.escrowFeePercent} />
                <NumField label="ขั้นต่ำ escrow" unit="บาท" value={fees.escrowFeeMin} onChange={v => setField('escrowFeeMin', v)} />
                <NumField label="ค่าคนกลาง" unit="%" value={fees.middlemanFeePercent} onChange={v => setField('middlemanFeePercent', v)} />
                <NumField label="ส่วนแบ่งแพลตฟอร์ม" unit="%" value={fees.platformCutPercent} onChange={v => setField('platformCutPercent', v)} />
              </div>
            </AdminAppSection>
            <AdminAppSection title="ดีลแบบง่าย">
              <div className="admin-app-form-card">
                <NumField label="ค่าธรรมเนียม" unit="%" value={fees.simpleFeePercent} onChange={v => setField('simpleFeePercent', v)} />
                <NumField label="ขั้นต่ำ" unit="บาท" value={fees.simpleFeeMin} onChange={v => setField('simpleFeeMin', v)} />
              </div>
            </AdminAppSection>
            <AdminAppSection title="GP ตลาด">
              <div className="admin-app-form-card">
                <NumField label="GP ตลาด" unit="%" value={fees.marketplaceGpPercent} onChange={v => setField('marketplaceGpPercent', v)} />
                <NumField label="คืนผู้ขาย (% GP)" unit="%" value={fees.marketplaceGpCommissionPercent} onChange={v => setField('marketplaceGpCommissionPercent', v)} />
                <NumField label="GP ประมูล" unit="%" value={fees.auctionGpPercent} onChange={v => setField('auctionGpPercent', v)} />
                <NumField label="คืนผู้ขายประมูล" unit="%" value={fees.auctionGpCommissionPercent} onChange={v => setField('auctionGpCommissionPercent', v)} />
              </div>
            </AdminAppSection>
          </>
        ) : fees && tab === 'services' ? (
          <AdminAppSection title="บริการเสริม">
            <div className="admin-app-form-card">
              <NumField label="ค่าตรวจ" unit="บาท" value={fees.inspectionFee} onChange={v => setField('inspectionFee', v)} />
              <NumField label="ค่าแพ็ค" unit="บาท" value={fees.packingFee} onChange={v => setField('packingFee', v)} />
              <NumField label="ออนไซต์ฐาน" unit="บาท" value={fees.onsiteBaseFee} onChange={v => setField('onsiteBaseFee', v)} />
              <NumField label="ออนไซต์/กม." unit="บาท" value={fees.onsitePerKm} onChange={v => setField('onsitePerKm', v)} />
              <NumField label="นัดเจอ" unit="%" value={fees.meetupFeePercent} onChange={v => setField('meetupFeePercent', v)} />
              <NumField label="ดีลไม่สำเร็จ" unit="บาท" value={fees.failedDealFee} onChange={v => setField('failedDealFee', v)} />
              <label className="admin-app-field">
                <span>ค่าส่งคืนโดย</span>
                <select value={fees.returnShippingBy} onChange={e => setStr('returnShippingBy', e.target.value)}>
                  <option value="buyer">ผู้ซื้อ</option>
                  <option value="seller">ผู้ขาย</option>
                  <option value="split">หารครึ่ง</option>
                </select>
              </label>
            </div>
          </AdminAppSection>
        ) : fees && tab === 'members' ? (
          <>
            <AdminAppSection title="Tier คนกลาง">
              <div className="admin-app-form-card">
                <NumField label="Bronze" unit="บาท" value={fees.depositBronze} onChange={v => setField('depositBronze', v)} />
                <NumField label="Silver" unit="บาท" value={fees.depositSilver} onChange={v => setField('depositSilver', v)} />
                <NumField label="Gold" unit="บาท" value={fees.depositGold} onChange={v => setField('depositGold', v)} />
                <NumField label="Platinum" unit="บาท" value={fees.depositPlatinum} onChange={v => setField('depositPlatinum', v)} />
              </div>
            </AdminAppSection>
            <AdminAppSection title="ค่าสมัคร & โปร">
              <div className="admin-app-form-card">
                <NumField label="สมัครผู้ขาย" unit="บาท" value={fees.sellerRegFee} onChange={v => setField('sellerRegFee', v)} />
                <NumField label="สมัครคนกลาง" unit="บาท" value={fees.middlemanRegFee} onChange={v => setField('middlemanRegFee', v)} />
                <div className="admin-app-toggle-row">
                  <button type="button" className={`admin-app-toggle-btn${fees.promoEnabled ? ' is-on' : ''}`}
                    onClick={() => setBool('promoEnabled', !fees.promoEnabled)}>โปร {fees.promoEnabled ? 'เปิด' : 'ปิด'}</button>
                </div>
                <NumField label="ส่วนลดโปร" unit="%" value={fees.promoPercent} onChange={v => setField('promoPercent', v)} />
                <label className="admin-app-field">
                  <span>ข้อความโปร</span>
                  <input value={fees.promoLabel} onChange={e => setStr('promoLabel', e.target.value)} />
                </label>
              </div>
            </AdminAppSection>
          </>
        ) : fees && tab === 'account' ? (
          <AdminAppSection title="บัญชีรับเงิน">
            <div className="admin-app-form-card">
              <label className="admin-app-field">
                <span>พร้อมเพย์</span>
                <input value={fees.companyPromptPay} onChange={e => setStr('companyPromptPay', e.target.value)} />
              </label>
              <label className="admin-app-field">
                <span>ธนาคาร</span>
                <select value={fees.companyBankName} onChange={e => setStr('companyBankName', e.target.value)}>
                  <option value="">เลือกธนาคาร</option>
                  {THAI_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label className="admin-app-field">
                <span>เลขบัญชี</span>
                <input value={fees.companyBankAcct} onChange={e => setStr('companyBankAcct', e.target.value)} />
              </label>
              <label className="admin-app-field">
                <span>ชื่อบัญชี</span>
                <input value={fees.companyBankHolder} onChange={e => setStr('companyBankHolder', e.target.value)} />
              </label>
              {fees.companyQrFileId && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={qrUrl(fees.companyQrFileId)} alt="QR" className="w-32 h-32 object-contain rounded-xl border mb-2" />
              )}
              <label className="admin-app-toggle-btn is-on text-center cursor-pointer">
                {qrUploading ? 'กำลังอัปโหลด…' : fees.companyQrFileId ? 'เปลี่ยน QR' : 'อัปโหลด QR'}
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadQr(f); e.target.value = ''; }} />
              </label>
            </div>
          </AdminAppSection>
        ) : null}
      </AdminAppFrame>
      {fees && (
        <div className="admin-app-save-bar">
          <button type="button" className="btn-primary" onClick={onSave} disabled={saving || !dirty}>
            {saving ? 'กำลังบันทึก…' : saved ? 'บันทึกแล้ว ✓' : 'บันทึกค่าธรรมเนียม'}
          </button>
        </div>
      )}
    </>
  );
}
