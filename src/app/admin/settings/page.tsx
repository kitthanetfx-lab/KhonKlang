'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from 'react';
import { account } from '@/lib/appwrite';
import { Settings, Loader2, CheckCircle2, ShoppingCart, Zap, Search, MapPin, Car, Shield, RotateCcw, Wallet } from 'lucide-react';
import { THAI_BANKS } from '@/lib/banks';

interface FeeConfig {
  escrowFeePercent: number; escrowFeeMin: number;
  middlemanFeePercent: number; middlemanFeeMin: number; platformCutPercent: number;
  simpleFeePercent: number; simpleFeeMin: number;
  inspectionFee: number; packingFee: number;
  depositBronze: number; depositSilver: number; depositGold: number; depositPlatinum: number;
  failedDealFee: number;
  onsiteBaseFee: number; onsitePerKm: number;
  meetupFeePercent: number; meetupFeeMin: number;
  sellerRegFee: number; middlemanRegFee: number;
  returnShippingBy: 'buyer' | 'seller' | 'split';
  companyPromptPay: string; companyBankName: string; companyBankAcct: string; companyBankHolder: string; companyQrFileId: string;
}

type StrKey = 'returnShippingBy' | 'companyPromptPay' | 'companyBankName' | 'companyBankAcct' | 'companyBankHolder' | 'companyQrFileId';
type NumKey = Exclude<keyof FeeConfig, StrKey>;
const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '';
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const qrUrl = (id: string) => `${ENDPOINT}/storage/buckets/deal_files/files/${id}/view?project=${PROJECT}`;

