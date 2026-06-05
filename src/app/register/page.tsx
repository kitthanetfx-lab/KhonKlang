'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Link2 } from 'lucide-react';
import { account } from '@/lib/appwrite';

// id ตรงกับ kongvut thai-province-data
const PROVINCES = [
  {id:1,n:'กระบี่'},{id:2,n:'กรุงเทพมหานคร'},{id:3,n:'กาญจนบุรี'},{id:4,n:'กาฬสินธุ์'},{id:5,n:'กำแพงเพชร'},
  {id:6,n:'ขอนแก่น'},{id:7,n:'จันทบุรี'},{id:8,n:'ฉะเชิงเทรา'},{id:9,n:'ชลบุรี'},{id:10,n:'ชัยนาท'},
  {id:11,n:'ชัยภูมิ'},{id:12,n:'ชุมพร'},{id:13,n:'เชียงราย'},{id:14,n:'เชียงใหม่'},{id:15,n:'ตรัง'},
  {id:16,n:'ตราด'},{id:17,n:'ตาก'},{id:18,n:'นครนายก'},{id:19,n:'นครปฐม'},{id:20,n:'นครพนม'},
  {id:21,n:'นครราชสีมา'},{id:22,n:'นครศรีธรรมราช'},{id:23,n:'นครสวรรค์'},{id:24,n:'นนทบุรี'},{id:25,n:'นราธิวาส'},
  {id:26,n:'น่าน'},{id:27,n:'บึงกาฬ'},{id:28,n:'บุรีรัมย์'},{id:29,n:'ปทุมธานี'},{id:30,n:'ประจวบคีรีขันธ์'},
  {id:31,n:'ปราจีนบุรี'},{id:32,n:'ปัตตานี'},{id:33,n:'พระนครศรีอยุธยา'},{id:34,n:'พะเยา'},{id:35,n:'พังงา'},
  {id:36,n:'พัทลุง'},{id:37,n:'พิจิตร'},{id:38,n:'พิษณุโลก'},{id:39,n:'เพชรบุรี'},{id:40,n:'เพชรบูรณ์'},
  {id:41,n:'แพร่'},{id:42,n:'ภูเก็ต'},{id:43,n:'มหาสารคาม'},{id:44,n:'มุกดาหาร'},{id:45,n:'แม่ฮ่องสอน'},
  {id:46,n:'ยโสธร'},{id:47,n:'ยะลา'},{id:48,n:'ร้อยเอ็ด'},{id:49,n:'ระนอง'},{id:50,n:'ระยอง'},
  {id:51,n:'ราชบุรี'},{id:52,n:'ลพบุรี'},{id:53,n:'ลำปาง'},{id:54,n:'ลำพูน'},{id:55,n:'เลย'},
  {id:56,n:'ศรีสะเกษ'},{id:57,n:'สกลนคร'},{id:58,n:'สงขลา'},{id:59,n:'สตูล'},{id:60,n:'สมุทรปราการ'},
  {id:61,n:'สมุทรสงคราม'},{id:62,n:'สมุทรสาคร'},{id:63,n:'สระแก้ว'},{id:64,n:'สระบุรี'},{id:65,n:'สิงห์บุรี'},
  {id:66,n:'สุโขทัย'},{id:67,n:'สุพรรณบุรี'},{id:68,n:'สุราษฎร์ธานี'},{id:69,n:'สุรินทร์'},{id:70,n:'หนองคาย'},
  {id:71,n:'หนองบัวลำภู'},{id:72,n:'อ่างทอง'},{id:73,n:'อำนาจเจริญ'},{id:74,n:'อุดรธานี'},{id:75,n:'อุตรดิตถ์'},
  {id:76,n:'อุทัยธานี'},{id:77,n:'อุบลราชธานี'},
];

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

  type Amph = { id: number; n: string };
  type Tamb = { id: number; n: string; z: number };

  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', houseNo: '',
    provinceId: 0, provinceName: '',
    amphureId: 0,  amphoreName: '',
    tambonId: 0,   tambonName: '',  postalCode: '',
  });

  const [amphoes, setAmphoes]         = useState<Amph[]>([]);
  const [tambons, setTambons]         = useState<Tamb[]>([]);
  const [loadingAmph, setLoadingAmph] = useState(false);
  const [loadingTamb, setLoadingTamb] = useState(false);

  const onText = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const onProvince = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [id, name] = e.target.value.split('|');
    setForm(p => ({ ...p, provinceId: +id, provinceName: name, amphureId: 0, amphoreName: '', tambonId: 0, tambonName: '', postalCode: '' }));
    setAmphoes([]); setTambons([]);
    if (!id) return;
    setLoadingAmph(true);
    try {
      const res = await fetch(`/api/thai-address?type=amphures&pid=${id}`);
      const data = await res.json();
      setAmphoes(Array.isArray(data) ? data : []);
    } catch { setAmphoes([]); }
    setLoadingAmph(false);
  };

  const onAmphoe = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [id, name] = e.target.value.split('|');
    setForm(p => ({ ...p, amphureId: +id, amphoreName: name, tambonId: 0, tambonName: '', postalCode: '' }));
    setTambons([]);
    if (!id) return;
    setLoadingTamb(true);
    try {
      const res = await fetch(`/api/thai-address?type=tambons&aid=${id}`);
      const data = await res.json();
      setTambons(Array.isArray(data) ? data : []);
    } catch { setTambons([]); }
    setLoadingTamb(false);
  };

  const onTambon = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [id, name, zip] = e.target.value.split('|');
    setForm(p => ({ ...p, tambonId: +id, tambonName: name, postalCode: zip }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');

    const address = [
      form.houseNo,
      form.tambonName  && `ตำบล${form.tambonName}`,
      form.amphoreName && `อำเภอ${form.amphoreName}`,
      form.provinceName && `จังหวัด${form.provinceName}`,
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
          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-75">บ้านเลขที่ / ถนน</label>
            <input type="text" name="houseNo" value={form.houseNo} onChange={onText} className={ic} placeholder="207/2 ม.1" />
          </div>

          {/* จังหวัด */}
          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-75">จังหวัด</label>
            <select required value={form.provinceId ? `${form.provinceId}|${form.provinceName}` : ''} onChange={onProvince} className={ic}>
              <option value="">เลือกจังหวัด</option>
              {PROVINCES.map(p => <option key={p.id} value={`${p.id}|${p.n}`}>{p.n}</option>)}
            </select>
          </div>

          {/* อำเภอ */}
          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-75">อำเภอ / เขต</label>
            <select required value={form.amphureId ? `${form.amphureId}|${form.amphoreName}` : ''} onChange={onAmphoe}
              disabled={!form.provinceId || loadingAmph} className={ic}>
              <option value="">{loadingAmph ? 'กำลังโหลด...' : form.provinceId ? 'เลือกอำเภอ' : '— เลือกจังหวัดก่อน —'}</option>
              {amphoes.map(a => <option key={a.id} value={`${a.id}|${a.n}`}>{a.n}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-75">ตำบล / แขวง</label>
              <select required value={form.tambonId ? `${form.tambonId}|${form.tambonName}|${form.postalCode}` : ''} onChange={onTambon}
                disabled={!form.amphureId || loadingTamb} className={ic}>
                <option value="">{loadingTamb ? 'กำลังโหลด...' : form.amphureId ? 'เลือกตำบล' : '— เลือกอำเภอก่อน —'}</option>
                {tambons.map(t => <option key={t.id} value={`${t.id}|${t.n}|${t.z}`}>{t.n}</option>)}
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
