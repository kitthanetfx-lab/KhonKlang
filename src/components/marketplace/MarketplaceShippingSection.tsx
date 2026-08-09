'use client';

import { useEffect, useState } from 'react';
import { PROVINCE_NAMES } from '@/lib/provinceGeo';
import {
  EMPTY_PROFILE_ADDRESS,
  ProfileAddressFields,
  buildProfileAddress,
  isShippingAddressComplete,
  parseProfileAddress,
} from '@/lib/profileAddress';

type Props = {
  displayName: string;
  phone: string;
  address: string;
  shippingProviderLabel?: string;
  saving: boolean;
  onConfirm: (payload: { phone: string } & ProfileAddressFields) => Promise<void>;
};

export function MarketplaceShippingSection({
  displayName,
  phone: initialPhone,
  address: initialAddress,
  shippingProviderLabel,
  saving,
  onConfirm,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(initialPhone);
  const [addr, setAddr] = useState<ProfileAddressFields>(() => parseProfileAddress(initialAddress));
  const [amphoes, setAmphoes] = useState<string[]>([]);
  const [tambons, setTambons] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setPhone(initialPhone);
    setAddr(parseProfileAddress(initialAddress));
  }, [initialPhone, initialAddress]);

  useEffect(() => {
    if (!addr.provinceName) { setAmphoes([]); return; }
    fetch(`/api/thai-address?type=amphures&province=${encodeURIComponent(addr.provinceName)}`)
      .then(r => r.json()).then(d => setAmphoes(Array.isArray(d) ? d : [])).catch(() => setAmphoes([]));
  }, [addr.provinceName]);

  useEffect(() => {
    if (!addr.provinceName || !addr.amphoreName) { setTambons([]); return; }
    fetch(`/api/thai-address?type=tambons&province=${encodeURIComponent(addr.provinceName)}&amphoe=${encodeURIComponent(addr.amphoreName)}`)
      .then(r => r.json()).then(d => setTambons(Array.isArray(d) ? d : [])).catch(() => setTambons([]));
  }, [addr.provinceName, addr.amphoreName]);

  const hasAddress = isShippingAddressComplete(initialPhone, parseProfileAddress(initialAddress));
  const showForm = editing || !hasAddress;

  async function handleConfirm() {
    setError('');
    if (!isShippingAddressComplete(phone, addr)) {
      setError('กรุณากรอกเบอร์โทร บ้านเลขที่ ตำบล อำเภอ และจังหวัด');
      setEditing(true);
      return;
    }
    await onConfirm({ phone, ...addr });
  }

  return (
    <div className="mkt-co-card">
      <div className="mkt-co-card-head">
        <h2>📍 ที่อยู่จัดส่ง</h2>
        {hasAddress && !editing && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            แก้ไขที่อยู่
          </button>
        )}
      </div>

      {shippingProviderLabel && (
        <p className="mkt-co-ship-note">ขนส่ง: <strong>{shippingProviderLabel}</strong></p>
      )}

      {!showForm ? (
        <div className="mkt-co-addr-display">
          <div className="mkt-co-addr-name">{displayName || 'ผู้รับ'}</div>
          <div className="mkt-co-addr-line">{initialPhone}</div>
          <div className="mkt-co-addr-line">{initialAddress}</div>
        </div>
      ) : (
        <div className="mkt-co-addr-form">
          <label className="mkt-co-field">
            <span>ชื่อผู้รับ</span>
            <input type="text" value={displayName} readOnly disabled />
          </label>
          <label className="mkt-co-field">
            <span>เบอร์โทร *</span>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
          </label>
          <label className="mkt-co-field">
            <span>บ้านเลขที่ *</span>
            <input type="text" value={addr.houseNo} onChange={e => setAddr({ ...addr, houseNo: e.target.value })} />
          </label>
          <div className="mkt-co-field-row">
            <label className="mkt-co-field">
              <span>หมู่</span>
              <input type="text" value={addr.moo} onChange={e => setAddr({ ...addr, moo: e.target.value })} />
            </label>
            <label className="mkt-co-field">
              <span>ถนน</span>
              <input type="text" value={addr.road} onChange={e => setAddr({ ...addr, road: e.target.value })} placeholder="ถ." />
            </label>
          </div>
          <label className="mkt-co-field">
            <span>จังหวัด *</span>
            <select value={addr.provinceName} onChange={e => setAddr({ ...EMPTY_PROFILE_ADDRESS, provinceName: e.target.value })}>
              <option value="">เลือกจังหวัด...</option>
              {PROVINCE_NAMES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <div className="mkt-co-field-row">
            <label className="mkt-co-field">
              <span>อำเภอ/เขต *</span>
              <select value={addr.amphoreName} disabled={!addr.provinceName} onChange={e => setAddr({ ...addr, amphoreName: e.target.value, tambonName: '' })}>
                <option value="">เลือก...</option>
                {amphoes.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label className="mkt-co-field">
              <span>ตำบล/แขวง *</span>
              <select value={addr.tambonName} disabled={!addr.amphoreName} onChange={e => setAddr({ ...addr, tambonName: e.target.value })}>
                <option value="">เลือก...</option>
                {tambons.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <label className="mkt-co-field">
            <span>รหัสไปรษณีย์</span>
            <input type="text" maxLength={5} value={addr.postalCode} onChange={e => setAddr({ ...addr, postalCode: e.target.value.replace(/\D/g, '') })} />
          </label>
          {showForm && hasAddress && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setPhone(initialPhone); setAddr(parseProfileAddress(initialAddress)); }}>
              ยกเลิก
            </button>
          )}
        </div>
      )}

      {error && <p className="rv-error">{error}</p>}

      <button type="button" className="btn btn-primary btn-block btn-lg" disabled={saving} onClick={handleConfirm}>
        {saving ? 'กำลังบันทึก...' : showForm ? 'บันทึกและยืนยันที่อยู่ →' : 'ยืนยันที่อยู่จัดส่ง →'}
      </button>

      {!showForm && (
        <p className="mkt-co-hint">ตรวจสอบที่อยู่ให้ถูกต้องก่อนชำระเงิน — ผู้ขายจะจัดส่งมาที่อยู่นี้</p>
      )}
      {showForm && (
        <p className="mkt-co-hint">ที่อยู่จะบันทึกลงโปรไฟล์ของคุณ — ใช้ซ้ำในคำสั่งซื้อครั้งถัดไป</p>
      )}
    </div>
  );
}

export function formatShippingPreview(phone: string, addr: ProfileAddressFields): string {
  return [phone, buildProfileAddress(addr)].filter(Boolean).join(' · ');
}