// กลุ่มฟิลด์สำหรับแสดงผล: [key, label, หน่วย]
const GROUPS: { title: string; icon: React.ReactNode; fields: [NumKey, string, string][] }[] = [
  { title: 'ซื้อขายผ่านกลาง (ออนไลน์) — มีคนกลางตรวจสอบ', icon: <ShoppingCart size={16} className="text-blue-600" />, fields: [
    ['escrowFeePercent', 'ค่าธรรมเนียมระบบ', '% ของราคา'],
    ['escrowFeeMin', 'ขั้นต่ำ', 'บาท'],
    ['middlemanFeePercent', 'ค่าบริการคนกลาง', '% ของราคา'],
    ['middlemanFeeMin', 'ค่าคนกลางขั้นต่ำ', 'บาท'],
    ['platformCutPercent', 'ส่วนแบ่งแพลตฟอร์มจากค่าคนกลาง', '%'],
  ] },
  { title: 'ซื้อขายผ่านกลางแบบง่าย (ส่งตรง)', icon: <Zap size={16} className="text-orange-600" />, fields: [
    ['simpleFeePercent', 'ค่าธรรมเนียม', '% ของราคา'],
    ['simpleFeeMin', 'ขั้นต่ำ', 'บาท'],
  ] },
  { title: 'ค่าบริการตรวจ/แพ็คสินค้า', icon: <Search size={16} className="text-teal-600" />, fields: [
    ['inspectionFee', 'ค่าตรวจสอบสินค้า', 'บาท'],
    ['packingFee', 'ค่าแพ็คสินค้า', 'บาท'],
  ] },
  { title: 'เครดิตประกันคนกลาง (ตามเทียร์)', icon: <Shield size={16} className="text-emerald-600" />, fields: [
    ['depositBronze', 'Bronze', 'บาท'],
    ['depositSilver', 'Silver', 'บาท'],
    ['depositGold', 'Gold', 'บาท'],
    ['depositPlatinum', 'Platinum', 'บาท'],
  ] },
  { title: 'เมื่อดีลไม่สำเร็จ / ตีกลับ', icon: <RotateCcw size={16} className="text-rose-600" />, fields: [
    ['failedDealFee', 'ค่าจัดการดีลไม่สำเร็จ', 'บาท'],
  ] },
  { title: 'บริการนัดออนไซต์', icon: <MapPin size={16} className="text-amber-600" />, fields: [
    ['onsiteBaseFee', 'ค่าบริการฐาน', 'บาท'],
    ['onsitePerKm', 'ค่าเดินทาง', 'บาท/กม.'],
  ] },
  { title: 'รับประกันเดินทาง (นัดเจอ)', icon: <Car size={16} className="text-violet-600" />, fields: [
    ['meetupFeePercent', 'ค่าธรรมเนียม', '% ของมูลค่า'],
    ['meetupFeeMin', 'ค่าบริการขั้นต่ำ', 'บาท'],
  ] },
  { title: 'ค่าสมัครสมาชิก', icon: <Wallet size={16} className="text-green-600" />, fields: [
    ['sellerRegFee', 'ค่าสมัครผู้ขาย', 'บาท'],
    ['middlemanRegFee', 'ค่าสมัครคนกลาง', 'บาท'],
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

  function setField(k: NumKey, v: string) {
    setFees(f => f ? { ...f, [k]: v === '' ? 0 : Number(v) } : f);
    setSaved(false);
  }

  function setStr(k: StrKey, v: string) {
    setFees(f => f ? { ...f, [k]: v } : f);
    setSaved(false);
  }

  const [qrUploading, setQrUploading] = useState(false);
  async function uploadQr(file: File) {
    setQrUploading(true);
    try {
      const jwt = (await account.createJWT()).jwt;
      const form = new FormData(); form.append('file', file);
      const r = await fetch('/api/upload-deal', { method: 'POST', headers: { 'x-session-jwt': jwt }, body: form });
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
      const jwt = (await account.createJWT()).jwt;
      const r = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fees }),
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
        <p className="text-sm text-gray-500 mt-0.5">กำหนดอัตราค่าบริการของแต่ละบริการและบัญชีรับเงินของระบบจากหลังบ้าน</p>
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

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
            <h2 className="font-semibold text-sm flex items-center gap-2 mb-4"><RotateCcw size={16} className="text-rose-600" /> ผู้รับผิดชอบค่าส่งคืน (เมื่อตีกลับผู้ขาย)</h2>
            <div className="flex gap-2 flex-wrap">
              {([['buyer', 'ผู้ซื้อ'], ['seller', 'ผู้ขาย'], ['split', 'หารครึ่ง']] as const).map(([val, lbl]) => (
                <button key={val} type="button"
                  onClick={() => { setFees(f => f ? { ...f, returnShippingBy: val } : f); setSaved(false); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${fees.returnShippingBy === val ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* บัญชีรับเงินของบริษัท — ลูกค้าโอนเข้าตรงนี้ (แสดงในหน้าชำระเงิน) */}
          <div className="bg-white dark:bg-gray-900 border-2 border-green-200 dark:border-green-900 rounded-2xl p-5">
            <h2 className="font-semibold text-sm flex items-center gap-2 mb-1"><Wallet size={16} className="text-green-600" /> บัญชีรับเงินของบริษัท (ลูกค้าโอนเข้าตรงนี้)</h2>
            <p className="text-xs text-gray-500 mb-4">ค่านี้จะแสดงในหน้าชำระเงินของลูกค้า — ต้องตั้งให้ถูกต้อง มิฉะนั้นลูกค้าโอนเงินไม่ได้</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block"><span className="text-sm text-gray-600 dark:text-gray-300">พร้อมเพย์ (เบอร์/เลขผู้เสียภาษี)</span>
                <input value={fees.companyPromptPay} onChange={e => setStr('companyPromptPay', e.target.value)} placeholder="0812345678"
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" /></label>
              <label className="block"><span className="text-sm text-gray-600 dark:text-gray-300">ธนาคาร</span>
                <select value={fees.companyBankName} onChange={e => setStr('companyBankName', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm">
                  <option value="">เลือกธนาคาร</option>
                  {THAI_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select></label>
              <label className="block"><span className="text-sm text-gray-600 dark:text-gray-300">เลขที่บัญชี</span>
                <input value={fees.companyBankAcct} onChange={e => setStr('companyBankAcct', e.target.value)} placeholder="123-4-56789-0"
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" /></label>
              <label className="block"><span className="text-sm text-gray-600 dark:text-gray-300">ชื่อบัญชี</span>
                <input value={fees.companyBankHolder} onChange={e => setStr('companyBankHolder', e.target.value)} placeholder="บริษัท คนกลาง จำกัด"
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" /></label>
            </div>
            <div className="mt-4">
              <span className="text-sm text-gray-600 dark:text-gray-300">รูป QR Code (ถ้ามี QR คงที่ของร้าน)</span>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                {fees.companyQrFileId && <img src={qrUrl(fees.companyQrFileId)} alt="QR" className="w-24 h-24 object-contain rounded-lg border border-gray-200 dark:border-gray-700" />}
                <label className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-200 inline-flex items-center gap-1">
                  {qrUploading ? <Loader2 size={14} className="animate-spin" /> : '🖼️'} {fees.companyQrFileId ? 'เปลี่ยนรูป QR' : 'อัปโหลดรูป QR'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadQr(f); e.target.value = ''; }} />
                </label>
                {fees.companyQrFileId && <button type="button" onClick={() => setStr('companyQrFileId', '')} className="text-xs text-red-500 hover:underline">ลบรูป</button>}
              </div>
              <p className="text-xs text-gray-400 mt-2">* ถ้าไม่อัปโหลด QR ระบบจะสร้าง QR พร้อมเพย์พร้อมยอดให้อัตโนมัติจากเลขพร้อมเพย์ด้านบน</p>
            </div>
          </div>

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
