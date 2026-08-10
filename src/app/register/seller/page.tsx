'use client';

/* eslint-disable @next/next/no-img-element */

import { Suspense, useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, ArrowLeft, CheckCircle2,
  AlertTriangle, Copy, Check, Store, ClipboardList, Plus, Trash2, MapPin,
} from 'lucide-react';
import { supabase, authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { uploadKycFiles } from '@/lib/uploadKyc';
import { FileUpload } from '@/components/FileUpload';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { useServiceControls } from '@/lib/useServiceControls';
import { ConsentModal } from '@/components/ConsentModal';
import { FEE_DEFAULTS, effectiveRegFee, isPromoActive, type FeeConfig } from '@/lib/fees';

// ─── Constants ──────────────────────────────────────────────────────────────

const PROVINCES = ['กระบี่','กรุงเทพมหานคร','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี'];

const BANKS = [
  'ธนาคารกรุงเทพ (BBL)','ธนาคารกสิกรไทย (KBANK)','ธนาคารไทยพาณิชย์ (SCB)',
  'ธนาคารกรุงไทย (KTB)','ธนาคารกรุงศรีอยุธยา (BAY)','ธนาคารทหารไทยธนชาต (TTB)',
  'ธนาคารออมสิน','ธนาคารอาคารสงเคราะห์ (GHB)','ธนาคารเพื่อการเกษตรและสหกรณ์ (BAAC)',
  'ธนาคารอิสลามแห่งประเทศไทย','ธนาคารแลนด์แอนด์เฮ้าส์ (LH Bank)',
  'ธนาคารซีไอเอ็มบีไทย (CIMB Thai)','ธนาคารยูโอบี (UOB)',
];

const SELLER_TYPES = [
  { value: 'freelance',    label: 'ผู้ค้าอิสระ',        icon: '🛒', desc: 'ขายสินค้าออนไลน์ ไม่มีหน้าร้านถาวร' },
  { value: 'physical',    label: 'ผู้ขายมีหน้าร้าน',   icon: '🏪', desc: 'มีร้านค้าจริง หรือตลาดนัด' },
  { value: 'distributor', label: 'ตัวแทนจำหน่าย',      icon: '📦', desc: 'จัดจำหน่ายสินค้าจากแบรนด์/โรงงาน' },
  { value: 'corporate',   label: 'บริษัท / นิติบุคคล', icon: '🏢', desc: 'จดทะเบียนธุรกิจถูกต้องตามกฎหมาย' },
];

const STEPS = ['ข้อมูลพื้นฐาน', 'ข้อมูลผู้ขาย', 'ยืนยันตัวตน', 'ชำระค่าสมาชิก'];

// ─── Branch address types & helpers ─────────────────────────────────────────

interface BranchData {
  id: string;
  label: string;       // e.g. "สาขาหลัก", "สาขา 2"
  houseNo: string;
  moo: string;
  road: string;
  provinceName: string;
  amphoreName: string;
  tambonName: string;
  postalCode: string;
}

let branchCounter = 1;
function newBranch(label = 'สาขาหลัก'): BranchData {
  return { id: String(branchCounter++), label, houseNo: '', moo: '', road: '', provinceName: '', amphoreName: '', tambonName: '', postalCode: '' };
}

/** พยายามดึงข้อมูลจาก address string เช่น "207/2 หมู่ 1 ถ.พหลโยธิน ต.บ้านเช่า อ.เมือง จ.ลพบุรี 15000" */
function parseProfileAddress(addr: string): Partial<BranchData> {
  const postalM  = addr.match(/\b(\d{5})\b/);
  const roadM    = addr.match(/ถ\.(\S+)/);
  const mooM     = addr.match(/หมู่(?:ที่)?\s*(\d+)/);
  const amphoeM  = addr.match(/อ\.(\S+)/);
  const tambonM  = addr.match(/ต\.(\S+)/);
  const firstTok = addr.trim().split(/\s+/)[0];
  return {
    houseNo:      (firstTok && /^[\d\/]/.test(firstTok)) ? firstTok : '',
    moo:          mooM  ? mooM[1]  : '',
    road:         roadM ? roadM[1] : '',
    provinceName: PROVINCES.find(p => addr.includes(p)) || '',
    amphoreName:  amphoeM ? amphoeM[1] : '',
    tambonName:   tambonM ? tambonM[1] : '',
    postalCode:   postalM ? postalM[1] : '',
  };
}

function branchToString(b: BranchData): string {
  return [
    b.houseNo,
    b.moo          ? `หมู่ ${b.moo}`       : '',
    b.road         ? `ถ.${b.road}`          : '',
    b.tambonName   ? `ต.${b.tambonName}`    : '',
    b.amphoreName  ? `อ.${b.amphoreName}`   : '',
    b.provinceName ? `จ.${b.provinceName}`  : '',
    b.postalCode,
  ].filter(Boolean).join(' ');
}

// ─── BranchAddressForm component ─────────────────────────────────────────────

const IC = 'w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-40 text-sm';

function BranchAddressForm({ branch, onChange, onRemove, showRemove, profileAddress }: {
  branch: BranchData;
  onChange: (b: BranchData) => void;
  onRemove?: () => void;
  showRemove?: boolean;
  profileAddress?: string;
}) {
  const [amphoes, setAmphoes]         = useState<string[]>([]);
  const [tambons, setTambons]         = useState<[string, string][]>([]);
  const [loadingAmph, setLoadingAmph] = useState(false);
  const [loadingTamb, setLoadingTamb] = useState(false);

  // Load amphoes when province changes
  useEffect(() => {
    if (!branch.provinceName) return;
    const timer = window.setTimeout(() => {
      setLoadingAmph(true);
      fetch(`/api/thai-address?type=amphures&province=${encodeURIComponent(branch.provinceName)}`)
        .then(r => r.json()).then(d => setAmphoes(Array.isArray(d) ? d : []))
        .catch(() => setAmphoes([]))
        .finally(() => setLoadingAmph(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [branch.provinceName]);

  // Load tambons when amphoe changes
  useEffect(() => {
    if (!branch.amphoreName || !branch.provinceName) return;
    const timer = window.setTimeout(() => {
      setLoadingTamb(true);
      fetch(`/api/thai-address?type=tambons&province=${encodeURIComponent(branch.provinceName)}&amphoe=${encodeURIComponent(branch.amphoreName)}`)
        .then(r => r.json()).then(d => setTambons(Array.isArray(d) ? d : []))
        .catch(() => setTambons([]))
        .finally(() => setLoadingTamb(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [branch.provinceName, branch.amphoreName]);

  const availableAmphoes = branch.provinceName ? amphoes : [];
  const availableTambons = branch.provinceName && branch.amphoreName ? tambons : [];

  const upd = (key: keyof BranchData, val: string) => onChange({ ...branch, [key]: val });
  const onProvince = (name: string) => { onChange({ ...branch, provinceName: name, amphoreName: '', tambonName: '', postalCode: '' }); setAmphoes([]); setTambons([]); };
  const onAmphoe   = (name: string) => { onChange({ ...branch, amphoreName: name, tambonName: '', postalCode: '' }); setTambons([]); };
  const onTambon   = (val: string)  => { const [n, z] = val.split('|'); onChange({ ...branch, tambonName: n, postalCode: z }); };

  const fillFromProfile = () => {
    if (!profileAddress) return;
    const parsed = parseProfileAddress(profileAddress);
    onChange({ ...branch, ...parsed });
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Branch header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <MapPin size={15} className="text-blue-500 shrink-0" />
          <input
            className="text-sm font-medium bg-transparent outline-none border-none focus:ring-0 w-32"
            value={branch.label}
            onChange={e => upd('label', e.target.value)}
            placeholder="ชื่อสาขา"
          />
        </div>
        <div className="flex items-center gap-2">
          {profileAddress && (
            <button type="button" onClick={fillFromProfile}
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-800/40 border border-blue-200 dark:border-blue-700 px-2.5 py-1 rounded-lg transition-all">
              <ClipboardList size={12} /> ดึงจากโปรไฟล์
            </button>
          )}
          {showRemove && onRemove && (
            <button type="button" onClick={onRemove}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 px-2.5 py-1 rounded-lg transition-all">
              <Trash2 size={12} /> ลบ
            </button>
          )}
        </div>
      </div>

      {/* Form fields */}
      <div className="p-4 space-y-3">
        {/* House no / Moo / Road */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">บ้านเลขที่</label>
            <input type="text" value={branch.houseNo} onChange={e => upd('houseNo', e.target.value)} className={IC} placeholder="207/2" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">หมู่ที่</label>
            <input type="text" value={branch.moo} onChange={e => upd('moo', e.target.value)} className={IC} placeholder="1" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">ถนน</label>
            <input type="text" value={branch.road} onChange={e => upd('road', e.target.value)} className={IC} placeholder="พหลโยธิน" />
          </div>
        </div>

        {/* Province */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">จังหวัด <span className="text-red-500">*</span></label>
          <select value={branch.provinceName} onChange={e => onProvince(e.target.value)} className={IC}>
            <option value="">เลือกจังหวัด</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Amphoe */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">อำเภอ / เขต <span className="text-red-500">*</span></label>
          <select value={branch.amphoreName} onChange={e => onAmphoe(e.target.value)}
            disabled={!branch.provinceName || loadingAmph} className={IC}>
            <option value="">{loadingAmph ? 'กำลังโหลด...' : branch.provinceName ? 'เลือกอำเภอ' : '— เลือกจังหวัดก่อน —'}</option>
            {availableAmphoes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Tambon + Postal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">ตำบล / แขวง <span className="text-red-500">*</span></label>
            <select value={branch.tambonName ? `${branch.tambonName}|${branch.postalCode}` : ''}
              onChange={e => onTambon(e.target.value)}
              disabled={!branch.amphoreName || loadingTamb} className={IC}>
              <option value="">{loadingTamb ? 'กำลังโหลด...' : branch.amphoreName ? 'เลือกตำบล' : '— เลือกอำเภอก่อน —'}</option>
              {availableTambons.map(([n, z]) => <option key={n} value={`${n}|${z}`}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">รหัสไปรษณีย์</label>
            <input readOnly value={branch.postalCode} className={IC + ' bg-gray-50 dark:bg-gray-800/80 cursor-default text-gray-500'} placeholder="ออโต้" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-start justify-between mb-8 px-1">
      {STEPS.map((label, i) => {
        const num = i + 1; const done = num < current; const act = num === current;
        return (
          <Fragment key={num}>
            <div className="flex flex-col items-center gap-1.5 w-16">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300
                ${done ? 'bg-green-500 text-white' : act ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                {done ? '✓' : num}
              </div>
              <span className={`text-[11px] text-center leading-tight ${act ? 'text-blue-600 font-semibold' : done ? 'text-green-600' : 'text-gray-400'}`}>{label}</span>
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

function SellerForm() {
  const router = useRouter();
  const controls = useServiceControls();

  const [consentShown, setConsentShown] = useState(false);
  const [step, setStep]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pdpaConsent, setPdpaConsent] = useState(false);
  const [error, setError]         = useState('');
  const [done, setDone]           = useState(false);
  const [copied, setCopied]       = useState<'acct' | 'pp' | null>(null);
  const [fees, setFees]           = useState<FeeConfig>(FEE_DEFAULTS);

  useEffect(() => {
    fetch('/api/fees').then(r => r.json()).then(d => { if (d.fees) setFees(d.fees); }).catch(() => {});
  }, []);

  const membershipFee = effectiveRegFee(fees, 'seller');
  const promoActive = isPromoActive(fees, 'seller');
  const ppDigits = (fees.companyPromptPay || '').replace(/\D/g, '');
  const qrSrc = fees.companyQrFileId
    ? fileViewUrl(DEAL_BUCKET, fees.companyQrFileId)
    : (ppDigits ? `https://promptpay.io/${ppDigits}/${Math.max(0, membershipFee)}.png` : '');

  if (!controls.loading && !controls.isEnabled('sellerRegistration')) {
    return <ServiceDisabledNotice title="สมัครเป็นผู้ขาย" message={controls.message('sellerRegistration')} backHref="/register" backLabel="กลับไปหน้าเลือกประเภท" />;
  }

  // OAuth / profile
  const [displayName, setDisplayName]     = useState('');
  const [oauthEmail, setOauthEmail]       = useState('');
  const [profileAddress, setProfileAddress] = useState('');

  // Step 1
  const [sellerType, setSellerType] = useState('');
  const [fullNameId, setFullNameId] = useState('');
  const [idNumber, setIdNumber]     = useState('');
  const [shopName, setShopName]     = useState('');
  const [shopTagline, setShopTagline] = useState('');
  const [shopLogoFile, setShopLogoFile] = useState<File | null>(null);

  // Step 2 — branches
  const [branches, setBranches] = useState<BranchData[]>([newBranch('สาขาหลัก')]);
  const [onlineLink, setOnlineLink]       = useState('');
  const [companyName, setCompanyName]     = useState('');
  const [companyRegNum, setCompanyRegNum] = useState('');

  // Step 3
  const [idCardFile, setIdCardFile]           = useState<File | null>(null);
  const [companyCertFile, setCompanyCertFile] = useState<File | null>(null);
  const [bookbankFile, setBookbankFile]       = useState<File | null>(null);

  // Step 4
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [bankAcct, setBankAcct]   = useState('');
  const [bankName, setBankName]   = useState('');
  const [bankOwner, setBankOwner] = useState('');
  const [companyBankAcct, setCompanyBankAcct] = useState('');
  const [companyBankName, setCompanyBankName] = useState('');

  const [existingStatus, setExistingStatus] = useState('');

  const isCorporate = sellerType === 'corporate';
  const ic = 'w-full bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-40';

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/login'); return; }
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        const name = profile?.display_name || '';
        setDisplayName(name);
        const em = (!user.email || user.email.includes('@line.khonklang.app')) ? '' : user.email;
        setOauthEmail(em);
        setFullNameId(name);
        if (profile?.address) setProfileAddress(profile.address);
        if (profile?.bank_acct)  setBankAcct(profile.bank_acct);
        if (profile?.bank_name)  setBankName(profile.bank_name);
        if (profile?.bank_owner) setBankOwner(profile.bank_owner);
        if (profile?.shop_name) setShopName(profile.shop_name);
        if (profile?.shop_tagline) setShopTagline(profile.shop_tagline);
        if (profile?.seller_status) {
          setExistingStatus(profile.seller_status);
        } else {
          const headers = await authHeaders();
          const res = await fetch('/api/register/seller', { headers }).catch(() => null);
          if (res?.ok) {
            const data = await res.json();
            if (data.status) setExistingStatus(data.status);
          }
        }
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // Branch helpers
  const updateBranch = (id: string, b: BranchData) =>
    setBranches(prev => prev.map(x => x.id === id ? b : x));
  const removeBranch = (id: string) =>
    setBranches(prev => prev.filter(x => x.id !== id));
  const addBranch = () =>
    setBranches(prev => [...prev, newBranch(`สาขา ${prev.length + 1}`)]);

  // Validation
  const validate = () => {
    setError('');
    if (step === 1) {
      if (!sellerType) return setError('กรุณาเลือกประเภทผู้ขาย'), false;
      if (!fullNameId.trim()) return setError('กรุณากรอกชื่อ-นามสกุลตามบัตรประชาชน'), false;
      if (!/^\d{13}$/.test(idNumber)) return setError('เลขประจำตัวประชาชนต้องเป็นตัวเลข 13 หลัก'), false;
    }
    if (step === 2) {
      if (!branches[0].provinceName) return setError('กรุณาเลือกจังหวัดของสาขาหลัก'), false;
      if (!branches[0].amphoreName)  return setError('กรุณาเลือกอำเภอของสาขาหลัก'), false;
      if (!branches[0].tambonName)   return setError('กรุณาเลือกตำบลของสาขาหลัก'), false;
      if (isCorporate && !companyName.trim()) return setError('กรุณากรอกชื่อบริษัท'), false;
      if (isCorporate && !/^\d{13}$/.test(companyRegNum)) return setError('เลขทะเบียนนิติบุคคลต้องเป็นตัวเลข 13 หลัก'), false;
    }
    if (step === 3) {
      if (!idCardFile) return setError('กรุณาอัปโหลดภาพบัตรประชาชน'), false;
      if (!bankAcct.trim()) return setError('กรุณากรอกเลขที่บัญชีธนาคาร'), false;
      if (!bankName) return setError('กรุณาเลือกธนาคาร'), false;
      if (!bankOwner.trim()) return setError('กรุณากรอกชื่อบัญชีธนาคาร'), false;
      if (!bookbankFile) return setError('กรุณาอัปโหลดหน้าสมุดบัญชีธนาคาร (Bookbank)'), false;
      if (isCorporate && !companyCertFile) return setError('กรุณาอัปโหลดหนังสือรับรองบริษัท'), false;
      if (isCorporate && !companyBankAcct.trim()) return setError('กรุณากรอกเลขที่บัญชีบริษัท'), false;
      if (isCorporate && !companyBankName) return setError('กรุณาเลือกธนาคารบริษัท'), false;
    }
    if (step === 4) {
      if (membershipFee > 0 && !slipFile) return setError('กรุณาอัปโหลดสลิปการโอนเงิน'), false;
    }
    return true;
  };

  const next = () => { if (validate()) { setStep(s => s + 1); window.scrollTo(0, 0); } };
  const back = () => { setError(''); setStep(s => s - 1); window.scrollTo(0, 0); };

  const copyText = (text: string, key: 'acct' | 'pp') => {
    navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    try {
      // Upload ไฟล์ทั้งหมดไปที่ Appwrite Storage ก่อน
      const fileIds = await uploadKycFiles({
        idCard:      idCardFile,
        bookbank:    bookbankFile,
        companyCert: companyCertFile,
        slip:        slipFile,
      });
      setError('');

      let shopAvatarFileId = '';
      if (shopLogoFile) {
        const headers = await authHeaders();
        const form = new FormData();
        form.append('file', shopLogoFile);
        const up = await fetch('/api/upload-deal', { method: 'POST', headers, body: form });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(upData.error || 'อัปโหลดโลโก้ร้านไม่สำเร็จ');
        shopAvatarFileId = upData.fileId || '';
      }

      const headers = await authHeaders();
      // Build address string from branches
      const address  = branches.map(b => `[${b.label}] ${branchToString(b)}`).filter(s => s.length > 10).join(' / ');
      const province = branches[0].provinceName;
      const body = {
        type: 'seller', sellerType, fullNameId, idNumber,
        province, address, onlineLink,
        companyName: isCorporate ? companyName : '',
        companyRegNum: isCorporate ? companyRegNum : '',
        bankAcct, bankName, bankOwner,
        companyBankAcct: isCorporate ? companyBankAcct : '',
        companyBankName: isCorporate ? companyBankName : '',
        idCardFileId:      fileIds.idCard,
        bookbankFileId:    fileIds.bookbank,
        companyCertFileId: fileIds.companyCert,
        slipFileId:        fileIds.slip,
        shopName:          shopName.trim(),
        shopTagline:       shopTagline.trim(),
        shopAvatarFileId,
      };
      const res = await fetch('/api/register/seller', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'เกิดข้อผิดพลาด'); return; }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500 animate-pulse">กำลังโหลด...</p>
    </div>
  );

  if (existingStatus && !done) {
    const cfg: Record<string, { icon: string; title: string; desc: string; cls: string }> = {
      pending_review: { icon: '⏳', title: 'ใบสมัครอยู่ระหว่างตรวจสอบ', desc: 'ทีมงานกำลังตรวจสอบเอกสาร KYC ของคุณ จะแจ้งผลภายใน 1-3 วันทำการ', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
      approved:       { icon: '✅', title: 'ได้รับการอนุมัติแล้ว!', desc: 'ยินดีด้วย! คุณเป็นผู้ขายในเครือของเราแล้ว', cls: 'bg-green-50 border-green-200 text-green-700' },
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

  if (done) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center glass-panel rounded-2xl p-10 shadow-xl animate-fade-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">ส่งใบสมัครแล้ว!</h2>
        <p className="text-gray-500 mb-6">ทีมงานจะตรวจสอบข้อมูลและติดต่อกลับภายใน 1-3 วันทำการ</p>
        <button onClick={() => router.push('/')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-all">
          กลับหน้าหลัก
        </button>
      </div>
    </div>
  );

  return (
    <>
    {!consentShown && (
      <ConsentModal
        onAccept={() => setConsentShown(true)}
        onDecline={() => router.replace('/register')}
      />
    )}
    <div className="min-h-screen py-10 px-4 sm:px-6 reg-wizard-app-shell">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
            <Store className="w-4 h-4" /> สมัครเป็นผู้ขายในเครือคนกลาง
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">ลงทะเบียนผู้ขาย</h1>
        </div>

        <div className="glass-panel rounded-2xl p-6 sm:p-8 shadow-xl animate-fade-in">
          <StepIndicator current={step} />

          {/* ───── STEP 1: Basic Identity ───── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">ข้อมูลพื้นฐาน</h2>
                <p className="text-sm text-gray-500">เลือกประเภทผู้ขายและกรอกข้อมูลส่วนตัวตามบัตรประชาชน</p>
              </div>

              {(displayName || oauthEmail) && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm space-y-1">
                  <p className="text-xs text-gray-400 mb-1">บัญชีที่ใช้ล็อกอิน</p>
                  {displayName && <div className="flex gap-3"><span className="opacity-50 w-14">ชื่อ</span><span className="font-medium">{displayName}</span></div>}
                  {oauthEmail  && <div className="flex gap-3"><span className="opacity-50 w-14">อีเมล</span><span className="font-medium">{oauthEmail}</span></div>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2 opacity-75">ประเภทผู้ขาย <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SELLER_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => setSellerType(t.value)}
                      className={`rounded-xl border-2 p-3 text-left transition-all
                        ${sellerType === t.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}>
                      <span className="text-xl">{t.icon}</span>
                      <p className="font-medium text-sm mt-1">{t.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-tight">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="seller-full-name" className="block text-sm font-medium mb-1.5 opacity-75">ชื่อ-นามสกุล (ตรงตามบัตรประชาชน) <span className="text-red-500">*</span></label>
                <input id="seller-full-name" name="fullNameId" className={ic} value={fullNameId} onChange={e => setFullNameId(e.target.value)} placeholder="ชื่อ นามสกุล" />
              </div>
              <div>
                <label htmlFor="seller-id-number" className="block text-sm font-medium mb-1.5 opacity-75">เลขประจำตัวประชาชน <span className="text-red-500">*</span></label>
                <input id="seller-id-number" name="idNumber" className={ic} value={idNumber} onChange={e => setIdNumber(e.target.value.replace(/\D/g,'').slice(0,13))} placeholder="1234567890123" maxLength={13} inputMode="numeric" />
                <p className="text-xs text-gray-400 mt-1">ตัวเลข 13 หลัก ไม่ต้องใส่ขีด</p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 dark:bg-blue-950/20 p-4 space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">🏪 ป้ายร้าน (ตั้งตอนนี้หรือแก้ทีหลังได้)</h3>
                  <p className="text-xs text-gray-500 mt-1">ชื่อร้านและโลโก้จะแสดงในหน้าร้าน public เมื่อได้รับการอนุมัติ</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 opacity-75">ชื่อร้าน</label>
                  <input className={ic} value={shopName} onChange={e => setShopName(e.target.value)} placeholder="เช่น Kitt IT Shop" maxLength={120} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 opacity-75">คำโปรยร้าน</label>
                  <input className={ic} value={shopTagline} onChange={e => setShopTagline(e.target.value)} placeholder="เช่น ของมือสองคุณภาพ ส่งไวทั่วไทย" maxLength={200} />
                </div>
                <FileUpload
                  label="โลโก้ร้าน (ไม่บังคับ)"
                  accept="image/*"
                  hint="PNG/JPG แนะนำ 512×512 px"
                  file={shopLogoFile}
                  onChange={setShopLogoFile}
                />
              </div>
            </div>
          )}

          {/* ───── STEP 2: ข้อมูลผู้ขาย (cascading address + branches) ───── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold mb-1">ข้อมูลผู้ขาย</h2>
                <p className="text-sm text-gray-500">ระบุที่ตั้งร้านหรือพื้นที่ขายสินค้า</p>
              </div>

              {isCorporate && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 opacity-75">ชื่อบริษัท / ชื่อนิติบุคคล <span className="text-red-500">*</span></label>
                    <input className={ic} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="บริษัท ตัวอย่าง จำกัด" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 opacity-75">เลขทะเบียนนิติบุคคล <span className="text-red-500">*</span></label>
                    <input className={ic} value={companyRegNum} onChange={e => setCompanyRegNum(e.target.value.replace(/\D/g,'').slice(0,13))} placeholder="1234567890123" maxLength={13} inputMode="numeric" />
                  </div>
                </div>
              )}

              {/* Branch forms */}
              <div className="space-y-4">
                {branches.map((b, i) => (
                  <BranchAddressForm
                    key={b.id}
                    branch={b}
                    onChange={updated => updateBranch(b.id, updated)}
                    onRemove={() => removeBranch(b.id)}
                    showRemove={branches.length > 1 && i > 0}
                    profileAddress={profileAddress}
                  />
                ))}
              </div>

              {/* Add branch button */}
              <button type="button" onClick={addBranch}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 dark:hover:border-blue-600 dark:hover:text-blue-400 transition-all">
                <Plus size={16} /> เพิ่มสาขา / ที่อยู่อื่น
              </button>

              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-75">ลิงก์หน้าร้านออนไลน์ <span className="text-xs text-gray-400 font-normal">(ถ้ามี)</span></label>
                <input className={ic} value={onlineLink} onChange={e => setOnlineLink(e.target.value)}
                  placeholder="https://facebook.com/yourpage หรือ Shopee/TikTok" type="url" />
              </div>
            </div>
          )}

          {/* ───── STEP 3: Trust Verification ───── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold mb-1">ยืนยันตัวตน</h2>
                <p className="text-sm text-gray-500">อัปโหลดเอกสารและข้อมูลบัญชีธนาคาร</p>
              </div>
              <FileUpload label="ภาพถ่ายบัตรประชาชน (หรือถ่ายคู่กับบัตร)" accept="image/*" file={idCardFile} onChange={setIdCardFile} hint="JPG / PNG / HEIC ขนาดไม่เกิน 10 MB" required />
              <FileUpload label="หน้าสมุดบัญชีธนาคาร (Bookbank)" accept="image/*,.pdf" file={bookbankFile} onChange={setBookbankFile} hint="JPG / PNG / PDF ขนาดไม่เกิน 10 MB" required />
              {isCorporate && (
                <FileUpload label="หนังสือรับรองบริษัท (อายุไม่เกิน 6 เดือน)" accept="image/*,.pdf" file={companyCertFile} onChange={setCompanyCertFile} hint="JPG / PNG / PDF" required />
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                <p className="text-sm font-semibold">บัญชีธนาคาร — สำหรับรับเงินค่าสินค้า</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="seller-bank-acct" className="block text-sm font-medium mb-1.5 opacity-75">เลขที่บัญชี <span className="text-red-500">*</span></label>
                    <input id="seller-bank-acct" name="bankAcct" className={ic} value={bankAcct} onChange={e => setBankAcct(e.target.value)} placeholder="xxx-x-xxxxx-x" />
                  </div>
                  <div>
                    <label htmlFor="seller-bank-name" className="block text-sm font-medium mb-1.5 opacity-75">ธนาคาร <span className="text-red-500">*</span></label>
                    <select id="seller-bank-name" name="bankName" className={ic} value={bankName} onChange={e => setBankName(e.target.value)}>
                      <option value="">เลือกธนาคาร</option>
                      {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="seller-bank-owner" className="block text-sm font-medium mb-1.5 opacity-75">ชื่อบัญชี (ต้องตรงกับบัตรประชาชน) <span className="text-red-500">*</span></label>
                  <input id="seller-bank-owner" name="bankOwner" className={ic} value={bankOwner} onChange={e => setBankOwner(e.target.value)} placeholder="ชื่อ นามสกุล" />
                </div>
              </div>
              {isCorporate && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                  <p className="text-sm font-semibold">บัญชีธนาคารบริษัท</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5 opacity-75">เลขที่บัญชีบริษัท <span className="text-red-500">*</span></label>
                      <input className={ic} value={companyBankAcct} onChange={e => setCompanyBankAcct(e.target.value)} placeholder="xxx-x-xxxxx-x" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5 opacity-75">ธนาคาร <span className="text-red-500">*</span></label>
                      <select className={ic} value={companyBankName} onChange={e => setCompanyBankName(e.target.value)}>
                        <option value="">เลือกธนาคาร</option>
                        {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ───── STEP 4: Payment ───── */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">ชำระค่าสมาชิก</h2>
                <p className="text-sm text-gray-500">ชำระค่าสมัครเพื่อเปิดใช้งานสิทธิ์ผู้ขาย</p>
              </div>
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
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500 mb-1">ค่าสมัครผู้ขาย</p>
                {promoActive && membershipFee !== fees.sellerRegFee && (
                  <p className="text-sm text-gray-400 line-through">฿{fees.sellerRegFee.toLocaleString()}</p>
                )}
                {membershipFee === 0 ? (
                  <p className="text-4xl font-bold text-green-600">ฟรี!</p>
                ) : (
                  <p className="text-4xl font-bold text-blue-600">฿{membershipFee.toLocaleString()}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">ชำระครั้งเดียว (ต่ออายุรายปี)</p>
              </div>
              {membershipFee > 0 && qrSrc && (
                <div className="text-center space-y-3">
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">สแกน QR PromptPay</p>
                  <div className="inline-block bg-white p-3 rounded-2xl shadow-lg border border-gray-200">
                    <img src={qrSrc} alt="QR" width={400} height={400} className="rounded-lg max-w-full h-auto" />
                  </div>
                  {ppDigits && (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                      <span>PromptPay:</span>
                      <code className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{fees.companyPromptPay}</code>
                      <button type="button" onClick={() => copyText(fees.companyPromptPay, 'pp')} className="p-1 hover:text-blue-600 transition-colors">
                        {copied === 'pp' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {membershipFee > 0 && (fees.companyBankAcct ? (
                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2 text-sm">
                  <p className="font-semibold mb-2">หรือโอนผ่านธนาคาร</p>
                  <div className="flex justify-between"><span className="text-gray-500">ธนาคาร</span><span className="font-medium">{fees.companyBankName}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">เลขบัญชี</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono font-medium">{fees.companyBankAcct}</code>
                      <button type="button" onClick={() => copyText(fees.companyBankAcct, 'acct')} className="p-1 hover:text-blue-600 transition-colors">
                        {copied === 'acct' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between"><span className="text-gray-500">ชื่อบัญชี</span><span className="font-medium">{fees.companyBankHolder}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">จำนวนเงิน</span><span className="font-bold text-blue-600">฿{membershipFee}</span></div>
                </div>
              ) : !qrSrc && (
                <p className="text-sm text-amber-600 text-center">⚠️ ทีมงานยังไม่ได้ตั้งบัญชีรับเงิน กรุณาติดต่อแอดมินก่อนโอนเงิน</p>
              ))}
              {/* Slip upload / ฟรีค่าสมัคร */}
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
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center">
                  <p className="text-green-700 dark:text-green-300 font-semibold">🎉 ฟรีค่าสมัคร!</p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">ไม่ต้องโอนเงินหรือแนบสลิป — กดยืนยันการสมัครได้เลย</p>
                </div>
              )}
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <label className="flex items-start gap-2.5 mb-4 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 cursor-pointer text-sm">
                <input type="checkbox" checked={pdpaConsent} onChange={e => setPdpaConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0" />
                <span className="text-gray-600 dark:text-gray-300 leading-relaxed">ข้าพเจ้ายินยอมให้ บริษัท กลางฮับ จำกัด เก็บและใช้ข้อมูลส่วนบุคคล (รวมถึงบัตรประชาชน บัญชีธนาคาร) เพื่อยืนยันตัวตนและให้บริการ ตาม<a href="/privacy" target="_blank" className="text-blue-600 underline">นโยบายความเป็นส่วนตัว</a></span>
              </label>
              <button onClick={handleSubmit} disabled={submitting || (membershipFee > 0 && !slipFile) || !pdpaConsent}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                {submitting ? 'กำลังส่งใบสมัคร...' : <><CheckCircle2 className="w-5 h-5" /> {membershipFee > 0 ? 'ยืนยันการสมัครและแนบสลิปแล้ว' : 'ยืนยันการสมัคร'}</>}
              </button>
            </div>
          )}

          {/* Navigation */}
          {error && step < 4 && <p className="mt-4 text-red-500 text-sm text-center">{error}</p>}
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
    </>
  );
}

export default function SellerRegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">กำลังโหลด...</div>}>
      <SellerForm />
    </Suspense>
  );
}
