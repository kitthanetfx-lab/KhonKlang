'use client';

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { Settings, ShoppingCart, Zap, Search, MapPin, Car, RotateCcw, Wallet, Tag, Store, Shield, Gavel } from 'lucide-react';
import { THAI_BANKS } from '@/lib/banks';
import { computeMarketplaceGp, type FeeConfig } from '@/lib/fees';
import {
  AdminPage,
  AdminPageHeader,
  AdminTabs,
  AdminAlert,
  AdminStickyBar,
  AdminCard,
  AdminFieldGrid,
  AdminFieldRow,
  AdminField,
  AdminPills,
  AdminGpPreview,
  AdminSectionNote,
  AdminLoading,
} from '@/components/admin/AdminUI';

type TabId = 'trade' | 'services' | 'members' | 'account';
type BoolKey = 'promoEnabled' | 'promoFree';
type StrKey = 'returnShippingBy' | 'companyPromptPay' | 'companyBankName' | 'companyBankAcct' | 'companyBankHolder' | 'companyQrFileId'
  | 'promoScope' | 'promoStart' | 'promoEnd' | 'promoLabel' | 'promoVideoUrl';
type NumKey = Exclude<keyof FeeConfig, StrKey | BoolKey>;

type PercentKey =
  | 'escrowFeePercent' | 'middlemanFeePercent' | 'platformCutPercent'
  | 'simpleFeePercent' | 'simpleShareTier1Percent' | 'simpleShareTier2Percent' | 'simpleShareTier3Percent'
  | 'meetupFeePercent' | 'promoPercent' | 'marketplaceGpPercent' | 'marketplaceGpCommissionPercent';

const PERCENT_KEYS = new Set<PercentKey>([
  'escrowFeePercent', 'middlemanFeePercent', 'platformCutPercent',
  'simpleFeePercent', 'simpleShareTier1Percent', 'simpleShareTier2Percent', 'simpleShareTier3Percent',
  'meetupFeePercent', 'promoPercent', 'marketplaceGpPercent', 'marketplaceGpCommissionPercent',
]);

function isPercentKey(k: NumKey): k is PercentKey {
  return PERCENT_KEYS.has(k as PercentKey);
}

const TIER_KEYS: { tier: number; mult: NumKey; pct: NumKey }[] = [
  { tier: 1, mult: 'simpleShareTier1Multiplier', pct: 'simpleShareTier1Percent' },
  { tier: 2, mult: 'simpleShareTier2Multiplier', pct: 'simpleShareTier2Percent' },
  { tier: 3, mult: 'simpleShareTier3Multiplier', pct: 'simpleShareTier3Percent' },
];

const TABS: { id: TabId; label: string; desc: string }[] = [
  { id: 'trade', label: 'ตลาด & GP', desc: 'ดีลผ่านกลาง + ตลาดซื้อขาย' },
  { id: 'services', label: 'บริการเสริม', desc: 'ตรวจ/แพ็ค/นัด/เดินทาง' },
  { id: 'members', label: 'สมาชิก & โปร', desc: 'Tier · ค่าสมัคร · โปรโมชัน' },
  { id: 'account', label: 'บัญชีรับเงิน', desc: 'พร้อมเพย์ · ธนาคาร · QR' },
];

const qrUrl = (id: string) => fileViewUrl(DEAL_BUCKET, id);

