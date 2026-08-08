'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from 'react';
import { authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { Settings, Loader2, CheckCircle2, ShoppingCart, Zap, Search, MapPin, Car, Shield, RotateCcw, Wallet, Tag, Store } from 'lucide-react';
import { THAI_BANKS } from '@/lib/banks';

interface FeeConfig {
  escrowFeePercent: number; escrowFeeMin: number;
  middlemanFeePercent: number; middlemanFeeMin: number; platformCutPercent: number;
  simpleFeePercent: number; simpleFeeMin: number;
  simpleShareTier1Multiplier: number; simpleShareTier1Percent: number;
  simpleShareTier2Multiplier: number; simpleShareTier2Percent: number;
  simpleShareTier3Multiplier: number; simpleShareTier3Percent: number;
  marketplaceGpPercent: number; marketplaceGpCommissionPercent: number;
  inspectionFee: number; packingFee: number;
  depositBronze: number; depositSilver: number; depositGold: number; depositPlatinum: number;
  failedDealFee: number;
  onsiteBaseFee: number; onsitePerKm: number;
  meetupFeePercent: number; meetupFeeMin: number;
  sellerRegFee: number; middlemanRegFee: number;
  returnShippingBy: 'buyer' | 'seller' | 'split';
  companyPromptPay: string; companyBankName: string; companyBankAcct: string; companyBankHolder: string; companyQrFileId: string;
  promoEnabled: boolean; promoScope: 'all' | 'seller' | 'middleman';
  promoPercent: number; promoFree: boolean;
  promoStart: string; promoEnd: string; promoLabel: string;
}

type TabId = 'trade' | 'services' | 'members' | 'account';
type BoolKey = 'promoEnabled' | 'promoFree';
type StrKey = 'returnShippingBy' | 'companyPromptPay' | 'companyBankName' | 'companyBankAcct' | 'companyBankHolder' | 'companyQrFileId'
  | 'promoScope' | 'promoStart' | 'promoEnd' | 'promoLabel';
type NumKey = Exclude<keyof FeeConfig, StrKey | BoolKey>;
const TIER_KEYS: { tier: number; mult: NumKey; pct: NumKey }[] = [
  { tier: 1, mult: 'simpleShareTier1Multiplier', pct: 'simpleShareTier1Percent' },
  { tier: 2, mult: 'simpleShareTier2Multiplier', pct: 'simpleShareTier2Percent' },
  { tier: 3, mult: 'simpleShareTier3Multiplier', pct: 'simpleShareTier3Percent' },
];
const qrUrl = (id: string) => fileViewUrl(DEAL_BUCKET, id);

const TABS: { id: TabId; label: string }[] = [
  { id: 'trade', label: 'ซื้อขาย & GP' },
  { id: 'services', label: 'บริการเสริม' },
  { id: 'members', label: 'สมาชิก & โปร' },
  { id: 'account', label: 'บัญชีรับเงิน' },
];

type FieldDef = [NumKey, string, string];
const TRADE_GROUPS: { title: string; icon: React.ReactNode; hint?: string; fields: FieldDef[] }[] = [
  { title: 'ซื้อขายผ่านกลาง (ออนไลน์)', icon: <ShoppingCart size={15} className="text-blue-600" />, fields: [
    ['escrowFeePercent', 'ค่าธรรมเนียมระบบ', '%'],
    ['escrowFeeMin', 'ขั้นต่ำ', 'บาท'],
    ['middlemanFeePercent', 'ค่าบริการคนกลาง', '%'],
    ['middlemanFeeMin', 'ค่าคนกลางขั้นต่ำ', 'บาท'],
    ['platformCutPercent', 'ส่วนแบ่งแพลตฟอร์มจากค่าคนกลาง', '%'],
  ] },
  { title: 'ซื้อขายผ่านกลางแบบง่าย', icon: <Zap size={15} className="text-orange-600" />, fields: [
    ['simpleFeePercent', 'ค่าธรรมเนียม', '%'],
    ['simpleFeeMin', 'ขั้นต่ำ', 'บาท'],
  ] },
  { title: 'GP ตลาดขาย (ลงประกาศหน้าร้าน)', icon: <Store size={15} className="text-indigo-600" />,
    hint: 'ผู้ขายตั้ง 100 + GP 20% → ผู้บริโภคเห็น 120 | คืนคอมมิชชั่น % ของ GP ให้ผู้ขาย ส่วนที่เหลือเป็นของแพลตฟอร์ม',
    fields: [
      ['marketplaceGpPercent', 'GP%', '% บวกจากราคาผู้ขาย'],
      ['marketplaceGpCommissionPercent', 'คืนผู้ขาย', '% ของ GP'],
    ] },
];

const SERVICE_GROUPS: { title: string; icon: React.ReactNode; fields: FieldDef[] }[] = [
  { title: 'ตรวจ/แพ็คสินค้า', icon: <Search size={15} className="text-teal-600" />, fields: [
    ['inspectionFee', 'ค่าตรวจสอบ', 'บาท'],
    ['packingFee', 'ค่าแพ็ค', 'บาท'],
  ] },
  { title: 'นัดออนไซต์', icon: <MapPin size={15} className="text-amber-600" />, fields: [
    ['onsiteBaseFee', 'ค่าบริการฐาน', 'บาท'],
    ['onsitePerKm', 'ค่าเดินทาง', 'บาท/กม.'],
  ] },
  { title: 'รับประกันเดินทาง', icon: <Car size={15} className="text-violet-600" />, fields: [
    ['meetupFeePercent', 'ค่าธรรมเนียม', '%'],
    ['meetupFeeMin', 'ขั้นต่ำ', 'บาท'],
  ] },
  { title: 'ดีลไม่สำเร็จ', icon: <RotateCcw size={15} className="text-rose-600" />, fields: [
    ['failedDealFee', 'ค่าจัดการ', 'บาท'],
  ] },
];

const MEMBER_GROUPS: { title: string; icon: React.ReactNode; fields: FieldDef[] }[] = [
  { title: 'เกณฑ์ Tier คนกลาง', icon: <Shield size={15} className="text-emerald-600" />, fields: [
    ['depositBronze', 'Bronze', 'บาท'],
    ['depositSilver', 'Silver', 'บาท'],
    ['depositGold', 'Gold', 'บาท'],
    ['depositPlatinum', 'Platinum', 'บาท'],
  ] },
  { title: 'ค่าสมัคร', icon: <Wallet size={15} className="text-green-600" />, fields: [
    ['sellerRegFee', 'ผู้ขาย', 'บาท'],
    ['middlemanRegFee', 'คนกลาง', 'บาท'],
  ] },
];

function FeeField({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: string) => void }) {
  return (
    <label className="admin-fee-field">
      <span className="admin-fee-field__label">{label}</span>
      <div className="admin-fee-field__input-wrap">
        <input type="number" min="0" step="any" value={value} onChange={e => onChange(e.target.value)}
          className="admin-fee-field__input" />
        <span className="admin-fee-field__unit">{unit}</span>
      </div>
    </label>
  );
}

