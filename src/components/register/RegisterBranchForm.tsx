'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, MapPin, Trash2 } from 'lucide-react';

export interface BranchData {
  id: string;
  label: string;
  houseNo: string;
  moo: string;
  road: string;
  provinceName: string;
  amphoreName: string;
  tambonName: string;
  postalCode: string;
}

type Props = {
  branch: BranchData;
  provinces: string[];
  onChange: (b: BranchData) => void;
  onRemove?: () => void;
  showRemove?: boolean;
  profileAddress?: string;
  onFillFromProfile?: () => void;
};

/** ฟอร์มที่อยู่สาขา — mobile-native app-field */
export function RegisterBranchForm({
  branch, provinces, onChange, onRemove, showRemove, profileAddress, onFillFromProfile,
}: Props) {
  const [amphoes, setAmphoes] = useState<string[]>([]);
  const [tambons, setTambons] = useState<[string, string][]>([]);
  const [loadingAmph, setLoadingAmph] = useState(false);
  const [loadingTamb, setLoadingTamb] = useState(false);

  useEffect(() => {
    if (!branch.provinceName) return;
    setLoadingAmph(true);
    fetch(`/api/thai-address?type=amphures&province=${encodeURIComponent(branch.provinceName)}`)
      .then(r => r.json()).then(d => setAmphoes(Array.isArray(d) ? d : []))
      .catch(() => setAmphoes([]))
      .finally(() => setLoadingAmph(false));
  }, [branch.provinceName]);

  useEffect(() => {
    if (!branch.amphoreName || !branch.provinceName) return;
    setLoadingTamb(true);
    fetch(`/api/thai-address?type=tambons&province=${encodeURIComponent(branch.provinceName)}&amphoe=${encodeURIComponent(branch.amphoreName)}`)
      .then(r => r.json()).then(d => setTambons(Array.isArray(d) ? d : []))
      .catch(() => setTambons([]))
      .finally(() => setLoadingTamb(false));
  }, [branch.provinceName, branch.amphoreName]);

  const upd = (key: keyof BranchData, val: string) => onChange({ ...branch, [key]: val });
  const onProvince = (name: string) => {
    onChange({ ...branch, provinceName: name, amphoreName: '', tambonName: '', postalCode: '' });
    setAmphoes([]); setTambons([]);
  };
  const onAmphoe = (name: string) => {
    onChange({ ...branch, amphoreName: name, tambonName: '', postalCode: '' });
    setTambons([]);
  };
  const onTambon = (val: string) => {
    const [n, z] = val.split('|');
    onChange({ ...branch, tambonName: n, postalCode: z });
  };

  return (
    <div className="reg-app-card">
      <div className="reg-app-card-head">
        <MapPin size={16} className="reg-app-card-ic" />
        <input
          className="reg-app-card-label-input"
          value={branch.label}
          onChange={e => upd('label', e.target.value)}
          placeholder="ชื่อสาขา"
          aria-label="ชื่อสาขา"
        />
        <div className="reg-app-card-head-actions">
          {profileAddress && onFillFromProfile && (
            <button type="button" className="reg-app-chip-btn" onClick={onFillFromProfile}>
              <ClipboardList size={12} /> จากโปรไฟล์
            </button>
          )}
          {showRemove && onRemove && (
            <button type="button" className="reg-app-chip-btn reg-app-chip-btn--danger" onClick={onRemove}>
              <Trash2 size={12} /> ลบ
            </button>
          )}
        </div>
      </div>

      <div className="reg-app-card-body">
        <label className="app-field">
          <span>บ้านเลขที่</span>
          <input value={branch.houseNo} onChange={e => upd('houseNo', e.target.value)} placeholder="207/2" />
        </label>
        <div className="reg-app-field-row">
          <label className="app-field">
            <span>หมู่ที่</span>
            <input value={branch.moo} onChange={e => upd('moo', e.target.value)} placeholder="1" />
          </label>
          <label className="app-field">
            <span>ถนน</span>
            <input value={branch.road} onChange={e => upd('road', e.target.value)} placeholder="พหลโยธิน" />
          </label>
        </div>
        <label className="app-field">
          <span>จังหวัด *</span>
          <select value={branch.provinceName} onChange={e => onProvince(e.target.value)}>
            <option value="">เลือกจังหวัด</option>
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="app-field">
          <span>อำเภอ / เขต *</span>
          <select value={branch.amphoreName} onChange={e => onAmphoe(e.target.value)} disabled={!branch.provinceName || loadingAmph}>
            <option value="">{loadingAmph ? 'กำลังโหลด…' : branch.provinceName ? 'เลือกอำเภอ' : 'เลือกจังหวัดก่อน'}</option>
            {amphoes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <div className="reg-app-field-row">
          <label className="app-field">
            <span>ตำบล / แขวง *</span>
            <select
              value={branch.tambonName ? `${branch.tambonName}|${branch.postalCode}` : ''}
              onChange={e => onTambon(e.target.value)}
              disabled={!branch.amphoreName || loadingTamb}
            >
              <option value="">{loadingTamb ? 'กำลังโหลด…' : branch.amphoreName ? 'เลือกตำบล' : 'เลือกอำเภอก่อน'}</option>
              {tambons.map(([n, z]) => <option key={n} value={`${n}|${z}`}>{n}</option>)}
            </select>
          </label>
          <label className="app-field">
            <span>รหัสไปรษณีย์</span>
            <input readOnly value={branch.postalCode} placeholder="ออโต้" className="reg-app-readonly" />
          </label>
        </div>
      </div>
    </div>
  );
}

export default RegisterBranchForm;
