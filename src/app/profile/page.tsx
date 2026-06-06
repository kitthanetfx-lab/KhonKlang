'use client';

import { Suspense, useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User, Mail, Phone, MapPin, ShieldCheck, Pencil, Check, X,
  Store, HandshakeIcon, ChevronRight, Clock, CheckCircle2,
  XCircle, AlertTriangle, LogOut, ArrowLeft, Camera,
} from 'lucide-react';
import { account } from '@/lib/appwrite';
import type { ReactNode } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROVINCES = ['กระบี่','กรุงเทพมหานคร','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี'];

const ROLE_INFO: Record<string, { label: string; icon: ReactNode; color: string; bg: string }> = {
  admin:     { label: 'ผู้ดูแลระบบ', icon: <ShieldCheck size={14} />, color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700' },
  middleman: { label: 'คนกลาง',     icon: <HandshakeIcon size={14} />, color: 'text-green-700 dark:text-green-300',  bg: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700' },
  seller:    { label: 'ผู้ขาย',     icon: <Store size={14} />,        color: 'text-blue-700 dark:text-blue-300',    bg: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' },
  user:      { label: 'ผู้ใช้งาน', icon: <User size={14} />,         color: 'text-gray-600 dark:text-gray-300',    bg: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600' },
};

const APP_STATUS: Record<string, { label: string; icon: ReactNode; color: string }> = {
  pending_review: { label: 'รอตรวจสอบ',    icon: <Clock size={14} />,        color: 'text-amber-600 dark:text-amber-400' },
  approved:       { label: 'อนุมัติแล้ว',  icon: <CheckCircle2 size={14} />, color: 'text-green-600 dark:text-green-400' },
  rejected:       { label: 'ไม่อนุมัติ',  icon: <XCircle size={14} />,      color: 'text-red-600 dark:text-red-400' },
};

/** แยก address string → structured fields */
function parseAddress(addr: string) {
  const postalM = addr.match(/\b(\d{5})\b/);
  const roadM   = addr.match(/ถ\.(\S+)/);
  const mooM    = addr.match(/หมู่(?:ที่)?\s*(\d+)/);
  const amphoeM = addr.match(/อ\.(\S+)/);
  const tambonM = addr.match(/ต\.(\S+)/);
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

function buildAddress(f: ReturnType<typeof parseAddress>) {
  return [
    f.houseNo,
    f.moo          ? `หมู่ ${f.moo}`      : '',
    f.road         ? `ถ.${f.road}`         : '',
    f.tambonName   ? `ต.${f.tambonName}`   : '',
    f.amphoreName  ? `อ.${f.amphoreName}`  : '',
    f.provinceName ? `จ.${f.provinceName}` : '',
    f.postalCode,
  ].filter(Boolean).join(' ');
}

// ─── Main component ────────────────────────────────────────────────────────────

function ProfilePage() {
  const router = useRouter();

  // raw user data
  const [userId, setUserId]       = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail]         = useState('');
  const [prefs, setPrefs]         = useState<Record<string, string>>({});

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [editing, setEditing]   = useState(false);
  const [error, setError]       = useState('');
  const [saveOk, setSaveOk]     = useState(false);

  // edit form state
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast]   = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddr, setEditAddr]   = useState({
    houseNo: '', moo: '', road: '',
    provinceName: '', amphoreName: '', tambonName: '', postalCode: '',
  });

  const [amphoes, setAmphoes]         = useState<string[]>([]);
  const [tambons, setTambons]         = useState<[string, string][]>([]);
  const [loadingAmph, setLoadingAmph] = useState(false);
  const [loadingTamb, setLoadingTamb] = useState(false);

  const ic = 'w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-40 text-sm';

  // Load user
  useEffect(() => {
    account.get()
      .then(u => {
        setUserId(u.$id);
        setDisplayName(u.name || '');
        const em = (!u.email || u.email.includes('@line.khonklang.app')) ? '' : u.email;
        setEmail(em);
        const p = (u.prefs || {}) as Record<string, string>;
        setPrefs(p);
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  // Open edit form
  const openEdit = () => {
    setEditFirst(prefs.firstName || '');
    setEditLast(prefs.lastName   || '');
    setEditPhone(prefs.phone     || '');
    setEditAddr(parseAddress(prefs.address || ''));
    setError('');
    setSaveOk(false);
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setError(''); };

  // Province → amphoe cascade
  useEffect(() => {
    if (!editAddr.provinceName) { setAmphoes([]); setTambons([]); return; }
    setLoadingAmph(true);
    fetch(`/api/thai-address?type=amphures&province=${encodeURIComponent(editAddr.provinceName)}`)
      .then(r => r.json()).then(d => setAmphoes(Array.isArray(d) ? d : []))
      .catch(() => setAmphoes([]))
      .finally(() => setLoadingAmph(false));
  }, [editAddr.provinceName]);

  // Amphoe → tambon cascade
  useEffect(() => {
    if (!editAddr.amphoreName || !editAddr.provinceName) { setTambons([]); return; }
    setLoadingTamb(true);
    fetch(`/api/thai-address?type=tambons&province=${encodeURIComponent(editAddr.provinceName)}&amphoe=${encodeURIComponent(editAddr.amphoreName)}`)
      .then(r => r.json()).then(d => setTambons(Array.isArray(d) ? d : []))
      .catch(() => setTambons([]))
      .finally(() => setLoadingTamb(false));
  }, [editAddr.provinceName, editAddr.amphoreName]);

  const onProvince = (name: string) => setEditAddr({ houseNo: editAddr.houseNo, moo: editAddr.moo, road: editAddr.road, provinceName: name, amphoreName: '', tambonName: '', postalCode: '' });
  const onAmphoe   = (name: string) => setEditAddr(a => ({ ...a, amphoreName: name, tambonName: '', postalCode: '' }));
  const onTambon   = (val: string)  => { const [n, z] = val.split('|'); setEditAddr(a => ({ ...a, tambonName: n, postalCode: z })); };

  const handleSave = async () => {
    if (!editFirst.trim() || !editLast.trim()) return setError('กรุณากรอกชื่อ-นามสกุล');
    if (!editPhone.trim()) return setError('กรุณากรอกเบอร์โทรศัพท์');
    setSaving(true); setError('');
    try {
      const jwt = (await account.createJWT()).jwt;
      const address = buildAddress(editAddr);
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-session-jwt': jwt },
        body: JSON.stringify({ firstName: editFirst, lastName: editLast, phone: editPhone, address }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'เกิดข้อผิดพลาด'); return; }
      // update local state
      const newPrefs = { ...prefs, firstName: editFirst, lastName: editLast, phone: editPhone, address, displayName: `${editFirst} ${editLast}`.trim() };
      setPrefs(newPrefs);
      setDisplayName(`${editFirst} ${editLast}`.trim());
      setSaveOk(true);
      setTimeout(() => { setEditing(false); setSaveOk(false); }, 1200);
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await account.deleteSession('current');
    router.push('/');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">กำลังโหลด...</p>
    </div>
  );

  const role      = prefs.role || 'user';
  const roleInfo  = ROLE_INFO[role] ?? ROLE_INFO.user;
  const firstName = prefs.firstName || '';
  const lastName  = prefs.lastName  || '';
  const phone     = prefs.phone     || '';
  const address   = prefs.address   || '';
  const initials  = (displayName || 'U').slice(0, 2).toUpperCase();

  const sellerStatus    = prefs.sellerStatus    || '';
  const middlemanStatus = prefs.middlemanStatus || '';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
          <ArrowLeft size={15} /> กลับหน้าหลัก
        </Link>

        {/* ── Header card ── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {/* Blue bar */}
          <div className="h-24 bg-gradient-to-r from-blue-600 to-blue-800 relative">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          </div>

          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="flex items-end justify-between -mt-12 mb-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 border-4 border-white dark:border-gray-900 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {initials}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" title="ออนไลน์" />
              </div>

              <div className="flex gap-2 pt-14">
                {!editing && (
                  <button onClick={openEdit}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-all">
                    <Pencil size={14} /> แก้ไขข้อมูล
                  </button>
                )}
                <button onClick={logout}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 transition-all">
                  <LogOut size={14} /> ออกจากระบบ
                </button>
              </div>
            </div>

            <h1 className="text-xl font-bold">{displayName || 'ผู้ใช้งาน'}</h1>
            {email && <p className="text-sm text-gray-500 mt-0.5">{email}</p>}

            <div className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full border text-xs font-medium ${roleInfo.bg} ${roleInfo.color}`}>
              {roleInfo.icon} {roleInfo.label}
            </div>
          </div>
        </div>

        {/* ── View mode: personal info ── */}
        {!editing && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">ข้อมูลส่วนตัว</h2>
              <button onClick={openEdit} className="text-blue-600 text-xs hover:underline flex items-center gap-1">
                <Pencil size={11} /> แก้ไข
              </button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              <InfoRow icon={<User size={15} />}    label="ชื่อ-นามสกุล" value={`${firstName} ${lastName}`.trim() || '—'} />
              <InfoRow icon={<Mail size={15} />}    label="อีเมล"         value={email || '—'} />
              <InfoRow icon={<Phone size={15} />}   label="เบอร์โทรศัพท์" value={phone || '—'} />
              <InfoRow icon={<MapPin size={15} />}  label="ที่อยู่"        value={address || '—'} multiline />
            </div>
          </div>
        )}

        {/* ── Edit mode ── */}
        {editing && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">แก้ไขข้อมูลส่วนตัว</h2>
              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">ชื่อ <span className="text-red-500">*</span></label>
                  <input className={ic} value={editFirst} onChange={e => setEditFirst(e.target.value)} placeholder="ชื่อ" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">นามสกุล <span className="text-red-500">*</span></label>
                  <input className={ic} value={editLast} onChange={e => setEditLast(e.target.value)} placeholder="นามสกุล" />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                <input className={ic} value={editPhone} onChange={e => setEditPhone(e.target.value.replace(/\D/g,''))} placeholder="0812345678" maxLength={10} inputMode="numeric" />
              </div>

              {/* Address */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <p className="text-xs font-medium text-gray-500 mb-3">ที่อยู่</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">บ้านเลขที่</label>
                      <input className={ic} value={editAddr.houseNo} onChange={e => setEditAddr(a => ({...a, houseNo: e.target.value}))} placeholder="207/2" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">หมู่ที่</label>
                      <input className={ic} value={editAddr.moo} onChange={e => setEditAddr(a => ({...a, moo: e.target.value}))} placeholder="1" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">ถนน</label>
                      <input className={ic} value={editAddr.road} onChange={e => setEditAddr(a => ({...a, road: e.target.value}))} placeholder="พหลโยธิน" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">จังหวัด</label>
                    <select className={ic} value={editAddr.provinceName} onChange={e => onProvince(e.target.value)}>
                      <option value="">เลือกจังหวัด</option>
                      {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">อำเภอ / เขต</label>
                    <select className={ic} value={editAddr.amphoreName} onChange={e => onAmphoe(e.target.value)} disabled={!editAddr.provinceName || loadingAmph}>
                      <option value="">{loadingAmph ? 'กำลังโหลด...' : editAddr.provinceName ? 'เลือกอำเภอ' : '— เลือกจังหวัดก่อน —'}</option>
                      {amphoes.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">ตำบล / แขวง</label>
                      <select className={ic} value={editAddr.tambonName ? `${editAddr.tambonName}|${editAddr.postalCode}` : ''} onChange={e => onTambon(e.target.value)} disabled={!editAddr.amphoreName || loadingTamb}>
                        <option value="">{loadingTamb ? 'กำลังโหลด...' : editAddr.amphoreName ? 'เลือกตำบล' : '— เลือกอำเภอก่อน —'}</option>
                        {tambons.map(([n, z]) => <option key={n} value={`${n}|${z}`}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">รหัสไปรษณีย์</label>
                      <input readOnly className={ic + ' bg-gray-50 dark:bg-gray-800/80 cursor-default text-gray-500'} value={editAddr.postalCode} placeholder="ออโต้" />
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                  <AlertTriangle size={15} /> {error}
                </div>
              )}

              {saveOk && (
                <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
                  <CheckCircle2 size={15} /> บันทึกสำเร็จ!
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={cancelEdit} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  ยกเลิก
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2">
                  {saving ? 'กำลังบันทึก...' : <><Check size={15} /> บันทึกข้อมูล</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Application status ── */}
        {(sellerStatus || middlemanStatus) && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">สถานะการสมัคร</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {sellerStatus && (
                <ApplicationStatusRow
                  icon={<Store size={16} />}
                  label="ผู้ขายในเครือ"
                  status={sellerStatus}
                  bgColor="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                />
              )}
              {middlemanStatus && (
                <ApplicationStatusRow
                  icon={<HandshakeIcon size={16} />}
                  label="คนกลาง"
                  status={middlemanStatus}
                  bgColor="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                />
              )}
            </div>
          </div>
        )}

        {/* ── Upgrade buttons (if not yet applied) ── */}
        {(role === 'user' || role === 'seller') && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">ขยายสิทธิ์การใช้งาน</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {role !== 'seller' && !sellerStatus && (
                <Link href="/register/seller"
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Store size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">สมัครเป็นผู้ขายในเครือ</p>
                      <p className="text-xs text-gray-400">เปิดร้านและขายสินค้าผ่านระบบคนกลาง</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                </Link>
              )}
              {role !== 'middleman' && !middlemanStatus && (
                <Link href="/register/middleman"
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                      <HandshakeIcon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">สมัครเป็นคนกลาง</p>
                      <p className="text-xs text-gray-400">รับงานเป็นตัวกลางในการซื้อขาย มีรายได้เพิ่ม</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-400 group-hover:text-green-600 group-hover:translate-x-0.5 transition-all" />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── Account info ── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-500">ข้อมูลบัญชี</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <InfoRow icon={<ShieldCheck size={15} />} label="รหัสผู้ใช้" value={userId ? userId.slice(0,8) + '...' : '—'} mono />
            {prefs.linkedTo && <InfoRow icon={<Camera size={15} />} label="เชื่อมบัญชี" value="เชื่อมบัญชีแล้ว ✓" />}
          </div>
        </div>

        {/* Danger zone */}
        <div className="flex justify-end">
          <button onClick={logout}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-red-500 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
            <LogOut size={14} /> ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helper components ─────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, multiline, mono }: {
  icon: ReactNode; label: string; value: string; multiline?: boolean; mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-6 py-4">
      <div className="text-gray-400 mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className={`text-sm font-medium text-gray-800 dark:text-gray-100 ${multiline ? 'leading-relaxed' : 'truncate'} ${mono ? 'font-mono text-xs' : ''}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function ApplicationStatusRow({ icon, label, status, bgColor }: {
  icon: ReactNode; label: string; status: string; bgColor: string;
}) {
  const info = APP_STATUS[status] || { label: status, icon: <Clock size={14} />, color: 'text-gray-500' };
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bgColor}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <div className={`flex items-center gap-1 text-xs mt-0.5 ${info.color}`}>
            {info.icon} {info.label}
          </div>
        </div>
      </div>
      {status === 'pending_review' && (
        <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-full">
          รอ 1-3 วัน
        </span>
      )}
      {status === 'approved' && (
        <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-2.5 py-1 rounded-full">
          ✓ อนุมัติ
        </span>
      )}
      {status === 'rejected' && (
        <span className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-2.5 py-1 rounded-full">
          ✕ ไม่ผ่าน
        </span>
      )}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function ProfilePageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-400 animate-pulse">กำลังโหลด...</p></div>}>
      <ProfilePage />
    </Suspense>
  );
}
