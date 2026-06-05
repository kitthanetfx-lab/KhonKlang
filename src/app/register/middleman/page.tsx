'use client';

import { Suspense, useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, ArrowLeft, Upload, CheckCircle2,
  AlertTriangle, Copy, Check, Shield,
} from 'lucide-react';
import { account } from '@/lib/appwrite';

// ─── Constants ─────────────────────────────────────────────────────────────

const PROVINCES = ['กระบี่','กรุงเทพมหานคร','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี'];

const BANKS = [
  'ธนาคารกรุงเทพ (BBL)','ธนาคารกสิกรไทย (KBANK)','ธนาคารไทยพาณิชย์ (SCB)',
  'ธนาคารกรุงไทย (KTB)','ธนาคารกรุงศรีอยุธยา (BAY)','ธนาคารทหารไทยธนชาต (TTB)',
  'ธนาคารออมสิน','ธนาคารอาคารสงเคราะห์ (GHB)','ธนาคารเพื่อการเกษตรและสหกรณ์ (BAAC)',
  'ธนาคารอิสลามแห่งประเทศไทย','ธนาคารแลนด์แอนด์เฮ้าส์ (LH Bank)',
  'ธนาคารซีไอเอ็มบีไทย (CIMB Thai)','ธนาคารยูโอบี (UOB)',
];

const CATEGORIES = [
  { id: 'it',       label: 'อุปกรณ์ไอที / มือถือ',        icon: '📱' },
  { id: 'amulet',   label: 'พระเครื่อง / วัตถุมงคล',       icon: '🪬' },
  { id: 'luxury',   label: 'แบรนด์เนม / กระเป๋า / นาฬิกา', icon: '👜' },
  { id: 'vehicle',  label: 'รถมอเตอร์ไซค์ / รถยนต์',        icon: '🏍️' },
  { id: 'game',     label: 'ไอดีเกม / บัญชีเกม',           icon: '🎮' },
  { id: 'appliance',label: 'เครื่องใช้ไฟฟ้า',              icon: '🖥️' },
  { id: 'jewelry',  label: 'อัญมณี / ทองคำ',               icon: '💍' },
  { id: 'general',  label: 'สินค้าทั่วไป',                  icon: '📦' },
];

function getTier(amount: number): { label: string; color: string; icon: string; maxDeal: string } {
  if (amount >= 100_000) return { label: 'Platinum', color: 'text-purple-600 bg-purple-50 border-purple-200', icon: '💎', maxDeal: 'ไม่จำกัด' };
  if (amount >= 50_000)  return { label: 'Gold',     color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: '🥇', maxDeal: '฿50,000 / ดีล' };
  if (amount >= 10_000)  return { label: 'Silver',   color: 'text-slate-600 bg-slate-50 border-slate-200',   icon: '🥈', maxDeal: '฿10,000 / ดีล' };
  return                        { label: 'Bronze',   color: 'text-orange-600 bg-orange-50 border-orange-200', icon: '🥉', maxDeal: '฿3,000 / ดีล' };
}

const MEMBERSHIP_FEE = 499;
const BANK_NAME   = 'ธนาคารกสิกรไทย (KBANK)';
const BANK_ACCT   = '123-4-56789-0';
const BANK_OWNER  = 'บริษัท คนกลาง จำกัด';
const PROMPTPAY   = '0000000000'; // TODO: ใส่หมายเลข PromptPay จริง

const STEPS = ['ข้อมูลพื้นฐาน', 'ข้อมูลคนกลาง', 'ยืนยันตัวตน', 'ชำระค่าสมาชิก'];

