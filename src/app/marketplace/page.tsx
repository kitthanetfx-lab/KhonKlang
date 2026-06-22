'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import { supabase, authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Nav, Footer, useReveal } from '@/components/Site';
import { isCertifiedMode } from '@/lib/listingMode';

interface Listing {
  id: string;
  seller_id: string;
  seller_name: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  location: string;
  selling_mode: string;
  source?: string;
  images: string[];
  status: string;
  buyer_id: string;
  created_at: string;
}

function imgUrl(fileId: string) {
  return fileViewUrl(DEAL_BUCKET, fileId);
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
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [myId,     setMyId]     = useState('');

  const [search,     setSearch]     = useState('');
  const [cat,        setCat]        = useState(() => {
    if (typeof window === 'undefined') return 'ทั้งหมด';
    try {
      const c = new URLSearchParams(window.location.search).get('cat');
      return c && CATS.includes(c) ? c : 'ทั้งหมด';
    } catch {
      return 'ทั้งหมด';
    }
  });
  const [province,   setProvince]   = useState('');
  const [certified,  setCertified]  = useState(false);
  const [sort,       setSort]       = useState('ล่าสุด');

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
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setMyId(user.id);
          const headers = await authHeaders();
          const res = await fetch('/api/deals?role=buyer', { headers });
          if (res.ok) { const data = await res.json(); setListings(data.deals || []); }
        } else {
          const res = await fetch('/api/deals?role=buyer').catch(() => null);
          if (res?.ok) { const data = await res.json(); setListings(data.deals || []); }
        }
      } finally { setLoading(false); }
    })();
  }, []);

  // ฐานรายการที่นับเป็น "ในตลาด" จริง (ก่อนกรองหมวด/จังหวัด/คำค้น) — ใช้คำนวณจำนวนต่อหมวดหมู่
  const marketListings = listings
    .filter(d => d.status === 'posted')
    .filter(d => d.source === 'listing' || (!d.source && !!d.selling_mode && d.selling_mode !== 'normal'));

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of marketListings) counts[d.category] = (counts[d.category] || 0) + 1;
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings]);

  let filtered = marketListings
    .filter(d => cat === 'ทั้งหมด' || d.category === cat)
    .filter(d => !province || d.location === province)
    .filter(d => !certified || isCertifiedMode(d.selling_mode))
    .filter(d => !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase())
    );
  if (sort === 'ราคา: น้อย→มาก') filtered = [...filtered].sort((a, b) => a.price - b.price);
  else if (sort === 'ราคา: มาก→น้อย') filtered = [...filtered].sort((a, b) => b.price - a.price);

  function goCat(c: string) {
    setCat(c);
    document.getElementById('mkt-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function getFirstImage(listing: Listing): string {
    return listing.images && listing.images.length > 0 ? imgUrl(listing.images[0]) : '';
  }

  function ListingCard({ listing, idx }: { listing: Listing; idx: number }) {
    const isCertified = isCertifiedMode(listing.selling_mode);
    const firstImg    = getFirstImage(listing);
    const isMyDeal    = listing.seller_id === myId || listing.buyer_id === myId;
    const c1 = CARD_BG[idx % 3 === 0 ? 0 : 2], c2 = CARD_BG[(idx % 5) + 1];
    const avatarBg = CARD_BG[(idx % 5) + 1];
    const detailHref = `/marketplace/${listing.id}`;

    return (
      <div className="lc-card reveal" style={{ ['--d' as string]: idx * 50 + 'ms', ...(isCertified ? { borderColor: 'var(--amber-400)' } : {}) }}>
        <Link href={detailHref} className="lc-link-shell" aria-label={`ดูรายละเอียด ${listing.title}`}>
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
        </Link>
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
          <Link href={detailHref} className="lc-link-shell">
            <div className="lc-price">฿{(listing.price || 0).toLocaleString()}</div>
            <h3 className="lc-title">{listing.title}</h3>
          </Link>
          <div className="lc-seller">
            <span className="avatar" style={{ width: 24, height: 24, fontSize: 11, background: avatarBg }}>{(listing.seller_name || 'ผู้ขาย').slice(0, 1)}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.seller_name || 'ผู้ขาย'}</span>
            {listing.location && <span style={{ fontSize: 12, color: 'var(--faint)' }}>📍 {listing.location}</span>}
          </div>
          <div className="lc-actions">
            <Link href={detailHref} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
              ดูรายละเอียด
            </Link>
            {isMyDeal && (
              <Link href={`/deal/${listing.id}`} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
                {listing.seller_id === myId ? 'เปิดดีลของคุณ' : 'เข้าห้อง Deal'}
              </Link>
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
            <div className="reveal" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16, ['--d' as string]: '80ms' }}>
              <Link href="/dashboard/seller" className="btn btn-primary">
                <Icon name="store" size={16} /> ลงขายสินค้า
              </Link>
              <Link href="/wanted" className="btn btn-ghost">
                📢 ประกาศหาสินค้า <Icon name="arrowRight" size={15} />
              </Link>
            </div>
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

      <section className="section" style={{ paddingTop: 36, paddingBottom: 8 }}>
        <div className="container">
          <div className="cat-head reveal">
            <h2 className="section-title" style={{ fontSize: 'clamp(20px,2.4vw,26px)' }}>เลือกซื้อตามหมวดหมู่</h2>
            <p className="section-lead" style={{ marginTop: 6, fontSize: 14 }}>แตะหมวดที่สนใจเพื่อกรองรายการด้านล่างทันที</p>
          </div>
          <div className="cat-grid reveal">
            {CATS.filter(c => c !== 'ทั้งหมด').map((c, i) => (
              <button
                key={c}
                className="cat-card"
                onClick={() => goCat(c)}
                style={{ ['--d' as string]: i * 40 + 'ms', textAlign: 'left', cursor: 'pointer', width: '100%', font: 'inherit', borderColor: cat === c ? 'var(--accent)' : undefined }}
              >
                <span className="icon-tile"><Icon name={CAT_ICON[c] || 'box'} /></span>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="cat-t">{c}</span>
                  <span className="cat-n">{catCounts[c] || 0} รายการ</span>
                </span>
                <span className="cat-arrow"><Icon name="arrowRight" size={16} /></span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div id="mkt-results" className="container mkt-layout">
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 14 }}>
                <button className="btn btn-soft" onClick={() => { setCat('ทั้งหมด'); setSearch(''); setProvince(''); setCertified(false); }}>ล้างตัวกรอง</button>
                <Link href="/wanted" className="btn btn-primary">📢 ลงประกาศหาสินค้านี้</Link>
              </div>
            </div>
          ) : (
            <div className="mkt-grid">
              {filtered.map((item, i) => <ListingCard key={item.id} listing={item} idx={i} />)}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}
