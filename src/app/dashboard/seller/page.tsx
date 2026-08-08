'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useCallback } from 'react';
import { supabase, authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { isCertifiedMode } from '@/lib/listingMode';

interface Deal {
  id: string; seller_id: string; seller_name: string; middleman_id: string; middleman_name: string;
  title: string; description: string; price: number; category: string; condition: string;
  location: string; selling_mode: string; images: string[]; status: string;
  reject_reason: string; created_at: string;
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

function imgUrl(fileId: string) { return fileViewUrl(DEAL_BUCKET, fileId); }

interface UploadedImage { fileId: string; url: string; name: string; }

export default function SellerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tab, setTab] = useState<'post' | 'active' | 'history'>('post');
  const [myId, setMyId] = useState('');

  const [shopName, setShopName] = useState('');
  const [shopLocation, setShopLocation] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPublic, setShopPublic] = useState(false);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopSaved, setShopSaved] = useState(false);
  const [shopError, setShopError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [location, setLocation] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [postDone, setPostDone] = useState(false);

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0'); r.style.setProperty('--accent-strong', '#1f54d6'); r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);

  const fetchDeals = useCallback(async (headers: Record<string, string>) => {
    const res = await fetch('/api/deals?role=seller', { headers }).catch(() => null);
    if (res?.ok) { const data = await res.json(); setDeals(data.deals || []); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/login'); return; }
        const { data: profile } = await supabase.from('profiles').select('seller_status').eq('id', user.id).maybeSingle();
        if (profile?.seller_status !== 'approved') { router.replace('/register/seller'); return; }
        setMyId(user.id);
        const headers = await authHeaders();
        const shopRes = await fetch('/api/seller/shop', { headers }).catch(() => null);
        if (shopRes?.ok) {
          const shopData = await shopRes.json();
          const s = shopData.shop || {};
          setShopName(s.shopName || '');
          setShopLocation(s.shopLocation || '');
          setShopAddress(s.shopAddress || '');
          setShopPublic(Boolean(s.shopPublic));
        }
        await fetchDeals(headers);
      } catch { router.replace('/login'); }
      finally { setLoading(false); }
    })();
  }, [router, fetchDeals]);

  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setPostError('');
    try {
      const headers = await authHeaders();
      const uploaded: UploadedImage[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch('/api/upload-deal', { method: 'POST', headers, body: fd });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(d.error || `อัปโหลดรูปไม่สำเร็จ (${file.name})`);
        }
        uploaded.push({ fileId: d.fileId, url: d.url, name: file.name });
      }
      setImages(prev => [...prev, ...uploaded]);
    } catch (err: unknown) {
      setPostError(err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ');
    } finally { setUploading(false); }
  }
  function removeImage(fileId: string) { setImages(prev => prev.filter(i => i.fileId !== fileId)); }

  async function saveShop() {
    setShopSaving(true);
    setShopSaved(false);
    setShopError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/seller/shop', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopName, shopLocation, shopAddress, shopPublic }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'บันทึกไม่สำเร็จ');
      setShopSaved(true);
      setTimeout(() => setShopSaved(false), 2000);
    } catch (err: unknown) {
      setShopError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setShopSaving(false);
    }
  }

  async function handlePost() {
    if (!title || !price) { setPostError('กรุณากรอกชื่อสินค้าและราคา'); return; }
    if (!condition) { setPostError('กรุณาเลือกสภาพสินค้า'); return; }
    setPosting(true); setPostError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, price: Number(price), category, condition, location, sellingMode: 'direct,escrow,chat', imageFileIds: images.map(i => i.fileId), creatorRole: 'seller', source: 'listing' }),
      });
      if (!res.ok) { const d = await res.json(); setPostError(d.error || 'เกิดข้อผิดพลาด'); return; }
      setPostDone(true);
      setTitle(''); setDescription(''); setPrice(''); setCategory(''); setCondition(''); setLocation(''); setImages([]);
      await fetchDeals(headers);
      setTimeout(() => { setPostDone(false); setTab('active'); }, 1800);
    } catch (err: unknown) {
      setPostError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally { setPosting(false); }
  }

  const ACTIVE_STATUSES = ['posted', 'buyer_joined', 'terms_pending', 'payment_pending', 'payment_uploaded', 'packing', 'shipped_to_middleman', 'middleman_received', 'middleman_checking', 'shipped_to_buyer', 'delivered'];
  const DONE_STATUSES = ['completed', 'cancelled', 'disputed'];
  const activeDeals = deals.filter(d => d.seller_id === myId && ACTIVE_STATUSES.includes(d.status));
  const historyDeals = deals.filter(d => d.seller_id === myId && DONE_STATUSES.includes(d.status));
  const totalRev = historyDeals.filter(d => d.status === 'completed').reduce((s, d) => s + (d.price || 0), 0);

  if (loading) return (
    <div className="dash-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'dashSpin .8s linear infinite' }} />
    </div>
  );

  function DealCard({ deal }: { deal: Deal }) {
    const firstImg = deal.images?.length ? imgUrl(deal.images[0]) : '';
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
                {isCertifiedMode(deal.selling_mode) && <span style={{ color: 'var(--amber-500)', fontWeight: 700 }}>⭐ Certified</span>}
              </div>
            </div>
          </div>
          <span className={`sb ${STATUS_CLS[deal.status] || 'sb-gray'}`}>{STATUS_LABEL[deal.status] || deal.status}</span>
        </div>
        <Link href={deal.status === 'posted' ? `/marketplace/${deal.id}` : `/deal/${deal.id}`} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
          {deal.status === 'posted' ? '📋 ดูประกาศ →' : '💬 เข้าห้องดีล →'}
        </Link>
      </div>
    );
  }

  return (
    <div className="dash-root">
      <header className="dash-header">
        <button onClick={() => router.back()} className="dash-back"><Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} /></button>
        <div className="dash-head-info"><div className="dash-head-title">🏪 ร้านของฉัน</div></div>
        <div className="dash-head-actions"><button className="btn btn-primary btn-sm" onClick={() => setTab('post')}>+ ลงขาย</button></div>
      </header>

      <section className="dash-body" style={{ paddingBottom: 0 }}>
        <div className="form-section" style={{ marginBottom: 0 }}>
          <h3 style={{ marginBottom: 12 }}>ข้อมูลร้าน</h3>
          {shopError && <div style={{ background: '#fdeef1', border: '1px solid #fbd5dd', borderRadius: 'var(--r-md)', padding: '10px 16px', marginBottom: 14, color: '#b22441' }}>⚠️ {shopError}</div>}
          {shopSaved && <div style={{ background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 'var(--r-md)', padding: '10px 16px', marginBottom: 14, color: 'var(--green-700)', fontWeight: 600 }}>✅ บันทึกข้อมูลร้านแล้ว</div>}
          <div className="form-field">
            <label>ชื่อร้าน</label>
            <input type="text" value={shopName} onChange={e => setShopName(e.target.value)} placeholder="เช่น ร้านของฉัน by Kitthanet" maxLength={120} />
          </div>
          <div className="form-field">
            <label>ที่ตั้งร้าน (จังหวัด)</label>
            <select value={shopLocation} onChange={e => setShopLocation(e.target.value)}>
              <option value="">เลือกจังหวัด...</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>ที่อยู่ร้าน (รายละเอียด)</label>
            <textarea rows={2} value={shopAddress} onChange={e => setShopAddress(e.target.value)} placeholder="เลขที่ ซอย แขวง/ตำบล..." maxLength={500} />
          </div>
          <label className="filter-row" style={{ cursor: 'pointer', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 14 }} onClick={() => setShopPublic(v => !v)}>
            <span>แสดงข้อมูลร้านต่อผู้ซื้อในหน้าสินค้า</span>
            <input type="checkbox" checked={shopPublic} readOnly />
          </label>
          <button type="button" className="btn btn-soft btn-sm" onClick={saveShop} disabled={shopSaving}>
            {shopSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลร้าน'}
          </button>
        </div>
      </section>

      <nav className="dash-tabs-wrap">
        {([{ k: 'post', l: '+ ลงขาย' }, { k: 'active', l: `กำลังขาย (${activeDeals.length})` }, { k: 'history', l: `ประวัติ (${historyDeals.length})` }] as const).map(({ k, l }) => (
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
        ) : activeDeals.map(d => <DealCard key={d.id} deal={d} />))}

        {tab === 'post' && (
          <div className="form-section">
            <h3 style={{ marginBottom: 20 }}>ลงขายสินค้า</h3>
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
              <label>รายละเอียดเพิ่มเติม</label>
              <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="รายละเอียดสินค้า สภาพ อุปกรณ์ที่มา เงื่อนไข..." />
            </div>

            <button className="btn btn-primary btn-block" style={{ marginTop: 4 }} onClick={handlePost} disabled={posting || postDone || uploading}>
              {posting ? 'กำลังลงประกาศ...' : 'ลงประกาศ'}
            </button>
          </div>
        )}

        {tab === 'history' && (historyDeals.length === 0 ? <div className="dash-empty"><p>ยังไม่มีประวัติการขาย</p></div> : historyDeals.map(d => <DealCard key={d.id} deal={d} />))}
      </main>
    </div>
  );
}
