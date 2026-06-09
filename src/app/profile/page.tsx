'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { account, clearPersistedSession } from '@/lib/appwrite';
import { Icon } from '@/components/Icon';

const PROVINCES = ['กระบี่','กรุงเทพมหานคร','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี'];

const ROLE_INFO: Record<string, { label: string; cls: string }> = {
  admin:     { label: 'ผู้ดูแลระบบ', cls: 'pf-role-middleman' },
  middleman: { label: 'คนกลาง',     cls: 'pf-role-middleman' },
  seller:    { label: 'ผู้ขาย',     cls: 'pf-role-seller' },
  user:      { label: 'ผู้ใช้งาน', cls: 'pf-role-user' },
};

function parseAddress(addr: string) {
  const postalM = addr.match(/\b(\d{5})\b/);
  const roadM   = addr.match(/ถ\.(\S+)/);
  const mooM    = addr.match(/หมู่(?:ที่)?\s*(\d+)/);
  const amphoeM = addr.match(/อ\.(\S+)/);
  const tambonM = addr.match(/ต\.(\S+)/);
  const firstTok = addr.trim().split(/\s+/)[0];
  return {
    houseNo: (firstTok && /^[\d\/]/.test(firstTok)) ? firstTok : '',
    moo: mooM ? mooM[1] : '', road: roadM ? roadM[1] : '',
    provinceName: PROVINCES.find(p => addr.includes(p)) || '',
    amphoreName: amphoeM ? amphoeM[1] : '', tambonName: tambonM ? tambonM[1] : '',
    postalCode: postalM ? postalM[1] : '',
  };
}
function buildAddress(f: ReturnType<typeof parseAddress>) {
  return [f.houseNo, f.moo ? `หมู่ ${f.moo}` : '', f.road ? `ถ.${f.road}` : '', f.tambonName ? `ต.${f.tambonName}` : '', f.amphoreName ? `อ.${f.amphoreName}` : '', f.provinceName ? `จ.${f.provinceName}` : '', f.postalCode].filter(Boolean).join(' ');
}

