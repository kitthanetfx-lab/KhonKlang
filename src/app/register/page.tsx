'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, AlertCircle, ArrowRight, CheckCircle2, Link2 } from 'lucide-react';
import { account } from '@/lib/appwrite';

/* ─────────── Thai Address Types ─────────── */
interface Province { id: number; name_th: string; }
interface Amphure  { id: number; name_th: string; province_id: number; }
interface Tambon   { id: number; name_th: string; amphure_id: number; zip_code: number; }

const BASE = 'https://raw.githubusercontent.com/kongvut/thai-province-data/master';
let _prov: Province[] | null = null;
let _amph: Amphure[] | null = null;
let _tamb: Tambon[]  | null = null;

async function loadGeo() {
  if (_prov) return;
  [_prov, _amph, _tamb] = await Promise.all([
    fetch(`${BASE}/api_province.json`).then(r => r.json()),
    fetch(`${BASE}/api_amphure.json`).then(r => r.json()),
    fetch(`${BASE}/api_tambon.json`).then(r => r.json()),
  ]);
}

/* ─────────── Main Form ─────────── */
function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'seller';

  /* ── auth guard ── */
  useEffect(() => {
    account.get().then((u) => {
      if ((u.prefs as Record<string, string>)?.firstName) router.replace('/');
    }).catch(() => router.replace('/login'));
  }, [router]);

  /* ── form state ── */
  const [type, setType]     = useState<'individual' | 'corporate'>('individual');
  const [saving, setSaving] = useState(false);
  const [linked, setLinked] = useState(false);
  const [validationError, setValidationError] = useState('');

  const [formData, setFormData] = useState({
    firstName: '', lastName: '',
    phone: '',
    houseNo: '',
    province: '', provinceId: 0,
    amphure: '',  amphureId: 0,
    tambon: '',   tambonId: 0,
    postalCode: '',
    bankAccountName: '', bankName: '', accountNumber: '',
  });

  /* ── geo dropdown state ── */
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [amphures, setAmphures]   = useState<Amphure[]>([]);
  const [tambons, setTambons]     = useState<Tambon[]>([]);
  const [geoLoading, setGeoLoading] = useState(true);
  const allAmphRef = useRef<Amphure[]>([]);
  const allTambRef = useRef<Tambon[]>([]);

  useEffect(() => {
    loadGeo().then(() => {
      setProvinces(_prov!);
      allAmphRef.current = _amph!;
      allTambRef.current = _tamb!;
      setGeoLoading(false);
    });
  }, []);

  /* ── input handlers ── */
  const set = (field: string, value: string | number) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleText = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    set(e.target.name, e.target.value);
    if (validationError) setValidationError('');
  };

  const handleProvince = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value);
    const prov = provinces.find(p => p.id === id);
    setFormData(prev => ({
      ...prev, provinceId: id, province: prov?.name_th || '',
      amphureId: 0, amphure: '', tambonId: 0, tambon: '', postalCode: '',
    }));
    setAmphures(allAmphRef.current.filter(a => a.province_id === id));
    setTambons([]);
  };

  const handleAmphure = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value);
    const amph = amphures.find(a => a.id === id);
    setFormData(prev => ({
      ...prev, amphureId: id, amphure: amph?.name_th || '',
      tambonId: 0, tambon: '', postalCode: '',
    }));
    setTambons(allTambRef.current.filter(t => t.amphure_id === id));
  };

  const handleTambon = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = parseInt(e.target.value);
    const tamb = tambons.find(t => t.id === id);
    setFormData(prev => ({
      ...prev, tambonId: id, tambon: tamb?.name_th || '',
      postalCode: tamb?.zip_code?.toString() || '',
    }));
  };

  /* ── validation ── */
  const validateNames = () => {
    const full = `${formData.firstName} ${formData.lastName}`.trim().toLowerCase();
    const bank = formData.bankAccountName.trim().toLowerCase();
    if (full && bank && full !== bank) {
      setValidationError('ชื่อ-นามสกุล และชื่อบัญชีธนาคารไม่ตรงกัน');
      return false;
    }
    return true;
  };

  /* ── submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNames()) return;

    const address = [
      formData.houseNo,
      formData.tambon   ? `ตำบล${formData.tambon}`   : '',
      formData.amphure  ? `อำเภอ${formData.amphure}`  : '',
      formData.province ? `จังหวัด${formData.province}` : '',
      formData.postalCode,
    ].filter(Boolean).join(' ');

    setSaving(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          address,
          role,
          bankAccountName: formData.bankAccountName,
          bankName: formData.bankName,
          accountNumber: formData.accountNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setValidationError(data.error || 'เกิดข้อผิดพลาด'); return; }

      if (data.linked) {
        setLinked(true);
        setTimeout(() => router.push('/'), 2500);
      } else {
        router.push('/');
      }
    } catch {
      setValidationError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  /* ── shared input class ── */
  const ic = 'w-full bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all';
  const sc = `${ic} disabled:opacity-50 disabled:cursor-not-allowed`;
  const roleLabel = role === 'middleman' ? 'คนกลาง' : 'ผู้ขาย';

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6">

      {/* Linked account overlay */}
      {linked && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl animate-fade-in">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <Link2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">เชื่อมบัญชีสำเร็จ!</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              พบบัญชีของคุณในระบบแล้ว บัญชีได้รับการเชื่อมโยงเรียบร้อย
            </p>
            <p className="text-xs text-gray-400 mt-3">กำลังพาไปหน้าหลัก...</p>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto glass-panel rounded-2xl p-6 sm:p-10 animate-fade-in shadow-xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">ข้อมูลผู้ใช้งาน</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            role === 'middleman'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
          }`}>สมัครเป็น{roleLabel}</span>
        </div>
        <p className="text-gray-600 dark:text-gray-300 mb-8">กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้องเพื่อประโยชน์ของท่าน</p>

        {/* Type toggle */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-8">
          {(['individual', 'corporate'] as const).map(t => (
            <button key={t} type="button"
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                type === t ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400'
                           : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
              onClick={() => setType(t)}>
              {t === 'individual' ? 'บุคคลธรรมดา' : 'นิติบุคคล'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ชื่อ - นามสกุล */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2 opacity-80">ชื่อจริง (ไม่ต้องใส่คำนำหน้า)</label>
              <input required type="text" name="firstName" value={formData.firstName}
                onChange={handleText} className={ic} placeholder="เช่น สมชาย" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 opacity-80">นามสกุล</label>
              <input required type="text" name="lastName" value={formData.lastName}
                onChange={handleText} className={ic} placeholder="เช่น ใจดี" />
            </div>
          </div>

          {/* ชื่อบริษัท (นิติบุคคล) */}
          {type === 'corporate' && (
            <div>
              <label className="block text-sm font-medium mb-2 opacity-80">ชื่อบริษัท / ห้างหุ้นส่วนจำกัด</label>
              <input required type="text" className={ic} placeholder="บริษัท ตัวอย่าง จำกัด" />
            </div>
          )}

          {/* เบอร์โทร */}
          <div>
            <label className="block text-sm font-medium mb-2 opacity-80">
              เบอร์โทรศัพท์
              <span className="ml-2 text-xs text-blue-500 font-normal">ใช้ยืนยันตัวตนและเชื่อมบัญชีข้ามแพลตฟอร์ม</span>
            </label>
            <input required type="tel" name="phone" value={formData.phone}
              onChange={handleText} className={ic} placeholder="0812345678" pattern="[0-9]{9,10}" />
          </div>

          {/* ───── ที่อยู่ ───── */}
          <div>
            <label className="block text-sm font-medium mb-2 opacity-80">บ้านเลขที่ / ถนน / ซอย</label>
            <input type="text" name="houseNo" value={formData.houseNo}
              onChange={handleText} className={ic} placeholder="เช่น 123/4 ถนนสุขุมวิท ซอย 11" />
          </div>

          {geoLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              กำลังโหลดข้อมูลที่อยู่...
            </div>
          ) : (
            <>
              {/* จังหวัด */}
              <div>
                <label className="block text-sm font-medium mb-2 opacity-80">จังหวัด</label>
                <select required value={formData.provinceId || ''} onChange={handleProvince} className={sc}>
                  <option value="">เลือกจังหวัด...</option>
                  {provinces.map(p => <option key={p.id} value={p.id}>{p.name_th}</option>)}
                </select>
              </div>

              {/* อำเภอ */}
              <div>
                <label className="block text-sm font-medium mb-2 opacity-80">อำเภอ / เขต</label>
                <select required value={formData.amphureId || ''} onChange={handleAmphure}
                  disabled={!formData.provinceId} className={sc}>
                  <option value="">
                    {formData.provinceId ? 'เลือกอำเภอ...' : 'เลือกจังหวัดก่อน'}
                  </option>
                  {amphures.map(a => <option key={a.id} value={a.id}>{a.name_th}</option>)}
                </select>
              </div>

              {/* ตำบล */}
              <div>
                <label className="block text-sm font-medium mb-2 opacity-80">ตำบล / แขวง</label>
                <select required value={formData.tambonId || ''} onChange={handleTambon}
                  disabled={!formData.amphureId} className={sc}>
                  <option value="">
                    {formData.amphureId ? 'เลือกตำบล...' : 'เลือกอำเภอก่อน'}
                  </option>
                  {tambons.map(t => <option key={t.id} value={t.id}>{t.name_th}</option>)}
                </select>
              </div>

              {/* รหัสไปรษณีย์ */}
              <div>
                <label className="block text-sm font-medium mb-2 opacity-80">รหัสไปรษณีย์</label>
                <input readOnly value={formData.postalCode} className={`${ic} bg-gray-50 dark:bg-gray-800/80 cursor-default`}
                  placeholder="กรอกอัตโนมัติเมื่อเลือกตำบล" />
              </div>
            </>
          )}

          <hr className="border-gray-200 dark:border-gray-700" />
          <h2 className="text-xl font-semibold">ข้อมูลบัญชีธนาคาร (สำหรับรับเงิน)</h2>

          {/* ชื่อบัญชี */}
          <div>
            <label className="block text-sm font-medium mb-2 opacity-80">ชื่อบัญชีธนาคาร</label>
            <input required type="text" name="bankAccountName" value={formData.bankAccountName}
              onChange={handleText} onBlur={validateNames}
              className={`w-full bg-white/50 dark:bg-gray-900/50 border ${
                validationError ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-gray-700 focus:ring-blue-500'
              } rounded-xl px-4 py-3 outline-none focus:ring-2 transition-all`}
              placeholder="ต้องตรงกับชื่อ-นามสกุล หรือชื่อบริษัท" />
            {validationError && (
              <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {validationError}
              </p>
            )}
            {formData.firstName && formData.bankAccountName && !validationError && (
              <p className="text-green-500 text-sm mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> ชื่อบัญชีตรงกัน
              </p>
            )}
          </div>

          {/* ธนาคาร + เลขบัญชี */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2 opacity-80">ธนาคาร</label>
              <select required name="bankName" onChange={handleText} className={ic}>
                <option value="">เลือกธนาคาร...</option>
                {[
                  ['kbank','กสิกรไทย (KBANK)'],['scb','ไทยพาณิชย์ (SCB)'],
                  ['bbl','กรุงเทพ (BBL)'],['ktb','กรุงไทย (KTB)'],
                  ['krungsri','กรุงศรีอยุธยา (BAY)'],['ttb','ทหารไทยธนชาต (TTB)'],
                  ['gsb','ออมสิน (GSB)'],['baac','ธ.ก.ส. (BAAC)'],
                ].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 opacity-80">เลขที่บัญชี</label>
              <input required type="text" name="accountNumber" value={formData.accountNumber}
                onChange={handleText} className={ic} placeholder="012-3-45678-9" />
            </div>
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />
          <h2 className="text-xl font-semibold">เอกสารแนบ</h2>

          <div className="space-y-4">
            {[
              `อัปโหลดรูปบัตรประชาชน${type === 'corporate' ? ' / หนังสือรับรองบริษัท' : ''}`,
              'อัปโหลดรูปหน้าสมุดบัญชีธนาคาร',
            ].map(label => (
              <div key={label}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm font-medium mb-1">{label}</p>
                <p className="text-xs text-gray-500 mb-4">รองรับ JPG, PNG ขนาดไม่เกิน 5MB</p>
                <input type="file" required accept="image/*"
                  className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              </div>
            ))}
          </div>

          <button type="submit" disabled={saving}
            className="w-full mt-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-4 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
            {saving ? 'กำลังตรวจสอบและบันทึก...' : <> บันทึกและไปหน้าหลัก <ArrowRight className="w-5 h-5" /> </>}
          </button>

        </form>
      </div>
    </div>
  );
}

export default function Register() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">กำลังโหลด...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