// ─── Sub-components ─────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-start justify-between mb-8 px-1">
      {STEPS.map((label, i) => {
        const num  = i + 1;
        const done = num < current;
        const act  = num === current;
        return (
          <Fragment key={num}>
            <div className="flex flex-col items-center gap-1.5 w-16">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300
                ${done ? 'bg-green-500 text-white' : act ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                {done ? '✓' : num}
              </div>
              <span className={`text-[11px] text-center leading-tight ${act ? 'text-blue-600 font-semibold' : done ? 'text-green-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mt-4 mx-0.5 transition-all duration-300 ${done ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function FileUpload({ label, accept, file, onChange, hint, required }: {
  label: string; accept: string; file: File | null;
  onChange: (f: File | null) => void; hint?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 opacity-75">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-all">
        <input type="file" accept={accept} className="hidden" onChange={e => onChange(e.target.files?.[0] ?? null)} />
        {file ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium truncate max-w-[220px]">{file.name}</span>
          </div>
        ) : (
          <div className="text-center text-gray-400">
            <Upload className="w-6 h-6 mx-auto mb-1.5" />
            <p className="text-sm">คลิกเพื่อเลือกไฟล์</p>
            {hint && <p className="text-xs mt-0.5">{hint}</p>}
          </div>
        )}
      </label>
    </div>
  );
}

// ─── Main form ───────────────────────────────────────────────────────────────

function MiddlemanForm() {
  const router = useRouter();

  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);
  const [copied, setCopied]   = useState<'acct' | 'pp' | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [oauthEmail, setOauthEmail]   = useState('');

  // Step 1 – Basic Identity
  const [fullNameId, setFullNameId] = useState('');
  const [idNumber, setIdNumber]     = useState('');

  // Step 2 – Middleman specific
  const [depositIntent, setDepositIntent] = useState('');  // declared intent (actual deposit after KYC)
  const [categories, setCategories] = useState<string[]>([]);
  const [workProvince, setWorkProvince] = useState('');
  const [terms, setTerms]           = useState('');

  // Step 3 – Docs & Bank
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [bankAcct, setBankAcct]   = useState('');
  const [bankName, setBankName]   = useState('');
  const [bankOwner, setBankOwner] = useState('');

  const depositNum = parseInt(depositIntent.replace(/,/g, ''), 10) || 0;
  const tier = getTier(depositNum);

  const ic = 'w-full bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-40';

  useEffect(() => {
    account.get()
      .then(u => {
        setDisplayName(u.name || '');
        const em = (!u.email || u.email.includes('@line.khonklang.app')) ? '' : u.email;
        setOauthEmail(em);
        setFullNameId(u.name || '');
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const toggleCategory = (id: string) =>
    setCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const validate = () => {
    setError('');
    if (step === 1) {
      if (!fullNameId.trim()) return setError('กรุณากรอกชื่อ-นามสกุลตามบัตรประชาชน'), false;
      if (!/^\d{13}$/.test(idNumber)) return setError('เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก'), false;
    }
    if (step === 2) {
      if (categories.length === 0) return setError('กรุณาเลือกประเภทสินค้าอย่างน้อย 1 ประเภท'), false;
      if (!workProvince) return setError('กรุณาเลือกจังหวัดที่รับงาน'), false;
    }
    if (step === 3) {
      if (!idCardFile) return setError('กรุณาอัปโหลดภาพบัตรประชาชน'), false;
      if (!bankAcct.trim()) return setError('กรุณากรอกเลขที่บัญชีธนาคาร'), false;
      if (!bankName) return setError('กรุณาเลือกธนาคาร'), false;
      if (!bankOwner.trim()) return setError('กรุณากรอกชื่อบัญชีธนาคาร'), false;
    }
    return true;
  };

  const next = () => { if (validate()) { setStep(s => s + 1); window.scrollTo(0, 0); } };
  const back = () => { setError(''); setStep(s => s - 1); window.scrollTo(0, 0); };

  const copyText = (text: string, key: 'acct' | 'pp') => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    try {
      const jwt = (await account.createJWT()).jwt;
      const body = {
        type: 'middleman', fullNameId, idNumber,
        depositIntent: depositNum,
        tier: tier.label,
        categories,
        workProvince, terms,
        bankAcct, bankName, bankOwner,
        idCardFileName: idCardFile?.name ?? '',
      };
      const res  = await fetch('/api/register/middleman', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-jwt': jwt },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'เกิดข้อผิดพลาด');
        return;
      }
      setDone(true);
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">กำลังโหลด...</p>
      </div>
    );
  }

  // ── Success screen ──
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center glass-panel rounded-2xl p-10 shadow-xl animate-fade-in">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">ส่งใบสมัครแล้ว!</h2>
          <p className="text-gray-500 mb-3">ทีมงานจะตรวจสอบ KYC และติดต่อกลับภายใน 1-3 วันทำการ</p>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300 mb-6 text-left space-y-1">
            <p className="font-semibold">ขั้นตอนถัดไปหลังผ่าน KYC</p>
            <p>• ทีมงานแจ้งผลทาง LINE / อีเมล</p>
            <p>• เข้าหน้าโปรไฟล์เพื่อวางเงินประกัน (Tier {tier.label})</p>
            <p>• เริ่มรับงานคนกลางได้ทันที</p>
          </div>
          <button onClick={() => router.push('/')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-all">
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
            <Shield className="w-4 h-4" /> สมัครเป็นคนกลาง (Escrow Agent)
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">ลงทะเบียนคนกลาง</h1>
        </div>

        <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-xl animate-fade-in">
          <StepIndicator current={step} />

          {/* ─────────── STEP 1: Basic Identity ─────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">ข้อมูลพื้นฐาน</h2>
                <p className="text-sm text-gray-500">กรอกข้อมูลส่วนตัวตามบัตรประชาชน</p>
              </div>

              {(displayName || oauthEmail) && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm space-y-1">
                  <p className="text-xs text-gray-400 mb-1">บัญชีที่ใช้ล็อกอิน</p>
                  {displayName && <div className="flex gap-3"><span className="opacity-50 w-14">ชื่อ</span><span className="font-medium">{displayName}</span></div>}
                  {oauthEmail  && <div className="flex gap-3"><span className="opacity-50 w-14">อีเมล</span><span className="font-medium">{oauthEmail}</span></div>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-75">ชื่อ-นามสกุล (ตรงตามบัตรประชาชน) <span className="text-red-500">*</span></label>
                <input className={ic} value={fullNameId} onChange={e => setFullNameId(e.target.value)}
                  placeholder="ชื่อ นามสกุล" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-75">เลขประจำตัวประชาชน <span className="text-red-500">*</span></label>
                <input className={ic} value={idNumber} onChange={e => setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 13))}
                  placeholder="1234567890123" maxLength={13} inputMode="numeric" />
                <p className="text-xs text-gray-400 mt-1">ตัวเลข 13 หลัก ไม่ต้องใส่ขีด</p>
              </div>
            </div>
          )}

          {/* ─────────── STEP 2: Middleman Specific ─────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">ข้อมูลคนกลาง</h2>
                <p className="text-sm text-gray-500">ระบุความเชี่ยวชาญและพื้นที่รับงาน</p>
              </div>

              {/* Deposit intent + Tier preview */}
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-75">
                  จำนวนเงินประกันที่ต้องการวาง (บาท)
                  <span className="ml-2 text-xs text-gray-400 font-normal">ชำระจริงหลังผ่าน KYC</span>
                </label>
                <input className={ic} value={depositIntent}
                  onChange={e => setDepositIntent(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="เช่น 10000" inputMode="numeric" />

                {depositNum > 0 && (
                  <div className={`mt-2 flex items-center gap-3 border rounded-xl px-4 py-3 ${tier.color}`}>
                    <span className="text-2xl">{tier.icon}</span>
                    <div>
                      <p className="font-bold text-sm">ระดับ {tier.label}</p>
                      <p className="text-xs opacity-75">รับงานสูงสุด {tier.maxDeal}</p>
                    </div>
                  </div>
                )}

                {/* Tier table */}
                <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
                  {[
                    { icon: '🥉', name: 'Bronze',   range: '< ฿10,000',          max: '฿3,000 / ดีล' },
                    { icon: '🥈', name: 'Silver',   range: '฿10,000 – ฿49,999',  max: '฿10,000 / ดีล' },
                    { icon: '🥇', name: 'Gold',     range: '฿50,000 – ฿99,999',  max: '฿50,000 / ดีล' },
                    { icon: '💎', name: 'Platinum', range: '฿100,000 ขึ้นไป',    max: 'ไม่จำกัด' },
                  ].map(t => (
                    <div key={t.name} className={`flex items-center gap-2 px-3 py-2 border-b last:border-0 border-gray-100 dark:border-gray-800
                      ${tier.label === t.name ? 'bg-blue-50 dark:bg-blue-900/20 font-semibold' : ''}`}>
                      <span>{t.icon}</span>
                      <span className="w-16">{t.name}</span>
                      <span className="flex-1 text-gray-500">{t.range}</span>
                      <span className="text-gray-500">{t.max}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product categories */}
              <div>
                <label className="block text-sm font-medium mb-2 opacity-75">
                  ประเภทสินค้าที่เชี่ยวชาญ <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs text-gray-400 font-normal">เลือกได้หลายประเภท</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => {
                    const sel = categories.includes(cat.id);
                    return (
                      <button key={cat.id} type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm text-left transition-all
                          ${sel ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}>
                        <span className="text-lg shrink-0">{cat.icon}</span>
                        <span className="leading-tight">{cat.label}</span>
                        {sel && <CheckCircle2 className="w-4 h-4 ml-auto shrink-0 text-blue-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Work province */}
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-75">จังหวัดหลักที่สะดวกรับงาน <span className="text-red-500">*</span></label>
                <select className={ic} value={workProvince} onChange={e => setWorkProvince(e.target.value)}>
                  <option value="">เลือกจังหวัด</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">ระบบจะแสดงคุณในรายชื่อคนกลางของจังหวัดนี้</p>
              </div>

              {/* Terms / notes */}
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-75">
                  เงื่อนไขหรือข้อตกลงเพิ่มเติม
                  <span className="ml-2 text-xs text-gray-400 font-normal">(ไม่บังคับ)</span>
                </label>
                <textarea className={ic + ' resize-none'} rows={4} value={terms}
                  onChange={e => setTerms(e.target.value)}
                  placeholder="เช่น อัตราค่าบริการ 1-3% ขึ้นอยู่กับมูลค่า, รับงานเฉพาะกลางวัน 9:00-18:00 น., นัดรับเฉพาะใน กทม." />
              </div>
            </div>
          )}

          {/* ─────────── STEP 3: Trust Verification ─────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold mb-1">ยืนยันตัวตน (KYC)</h2>
                <p className="text-sm text-gray-500">อัปโหลดเอกสารและข้อมูลบัญชีธนาคาร</p>
              </div>

              <FileUpload
                label="ภาพถ่ายบัตรประชาชน (หรือถ่ายคู่กับบัตร)"
                accept="image/*"
                file={idCardFile}
                onChange={setIdCardFile}
                hint="JPG / PNG / HEIC ขนาดไม่เกิน 10 MB"
                required
              />

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                <p className="text-sm font-semibold">บัญชีธนาคาร — สำหรับรับ-คืนเงินประกันและค่าบริการ</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 opacity-75">เลขที่บัญชี <span className="text-red-500">*</span></label>
                    <input className={ic} value={bankAcct} onChange={e => setBankAcct(e.target.value)}
                      placeholder="xxx-x-xxxxx-x" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 opacity-75">ธนาคาร <span className="text-red-500">*</span></label>
                    <select className={ic} value={bankName} onChange={e => setBankName(e.target.value)}>
                      <option value="">เลือกธนาคาร</option>
                      {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 opacity-75">ชื่อบัญชี (ต้องตรงกับบัตรประชาชน) <span className="text-red-500">*</span></label>
                  <input className={ic} value={bankOwner} onChange={e => setBankOwner(e.target.value)}
                    placeholder="ชื่อ นามสกุล" />
                </div>
              </div>

              {/* KYC note */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p className="font-semibold">ขั้นตอนหลัง KYC อนุมัติ</p>
                <p>เงินประกัน (Tier) จะถูกแจ้งให้วางผ่านหน้าโปรไฟล์ของคุณ ไม่ต้องโอนตอนนี้</p>
              </div>
            </div>
          )}

          {/* ─────────── STEP 4: Payment ─────────── */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">ชำระค่าสมาชิก</h2>
                <p className="text-sm text-gray-500">ค่าสมัครคนกลาง (ไม่รวมเงินประกัน)</p>
              </div>

              {/* Warning */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                  <p className="font-semibold">ข้อควรทราบก่อนชำระเงิน</p>
                  <p>หากท่านเคยมีประวัติการโกง ทางแพลตฟอร์มจะ<strong>ไม่คืนเงินค่าสมัครทุกกรณี</strong></p>
                  <p>หากมีปัญหาหรือต้องการยื่นหลักฐานชี้แจง กรุณาติดต่อ Admin โดยตรงผ่านช่องทางที่กำหนด</p>
                </div>
              </div>

              {/* Fee */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500 mb-1">ค่าสมัครคนกลาง</p>
                <p className="text-4xl font-bold text-purple-600">฿{MEMBERSHIP_FEE.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">ชำระครั้งเดียว (ต่ออายุรายปี) — ไม่รวมเงินประกัน Tier</p>
              </div>

              {/* Tier summary */}
              {depositNum > 0 && (
                <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 ${tier.color}`}>
                  <span className="text-2xl">{tier.icon}</span>
                  <div className="text-sm">
                    <p className="font-bold">Tier ที่ประกาศไว้: {tier.label}</p>
                    <p className="opacity-75">เงินประกัน ฿{depositNum.toLocaleString()} — วางจริงหลังผ่าน KYC</p>
                  </div>
                </div>
              )}

              {/* QR Code */}
              <div className="text-center space-y-3">
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">สแกน QR PromptPay (ค่าสมัคร ฿{MEMBERSHIP_FEE})</p>
                <div className="inline-block bg-white p-3 rounded-2xl shadow-lg border border-gray-200">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${PROMPTPAY}&bgcolor=ffffff`}
                    alt="PromptPay QR Code"
                    width={200} height={200}
                    className="rounded-lg"
                  />
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <span>หมายเลข PromptPay:</span>
                  <code className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{PROMPTPAY}</code>
                  <button type="button" onClick={() => copyText(PROMPTPAY, 'pp')}
                    className="p-1 hover:text-blue-600 transition-colors">
                    {copied === 'pp' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Bank transfer */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold mb-2">หรือโอนผ่านธนาคาร</p>
                <div className="flex justify-between">
                  <span className="text-gray-500">ธนาคาร</span>
                  <span className="font-medium">{BANK_NAME}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">เลขบัญชี</span>
                  <div className="flex items-center gap-2">
                    <code className="font-mono font-medium">{BANK_ACCT}</code>
                    <button type="button" onClick={() => copyText(BANK_ACCT, 'acct')}
                      className="p-1 hover:text-blue-600 transition-colors">
                      {copied === 'acct' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ชื่อบัญชี</span>
                  <span className="font-medium">{BANK_OWNER}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">จำนวนเงิน</span>
                  <span className="font-bold text-purple-600">฿{MEMBERSHIP_FEE} (ค่าสมัคร)</span>
                </div>
              </div>

              <p className="text-xs text-center text-gray-400">
                หลังจากโอนเงินแล้ว กรุณาแนบหลักฐานการโอนส่งให้ Admin ผ่านช่องทาง LINE Official
              </p>

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <button onClick={handleSubmit} disabled={submitting}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                {submitting ? 'กำลังส่งใบสมัคร...' : <>ยืนยันการสมัครและโอนเงินแล้ว <CheckCircle2 className="w-5 h-5" /></>}
              </button>
            </div>
          )}

          {/* ─── Navigation ─── */}
          {error && step < 4 && (
            <p className="mt-4 text-red-500 text-sm text-center">{error}</p>
          )}

          {step < 4 && (
            <div className={`flex mt-8 gap-3 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
              {step > 1 && (
                <button type="button" onClick={back}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-sm font-medium">
                  <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
                </button>
              )}
              <button type="button" onClick={next}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all text-sm font-semibold ml-auto">
                ถัดไป <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {step === 4 && (
            <button type="button" onClick={back}
              className="flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-sm font-medium mx-auto">
              <ArrowLeft className="w-4 h-4" /> ย้อนกลับแก้ไขข้อมูล
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MiddlemanRegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">กำลังโหลด...</div>}>
      <MiddlemanForm />
    </Suspense>
  );
}