function ProfilePage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [prefs, setPrefs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [saveOk, setSaveOk] = useState(false);

  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddr, setEditAddr] = useState({ houseNo: '', moo: '', road: '', provinceName: '', amphoreName: '', tambonName: '', postalCode: '' });
  const [amphoes, setAmphoes] = useState<string[]>([]);
  const [tambons, setTambons] = useState<[string, string][]>([]);
  const [loadingAmph, setLoadingAmph] = useState(false);
  const [loadingTamb, setLoadingTamb] = useState(false);

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0');
    r.style.setProperty('--accent-strong', '#1f54d6');
    r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);

  useEffect(() => {
    account.get()
      .then(async u => {
        setDisplayName(u.name || '');
        const em = (!u.email || u.email.includes('@line.khonklang.app')) ? '' : u.email;
        setEmail(em);
        let p = (u.prefs || {}) as Record<string, string>;
        setPrefs(p);
        try {
          const jwt = (await account.createJWT()).jwt;
          const [sellerRes, middlemanRes] = await Promise.all([
            fetch('/api/register/seller', { headers: { 'x-session-jwt': jwt } }).catch(() => null),
            fetch('/api/register/middleman', { headers: { 'x-session-jwt': jwt } }).catch(() => null),
          ]);
          const sellerData = sellerRes?.ok ? await sellerRes.json() : null;
          const middlemanData = middlemanRes?.ok ? await middlemanRes.json() : null;
          let synced = false;
          if (sellerData?.status && sellerData.status !== p.sellerStatus) { p = { ...p, sellerStatus: sellerData.status }; synced = true; }
          if (middlemanData?.status && middlemanData.status !== p.middlemanStatus) { p = { ...p, middlemanStatus: middlemanData.status }; synced = true; }
          if (synced) setPrefs(p);
        } catch { /* best-effort */ }
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const openEdit = () => {
    setEditFirst(prefs.firstName || ''); setEditLast(prefs.lastName || '');
    setEditPhone(prefs.phone || ''); setEditAddr(parseAddress(prefs.address || ''));
    setError(''); setSaveOk(false); setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setError(''); };

  useEffect(() => {
    if (!editAddr.provinceName) { setAmphoes([]); setTambons([]); return; }
    setLoadingAmph(true);
    fetch(`/api/thai-address?type=amphures&province=${encodeURIComponent(editAddr.provinceName)}`)
      .then(r => r.json()).then(d => setAmphoes(Array.isArray(d) ? d : [])).catch(() => setAmphoes([])).finally(() => setLoadingAmph(false));
  }, [editAddr.provinceName]);

  useEffect(() => {
    if (!editAddr.amphoreName || !editAddr.provinceName) { setTambons([]); return; }
    setLoadingTamb(true);
    fetch(`/api/thai-address?type=tambons&province=${encodeURIComponent(editAddr.provinceName)}&amphoe=${encodeURIComponent(editAddr.amphoreName)}`)
      .then(r => r.json()).then(d => setTambons(Array.isArray(d) ? d : [])).catch(() => setTambons([])).finally(() => setLoadingTamb(false));
  }, [editAddr.provinceName, editAddr.amphoreName]);

  const onProvince = (name: string) => setEditAddr({ houseNo: editAddr.houseNo, moo: editAddr.moo, road: editAddr.road, provinceName: name, amphoreName: '', tambonName: '', postalCode: '' });
  const onAmphoe = (name: string) => setEditAddr(a => ({ ...a, amphoreName: name, tambonName: '', postalCode: '' }));
  const onTambon = (val: string) => { const [n, z] = val.split('|'); setEditAddr(a => ({ ...a, tambonName: n, postalCode: z })); };

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
      const newPrefs = { ...prefs, firstName: editFirst, lastName: editLast, phone: editPhone, address, displayName: `${editFirst} ${editLast}`.trim() };
      setPrefs(newPrefs); setDisplayName(`${editFirst} ${editLast}`.trim()); setSaveOk(true);
      setTimeout(() => { setEditing(false); setSaveOk(false); }, 1200);
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); } finally { setSaving(false); }
  };

  const logout = async () => {
    try {
      await account.deleteSession('current');
    } finally {
      clearPersistedSession();
      router.push('/');
    }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--muted)' }}>กำลังโหลด...</p>
    </div>
  );

  const role = (prefs.role || 'user') as string;
  const roleInfo = ROLE_INFO[role] ?? ROLE_INFO.user;
  const firstName = prefs.firstName || '', lastName = prefs.lastName || '';
  const phone = prefs.phone || '', address = prefs.address || '';
  const initials = (displayName || 'U').slice(0, 2).toUpperCase();
  const sellerStatus = prefs.sellerStatus || '', middlemanStatus = prefs.middlemanStatus || '';

  function StatusBadge({ status }: { status: string }) {
    if (status === 'approved') return <span className="pf-status-badge pf-status-approved">✅ อนุมัติแล้ว</span>;
    if (status === 'pending_review') return <span className="pf-status-badge pf-status-pending">⏳ รอตรวจสอบ</span>;
    if (status === 'rejected') return <span className="pf-status-badge pf-status-rejected">❌ ไม่อนุมัติ</span>;
    return <span className="pf-status-badge pf-status-pending">{status}</span>;
  }

  return (
    <div className="sub-page">
      <header className="sub-header">
        <Link href="/" className="sub-back"><Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} /></Link>
        <span className="sub-htitle" style={{ flex: 1 }}>โปรไฟล์ของฉัน</span>
        {!editing
          ? <button className="btn btn-ghost btn-sm" onClick={openEdit}><Icon name="user" size={14} /> แก้ไข</button>
          : <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>ยกเลิก</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            </div>}
      </header>

      <div className="pf-inner">
        <div className="pf-hero">
          <div className="pf-avatar">{initials}</div>
          <div className="pf-hero-info">
            <div className="pf-name">{displayName || 'ผู้ใช้งาน'}</div>
            {email && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{email}</div>}
            <div className="pf-badges">
              <span className={`pf-role-badge ${roleInfo.cls}`}>{roleInfo.label}</span>
              {sellerStatus === 'approved' && <span className="pf-role-badge pf-role-seller">🛒 ผู้ขาย</span>}
              {middlemanStatus === 'approved' && <span className="pf-role-badge pf-role-middleman">🤝 คนกลาง</span>}
            </div>
          </div>
        </div>

        {/* Personal info */}
        <div className="pf-card">
          <div className="pf-card-title">ข้อมูลส่วนตัว</div>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>ชื่อ *</div><input className="pf-edit-input" value={editFirst} onChange={e => setEditFirst(e.target.value)} placeholder="ชื่อ" /></div>
                <div><div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>นามสกุล *</div><input className="pf-edit-input" value={editLast} onChange={e => setEditLast(e.target.value)} placeholder="นามสกุล" /></div>
              </div>
              <div><div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>เบอร์โทรศัพท์ *</div><input className="pf-edit-input" value={editPhone} onChange={e => setEditPhone(e.target.value.replace(/\D/g, ''))} placeholder="0812345678" maxLength={10} inputMode="numeric" /></div>
              <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>ที่อยู่</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <input className="pf-edit-input" value={editAddr.houseNo} onChange={e => setEditAddr(a => ({ ...a, houseNo: e.target.value }))} placeholder="บ้านเลขที่" />
                  <input className="pf-edit-input" value={editAddr.moo} onChange={e => setEditAddr(a => ({ ...a, moo: e.target.value }))} placeholder="หมู่" />
                  <input className="pf-edit-input" value={editAddr.road} onChange={e => setEditAddr(a => ({ ...a, road: e.target.value }))} placeholder="ถนน" />
                </div>
                <select className="pf-edit-input" style={{ marginBottom: 10 }} value={editAddr.provinceName} onChange={e => onProvince(e.target.value)}>
                  <option value="">เลือกจังหวัด</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select className="pf-edit-input" style={{ marginBottom: 10 }} value={editAddr.amphoreName} onChange={e => onAmphoe(e.target.value)} disabled={!editAddr.provinceName || loadingAmph}>
                  <option value="">{loadingAmph ? 'กำลังโหลด...' : editAddr.provinceName ? 'เลือกอำเภอ' : '— เลือกจังหวัดก่อน —'}</option>
                  {amphoes.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <select className="pf-edit-input" value={editAddr.tambonName ? `${editAddr.tambonName}|${editAddr.postalCode}` : ''} onChange={e => onTambon(e.target.value)} disabled={!editAddr.amphoreName || loadingTamb}>
                    <option value="">{loadingTamb ? 'กำลังโหลด...' : editAddr.amphoreName ? 'เลือกตำบล' : '— เลือกอำเภอก่อน —'}</option>
                    {tambons.map(([n, z]) => <option key={n} value={`${n}|${z}`}>{n}</option>)}
                  </select>
                  <input readOnly className="pf-edit-input" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }} value={editAddr.postalCode} placeholder="รหัสไปรษณีย์" />
                </div>
              </div>
              {error && <div style={{ color: '#b22441', fontSize: 13, background: '#fdeef1', border: '1px solid #fbd5dd', borderRadius: 'var(--r-sm)', padding: '9px 14px' }}>⚠️ {error}</div>}
              {saveOk && <div style={{ color: 'var(--green-700)', fontSize: 13, background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 'var(--r-sm)', padding: '9px 14px' }}>✅ บันทึกสำเร็จ!</div>}
            </div>
          ) : (
            [['ชื่อ-นามสกุล', `${firstName} ${lastName}`.trim() || '—'], ['อีเมล', email || '—'], ['เบอร์โทร', phone || '—'], ['ที่อยู่', address || '—']].map(([l, v]) => (
              <div key={l} className="pf-row"><span className="pf-row-lbl">{l}</span><span className="pf-row-val" style={{ maxWidth: '62%', wordBreak: 'break-word' }}>{v}</span></div>
            ))
          )}
        </div>

        {/* Application status */}
        {(sellerStatus || middlemanStatus) && (
          <div className="pf-card">
            <div className="pf-card-title">สถานะการสมัคร</div>
            {sellerStatus && <div className="pf-row"><span className="pf-row-lbl">ผู้ขาย 🛒</span><StatusBadge status={sellerStatus} /></div>}
            {middlemanStatus && <div className="pf-row"><span className="pf-row-lbl">คนกลาง 🤝</span><StatusBadge status={middlemanStatus} /></div>}
          </div>
        )}

        {/* Bank info */}
        {(prefs.bankAcct || prefs.bankName) && (
          <div className="pf-card">
            <div className="pf-card-title">บัญชีธนาคาร</div>
            {prefs.bankName && <div className="pf-row"><span className="pf-row-lbl">ธนาคาร</span><span className="pf-row-val">{prefs.bankName}</span></div>}
            {prefs.bankAcct && <div className="pf-row"><span className="pf-row-lbl">เลขที่บัญชี</span><span className="pf-row-val mono">{prefs.bankAcct}</span></div>}
            {prefs.bankOwner && <div className="pf-row"><span className="pf-row-lbl">ชื่อบัญชี</span><span className="pf-row-val">{prefs.bankOwner}</span></div>}
          </div>
        )}

        {/* Quick links / upgrade */}
        <div className="pf-links">
          {sellerStatus === 'approved' && (
            <Link href="/dashboard/seller" className="pf-link">
              <div className="pf-link-left"><div className="pf-link-icon" style={{ background: 'var(--blue-50)' }}>🛒</div><div><span className="pf-link-t">บอร์ดผู้ขาย</span><span className="pf-link-d">จัดการประกาศและดีลของคุณ</span></div></div>
              <span style={{ color: 'var(--faint)', fontSize: 18 }}>›</span>
            </Link>
          )}
          {middlemanStatus === 'approved' && (
            <Link href="/dashboard/middleman" className="pf-link">
              <div className="pf-link-left"><div className="pf-link-icon" style={{ background: 'var(--green-50)' }}>🤝</div><div><span className="pf-link-t">บอร์ดคนกลาง</span><span className="pf-link-d">ดีลที่คุณกำลังดูแลอยู่</span></div></div>
              <span style={{ color: 'var(--faint)', fontSize: 18 }}>›</span>
            </Link>
          )}
          {role !== 'seller' && role !== 'middleman' && !sellerStatus && (
            <Link href="/register/seller" className="pf-link">
              <div className="pf-link-left"><div className="pf-link-icon" style={{ background: 'var(--blue-50)' }}>🛒</div><div><span className="pf-link-t">สมัครเป็นผู้ขาย</span><span className="pf-link-d">เปิดร้านและขายผ่านระบบคนกลาง</span></div></div>
              <span style={{ color: 'var(--faint)', fontSize: 18 }}>›</span>
            </Link>
          )}
          {!middlemanStatus && (
            <Link href="/register/middleman" className="pf-link">
              <div className="pf-link-left"><div className="pf-link-icon" style={{ background: 'var(--green-50)' }}>🤝</div><div><span className="pf-link-t">สมัครเป็นคนกลาง</span><span className="pf-link-d">รับงานตัวกลาง มีรายได้เพิ่ม</span></div></div>
              <span style={{ color: 'var(--faint)', fontSize: 18 }}>›</span>
            </Link>
          )}
          <Link href="/check-scam" className="pf-link">
            <div className="pf-link-left"><div className="pf-link-icon" style={{ background: '#fef5e3' }}>🛡️</div><div><span className="pf-link-t">เช็คคนโกง</span><span className="pf-link-d">ตรวจสอบประวัติก่อนทำธุรกรรม</span></div></div>
            <span style={{ color: 'var(--faint)', fontSize: 18 }}>›</span>
          </Link>
        </div>

        <button className="pf-logout" onClick={logout}><Icon name="logout" size={16} /> ออกจากระบบ</button>
      </div>
    </div>
  );
}

export default function ProfilePageWrapper() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: 'var(--muted)' }}>กำลังโหลด...</p></div>}>
      <ProfilePage />
    </Suspense>
  );
}
