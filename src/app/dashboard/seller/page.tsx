'use client';

import { useEffect, useState, useCallback } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

interface Deal {
  $id: string; sellerId: string; sellerName: string; middlemanId: string; middlemanName: string;
  title: string; description: string; price: number; category: string; condition: string;
  location: string; sellingMode: string; imageFileIds: string; status: string;
  sellerConfirmed: boolean; middlemanConfirmed: boolean; rejectReason: string; createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  posted: 'รอคนกลาง', buyer_joined: 'มีผู้ซื้อ', terms_pending: 'รอยอมรับเงื่อนไข', payment_pending: 'รอโอนเงิน',
  payment_uploaded: 'ตรวจสลิป', packing: 'แพ็คของ', shipped_to_middleman: 'รอคนกลางรับ', middleman_received: 'คนกลางรับแล้ว',
  middleman_checking: 'คนกลางตรวจสินค้า', shipped_to_buyer: 'จัดส่งให้ผู้ซื้อ', delivered: 'รอยืนยันรับ',
  completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก', disputed: 'มีปัญหา',
};
const STATUS_CLS: Record<string, string> = {
  posted: 'sb-blue', buyer_joined: 'sb-teal', terms_pending: 'sb-amber', payment_pending: 'sb-amber', payment_uploaded: 'sb-amber',
  packing: 'sb-purple', shipped_to_middleman: 'sb-teal', middleman_received: 'sb-teal', middleman_checking: 'sb-purple',
  shipped_to_buyer: 'sb-blue', delivered: 'sb-green', completed: 'sb-green', cancelled: 'sb-gray', disputed: 'sb-red',
};
const CATEGORIES = ['สินค้าทั่วไป', 'อิเล็กทรอนิกส์', 'เสื้อผ้า', 'ยานพาหนะ', 'อสังหาริมทรัพย์', 'บริการ', 'อื่นๆ'];
const CONDITIONS = ['ของใหม่', 'มือสองสภาพดี', 'มือสองมีตำหนิ'];
const PROVINCES = ['กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี'];

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const BUCKET_ID = 'deal_files';
function imgUrl(fileId: string) { return `${ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileId}/view?project=${PROJECT}`; }

interface UploadedImage { fileId: string; url: string; name: string; }

