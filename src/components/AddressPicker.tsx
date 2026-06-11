'use client';
import React, { useEffect, useState } from 'react';
import { PROVINCE_NAMES } from '@/lib/provinceGeo';

export interface ThaiAddress { province: string; amphoe: string; tambon: string }
export const EMPTY_ADDRESS: ThaiAddress = { province: '', amphoe: '', tambon: '' };
export const addressLabel = (a?: ThaiAddress | null) =>
  a && a.province ? [a.tambon && `ต.${a.tambon}`, a.amphoe && `อ.${a.amphoe}`, `จ.${a.province}`].filter(Boolean).join(' ') : '';

/** เลือกที่อยู่ระดับ ตำบล/อำเภอ/จังหวัด — cascading จาก /api/thai-address */
export function AddressPicker({ value, onChange, compact }: {
  value: ThaiAddress; onChange: (v: ThaiAddress) => void; compact?: boolean;
}) {
  const [amphures, setAmphures] = useState<string[]>([]);
  const [tambons, setTambons] = useState<string[]>([]);

  useEffect(() => {
    if (!value.province) return;
    let off = false;
    fetch(`/api/thai-address?type=amphures&province=${encodeURIComponent(value.province)}`)
      .then(r => r.json())
      .then((l: string[]) => { if (!off) setAmphures(Array.isArray(l) ? l : []); })
      .catch(() => { if (!off) setAmphures([]); });
    return () => { off = true; };
  }, [value.province]);

  useEffect(() => {
    if (!value.province || !value.amphoe) return;
    let off = false;
    fetch(`/api/thai-address?type=tambons&province=${encodeURIComponent(value.province)}&amphoe=${encodeURIComponent(value.amphoe)}`)
      .then(r => r.json())
      .then((l: (string | string[])[]) => { if (!off) setTambons((Array.isArray(l) ? l : []).map(x => (typeof x === 'string' ? x : x[0]))); })
      .catch(() => { if (!off) setTambons([]); });
    return () => { off = true; };
  }, [value.province, value.amphoe]);

  const visibleAmphures = value.province ? amphures : [];
  const visibleTambons = value.province && value.amphoe ? tambons : [];

  return (
    <div className={`addr-grid ${compact ? 'compact' : ''}`}>
      <select value={value.province} onChange={e => onChange({ province: e.target.value, amphoe: '', tambon: '' })}>
        <option value="">จังหวัด...</option>
        {PROVINCE_NAMES.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <select value={value.amphoe} disabled={!value.province} onChange={e => onChange({ ...value, amphoe: e.target.value, tambon: '' })}>
        <option value="">อำเภอ/เขต...</option>
        {visibleAmphures.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
      <select value={value.tambon} disabled={!value.amphoe} onChange={e => onChange({ ...value, tambon: e.target.value })}>
        <option value="">ตำบล/แขวง...</option>
        {visibleTambons.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
}

export default AddressPicker;
