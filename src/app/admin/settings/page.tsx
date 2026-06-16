'use client';

import { useState, useEffect } from 'react';
import { account } from '@/lib/appwrite';
import { Settings, Loader2, CheckCircle2, ShoppingCart, Zap, Search, Package, MapPin, Car } from 'lucide-react';

interface FeeConfig {
  escrowFeePercent: number; escrowFeeMin: number;
  simpleFeePercent: number; simpleFeeMin: number;
  inspectionFee: number; packingFee: number;
  onsiteBaseFee: number; onsitePerKm: number;
  meetupFeePercent: number; meetupFeeMin: number;
}

// กลุ่มฟิลด์สำหรับแสดงผล: [key, label, หน่วย]
const GROUPS: { title: string; icon: React.ReactNode; fields: [keyof FeeConfig, string, string][] }[] = [
  { title: 'ซื้อขายผ่านกลาง (ออนไลน์)', icon: <ShoppingCart size={16} className="text-blue-600" />, fields: [
    ['escrowFeePercent', 'ค่าธรรมเนียม', '% ของราคา'],
    ['escrowFeeMin', 'ขั้นต่ำ', 'บาท'],
  ] },
  { title: 'ซื้อขายผ่านกลางแบบง่าย (ส่งตรง)', icon: <Zap size={16} className="text-orange-600" />, fields: [
    ['simpleFeePercent', 'ค่าธรรมเนียม', '% ของราคา'],
    ['simpleFeeMin', 'ขั้นต่ำ', 'บาท'],
  ] },
  { title: 'ค่าบริการตรวจ/แพ็คสินค้า', icon: <Search size={16} className="text-teal-600" />, fields: [
    ['inspectionFee', 'ค่าตรวจสอบสินค้า', 'บาท'],
    ['packingFee', 'ค่าแพ็คสินค้า', 'บาท'],
  ] },
  { title: 'บริการนัดออนไซต์', icon: <MapPin size={16} className="text-amber-600" />, fields: [
    ['onsiteBaseFee', 'ค่าบริการฐาน', 'บาท'],
    ['onsitePerKm', 'ค่าเดินทาง', 'บาท/กม.'],
  ] },
  { title: 'รับประกันเดินทาง (นัดเจอ)', icon: <Car size={16} className="text-violet-600" />, fields: [
    ['meetupFeePercent', 'ค่าธรรมเนียม', '% ของมูลค่า'],
    ['meetupFeeMin', 'ค่าบริการขั้นต่ำ', 'บาท'],
  ] },
];

export default function SettingsPage() {
  const [fees, setFees] = useState<FeeConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const jwt = (await account.createJWT()).jwt;
        const r = await fetch('/api/admin/settings', { headers: { 'x-session-jwt': jwt } });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'โหลดค่าธรรมเนียมไม่สำเร็จ');
        setFees(d.fees);
      } catch (e) { setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด'); }
    })();
  }, []);

  function setField(k: keyof FeeConfig, v: string) {
    setFees(f => f ? { ...f, [k]: v === '' ? 0 : Number(v) } : f);
    setSaved(false);
  }

  async function save() {
    if (!fees) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify(fees),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'บันทึกไม่สำเร็จ');
      setFees(d.fees);
      setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Settings size={20} /> ตั้งค่าค่าธรรมเนียม & ค่าบริการ</h1>
        <p className="text-sm text-gray-500 mt-0.5">กำหนดอัตราค่าบริการของแต่ละบริการ — ผู้ใช้จะเห็นและต้องยอมรับก่อนเริ่มดีลทุกครั้ง</p>
      </div>

      {fees === null && !error && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">⚠️ {error}</div>}

      {fees && (
        <>
          {GROUPS.map(g => (
            <div key={g.title} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              <h2 className="font-semibold text-sm flex items-center gap-2 mb-4">{g.icon} {g.title}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {g.fields.map(([k, label, unit]) => (
                  <label key={k} className="block">
                    <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
                    <div className="mt-1 flex items-center gap-2">
                      <input type="number" min="0" step="any" value={fees[k]}
                        onChange={e => setField(k, e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
                      <span className="text-xs text-gray-400 shrink-0 w-20">{unit}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3 sticky bottom-4">
            <button onClick={save} disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 shadow-lg">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} บันทึกค่าธรรมเนียม
            </button>
            {saved && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 size={15} /> บันทึกแล้ว</span>}
          </div>

          <p className="text-xs text-gray-400">หมายเหตุ: บันทึกค่าไว้ในระบบแล้ว ขั้นต่อไปคือการนำอัตราเหล่านี้ไปคิดเงินจริงในแต่ละดีล (ยังไม่ได้เชื่อมกับ flow คิดเงิน)</p>
        </>
      )}
    </div>
  );
}
