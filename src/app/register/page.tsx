'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Link2 } from 'lucide-react';
import { account } from '@/lib/appwrite';

const PROVINCES = ['กระบี่','กรุงเทพมหานคร','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี'];

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'user';

  useEffect(() => {
    account.get()
      .then((u) => { if ((u.prefs as Record<string, string>)?.firstName) router.replace('/'); })
      .catch(() => router.replace('/login'));
  }, [router]);

  const [saving, setSaving] = useState(false);
  const [linked, setLinked] = useState(false);
  const [error, setError]   = useState('');


  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '',
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
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName, phone: form.phone, address, role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return; }
      if (data.linked) { setLinked(true); setTimeout(() => router.push('/'), 2500); }
      else router.push('/');
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); }
    finally { setSaving(false); }
  };

  const ic = 'w-full bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-40';

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6">
      {linked && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Link2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">เชื่อมบัญชีสำเร็จ!</h3>
            <p className="text-gray-600 text-sm">กำลังพาไปหน้าหลัก...</p>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto glass-panel rounded-2xl p-6 sm:p-10 animate-fade-in shadow-xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">ข้อมูลส่วนตัว</h1>
        <p className="text-gray-500 text-sm mb-8">กรุณากรอกข้อมูลเบื้องต้นเพื่อเริ่มใช้งาน</p>

        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-75">ชื่อจริง</label>
              <input required type="text" name="firstName" value={form.firstName} onChange={onText} className={ic} placeholder="สมชาย" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-75">นามสกุล</label>
              <input required type="text" name="lastName" value={form.lastName} onChange={onText} className={ic} placeholder="ใจดี" />
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
                                                                                                                                                                                                                                                                                                                                                                                                                            