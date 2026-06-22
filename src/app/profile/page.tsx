'use client';
/* eslint-disable @next/next/no-img-element */

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { Icon } from '@/components/Icon';
import { THAI_BANKS } from '@/lib/banks';
import { isProfileComplete } from '@/lib/profileComplete';

const qrUrl = (id: string) => fileViewUrl(DEAL_BUCKET, id);

const PROVINCES = ['กระบี่','กรุงเทพมหานคร','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี'];

const ROLE_INFO: Record<string, { label: string; cls: string }> = {
  admin:     { label: 'ผู้ดูแลระบบ', cls: 'pf-role-middleman' },
  middleman: { label: 'คนกลาง',     cls: 'pf-role-middleman' },
  seller:    { label: 'ผู้ขาย',     cls: 'pf-role-seller' },
  user:      { label: 'ผู้ใช้งาน', cls: 'pf-role-user' },
};

interface MiddlemanWallet {
  tier: string;
  credit_limit: number;
  available_credit: number;
  held_credit: number;
  released_credit: number;
  penalty_credit: number;
  active_deal_count: number;
  updated_at: string;
}

interface LedgerEntry {
  entry_key: string;
  purpose: string;
  amount: number;
  status: string;
  deal_number?: string;
}

const LEDGER_STATUS: Record<string, string> = {
  expected: 'รอเริ่ม',
  held: 'กำลัง hold',
  released: 'ปลดแล้ว',
  forfeited: 'ถูกหัก',
  scheduled: 'รอจ่าย',
  paid: 'จ่ายแล้ว',
};

