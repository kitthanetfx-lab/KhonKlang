'use client';

/* eslint-disable @next/next/no-img-element */

import { Suspense, useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, ArrowLeft, CheckCircle2,
  AlertTriangle, Copy, Check, Shield, ClipboardList,
} from 'lucide-react';
import { supabase, authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { uploadKycFiles } from '@/lib/uploadKyc';
import { FileUpload } from '@/components/FileUpload';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { useServiceControls } from '@/lib/useServiceControls';
import { FEE_DEFAULTS, effectiveRegFee, isPromoActive, type FeeConfig } from '@/lib/fees';

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

// ดึงจังหวัดออกจาก address string
function extractProvince(addr: string): string {
  const m = addr.match(/จ\.(\S+)/);
  if (m) {
    const hit = PROVINCES.find(p => p === m[1] || p.includes(m[1]) || m[1].includes(p));
    if (hit) return hit;
  }
  return PROVINCES.find(p => addr.includes(p)) || '';
}

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

// FileUpload (พร้อมพรีวิวรูป) ย้ายไปเป็นคอมโพเนนต์กลางที่ '@/components/FileUpload'

// ─── Main form ───────────────────────────────────────────────────────────────

function MiddlemanForm() {
  const router = useRouter();
  const controls = useServiceControls();

  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pdpaConsent, setPdpaConsent] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);
  const [copied, setCopied]   = useState<'acct' | 'pp' | null>(null);
  const [fees, setFees]       = useState<FeeConfig>(FEE_DEFAULTS);

  useEffect(() => {
    fetch('/api/fees').then(r => r.json()).then(d => { if (d.fees) setFees(d.fees); }).catch(() => {});
  }, []);

  const membershipFee = effectiveRegFee(fees, 'middleman');
  const promoActive = isPromoActive(fees, 'middleman');
  const ppDigits = (fees.companyPromptPay || '').replace(/\D/g, '');
  const qrSrc = fees.companyQrFileId
    ? fileViewUrl(DEAL_BUCKET, fees.companyQrFileId)
    : (ppDigits ? `https://promptpay.io/${ppDigits}/${Math.max(0, membershipFee)}.png` : '');

  if (!controls.loading && !controls.isEnabled('middlemanRegistration')) {
    return <ServiceDisabledNotice title="สมัครเป็นคนกลาง" message={controls.message('middlemanRegistration')} backHref="/register" backLabel="กลับไปหน้าเลือกประเภท" />;
  }

  const [displayName, setDisplayName]         = useState('');
  const [oauthEmail, setOauthEmail]           = useState('');
  const [profileProvince, setProfileProvince] = useState('');

  // Step 1 – Basic Identity
  const [fullNameId, setFullNameId] = useState('');
  const [idNumber, setIdNumber]     = useState('');

  // Step 2 – Middleman specific
  const [categories, setCategories] = useState<string[]>([]);
  const [workProvince, setWorkProvince] = useState('');
  const [terms, setTerms]           = useState('');

  // Step 3 – Docs & Bank
  const [idCardFile, setIdCardFile]       = useState<File | null>(null);
  const [bookbankFile, setBookbankFile]   = useState<File | null>(null);
  const [bankAcct, setBankAcct]   = useState('');
  const [bankName, setBankName]   = useState('');
  const [bankOwner, setBankOwner] = useState('');

  // Step 4 – Payment slip
  const [slipFile, setSlipFile] = useState<File | null>(null);

  const [existingStatus, setExistingStatus] = useState('');

  const ic = 'w-full bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-40';

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      setDisplayName(profile?.display_name || '');
      const em = (!user.email || user.email.includes('@line.khonklang.app')) ? '' : user.email;
      setOauthEmail(em || '');
      setFullNameId(profile?.display_name || '');
      if (profile?.address) {
        setProfileProvince(extractProvince(profile.address));
        setWorkProvince(extractProvince(profile.address));
      }
      if (profile?.bank_acct)  setBankAcct(profile.bank_acct);
      if (profile?.bank_name)  setBankName(profile.bank_name);
      if (profile?.bank_owner) setBankOwner(profile.bank_owner);
      // เช็คจาก profile ก่อน ถ้าไม่มีให้ถาม API (เผื่อกรณี multi-account)
      if (profile?.middleman_status) {
        setExistingStatus(profile.middleman_status);
      } else {
        const headers = await authHeaders();
        const res = await fetch('/api/register/middleman', { headers }).catch(() => null);
        if (res?.ok) {
          const data = await res.json();
          if (data.status) setExistingStatus(data.status);
        }
      }
      setLoading(false);
    })().catch(() => router.replace('/login'));
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
      if (!bookbankFile) return setError('กรุณาอัปโหลดหน้าสมุดบัญชีธนาคาร (Bookbank)'), false;
      if (!bankAcct.trim()) return setError('กรุณากรอกเลขที่บัญชีธนาคาร'), false;
      if (!bankName) return setError('กรุณาเลือกธนาคาร'), false;
      if (!bankOwner.trim()) return setError('กรุณากรอกชื่อบัญชีธนาคาร'), false;
    }
    if (step === 4) {
      if (membershipFee > 0 && !slipFile) return setError('กรุณาอัปโหลดสลิปการโอนเงิน'), false;
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
      const fileIds = await uploadKycFiles({
        idCard:   idCardFile,
        bookbank: bookbankFile,
        slip:     slipFile,
      });
      setError('');

      const headers = await authHeaders();
      const body = {
        type: 'middleman', fullNameId, idNumber,
        categories,
        workProvince, terms,
        bankAcct, bankName, bankOwner,
        idCardFileId:   fileIds.idCard,
        bookbankFileId: fileIds.bookbank,
        slipFileId:     fileIds.slip,
      };
      const res  = await fetch('/api/register/middleman', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'เกิดข้อผิดพลาด');
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
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

  // ── Already applied screen ──
  if (existingStatus && !done) {
    const cfg: Record<string, { icon: string; title: string; desc: string; cls: string }> = {
      pending_review: { icon: '⏳', title: 'ใบสมัครอยู่ระหว่างตรวจสอบ', desc: 'ทีมงานกำลังตรวจสอบเอกสาร KYC ของคุณ จะแจ้งผลภายใน 1-3 วันทำการ', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
      approved:       { icon: '✅', title: 'ได้รับการอนุมัติแล้ว!', desc: 'ยินดีด้วย! คุณเป็นคนกลางของเราแล้ว ไปที่โปรไฟล์เพื่อวางเงินประกัน', cls: 'bg-green-50 border-green-200 text-green-700' },
      rejected:       { icon: '❌', title: 'ใบสมัครถูกปฏิเสธ', desc: 'ขออภัย ใบสมัครของคุณไม่ผ่านการตรวจสอบ กรุณาติดต่อทีมงานเพื่อสอบถาม', cls: 'bg-red-50 border-red-200 text-red-700' },
    };
    const s = cfg[existingStatus] ?? cfg.pending_review;
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center glass-panel rounded-2xl p-10 shadow-xl">
          <div className="text-5xl mb-4">{s.icon}</div>
          <h2 className="text-xl font-bold mb-2">{s.title}</h2>
          <p className="text-gray-500 text-sm mb-6">{s.desc}</p>
          <div className={`rounded-xl border px-4 py-3 text-sm mb-6 ${s.cls}`}>
            สถานะ: <strong>{existingStatus === 'pending_review' ? 'รอตรวจสอบ' : existingStatus === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}</strong>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/profile')}
              className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm hover:bg-gray-50 transition-all">
              ดูโปรไฟล์
            </button>
            <button onClick={() => router.push('/')}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all">
              หน้าหลัก
            </button>
          </div>
        </div>
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
            <p>• เข้าหน้าบอร์ดคนกลางเพื่อโอนเงินค้ำประกัน (โอนเท่าไหร่ ได้เครดิตเต็มจำนวนนั้น ไม่มีขั้นต่ำ)</p>
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

              {/* เงินค้ำประกัน — วางหลังผ่าน KYC ผ่านหน้าบอร์ดคนกลาง ไม่ต้องระบุตรงนี้ */}
              <div className="flex items-start gap-3 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-xl px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
                <Shield className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">เรื่องเงินค้ำประกัน</p>
                  <p className="opacity-80 mt-0.5">โอนเงินค้ำประกันได้ทีหลัง หลังผ่านการอนุมัติ KYC แล้ว ผ่านหน้าบอร์ดคนกลาง — โอนเท่าไหร่ใช้เป็นเครดิตรับงานได้เต็มจำนวนนั้นเลย ไม่มีขั้นต่ำ ไม่มีเพดานต่อดีล</p>
                </div>
              </div>

              {/* Product categories */}
              <div>
                <label className="block text-sm font-medium mb-2 opacity-75">
                  ประเภทสินค้าที่เชี่ยวชาญ <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs text-gray-400 font-normal">เลือกได้หลายประเภท</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium opacity-75">จังหวัดหลักที่สะดวกรับงาน <span className="text-red-500">*</span></label>
                  {profileProvince && (
                    <button type="button"
                      onClick={() => setWorkProvince(profileProvince)}
                      className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-lg transition-all">
                      <ClipboardList size={12} /> ใช้จากโปรไฟล์ ({profileProvince})
                    </button>
                  )}
                </div>
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
              <FileUpload
                label="หน้าสมุดบัญชีธนาคาร (Bookbank)"
                accept="image/*,.pdf"
                file={bookbankFile}
                onChange={setBookbankFile}
                hint="JPG / PNG / PDF ขนาดไม่เกิน 10 MB"
                required
              />

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                <p className="text-sm font-semibold">บัญชีธนาคาร — สำหรับรับ-คืนเงินประกันและค่าบริการ</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              {promoActive && fees.promoLabel && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-3 text-center text-sm text-amber-800 dark:text-amber-200 font-medium">
                  🎉 {fees.promoLabel}
                </div>
              )}
              {/* Fee */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500 mb-1">ค่าสมัครคนกลาง</p>
                {promoActive && membershipFee !== fees.middlemanRegFee && (
                  <p className="text-sm text-gray-400 line-through">฿{fees.middlemanRegFee.toLocaleString()}</p>
                )}
                <p className="text-4xl font-bold text-purple-600">฿{membershipFee.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">ชำระครั้งเดียว (ต่ออายุรายปี) — ไม่รวมเงินค้ำประกัน (โอนทีหลังที่หน้าบอร์ดคนกลาง)</p>
              </div>

              {/* QR Code */}
              {qrSrc && (
                <div className="text-center space-y-3">
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">สแกน QR PromptPay (ค่าสมัคร ฿{membershipFee.toLocaleString()})</p>
                  <div className="inline-block bg-white p-3 rounded-2xl shadow-lg border border-gray-200">
                    <img src={qrSrc} alt="PromptPay QR Code" width={400} height={400} className="rounded-lg max-w-full h-auto" />
                  </div>
                  {ppDigits && (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                      <span>หมายเลข PromptPay:</span>
                      <code className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{fees.companyPromptPay}</code>
                      <button type="button" onClick={() => copyText(fees.companyPromptPay, 'pp')}
                        className="p-1 hover:text-blue-600 transition-colors">
                        {copied === 'pp' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Bank transfer */}
              {fees.companyBankAcct ? (
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2 text-sm">
                  <p className="font-semibold mb-2">หรือโอนผ่านธนาคาร</p>
                  <div className="flex justify-between">
                    <span className="text-gray-500">ธนาคาร</span>
                    <span className="font-medium">{fees.companyBankName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">เลขบัญชี</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono font-medium">{fees.companyBankAcct}</code>
                      <button type="button" onClick={() => copyText(fees.companyBankAcct, 'acct')}
                        className="p-1 hover:text-blue-600 transition-colors">
                        {copied === 'acct' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">ชื่อบัญชี</span>
                    <span className="font-medium">{fees.companyBankHolder}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">จำนวนเงิน</span>
                    <span className="font-bold text-purple-600">฿{membershipFee.toLocaleString()} (ค่าสมัคร)</span>
                  </div>
                </div>
              ) : !qrSrc && (
                <p className="text-sm text-amber-600 text-center">⚠️ ทีมงานยังไม่ได้ตั้งบัญชีรับเงิน กรุณาติดต่อแอดมินก่อนโอนเงิน</p>
              )}

              {/* Slip upload */}
              {membershipFee > 0 ? (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                  <FileUpload
                    label="แนบสลิปการโอนเงิน"
                    accept="image/*,.pdf"
                    file={slipFile}
                    onChange={setSlipFile}
                    hint="JPG / PNG / PDF — ภาพหน้าจอหรือสลิปโอนเงินจากแอปธนาคาร"
                    required
                  />
                </div>
              ) : (
                <p className="text-sm text-green-600 text-center border-t border-gray-200 dark:border-gray-700 pt-5">✅ ฟรีค่าสมัคร — ไม่ต้องโอนเงินหรือแนบสลิป</p>
              )}

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 cursor-pointer text-sm">
                <input type="checkbox" checked={pdpaConsent} onChange={e => setPdpaConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0" />
                <span className="text-gray-600 dark:text-gray-300 leading-relaxed">ข้าพเจ้ายินยอมให้ บริษัท คนกลาง จำกัด เก็บและใช้ข้อมูลส่วนบุคคล (รวมถึงบัตรประชาชน บัญชีธนาคาร) เพื่อยืนยันตัวตนและให้บริการ ตาม<a href="/privacy" target="_blank" className="text-blue-600 underline">นโยบายความเป็นส่วนตัว</a></span>
              </label>
              <button onClick={handleSubmit} disabled={submitting || (membershipFee > 0 && !slipFile) || !pdpaConsent}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                {submitting ? 'กำลังส่งใบสมัคร...' : <>{membershipFee > 0 ? 'ยืนยันการสมัครและแนบสลิปแล้ว' : 'ยืนยันการสมัคร'} <CheckCircle2 className="w-5 h-5" /></>}
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
