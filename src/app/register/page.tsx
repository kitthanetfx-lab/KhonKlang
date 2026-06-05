'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Link2 } from 'lucide-react';
import { account } from '@/lib/appwrite';

/* ─────────── Thai Address Types ─────────── */
interface Province { id: number; n: string; }
interface Amphure  { id: number; n: string; p: number; }
interface Tambon   { id: number; n: string; a: number; z: number; }

let _prov: Province[] | null = null;
let _amph: Amphure[] | null = null;
let _tamb: Tambon[]  | null = null;

async function loadGeo() {
  if (_prov) return;
  const res = await fetch('/api/thai-address');
  if (!res.ok) throw new Error('fetch failed');
  const data = await res.json();
  _prov = data.provinces;
  _amph = data.amphures;
  _tamb = data.tambons;
}

/* ─────────── Form ─────────── */
function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'user';

  /* auth guard */
  useEffect(() => {
    account.get()
      .then((u) => {
        if ((u.prefs as Record<string, string>)?.firstName) router.replace('/');
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  /* form */
  const [saving, setSaving] = useState(false);
  const [linked, setLinked] = useState(false);
  const [error, setError]   = useState('');
  const [form, setForm]     = useState({
    firstName: '', lastName: '', phone: '', houseNo: '',
    province: '', provinceId: 0,
    amphure: '',  amphureId: 0,
    tambon: '',   tambonId: 0,
    postalCode: '',
  });

  /* geo */
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [amphures,  setAmphures]  = useState<Amphure[]>([]);
  const [tambons,   setTambons]   = useState<Tambon[]>([]);
  const [geoState, setGeoState]   = useState<'loading' | 'ready' | 'error'>('loading');
  const allAmph = useRef<Amphure[]>([]);
  const allTamb = useRef<Tambon[]>([]);

  const fetchGeo = () => {
    setGeoState('loading');
    loadGeo()
      .then(() => {
        setProvinces(_prov!);
        allAmph.current = _amph!;
        allTamb.current = _tamb!;
        setGeoState('ready');
      })
      .catch(() => { _prov = null; setGeoState('error'); });
  };
  useEffect(fetchGeo, []);

  /* handlers */
  const set = (k: string, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const onText = (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.name, e.target.value);
    if (error) setError('');
  };

  const onProvince = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = +e.target.value;
    const name = provinces.find(p => p.id === id)?.n || '';
    setForm(p => ({ ...p, provinceId: id, province: name, amphureId: 0, amphure: '', tambonId: 0, tambon: '', postalCode: '' }));
    setAmphures(allAmph.current.filter(a => a.p === id));
    setTambons([]);
  };

  const onAmphure = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = +e.target.value;
    const name = amphures.find(a => a.id === id)?.n || '';
    setForm(p => ({ ...p, amphureId: id, amphure: name, tambonId: 0, tambon: '', postalCode: '' }));
    setTambons(allTamb.current.filter(t => t.a === id));
  };

  const onTambon = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = +e.target.value;
    const t = tambons.find(t => t.id === id);
    setForm(p => ({ ...p, tambonId: id, tambon: t?.n || '', postalCode: t?.z?.toString() || '' }));
  };

  /* submit */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const address = [
      form.houseNo,
      form.tambon   ? `ตำบล${form.tambon}`   : '',
      form.amphure  ? `อำเภอ${form.amphure}`  : '',
      form.province ? `จังหวัด${form.province}` : '',
      form.postalCode,
    ].filter(Boolean).join(' ');

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName:  form.lastName,
          phone:     form.phone,
          address,
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return; }

      if (data.linked) {
        setLinked(true);
        setTimeout(() => router.push('/'), 2500);
      } else {
        router.push('/');
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const ic = 'w-full bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all';

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6">

      {linked && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Link2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">เชื่อมบัญชีสำเร็จ!</h3>
            <p className="text-gray-600 text-sm">พบบัญชีของคุณในระบบแล้ว กำลังพาไปหน้าหลัก...</p>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto glass-panel rounded-2xl p-6 sm:p-10 animate-fade-in shadow-xl">

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">ข้อมูลส่วนตัว</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">กรุณากรอกข้อมูลเบื้องต้นเพื่อเริ่มใช้งาน</p>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ชื่อ - นามสกุล */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-75">ชื่อจริง</label>
              <input required type="text" name="firstName" value={form.firstName}
                onChange={onText} className={ic} placeholder="สมชาย" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-75">นามสกุล</label>
              <input required type="text" name="lastName" value={form.lastName}
                onChange={onText} className={ic} placeholder="ใจดี" />
            </div>
          </div>

          {/* เบอร์โทร */}
          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-75">
              เบอร์โทรศัพท์
              <span className="ml-2 text-xs text-blue-500 font-normal">ใช้เชื่อมบัญชีข้ามแพลตฟอร์ม</span>
            </label>
            <input required type="tel" name="phone" value={form.phone}
              onChange={onText} className={ic} placeholder="0812345678" pattern="[0-9]{9,10}" />
          </div>

          {/* ที่อยู่ */}
          <div>
            <label className="block text-sm font-medium mb-1.5 opacity-75">บ้านเลขที่ / ถนน / ซอย</label>
            <input type="text" name="houseNo" value={form.houseNo}
              onChange={onText} className={ic} placeholder="เช่น 123/4 ถ.สุขุมวิท ซ.11" />
          </div>

          {/* Geo dropdowns */}
          {geoState === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              กำลังโหลดข้อมูลที่อยู่...
            </div>
          )}
          {geoState === 'error' && (
            <div className="flex items-center gap-3 text-sm py-1">
              <span className="text-red-500">โหลดข้อมูลไม่สำเร็จ</span>
              <button type="button" onClick={fetchGeo} className="text-blue-500 underline">ลองใหม่</button>
            </div>
          )}
          {geoState === 'ready' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 opacity-75">จังหวัด</label>
                  <select required value={form.provinceId || ''} onChange={onProvince}
                    className={ic + ' appearance-none'}>
                    <option value="">เลือกจังหวัด</option>
                    {provinces.map(p => <option key={p.id} value={p.id}>{p.n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 opacity-75">อำเภอ / เขต</label>
                  <select required value={form.amphureId || ''} onChange={onAmphure}
                    disabled={!form.provinceId}
                    className={ic + ' appearance-none disabled:opacity-40'}>
                    <option value="">{form.provinceId ? 'เลือกอำเภอ' : '— เลือกจังหวัดก่อน —'}</option>
                    {amphures.map(a => <option key={a.id} value={a.id}>{a.n}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 opacity-75">ตำบล / แขวง</label>
                  <select required value={form.tambonId || ''} onChange={onTambon}
                    disabled={!form.amphureId}
                    className={ic + ' appearance-none disabled:opacity-40'}>
                    <option value="">{form.amphureId ? 'เลือกตำบล' : '— เลือกอำเภอก่อน —'}</option>
                    {tambons.map(t => <option key={t.id} value={t.id}>{t.n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 opacity-75">รหัสไปรษณีย์</label>
                  <input readOnly value={form.postalCode}
                    className={ic + ' bg-gray-50 dark:bg-gray-800/80 cursor-default text-gray-500'}
                    placeholder="ออโต้" />
                </div>
              </div>
            </>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" disabled={saving}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3.5 rounded-xl font-medium transition-all shadow flex items-center justify-center gap-2">
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