function baht(amount: number) {
  return `฿${Number(amount || 0).toLocaleString()}`;
}

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

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return <span className="pf-status-badge pf-status-approved">✅ อนุมัติแล้ว</span>;
  if (status === 'pending_review') return <span className="pf-status-badge pf-status-pending">⏳ รอตรวจสอบ</span>;
  if (status === 'rejected') return <span className="pf-status-badge pf-status-rejected">❌ ไม่อนุมัติ</span>;
  return <span className="pf-status-badge pf-status-pending">{status}</span>;
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
  const [editBankName, setEditBankName] = useState('');
  const [editBankAcct, setEditBankAcct] = useState('');
  const [editBankOwner, setEditBankOwner] = useState('');
  const [editBankQr, setEditBankQr] = useState('');
  const [qrUploading, setQrUploading] = useState(false);
  const [amphoes, setAmphoes] = useState<string[]>([]);
  const [tambons, setTambons] = useState<[string, string][]>([]);
  const [loadingAmph, setLoadingAmph] = useState(false);
  const [loadingTamb, setLoadingTamb] = useState(false);
  const [wallet, setWallet] = useState<MiddlemanWallet | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0');
    r.style.setProperty('--accent-strong', '#1f54d6');
    r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/login'); return; }
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        let p = (profile || {}) as Record<string, string>;
        setDisplayName(p.display_name || '');
        const em = (!user.email || user.email.includes('@line.khonklang.app')) ? '' : user.email;
        setEmail(em);
        setPrefs(p);
        // ข้อมูลบังคับ (ชื่อ-นามสกุล-เบอร์-บัญชีธนาคาร) ยังไม่ครบ — บังคับเข้าโหมดกรอกข้อมูลทันที
        // ไม่ต้องให้กดปุ่ม "แก้ไข" เอง
        if (!isProfileComplete(p)) openEditWith(p);
        try {
          const headers = await authHeaders();
          const [sellerRes, middlemanRes, profileRes] = await Promise.all([
            fetch('/api/register/seller', { headers }).catch(() => null),
            fetch('/api/register/middleman', { headers }).catch(() => null),
            fetch('/api/profile', { headers }).catch(() => null),
          ]);
          const sellerData = sellerRes?.ok ? await sellerRes.json() : null;
          const middlemanData = middlemanRes?.ok ? await middlemanRes.json() : null;
          const profileData = profileRes?.ok ? await profileRes.json() : null;
          let synced = false;
          if (sellerData?.status && sellerData.status !== p.seller_status) { p = { ...p, seller_status: sellerData.status }; synced = true; }
          if (middlemanData?.status && middlemanData.status !== p.middleman_status) { p = { ...p, middleman_status: middlemanData.status }; synced = true; }
          if (synced) setPrefs(p);
          setWallet(profileData?.wallet || null);
          setLedger(profileData?.ledger || []);
        } catch { /* best-effort */ }
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const openEditWith = (p: Record<string, string>) => {
    setEditFirst(p.first_name || ''); setEditLast(p.last_name || '');
    setEditPhone(p.phone || ''); setEditAddr(parseAddress(p.address || ''));
    setEditBankName(p.bank_name || ''); setEditBankAcct(p.bank_acct || '');
    setEditBankOwner(p.bank_owner || ''); setEditBankQr(p.bank_qr_file_id || '');
    setError(''); setSaveOk(false); setEditing(true);
  };
  const openEdit = () => openEditWith(prefs);
  // ข้อมูลบังคับยังไม่ครบ — ต้องล็อกหน้าไว้ในโหมดกรอกข้อมูล ซ่อนทางออกทั้งหมดจนกว่าจะบันทึกสำเร็จ
  const locked = !isProfileComplete(prefs);

  async function uploadBankQr(file: File) {
    setQrUploading(true);
    try {
      const headers = await authHeaders();
      const form = new FormData(); form.append('file', file);
      const r = await fetch('/api/upload-deal', { method: 'POST', headers, body: form });
      const d = await r.json();
      if (r.ok && d.fileId) setEditBankQr(d.fileId);
      else setError(d.error || 'อัปโหลด QR ไม่สำเร็จ');
    } catch { setError('อัปโหลด QR ไม่สำเร็จ'); }
    finally { setQrUploading(false); }
  }
  const cancelEdit = () => {
    if (locked) return; // ข้อมูลบังคับยังไม่ครบ — ห้ามยกเลิกออกจากโหมดกรอกข้อมูล
    setEditing(false); setError('');
  };

  useEffect(() => {
    if (!editAddr.provinceName) return;
    const timer = window.setTimeout(() => {
      setLoadingAmph(true);
      fetch(`/api/thai-address?type=amphures&province=${encodeURIComponent(editAddr.provinceName)}`)
        .then(r => r.json()).then(d => setAmphoes(Array.isArray(d) ? d : [])).catch(() => setAmphoes([])).finally(() => setLoadingAmph(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editAddr.provinceName]);

  useEffect(() => {
    if (!editAddr.amphoreName || !editAddr.provinceName) return;
    const timer = window.setTimeout(() => {
      setLoadingTamb(true);
      fetch(`/api/thai-address?type=tambons&province=${encodeURIComponent(editAddr.provinceName)}&amphoe=${encodeURIComponent(editAddr.amphoreName)}`)
        .then(r => r.json()).then(d => setTambons(Array.isArray(d) ? d : [])).catch(() => setTambons([])).finally(() => setLoadingTamb(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editAddr.provinceName, editAddr.amphoreName]);


  const availableAmphoes = editAddr.provinceName ? amphoes : [];
  const availableTambons = editAddr.provinceName && editAddr.amphoreName ? tambons : [];

  const onProvince = (name: string) => setEditAddr({ houseNo: editAddr.houseNo, moo: editAddr.moo, road: editAddr.road, provinceName: name, amphoreName: '', tambonName: '', postalCode: '' });
  const onAmphoe = (name: string) => setEditAddr(a => ({ ...a, amphoreName: name, tambonName: '', postalCode: '' }));
  const onTambon = (val: string) => { const [n, z] = val.split('|'); setEditAddr(a => ({ ...a, tambonName: n, postalCode: z })); };

  const handleSave = async () => {
    if (!editBankName.trim() || !editBankAcct.trim() || !editBankOwner.trim()) {
      return setError('กรุณากรอกข้อมูลบัญชีธนาคารให้ครบ (ธนาคาร, เลขที่บัญชี, ชื่อบัญชี) — จำเป็นสำหรับรับเงินจากระบบ');
    }
    if (!editFirst.trim() || !editLast.trim()) return setError('กรุณากรอกชื่อ-นามสกุล');
    if (!editPhone.trim()) return setError('กรุณากรอกเบอร์โทรศัพท์');
    const wasLocked = locked;
    setSaving(true); setError('');
    try {
      const headers = await authHeaders();
      const address = buildAddress(editAddr);
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: editFirst, lastName: editLast, phone: editPhone, address, bankName: editBankName, bankAcct: editBankAcct, bankOwner: editBankOwner, bankQrFileId: editBankQr }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'เกิดข้อผิดพลาด'); return; }
      const newPrefs = { ...prefs, first_name: editFirst, last_name: editLast, phone: editPhone, address, display_name: `${editFirst} ${editLast}`.trim(), bank_name: editBankName, bank_acct: editBankAcct, bank_owner: editBankOwner, bank_qr_file_id: editBankQr };
      setPrefs(newPrefs); setDisplayName(`${editFirst} ${editLast}`.trim()); setSaveOk(true);
      if (wasLocked) {
        // กรอกข้อมูลบังคับครบแล้วเป็นครั้งแรก — ปลดล็อกให้เข้าใช้งานเว็บไซต์ส่วนอื่นได้
        setTimeout(() => { router.replace('/'); }, 1200);
      } else {
        setTimeout(() => { setEditing(false); setSaveOk(false); }, 1200);
      }
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); } finally { setSaving(false); }
  };

  const logout = async () => {
    await supabase.auth.signOut().catch(() => null);
    router.push('/');
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--muted)' }}>กำลังโหลด...</p>
    </div>
  );

  const role = (prefs.role || 'user') as string;
  const roleInfo = ROLE_INFO[role] ?? ROLE_INFO.user;
  const firstName = prefs.first_name || '', lastName = prefs.last_name || '';
  const phone = prefs.phone || '', address = prefs.address || '';
  const initials = (displayName || 'U').slice(0, 2).toUpperCase();
  const sellerStatus = prefs.seller_status || '', middlemanStatus = prefs.middleman_status || '';

  return (
    <div className="sub-page">
      <header className="sub-header">
        {locked
          ? <span style={{ width: 18, display: 'inline-block' }} />
          : <Link href="/" className="sub-back"><Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} /></Link>}
        <span className="sub-htitle" style={{ flex: 1 }}>{locked ? 'กรอกข้อมูลให้ครบเพื่อใช้งานเว็บไซต์' : 'โปรไฟล์ของฉัน'}</span>
        {!editing
          ? <button className="btn btn-ghost btn-sm" onClick={openEdit}><Icon name="user" size={14} /> แก้ไข</button>
          : <div style={{ display: 'flex', gap: 8 }}>
              {!locked && <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>ยกเลิก</button>}
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

        {locked && (
          <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 'var(--r-md)', padding: '12px 14px', fontSize: 13, color: '#7a5c00' }}>
            ⚠️ กรุณากรอกข้อมูลบัญชีธนาคารและข้อมูลส่วนตัวให้ครบก่อนใช้งานเว็บไซต์ — ระบบจะปลดล็อกให้เข้าหน้าอื่นได้ทันทีหลังบันทึกสำเร็จ
          </div>
        )}

        {/* Bank info — บัญชีรับเงินของผู้ใช้ (แก้ไขได้ทุก role) — ขึ้นก่อนเพราะสำคัญที่สุด */}
        <div className="pf-card">
          <div className="pf-card-title">บัญชีธนาคาร (สำหรับรับเงิน)</div>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select className="pf-edit-input" value={editBankName} onChange={e => setEditBankName(e.target.value)}>
                <option value="">เลือกธนาคาร</option>
                {THAI_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <input className="pf-edit-input" value={editBankAcct} onChange={e => setEditBankAcct(e.target.value)} placeholder="เลขที่บัญชี" />
              <input className="pf-edit-input" value={editBankOwner} onChange={e => setEditBankOwner(e.target.value)} placeholder="ชื่อบัญชี" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {editBankQr && <img src={qrUrl(editBankQr)} alt="QR" style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--line)' }} />}
                <label className="btn btn-soft btn-sm" style={{ cursor: 'pointer' }}>
                  {qrUploading ? 'กำลังอัปโหลด...' : editBankQr ? '🖼️ เปลี่ยนรูป QR' : '🖼️ อัปโหลดรูป QR (พร้อมเพย์)'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadBankQr(f); e.target.value = ''; }} />
                </label>
                {editBankQr && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditBankQr('')}>ลบรูป</button>}
              </div>
            </div>
          ) : (
            (prefs.bank_acct || prefs.bank_name || prefs.bank_qr_file_id) ? (
              <>
                {prefs.bank_name && <div className="pf-row"><span className="pf-row-lbl">ธนาคาร</span><span className="pf-row-val">{prefs.bank_name}</span></div>}
                {prefs.bank_acct && <div className="pf-row"><span className="pf-row-lbl">เลขที่บัญชี</span><span className="pf-row-val mono">{prefs.bank_acct}</span></div>}
                {prefs.bank_owner && <div className="pf-row"><span className="pf-row-lbl">ชื่อบัญชี</span><span className="pf-row-val">{prefs.bank_owner}</span></div>}
                {prefs.bank_qr_file_id && <div style={{ marginTop: 10 }}><img src={qrUrl(prefs.bank_qr_file_id)} alt="QR พร้อมเพย์" style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--line)' }} /></div>}
              </>
            ) : (
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>ยังไม่ได้กรอกบัญชีรับเงิน — กด &quot;แก้ไข&quot; เพื่อเพิ่มบัญชีและรูป QR สำหรับรับเงิน</p>
            )
          )}
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
                  {availableAmphoes.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <select className="pf-edit-input" value={editAddr.tambonName ? `${editAddr.tambonName}|${editAddr.postalCode}` : ''} onChange={e => onTambon(e.target.value)} disabled={!editAddr.amphoreName || loadingTamb}>
                    <option value="">{loadingTamb ? 'กำลังโหลด...' : editAddr.amphoreName ? 'เลือกตำบล' : '— เลือกอำเภอก่อน —'}</option>
                    {availableTambons.map(([n, z]) => <option key={n} value={`${n}|${z}`}>{n}</option>)}
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

        {editing && (
          <div style={{ display: 'flex', gap: 8, marginTop: -8 }}>
            {!locked && <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={cancelEdit}>ยกเลิก</button>}
            <button className="btn btn-primary" style={{ flex: 2, padding: '12px' }} onClick={handleSave} disabled={saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </div>
        )}

        {/* Application status */}
        {!locked && (sellerStatus || middlemanStatus) && (
          <div className="pf-card">
            <div className="pf-card-title">สถานะการสมัคร</div>
            {sellerStatus && <div className="pf-row"><span className="pf-row-lbl">ผู้ขาย 🛒</span><StatusBadge status={sellerStatus} /></div>}
            {middlemanStatus && <div className="pf-row"><span className="pf-row-lbl">คนกลาง 🤝</span><StatusBadge status={middlemanStatus} /></div>}
          </div>
        )}

        {!locked && wallet && (
          <div className="pf-card">
            <div className="pf-card-title">Middleman Credit Wallet</div>
            <div className="pf-row"><span className="pf-row-lbl">Tier</span><span className="pf-row-val">{wallet.tier}</span></div>
            <div className="pf-row"><span className="pf-row-lbl">วงเงินเครดิต</span><span className="pf-row-val">{baht(wallet.credit_limit)}</span></div>
            <div className="pf-row"><span className="pf-row-lbl">เครดิตคงเหลือ</span><span className="pf-row-val" style={{ color: 'var(--green-700)' }}>{baht(wallet.available_credit)}</span></div>
            <div className="pf-row"><span className="pf-row-lbl">เครดิตที่ hold</span><span className="pf-row-val">{baht(wallet.held_credit)}</span></div>
            <div className="pf-row"><span className="pf-row-lbl">เครดิตปลดแล้ว</span><span className="pf-row-val">{baht(wallet.released_credit)}</span></div>
            <div className="pf-row"><span className="pf-row-lbl">เครดิตถูกหัก</span><span className="pf-row-val">{baht(wallet.penalty_credit)}</span></div>
            <div className="pf-row"><span className="pf-row-lbl">ดีล/งานที่ lock เครดิต</span><span className="pf-row-val">{wallet.active_deal_count}</span></div>
            <div className="pf-row"><span className="pf-row-lbl">อัปเดตล่าสุด</span><span className="pf-row-val">{new Date(wallet.updated_at).toLocaleString('th-TH')}</span></div>
            {ledger.length > 0 && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--line-2)', paddingTop: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>รายการเครดิตล่าสุด</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {ledger.slice(0, 4).map(item => (
                    <div key={item.entry_key} className="pf-row" style={{ alignItems: 'flex-start' }}>
                      <span className="pf-row-lbl">{item.deal_number || 'รายการเครดิต'}</span>
                      <span className="pf-row-val" style={{ maxWidth: '62%', textAlign: 'right' }}>
                        <span style={{ display: 'block', fontWeight: 700 }}>{item.purpose}</span>
                        <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>{baht(item.amount)} · {LEDGER_STATUS[item.status] || item.status}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick links / upgrade */}
        {!locked && <div className="pf-links">
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
        </div>}

        <button className="pf-logout" onClick={logout}><Icon name="logout" size={16} /> ออกจากระบบ</button>

        {/* PDPA: สิทธิ์ขอลบข้อมูลส่วนบุคคล */}
        {!locked && <button
          onClick={() => {
            const subject = encodeURIComponent('ขอลบข้อมูลส่วนบุคคล (PDPA)');
            const body = encodeURIComponent('ข้าพเจ้าขอใช้สิทธิ์ลบข้อมูลส่วนบุคคลตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล\nอีเมลบัญชี: ');
            window.location.href = `mailto:runandyaow002@gmail.com?subject=${subject}&body=${body}`;
          }}
          style={{ width: '100%', marginTop: 10, padding: '11px', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', background: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}
        >
          🗑️ ขอลบข้อมูลส่วนบุคคลของฉัน (สิทธิ์ตาม PDPA)
        </button>}
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
