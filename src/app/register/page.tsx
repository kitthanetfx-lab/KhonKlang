'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Link2 } from 'lucide-react';
import { account } from '@/lib/appwrite';

const PROVINCES = ['กระบี่','กรุงเทพมหานคร','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี'];

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role     = searchParams.get('role') || 'user';
  const returnTo = searchParams.get('returnTo') || '/';

  useEffect(() => {
    account.get().then(async (u) => {
      // ถ้ามีโปรไฟล์แล้ว → ไปหน้าเดิม (หรือหน้าหลัก)
      if ((u.prefs as Record<string, string>)?.firstName) {
        router.replace(returnTo.startsWith('/') ? returnTo : '/');
        return;
      }

      // pre-fill ชื่อ + email จาก OAuth
      const full  = u.name || '';
      const parts = full.trim().split(' ');
      const first = parts[0] || '';
      const last  = parts.slice(1).join(' ') || '';
      const email = (!u.email || u.email.includes('@line.khonklang.app')) ? '' : u.email;
      setForm(p => ({ ...p, firstName: first, lastName: last, email }));

      // ตรวจ auto-match กับโปรไฟล์ในระบบ (ชื่อหรืออีเมลตรงกัน)
      try {
        const jwt = await account.createJWT().then(r => r.jwt);
        const res = await fetch('/api/register', {
          headers: { 'x-session-jwt': jwt },
        });
        const data = await res.json();
        if (data.matched) {
          // พบโปรไฟล์ตรงกัน → ข้ามฟอร์ม
          setLinked(true);
          setTimeout(() => router.replace('/'), 2000);
          return;
        }
      } catch { /* ไม่ match → แสดงฟอร์มตามปกติ */ }

      setChecking(false);
    }).catch(() => router.replace('/login'));
  }, [router]);

  const [checking, setChecking] = useState(true);  // ตรวจ auto-match ก่อน
  const [saving, setSaving]     = useState(false);
  const [linked, setLinked]     = useState(false);
  const [error, setError]       = useState('');


  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    houseNo: '', moo: '', road: '',
    provinceName: '', amphoreName: '', tambonName: '', postalCode: '',
  });

  const [amphoes, setAmphoes]         = useState<string[]>([]);
  const [tambons, setTambons]         = useState<[string,string][]>([]);
  const [loadingAmph, setLoadingAmph] = useState(false);
  const [loadingTamb, setLoadingTamb] = useState(false);

  const onText = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const onProvince = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setForm(p => ({ ...p, provinceName: name, amphoreName: '', tambonName: '', postalCode: '' }));
    setAmphoes([]); setTambons([]);
    if (!name) return;
    setLoadingAmph(true);
    try {
      const res = await fetch(`/api/thai-address?type=amphures&province=${encodeURIComponent(name)}`);
      const d = await res.json();
      setAmphoes(Array.isArray(d) ? d : []);
    } catch { setAmphoes([]); }
    setLoadingAmph(false);
  };

  const onAmphoe = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setForm(p => ({ ...p, amphoreName: name, tambonName: '', postalCode: '' }));
    setTambons([]);
    if (!name) return;
    setLoadingTamb(true);
    try {
      const res = await fetch(`/api/thai-address?type=tambons&province=${encodeURIComponent(form.provinceName)}&amphoe=${encodeURIComponent(name)}`);
      const d = await res.json();
      setTambons(Array.isArray(d) ? d : []);
    } catch { setTambons([]); }
    setLoadingTamb(false);
  };

  const onTambon = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value; // "name|zip"
    const [name, zip] = val.split('|');
    setForm(p => ({ ...p, tambonName: name, postalCode: zip }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');

    const address = [
      form.houseNo,
      form.moo          ? `หมู่ ${form.moo}`           : '',
      form.road         ? `ถ.${form.road}`              : '',
      form.tambonName   ? `ต.${form.tambonName}`        : '',
      form.amphoreName  ? `อ.${form.amphoreName}`       : '',
      form.provinceName ? `จ.${form.provinceName}`      : '',
      form.postalCode,
    ].filter(Boolean).join(' ');

    try {
      // สร้าง JWT สั้น ๆ เพื่อให้ server verify ตัวตนได้ (รองรับทั้ง Google/LINE/Facebook OAuth)
      const { jwt } = await account.createJWT();

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-jwt': jwt },
        body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone, address, role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return; }
      const dest = returnTo.startsWith('/') ? returnTo : '/';
      if (data.linked) { setLinked(true); setTimeout(() => router.push(dest), 2500); }
      else router.push(dest);
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); }
    finally { setSaving(false); }
  };

  const ic = 'w-full bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-40';

  if (checking && !linked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">กำลังตรวจสอบข้อมูล...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6">
      {linked && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Link2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">พบข้อมูลของคุณในระบบแล้ว!</h3>
            <p className="text-gray-600 text-sm">เชื่อมบัญชีสำเร็จ กำลังพาไปหน้าหลัก...</p>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto glass-panel rounded-2xl p-6 sm:p-10 animate-fade-in shadow-xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">ข้อมูลส่วนตัว</h1>
        <p className="text-gray-500 text-sm mb-8">กรุณากรอกข้อมูลเบื้องต้นเพื่อเริ่มใช้งาน</p>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ชื่อ + อีเมล: ดึงจาก OAuth อ่านอย่างเดียว */}
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-4 py-3 space-y-2">
            <p className="text-xs text-gray-400 mb-1">ข้อมูลจากบัญชีที่ใช้ล็อกอิน</p>
            <div className="flex items-center gap-3">
              <span className="text-sm opacity-60 w-16 shrink-0">ชื่อ</span>
              <span className="font-medium">{form.firstName} {form.lastName}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm opacity-60 w-16 shrink-0">อีเมล</span>
              <span className="font-medium">{form.email || <span className="text-gray-400 text-sm">ไม่มีข้อมูล</span>}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-75">
              เบอร์โทรศัพท์
              <span className="ml-2 text-xs text-blue-500 font-normal">ใช้เชื่อมบัญชีข้ามแพลตฟอร์ม</span>
            </label>
            <input required type="tel" name="phone" value={form.phone} onChange={onText} className={ic} placeholder="0812345678" pattern="[0-9]{9,10}" />
          </div>

          {/* ─── ที่อยู่ ─── */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-75">บ้านเลขที่</label>
              <input type="text" name="houseNo" value={form.houseNo} onChange={onText} className={ic} placeholder="207/2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-75">หมู่ที่</label>
              <input type="text" name="moo" value={form.moo} onChange={onText} className={ic} placeholder="1" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-75">ถนน</label>
              <input type="text" name="road" value={form.road} onChange={onText} className={ic} placeholder="พหลโยธิน" />
            </div>
          </div>

          {/* จังหวัด */}
          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-75">จังหวัด</label>
            <select required value={form.provinceName} onChange={onProvince} className={ic}>
              <option value="">เลือกจังหวัด</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* อำเภอ */}
          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-75">อำเภอ / เขต</label>
            <select required value={form.amphoreName} onChange={onAmphoe}
              disabled={!form.provinceName || loadingAmph} className={ic}>
              <option value="">{loadingAmph ? 'กำลังโหลด...' : form.provinceName ? 'เลือกอำเภอ' : '— เลือกจังหวัดก่อน —'}</option>
              {amphoes.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-75">ตำบล / แขวง</label>
              <select required value={form.tambonName ? `${form.tambonName}|${form.postalCode}` : ''} onChange={onTambon}
                disabled={!form.amphoreName || loadingTamb} className={ic}>
                <option value="">{loadingTamb ? 'กำลังโหลด...' : form.amphoreName ? 'เลือกตำบล' : '— เลือกอำเภอก่อน —'}</option>
                {tambons.map(([n, z]) => <option key={n} value={`${n}|${z}`}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-75">รหัสไปรษณีย์</label>
              <input readOnly value={form.postalCode}
                className={ic + ' bg-gray-50 dark:bg-gray-800/80 cursor-default text-gray-500'} placeholder="ออโต้" />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3.5 rounded-xl font-medium transition-all shadow flex items-center justify-center gap-2">
            {saving ? 'กำลังบันทึก...' : <> บันทึกและไปหน้าหลัก <ArrowRight className="w-4 h-4" /> </>}
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