function feesEqual(a: FeeConfig | null, b: FeeConfig | null) {
  if (!a || !b) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

function clampPercent(n: number) {
  return Math.min(100, Math.max(0, n));
}

export default function SettingsPage() {
  const [fees, setFees] = useState<FeeConfig | null>(null);
  const [savedFees, setSavedFees] = useState<FeeConfig | null>(null);
  const [tab, setTab] = useState<TabId>('trade');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<NumKey, string>>>({});

  const dirty = !feesEqual(fees, savedFees);

  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeaders();
        const r = await fetch('/api/admin/settings', { headers });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'โหลดค่าธรรมเนียมไม่สำเร็จ');
        setFees(d.fees);
        setSavedFees(d.fees);
      } catch (e) { setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด'); }
    })();
  }, []);

  const gpPreview = useMemo(() => {
    if (!fees) return null;
    return computeMarketplaceGp(fees, 100);
  }, [fees]);

  const gpHint = fees
    ? `ผู้ขายตั้ง 100 + GP ${fees.marketplaceGpPercent}% → ลูกค้าเห็น ${100 + Math.round(100 * fees.marketplaceGpPercent / 100)} | คืนผู้ขาย ${fees.marketplaceGpCommissionPercent}% ของ GP`
    : '';

  function setField(k: NumKey, v: string) {
    const num = v === '' ? 0 : Number(v);
    setFees(f => f ? { ...f, [k]: num } : f);
    setSaved(false);
    if (isPercentKey(k)) {
      if (num < 0 || num > 100) {
        setFieldErrors(e => ({ ...e, [k]: 'ต้องอยู่ระหว่าง 0–100' }));
      } else {
        setFieldErrors(e => { const n = { ...e }; delete n[k]; return n; });
      }
    } else if (num < 0) {
      setFieldErrors(e => ({ ...e, [k]: 'ต้องไม่ต่ำกว่า 0' }));
    } else {
      setFieldErrors(e => { const n = { ...e }; delete n[k]; return n; });
    }
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

  function validate(): boolean {
    if (!fees) return false;
    const errs: Partial<Record<NumKey, string>> = {};
    for (const k of PERCENT_KEYS) {
      const v = fees[k];
      if (v < 0 || v > 100) errs[k] = 'ต้องอยู่ระหว่าง 0–100';
    }
    for (const k of Object.keys(fees) as NumKey[]) {
      const v = fees[k];
      if (typeof v === 'number' && v < 0 && !isPercentKey(k)) {
        errs[k] = 'ต้องไม่ต่ำกว่า 0';
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const save = useCallback(async () => {
    if (!fees || !validate()) {
      setError('กรุณาแก้ค่าที่ไม่ถูกต้องก่อนบันทึก');
      return;
    }
    setSaving(true); setError(''); setSaved(false);
    try {
      const headers = await authHeaders();
      const payload = {
        ...fees,
        ...Object.fromEntries(
          [...PERCENT_KEYS].map(k => [k, clampPercent(fees[k] as number)])
        ),
      };
      const r = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fees: payload }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'บันทึกไม่สำเร็จ');
      setFees(d.fees);
      setSavedFees(d.fees);
      setSaved(true);
      setFieldErrors({});
    } catch (e) { setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  }, [fees]);

  function switchTab(next: TabId) {
    if (dirty && !window.confirm('มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการสลับแท็บ?')) return;
    setTab(next);
  }

  function numField(k: NumKey, label: string, unit: string, hint?: string) {
    if (!fees) return null;
    return (
      <AdminField
        key={k}
        label={label}
        unit={unit}
        value={fees[k] as number}
        onChange={v => setField(k, v)}
        min={0}
        max={isPercentKey(k) ? 100 : undefined}
        error={fieldErrors[k]}
        hint={hint}
      />
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        icon={<Settings size={22} />}
        title="ตั้งค่าค่าธรรมเนียม"
        subtitle="กำหนดอัตราค่าบริการ ตลาดซื้อขาย/ประมูล และบัญชีรับเงินของระบบ"
        onSave={save}
        saving={saving}
        saved={saved}
        dirty={dirty}
      />

      <AdminTabs tabs={TABS} active={tab} onChange={switchTab} />

      {fees === null && !error && <AdminLoading />}
      {error && <AdminAlert type="error">⚠️ {error}</AdminAlert>}

      {fees && tab === 'trade' && (
        <>
          <div className="admin-grid">
            <AdminCard
              title="ดีลผ่านคนกลาง (ออนไลน์)"
              icon={<ShoppingCart size={18} className="text-blue-600" />}
              hint="ใช้เมื่อซื้อขายผ่าน escrow แบบมีคนกลางดูแล"
              featured="blue"
            >
              <AdminFieldRow label="ค่าธรรมเนียมระบบ">
                {numField('escrowFeePercent', 'อัตรา', '%')}
                {numField('escrowFeeMin', 'ขั้นต่ำ', 'บาท')}
              </AdminFieldRow>
              <AdminFieldRow label="ค่าบริการคนกลาง">
                {numField('middlemanFeePercent', 'อัตรา', '%')}
                {numField('middlemanFeeMin', 'ขั้นต่ำ', 'บาท')}
              </AdminFieldRow>
              <AdminFieldRow label="ส่วนแบ่งแพลตฟอร์ม">
                {numField('platformCutPercent', '% จากค่าคนกลาง', '%', 'เปอร์เซ็นต์ของค่าบริการคนกลางที่เป็นของแพลตฟอร์ม')}
              </AdminFieldRow>
            </AdminCard>

            <AdminCard
              title="ดีลแบบง่าย"
              icon={<Zap size={18} className="text-orange-600" />}
              hint="ดีลที่ไม่ผ่านคนกลางเต็มรูปแบบ — คิดค่าธรรมเนียมแบบรวม"
            >
              <AdminFieldGrid>
                {numField('simpleFeePercent', 'ค่าธรรมเนียม', '%')}
                {numField('simpleFeeMin', 'ขั้นต่ำ', 'บาท')}
              </AdminFieldGrid>
            </AdminCard>
          </div>

          <div className="admin-grid admin-grid--1">
            <AdminCard
              title="GP ตลาดซื้อขาย & ตลาดประมูล"
              icon={<Store size={18} className="text-indigo-600" />}
              hint={gpHint}
              featured="indigo"
            >
              <AdminFieldGrid>
                {numField('marketplaceGpPercent', 'GP บวกจากราคาผู้ขาย', '%')}
                {numField('marketplaceGpCommissionPercent', 'คืนผู้ขาย (% ของ GP)', '%')}
              </AdminFieldGrid>
              {gpPreview && <AdminGpPreview preview={gpPreview} />}
              <AdminSectionNote>
                <Gavel size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                ตลาดประมูลใช้ GP ชุดเดียวกับตลาดซื้อขาย — ราคาเริ่มประมูล = ราคาฐาน + GP
              </AdminSectionNote>
            </AdminCard>
          </div>

          <AdminCard
            title="คอมมิชชั่นผู้สร้างดีล (3 ชั้น)"
            icon={<Zap size={18} className="text-orange-600" />}
            hint={`ใช้กับดีลแบบง่าย — เปรียบเทียบค่าบริการกับค่าคนกลางขั้นต่ำ (฿${fees.middlemanFeeMin.toLocaleString()})`}
          >
            <div className="admin-tier-grid">
              {TIER_KEYS.map(({ tier, mult, pct }) => {
                const threshold = Math.round((fees[mult] || 0) * fees.middlemanFeeMin);
                return (
                  <div key={tier} className="admin-tier">
                    <div className="admin-tier__title">ชั้น {tier} · ค่าบริการ ≥ ฿{threshold.toLocaleString()}</div>
                    {numField(mult, 'จำนวนเท่าของค่ากลาง', 'เท่า')}
                    {numField(pct, '% แบ่งให้ผู้สร้างดีล', '%')}
                  </div>
                );
              })}
            </div>
          </AdminCard>
        </>
      )}

      {fees && tab === 'services' && (
        <>
          <div className="admin-grid">
            <AdminCard title="ตรวจ/แพ็คสินค้า" icon={<Search size={18} className="text-teal-600" />}>
              <AdminFieldGrid>
                {numField('inspectionFee', 'ค่าตรวจสอบ', 'บาท')}
                {numField('packingFee', 'ค่าแพ็ค', 'บาท')}
              </AdminFieldGrid>
            </AdminCard>
            <AdminCard title="นัดออนไซต์" icon={<MapPin size={18} className="text-amber-600" />}>
              <AdminFieldGrid>
                {numField('onsiteBaseFee', 'ค่าบริการฐาน', 'บาท')}
                {numField('onsitePerKm', 'ค่าเดินทาง', 'บาท/กม.')}
              </AdminFieldGrid>
            </AdminCard>
            <AdminCard title="รับประกันเดินทาง" icon={<Car size={18} className="text-violet-600" />}>
              <AdminFieldGrid>
                {numField('meetupFeePercent', 'ค่าธรรมเนียม', '%')}
                {numField('meetupFeeMin', 'ขั้นต่ำ', 'บาท')}
              </AdminFieldGrid>
            </AdminCard>
            <AdminCard title="ดีลไม่สำเร็จ" icon={<RotateCcw size={18} className="text-rose-600" />}>
              <AdminFieldGrid>{numField('failedDealFee', 'ค่าจัดการ', 'บาท')}</AdminFieldGrid>
            </AdminCard>
          </div>

          <AdminCard title="ผู้รับผิดชอบค่าส่งคืน (ตีกลับ)" icon={<RotateCcw size={18} className="text-rose-600" />}>
            <AdminPills
              options={[
                { value: 'buyer' as const, label: 'ผู้ซื้อ' },
                { value: 'seller' as const, label: 'ผู้ขาย' },
                { value: 'split' as const, label: 'หารครึ่ง' },
              ]}
              value={fees.returnShippingBy}
              onChange={v => { setFees(f => f ? { ...f, returnShippingBy: v } : f); setSaved(false); }}
            />
          </AdminCard>
        </>
      )}

      {fees && tab === 'members' && (
        <>
          <div className="admin-grid">
            <AdminCard title="เกณฑ์ Tier คนกลาง" icon={<Shield size={18} className="text-emerald-600" />} featured="amber">
              <AdminFieldGrid>
                {numField('depositBronze', 'Bronze', 'บาท')}
                {numField('depositSilver', 'Silver', 'บาท')}
                {numField('depositGold', 'Gold', 'บาท')}
                {numField('depositPlatinum', 'Platinum', 'บาท')}
              </AdminFieldGrid>
            </AdminCard>
            <AdminCard title="ค่าสมัคร" icon={<Wallet size={18} className="text-green-600" />}>
              <AdminFieldGrid>
                {numField('sellerRegFee', 'ผู้ขาย', 'บาท')}
                {numField('middlemanRegFee', 'คนกลาง', 'บาท')}
              </AdminFieldGrid>
            </AdminCard>
          </div>

          <AdminCard title="โปรโมชันค่าสมัคร" icon={<Tag size={18} className="text-amber-600" />} featured="amber">
            <div className="admin-promo-head">
              <p>ลดราคาหรือฟรีค่าสมัครในช่วงเวลาที่กำหนด</p>
              <button type="button" onClick={() => setBool('promoEnabled', !fees.promoEnabled)}
                className={`admin-promo-toggle${fees.promoEnabled ? ' on' : ''}`}>
                {fees.promoEnabled ? 'เปิด' : 'ปิด'}
              </button>
            </div>
            <AdminFieldGrid wide>
              <label className="admin-field">
                <span className="admin-field__label">ใช้กับ</span>
                <select value={fees.promoScope} onChange={e => setStr('promoScope', e.target.value)} className="admin-field__input">
                  <option value="all">ผู้ขาย + คนกลาง</option>
                  <option value="seller">ผู้ขาย</option>
                  <option value="middleman">คนกลาง</option>
                </select>
              </label>
              <label className="admin-field admin-field--check">
                <input type="checkbox" checked={fees.promoFree} onChange={e => setBool('promoFree', e.target.checked)} />
                <span>ฟรีค่าสมัครทั้งหมด</span>
              </label>
              {numField('promoPercent', 'ส่วนลด', '%')}
              <label className="admin-field">
                <span className="admin-field__label">ข้อความโปร</span>
                <input value={fees.promoLabel} onChange={e => setStr('promoLabel', e.target.value)} className="admin-field__input" placeholder="เช่น โปรปีใหม่" />
              </label>
              <AdminField label="วันเริ่ม" value={fees.promoStart ? fees.promoStart.slice(0, 10) : ''} onChange={v => setStr('promoStart', v)} type="date" />
              <AdminField label="วันสิ้นสุด" value={fees.promoEnd ? fees.promoEnd.slice(0, 10) : ''} onChange={v => setStr('promoEnd', v)} type="date" />
            </AdminFieldGrid>
          </AdminCard>
        </>
      )}

      {fees && tab === 'account' && (
        <AdminCard
          title="บัญชีรับเงินของบริษัท"
          icon={<Wallet size={18} className="text-green-600" />}
          hint="แสดงในหน้าชำระเงิน — ลูกค้าโอนเข้าบัญชีนี้"
          featured="blue"
        >
          <AdminFieldGrid wide>
            <label className="admin-field">
              <span className="admin-field__label">พร้อมเพย์</span>
              <input value={fees.companyPromptPay} onChange={e => setStr('companyPromptPay', e.target.value)} className="admin-field__input" placeholder="0812345678" />
            </label>
            <label className="admin-field">
              <span className="admin-field__label">ธนาคาร</span>
              <select value={fees.companyBankName} onChange={e => setStr('companyBankName', e.target.value)} className="admin-field__input">
                <option value="">เลือกธนาคาร</option>
                {THAI_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="admin-field">
              <span className="admin-field__label">เลขบัญชี</span>
              <input value={fees.companyBankAcct} onChange={e => setStr('companyBankAcct', e.target.value)} className="admin-field__input" />
            </label>
            <label className="admin-field">
              <span className="admin-field__label">ชื่อบัญชี</span>
              <input value={fees.companyBankHolder} onChange={e => setStr('companyBankHolder', e.target.value)} className="admin-field__input" />
            </label>
          </AdminFieldGrid>
          <div className="admin-qr">
            {fees.companyQrFileId && <img src={qrUrl(fees.companyQrFileId)} alt="QR" />}
            <label className="admin-qr-btn">
              {qrUploading ? '⏳' : '🖼️'} {fees.companyQrFileId ? 'เปลี่ยน QR' : 'อัปโหลด QR'}
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadQr(f); e.target.value = ''; }} />
            </label>
            {fees.companyQrFileId && <button type="button" onClick={() => setStr('companyQrFileId', '')} className="admin-qr-del">ลบ QR</button>}
          </div>
        </AdminCard>
      )}

      {fees && (
        <AdminStickyBar onSave={save} saving={saving} saved={saved} dirty={dirty} label="บันทึกค่าธรรมเนียม" />
      )}
    </AdminPage>
  );
}
