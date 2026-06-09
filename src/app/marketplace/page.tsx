'use client';

import { useEffect, useState } from 'react';
import { account } from '@/lib/appwrite';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { Nav, Footer, useReveal } from '@/components/Site';

interface Listing {
  $id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  location: string;
  sellingMode: string;
  imageFileIds: string;
  status: string;
  buyerId: string;
  createdAt: string;
}

const ENDPOINT  = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT  || 'https://sgp.cloud.appwrite.io/v1';
const PROJECT   = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const BUCKET_ID = 'deal_files';

function imgUrl(fileId: string) {
  return `${ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileId}/view?project=${PROJECT}`;
}

const CATS = ['ทั้งหมด','สินค้าทั่วไป','อิเล็กทรอนิกส์','เสื้อผ้า','ยานพาหนะ','อสังหาริมทรัพย์','บริการ','อื่นๆ'];
const CAT_ICON: Record<string, string> = {
  'ทั้งหมด': 'grid', 'สินค้าทั่วไป': 'box', 'อิเล็กทรอนิกส์': 'smartphone',
  'เสื้อผ้า': 'gem', 'ยานพาหนะ': 'car', 'อสังหาริมทรัพย์': 'building',
  'บริการ': 'handCoins', 'อื่นๆ': 'package',
};
const PROVINCES = [
  'กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร',
  'ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ',
  'ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก',
  'นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์',
  'นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี',
  'ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา',
  'พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์',
  'แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร',
  'ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง',
  'ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ',
  'สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย',
  'สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู',
  'อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี',
];
const CARD_BG = ['#0d1b3e','#2f6bf0','#10a566','#6841d9','#e89211','#0d9aa6'];