function FeeCard({ title, icon, hint, children }: { title: string; icon: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <section className="admin-fee-card">
      <header className="admin-fee-card__head">
        {icon}
        <div>
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const [fees, setFees] = useState<FeeConfig | null>(null);
  const [tab, setTab] = useState<TabId>('trade');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeaders();
        const r = await fetch('/api/admin/settings', { headers });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'โหลดค่าธรรมเนียมไม่สำเร็จ');
        setFees(d.fees);
      } catch (e) { setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด'); }
    })();
  }, []);

  function setField(k: NumKey, v: string) {
    setFees(f => f ? { ...f, [k]: v === '' ? 0 : Number(v) } : f);
    setSaved(false);
  }
  function setStr(k: StrKey, v: string) {
    setFees(f => f ? { ...f, [k]: v } : f);
    setSaved(false);
  }
  function setBool(k: BoolKey, v: boolean) {
    setFees(f => f ? { ...f, [k]: v } : f);
    setSaved(false);
  }

  const [qrUploading, setQrUploading] = useState(false);
  async function uploadQr(file: File) {
    setQrUploading(true);
    try {
      const headers = await authHeaders();
      const form = new FormData(); form.append('file', file);
      const r = await fetch('/api/upload-deal', { method: 'POST', headers, body: form });
      const d = await r.json();
      if (r.ok && d.fileId) setStr('companyQrFileId', d.fileId);
      else setError(d.error || 'อัปโหลด QR ไม่สำเร็จ');
    } catch { setError('อัปโหลด QR ไม่สำเร็จ'); }
    finally { setQrUploading(false); }
  }

  async function save() {
    if (!fees) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const headers = await authHeaders();
      const r = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fees }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'บันทึกไม่สำเร็จ');
      setFees(d.fees);
      setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  }

  function renderGroups(groups: typeof TRADE_GROUPS) {
    if (!fees) return null;
    return (
      <div className="admin-fee-grid">
        {groups.map(g => (
          <FeeCard key={g.title} title={g.title} icon={g.icon} hint={g.hint}>
            <div className="admin-fee-fields">
              {g.fields.map(([k, label, unit]) => (
                <FeeField key={k} label={label} unit={unit} value={fees[k]} onChange={v => setField(k, v)} />
              ))}
            </div>
          </FeeCard>
        ))}
      </div>
    );
  }

  return (
    <div className="admin-fee-page">
      <header className="admin-fee-page__head">
        <div>
          <h1><Settings size={20} /> ตั้งค่าค่าธรรมเนียม</h1>
          <p>กำหนดอัตราค่าบริการและบัญชีรับเงินของระบบ</p>
        </div>
        <div className="admin-fee-page__actions">
          <button onClick={save} disabled={saving || !fees}
            className="admin-fee-save">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            บันทึก
          </button>
          {saved && <span className="admin-fee-saved"><CheckCircle2 size={14} /> บันทึกแล้ว</span>}
        </div>
      </header>

      <nav className="admin-fee-tabs">
        {TABS.map(t => (
          <button key={t.id} type="button" className={`admin-fee-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {fees === null && !error && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>}
      {error && <div className="admin-fee-error">⚠️ {error}</div>}

      {fees && tab === 'trade' && (
        <>
          {renderGroups(TRADE_GROUPS)}
          <FeeCard title="คอมมิชชั่นผู้สร้างดีล (3 ชั้น)" icon={<Zap size={15} className="text-orange-600" />}
            hint={`เปรียบเทียบค่าบริการดีลแบบง่ายกับค่าคนกลางขั้นต่ำ (฿${fees.middlemanFeeMin.toLocaleString()})`}>
            <div className="admin-fee-tier-grid">
              {TIER_KEYS.map(({ tier, mult, pct }) => {
                const threshold = Math.round((fees[mult] || 0) * fees.middlemanFeeMin);
                return (
                  <div key={tier} className="admin-fee-tier">
                    <div className="admin-fee-tier__title">ชั้น {tier} · ค่าบริการ ≥ ฿{threshold.toLocaleString()}</div>
                    <FeeField label="จำนวนเท่าของค่ากลาง" unit="เท่า" value={fees[mult]} onChange={v => setField(mult, v)} />
                    <FeeField label="% แบ่งให้ผู้สร้างดีล" unit="%" value={fees[pct]} onChange={v => setField(pct, v)} />
                  </div>
                );
              })}
            </div>
          </FeeCard>
        </>
      )}

      {fees && tab === 'services' && (
        <>
          {renderGroups(SERVICE_GROUPS)}
          <FeeCard title="ผู้รับผิดชอบค่าส่งคืน (ตีกลับ)" icon={<RotateCcw size={15} className="text-rose-600" />}>
            <div className="admin-fee-pills">
              {([['buyer', 'ผู้ซื้อ'], ['seller', 'ผู้ขาย'], ['split', 'หารครึ่ง']] as const).map(([val, lbl]) => (
                <button key={val} type="button"
                  onClick={() => { setFees(f => f ? { ...f, returnShippingBy: val } : f); setSaved(false); }}
                  className={`admin-fee-pill${fees.returnShippingBy === val ? ' active' : ''}`}>{lbl}</button>
              ))}
            </div>
          </FeeCard>
        </>
      )}

      {fees && tab === 'members' && (
        <>
          {renderGroups(MEMBER_GROUPS)}
          <FeeCard title="โปรโมชันค่าสมัคร" icon={<Tag size={15} className="text-amber-600" />}>
            <div className="admin-fee-promo-head">
              <p>ลดราคาหรือฟรีค่าสมัครในช่วงเวลาที่กำหนด</p>
              <button type="button" onClick={() => setBool('promoEnabled', !fees.promoEnabled)}
                className={`admin-fee-promo-toggle${fees.promoEnabled ? ' on' : ''}`}>
                {fees.promoEnabled ? 'เปิด' : 'ปิด'}
              </button>
            </div>
            <div className="admin-fee-fields admin-fee-fields--wide">
              <label className="admin-fee-field">
                <span className="admin-fee-field__label">ใช้กับ</span>
                <select value={fees.promoScope} onChange={e => setStr('promoScope', e.target.value)} className="admin-fee-field__input">
                  <option value="all">ผู้ขาย + คนกลาง</option>
                  <option value="seller">ผู้ขาย</option>
                  <option value="middleman">คนกลาง</option>
                </select>
              </label>
              <label className="admin-fee-field admin-fee-field--check">
                <input type="checkbox" checked={fees.promoFree} onChange={e => setBool('promoFree', e.target.checked)} />
                <span>ฟรีค่าสมัครทั้งหมด</span>
              </label>
              <FeeField label="ส่วนลด" unit="%" value={fees.promoPercent} onChange={v => setField('promoPercent', v)} />
              <label className="admin-fee-field">
                <span className="admin-fee-field__label">ข้อความโปร</span>
                <input value={fees.promoLabel} onChange={e => setStr('promoLabel', e.target.value)} className="admin-fee-field__input" placeholder="เช่น โปรปีใหม่" />
              </label>
              <label className="admin-fee-field">
                <span className="admin-fee-field__label">วันเริ่ม</span>
                <input type="date" value={fees.promoStart ? fees.promoStart.slice(0, 10) : ''} onChange={e => setStr('promoStart', e.target.value)} className="admin-fee-field__input" />
              </label>
              <label className="admin-fee-field">
                <span className="admin-fee-field__label">วันสิ้นสุด</span>
                <input type="date" value={fees.promoEnd ? fees.promoEnd.slice(0, 10) : ''} onChange={e => setStr('promoEnd', e.target.value)} className="admin-fee-field__input" />
              </label>
            </div>
          </FeeCard>
        </>
      )}

      {fees && tab === 'account' && (
        <FeeCard title="บัญชีรับเงินของบริษัท" icon={<Wallet size={15} className="text-green-600" />}
          hint="แสดงในหน้าชำระเงิน — ลูกค้าโอนเข้าบัญชีนี้">
          <div className="admin-fee-fields admin-fee-fields--wide">
            <label className="admin-fee-field">
              <span className="admin-fee-field__label">พร้อมเพย์</span>
              <input value={fees.companyPromptPay} onChange={e => setStr('companyPromptPay', e.target.value)} className="admin-fee-field__input" placeholder="0812345678" />
            </label>
            <label className="admin-fee-field">
              <span className="admin-fee-field__label">ธนาคาร</span>
              <select value={fees.companyBankName} onChange={e => setStr('companyBankName', e.target.value)} className="admin-fee-field__input">
                <option value="">เลือกธนาคาร</option>
                {THAI_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="admin-fee-field">
              <span className="admin-fee-field__label">เลขบัญชี</span>
              <input value={fees.companyBankAcct} onChange={e => setStr('companyBankAcct', e.target.value)} className="admin-fee-field__input" />
            </label>
            <label className="admin-fee-field">
              <span className="admin-fee-field__label">ชื่อบัญชี</span>
              <input value={fees.companyBankHolder} onChange={e => setStr('companyBankHolder', e.target.value)} className="admin-fee-field__input" />
            </label>
          </div>
          <div className="admin-fee-qr">
            {fees.companyQrFileId && <img src={qrUrl(fees.companyQrFileId)} alt="QR" />}
            <label className="admin-fee-qr-btn">
              {qrUploading ? <Loader2 size={14} className="animate-spin" /> : '🖼️'} {fees.companyQrFileId ? 'เปลี่ยน QR' : 'อัปโหลด QR'}
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadQr(f); e.target.value = ''; }} />
            </label>
            {fees.companyQrFileId && <button type="button" onClick={() => setStr('companyQrFileId', '')} className="admin-fee-qr-del">ลบ</button>}
          </div>
        </FeeCard>
      )}
    </div>
  );
}