export default function SellerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tab, setTab] = useState<'active' | 'post' | 'history'>('active');
  const [myId, setMyId] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [location, setLocation] = useState('');
  const [sellingMode, setSellingMode] = useState<'normal' | 'certified'>('normal');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [postDone, setPostDone] = useState(false);

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0'); r.style.setProperty('--accent-strong', '#1f54d6'); r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);

  const fetchDeals = useCallback(async (jwt: string) => {
    const res = await fetch('/api/deals?role=seller', { headers: { 'x-session-jwt': jwt } }).catch(() => null);
    if (res?.ok) { const data = await res.json(); setDeals(data.deals || []); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await account.get();
        const prefs = user.prefs as Record<string, string>;
        if (prefs.sellerStatus !== 'approved') { router.replace('/register/seller'); return; }
        setMyId(user.$id);
        const jwt = (await account.createJWT()).jwt;
        await fetchDeals(jwt);
      } catch { router.replace('/login'); }
      finally { setLoading(false); }
    })();
  }, [router, fetchDeals]);

  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const jwt = (await account.createJWT()).jwt;
      const uploaded: UploadedImage[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch('/api/upload-deal', { method: 'POST', headers: { 'x-session-jwt': jwt }, body: fd });
        if (res.ok) { const d = await res.json(); uploaded.push({ fileId: d.fileId, url: d.url, name: file.name }); }
      }
      setImages(prev => [...prev, ...uploaded]);
    } finally { setUploading(false); }
  }
  function removeImage(fileId: string) { setImages(prev => prev.filter(i => i.fileId !== fileId)); }

  async function handlePost() {
    if (!title || !price) { setPostError('กรุณากรอกชื่อสินค้าและราคา'); return; }
    if (!condition) { setPostError('กรุณาเลือกสภาพสินค้า'); return; }
    setPosting(true); setPostError('');
    try {
      const jwt = (await account.createJWT()).jwt;
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, price: Number(price), category, condition, location, sellingMode, imageFileIds: images.map(i => i.fileId), creatorRole: 'seller' }),
      });
      if (!res.ok) { const d = await res.json(); setPostError(d.error || 'เกิดข้อผิดพลาด'); return; }
      setPostDone(true);
      setTitle(''); setDescription(''); setPrice(''); setCategory(''); setCondition(''); setLocation(''); setSellingMode('normal'); setImages([]);
      await fetchDeals(jwt);
      setTimeout(() => { setPostDone(false); setTab('active'); }, 1800);
    } finally { setPosting(false); }
  }

  const ACTIVE_STATUSES = ['posted', 'buyer_joined', 'terms_pending', 'payment_pending', 'payment_uploaded', 'packing', 'shipped_to_middleman', 'middleman_received', 'middleman_checking', 'shipped_to_buyer', 'delivered'];
  const DONE_STATUSES = ['completed', 'cancelled', 'disputed'];
  const activeDeals = deals.filter(d => d.sellerId === myId && ACTIVE_STATUSES.includes(d.status));
  const historyDeals = deals.filter(d => d.sellerId === myId && DONE_STATUSES.includes(d.status));
  const totalRev = historyDeals.filter(d => d.status === 'completed').reduce((s, d) => s + (d.price || 0), 0);

  if (loading) return (
    <div className="dash-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'dashSpin .8s linear infinite' }} />
    </div>
  );

  function DealCard({ deal }: { deal: Deal }) {
    let firstImg = '';
    try { const ids = JSON.parse(deal.imageFileIds || '[]'); if (ids.length) firstImg = imgUrl(ids[0]); } catch {}
    return (
      <div className="deal-card">
        <div className="deal-card-header">
          <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 0 }}>
            {firstImg && <img src={firstImg} alt="" style={{ width: 56, height: 56, borderRadius: 'var(--r-md)', objectFit: 'cover', flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="deal-card-title">{deal.title}</div>
              <div className="deal-card-meta">
                <span className="deal-card-price">฿{(deal.price || 0).toLocaleString()}</span>
                {deal.condition && <span>{deal.condition}</span>}
                {deal.location && <span>📍 {deal.location}</span>}
                {deal.sellingMode === 'certified' && <span style={{ color: 'var(--amber-500)', fontWeight: 700 }}>⭐ Certified</span>}
              </div>
            </div>
          </div>
          <span className={`sb ${STATUS_CLS[deal.status] || 'sb-gray'}`}>{STATUS_LABEL[deal.status] || deal.status}</span>
        </div>
        <Link href={`/deal/${deal.$id}`} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>💬 เข้าห้องดีล →</Link>
      </div>
    );
  }

  return (
    <div className="dash-root">
      <header className="dash-header">
        <button onClick={() => router.back()} className="dash-back"><Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} /></button>
        <div className="dash-head-info"><div className="dash-head-title">🛒 บอร์ดผู้ขาย</div></div>
        <div className="dash-head-actions"><button className="btn btn-primary btn-sm" onClick={() => setTab('post')}>+ ลงประกาศ</button></div>
      </header>

      <nav className="dash-tabs-wrap">
        {([{ k: 'active', l: `กำลังขาย (${activeDeals.length})` }, { k: 'post', l: '+ ลงประกาศ' }, { k: 'history', l: `ประวัติ (${historyDeals.length})` }] as const).map(({ k, l }) => (
          <button key={k} className={`dash-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>

      <main className="dash-body">
        {tab !== 'post' && (
          <div className="dash-stats">
            <div className="dash-stat"><div className="dash-stat-val">{activeDeals.length}</div><div className="dash-stat-lbl">กำลังขาย</div></div>
            <div className="dash-stat"><div className="dash-stat-val">{historyDeals.filter(d => d.status === 'completed').length}</div><div className="dash-stat-lbl">เสร็จสิ้น</div></div>
            <div className="dash-stat"><div className="dash-stat-val" style={{ fontSize: 17 }}>฿{totalRev.toLocaleString()}</div><div className="dash-stat-lbl">รายได้รวม</div></div>
          </div>
        )}

        {tab === 'active' && (activeDeals.length === 0 ? (
          <div className="dash-empty">
            <div className="dash-empty-icon">📦</div>
            <p>ยังไม่มีประกาศที่กำลังดำเนินการ</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setTab('post')}>+ ลงประกาศใหม่</button>
          </div>
        ) : activeDeals.map(d => <DealCard key={d.$id} deal={d} />))}

        {tab === 'post' && (
          <div className="form-section">
            <h3 style={{ marginBottom: 20 }}>ลงประกาศสินค้าใหม่</h3>
            {postDone && <div style={{ background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 'var(--r-md)', padding: '10px 16px', marginBottom: 18, color: 'var(--green-700)', fontWeight: 600 }}>✅ ลงประกาศสำเร็จ!</div>}
            {postError && <div style={{ background: '#fdeef1', border: '1px solid #fbd5dd', borderRadius: 'var(--r-md)', padding: '10px 16px', marginBottom: 18, color: '#b22441' }}>⚠️ {postError}</div>}

            <div className="form-field">
              <label>รูปภาพสินค้า</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {images.map(img => (
                  <div key={img.fileId} style={{ position: 'relative' }}>
                    <img src={img.url} alt={img.name} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--r-md)' }} />
                    <button onClick={() => removeImage(img.fileId)} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', background: 'var(--rose-500)', color: '#fff', border: 'none', fontSize: 14, cursor: 'pointer' }}>×</button>
                  </div>
                ))}
                <label className="img-upload-box" style={{ width: 80, height: 80, padding: 0, margin: 0 }}>
                  <span style={{ fontSize: 22 }}>{uploading ? '⏳' : '📷'}</span>
                  <span style={{ fontSize: 11 }}>{uploading ? 'กำลังอัป...' : 'เพิ่มรูป'}</span>
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleImageUpload(e.target.files)} />
                </label>
              </div>
            </div>

            <div className="form-field">
              <label>ชื่อสินค้า / บริการ *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="เช่น iPhone 15 Pro Max 256GB สีดำ" />
            </div>

            <div className="form-row-2">
              <div className="form-field" style={{ margin: 0 }}>
                <label>ราคา (บาท) *</label>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" min="0" />
              </div>
              <div className="form-field" style={{ margin: 0 }}>
                <label>หมวดหมู่</label>
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">เลือก...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-field">
              <label>สภาพสินค้า *</label>
              <div className="cond-chips">
                {CONDITIONS.map(c => (
                  <button key={c} type="button" className={`cond-chip${condition === c ? ' sel' : ''}`} onClick={() => setCondition(c)}>{c}</button>
                ))}
              </div>
            </div>

            <div className="form-field">
              <label>จังหวัดที่ตั้งสินค้า</label>
              <select value={location} onChange={e => setLocation(e.target.value)}>
                <option value="">เลือกจังหวัด...</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="form-field">
              <label>รูปแบบการขาย</label>
              <div className="mode-opts">
                <div className={`mode-opt${sellingMode === 'normal' ? ' sel' : ''}`} onClick={() => setSellingMode('normal')}>
                  <div className="mode-opt-icon">🏪</div>
                  <div><div className="mode-opt-t">ลงขายปกติ</div><div className="mode-opt-d">ผู้ซื้อเลือกคนกลางเอง ค่าธรรมเนียมมาตรฐาน</div></div>
                </div>
                <div className={`mode-opt${sellingMode === 'certified' ? ' sel' : ''}`} onClick={() => setSellingMode('certified')}>
                  <div className="mode-opt-icon">⭐</div>
                  <div><div className="mode-opt-t">Khonklang Certified</div><div className="mode-opt-d">คนกลางตรวจสอบสินค้าก่อนส่ง เพิ่มความน่าเชื่อถือ</div></div>
                </div>
              </div>
            </div>

            <div className="form-field">
              <label>รายละเอียดเพิ่มเติม</label>
              <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="รายละเอียดสินค้า สภาพ อุปกรณ์ที่มา เงื่อนไข..." />
            </div>

            <button className="btn btn-primary btn-block" style={{ marginTop: 4 }} onClick={handlePost} disabled={posting || postDone || uploading}>
              {posting ? 'กำลังลงประกาศ...' : 'ลงประกาศ'}
            </button>
          </div>
        )}

        {tab === 'history' && (historyDeals.length === 0 ? <div className="dash-empty"><p>ยังไม่มีประวัติการขาย</p></div> : historyDeals.map(d => <DealCard key={d.$id} deal={d} />))}
      </main>
    </div>
  );
}