export default function Marketplace() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [myId,     setMyId]     = useState('');
  const [jwt,      setJwt]      = useState('');

  const [search,     setSearch]     = useState('');
  const [cat,        setCat]        = useState('ทั้งหมด');
  const [province,   setProvince]   = useState('');
  const [certified,  setCertified]  = useState(false);
  const [sort,       setSort]       = useState('ล่าสุด');

  const [joining,  setJoining]  = useState<string | null>(null);
  const [contacting, setContacting] = useState<string | null>(null);

  useReveal();

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0');
    r.style.setProperty('--accent-strong', '#1f54d6');
    r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await account.get();
        setMyId(user.$id);
        const j = (await account.createJWT()).jwt;
        setJwt(j);
        const res = await fetch('/api/deals?role=buyer', { headers: { 'x-session-jwt': j } });
        if (res.ok) { const data = await res.json(); setListings(data.deals || []); }
      } catch {
        const res = await fetch('/api/deals?role=buyer').catch(() => null);
        if (res?.ok) { const data = await res.json(); setListings(data.deals || []); }
      } finally { setLoading(false); }
    })();
  }, []);

  async function joinDeal(dealId: string) {
    if (!myId) { router.push('/login'); return; }
    setJoining(dealId);
    try {
      const j = jwt || (await account.createJWT()).jwt;
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'x-session-jwt': j, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join_as_buyer' }),
      });
      if (res.ok) router.push(`/deal/${dealId}`);
      else { const d = await res.json(); alert(d.error || 'เกิดข้อผิดพลาด'); }
    } finally { setJoining(null); }
  }

  async function callMiddleman(dealId: string) {
    if (!myId) { router.push('/login'); return; }
    setContacting(dealId);
    try {
      const j = jwt || (await account.createJWT()).jwt;
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'x-session-jwt': j, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join_as_buyer' }),
      });
      if (res.ok) router.push(`/deal/${dealId}`);
      else router.push(`/deal/${dealId}`);
    } finally { setContacting(null); }
  }

  let filtered = listings
    .filter(d => d.status === 'posted')
    .filter(d => cat === 'ทั้งหมด' || d.category === cat)
    .filter(d => !province || d.location === province)
    .filter(d => !certified || d.sellingMode === 'certified')
    .filter(d => !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase())
    );
  if (sort === 'ราคา: น้อย→มาก') filtered = [...filtered].sort((a, b) => a.price - b.price);
  else if (sort === 'ราคา: มาก→น้อย') filtered = [...filtered].sort((a, b) => b.price - a.price);

  function getFirstImage(listing: Listing): string {
    try {
      const ids = JSON.parse(listing.imageFileIds || '[]');
      return ids.length > 0 ? imgUrl(ids[0]) : '';
    } catch { return ''; }
  }

  function ListingCard({ listing, idx }: { listing: Listing; idx: number }) {
    const isCertified = listing.sellingMode === 'certified';
    const firstImg    = getFirstImage(listing);
    const isMyDeal    = listing.sellerId === myId || listing.buyerId === myId;
    const c1 = CARD_BG[idx % 3 === 0 ? 0 : 2], c2 = CARD_BG[(idx % 5) + 1];
    const avatarBg = CARD_BG[(idx % 5) + 1];

    return (
      <div className="lc-card reveal" style={{ ['--d' as string]: idx * 50 + 'ms', ...(isCertified ? { borderColor: 'var(--amber-400)' } : {}) }}>
        <div className="lc-img" style={firstImg ? { padding: 0 } : { background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}>
          {firstImg
            ? <img src={firstImg} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Icon name="package" size={52} style={{ color: 'rgba(255,255,255,0.22)' }} />}
          <span className="lc-img-label">
            {isCertified
              ? <span className="badge badge-amber" style={{ background: 'var(--amber-400)', color: '#3a2700', border: 'none' }}>⭐ Certified</span>
              : <span className="badge badge-green" style={{ background: 'rgba(16,165,102,.9)', color: '#fff', border: 'none' }}><span className="dot" /> Escrow</span>}
          </span>
        </div>
        <div className="lc-body">
          {isCertified && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--green-700)', background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 'var(--r-sm)', padding: '7px 11px' }}>
              ✅ ตรวจสอบและพร้อมส่งโดยคนกลาง
            </div>
          )}
          <div className="lc-tags">
            {listing.category && <span className="badge badge-gray">{listing.category}</span>}
            {listing.condition && <span className="badge badge-gray">{listing.condition}</span>}
          </div>
          <div className="lc-price">฿{(listing.price || 0).toLocaleString()}</div>
          <h3 className="lc-title">{listing.title}</h3>
          <div className="lc-seller">
            <span className="avatar" style={{ width: 24, height: 24, fontSize: 11, background: avatarBg }}>{(listing.sellerName || 'ผู้ขาย').slice(0, 1)}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.sellerName || 'ผู้ขาย'}</span>
            {listing.location && <span style={{ fontSize: 12, color: 'var(--faint)' }}>📍 {listing.location}</span>}
          </div>
          <div className="lc-actions">
            {isMyDeal ? (
              <Link href={`/deal/${listing.$id}`} className="btn btn-primary btn-sm" style={{ flex: 1, background: 'var(--green-500)' }}>
                {listing.sellerId === myId ? 'รายการของคุณ' : 'เข้าห้อง Deal ของคุณ'}
              </Link>
            ) : isCertified ? (
              <button onClick={() => joinDeal(listing.$id)} disabled={joining === listing.$id} className="btn btn-primary btn-sm" style={{ flex: 1, background: 'var(--amber-500)', color: '#3a2700' }}>
                {joining === listing.$id ? 'กำลังเข้าร่วม...' : '⭐ ซื้อ Certified'}
              </button>
            ) : (
              <>
                <button onClick={() => joinDeal(listing.$id)} disabled={joining === listing.$id} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                  {joining === listing.$id ? '...' : 'ขอซื้อ'}
                </button>
                <button onClick={() => callMiddleman(listing.$id)} disabled={contacting === listing.$id} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
                  {contacting === listing.$id ? '...' : '🤝 คนกลาง'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Nav active="market" />

      <section className="mkt-hero">
        <div className="container mkt-hero-inner">
          <div>
            <div className="kicker" style={{ marginBottom: 10 }}>ตลาดคนกลาง</div>
            <h1 className="mkt-headline reveal">ซื้อขายได้ทุกหมวด <span className="gradient-text">มั่นใจทุกมูลค่า</span></h1>
            <p className="mkt-sub reveal" style={{ ['--d' as string]: '60ms' }}>ทุกรายการปลอดภัยด้วยระบบ Escrow — พักเงินจนกว่าจะได้ของตรงปก</p>
          </div>
          <div className="mkt-search reveal" style={{ ['--d' as string]: '100ms' }}>
            <Icon name="search" size={18} style={{ color: 'var(--faint)', flexShrink: 0 }} />
            <input type="text" placeholder="ค้นหา iPhone, รถมือสอง, ไอดีเกม…" value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn btn-primary btn-sm">ค้นหา</button>
          </div>
          <div className="mkt-cats reveal" style={{ ['--d' as string]: '140ms' }}>
            {CATS.map(c => (
              <button key={c} className={`chip ${cat === c ? 'is-active' : ''}`} onClick={() => setCat(c)}>
                <Icon name={CAT_ICON[c] || 'box'} />{c}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="container mkt-layout">
        <aside className="mkt-sidebar">
          <div className="mkt-filter-card">
            <h4>จังหวัด</h4>
            <select value={province} onChange={e => setProvince(e.target.value)} style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', background: 'var(--surface-2)' }}>
              <option value="">📍 ทุกจังหวัด</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="mkt-filter-card" style={{ marginTop: 14 }}>
            <h4>การรับรอง</h4>
            <label className="filter-row" onClick={() => setCertified(c => !c)} style={{ cursor: 'pointer' }}>
              <span>⭐ Certified เท่านั้น</span>
              <input type="checkbox" checked={certified} readOnly />
            </label>
          </div>
        </aside>

        <div>
          <div className="mkt-topbar">
            <span className="mkt-count">แสดง <b style={{ color: 'var(--ink)' }}>{filtered.length}</b> รายการ {cat !== 'ทั้งหมด' && `ใน "${cat}"`}</span>
            <div className="mkt-sort">
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>เรียงโดย</span>
              <select value={sort} onChange={e => setSort(e.target.value)}>
                {['ล่าสุด', 'ราคา: น้อย→มาก', 'ราคา: มาก→น้อย'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <div style={{ width: 32, height: 32, border: '3px solid var(--line)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'dashSpin .8s linear infinite' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="mkt-empty">
              <div className="mkt-empty-ic"><Icon name="search" size={32} /></div>
              <p>ไม่พบสินค้าที่ตรงกับที่ค้นหา</p>
              <button className="btn btn-soft" style={{ marginTop: 14 }} onClick={() => { setCat('ทั้งหมด'); setSearch(''); setProvince(''); setCertified(false); }}>ล้างตัวกรอง</button>
            </div>
          ) : (
            <div className="mkt-grid">
              {filtered.map((item, i) => <ListingCard key={item.$id} listing={item} idx={i} />)}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}
