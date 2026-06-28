'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import { supabase, authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Nav, Footer, useReveal } from '@/components/Site';
import { isCertifiedMode } from '@/lib/listingMode';
import { useAppPreferences } from '@/components/AppPreferences';

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
const CATEGORY_EN: Record<string, string> = {
  'ทั้งหมด': 'All',
  'สินค้าทั่วไป': 'General',
  'อิเล็กทรอนิกส์': 'Electronics',
  'เสื้อผ้า': 'Fashion',
  'ยานพาหนะ': 'Vehicles',
  'อสังหาริมทรัพย์': 'Property',
  'บริการ': 'Services',
  'อื่นๆ': 'Other',
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
  const { locale } = useAppPreferences();
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
  const [sort,       setSort]       = useState('latest');

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
  if (sort === 'price-asc') filtered = [...filtered].sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') filtered = [...filtered].sort((a, b) => b.price - a.price);

  function goCat(c: string) {
    setCat(c);
    document.getElementById('mkt-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function getFirstImage(listing: Listing): string {
    return listing.images && listing.images.length > 0 ? imgUrl(listing.images[0]) : '';
  }

  function catLabel(category: string) {
    return locale === 'th' ? category : (CATEGORY_EN[category] || category);
  }

  const sortOptions = [
    { value: 'latest', label: locale === 'th' ? 'ล่าสุด' : 'Latest' },
    { value: 'price-asc', label: locale === 'th' ? 'ราคา: น้อย→มาก' : 'Price: Low to High' },
    { value: 'price-desc', label: locale === 'th' ? 'ราคา: มาก→น้อย' : 'Price: High to Low' },
  ];

  function ListingCard({ listing, idx }: { listing: Listing; idx: number }) {
    const isCertified = isCertifiedMode(listing.selling_mode);
    const firstImg    = getFirstImage(listing);
    const isMyDeal    = listing.seller_id === myId || listing.buyer_id === myId;
    const c1 = CARD_BG[idx % 3 === 0 ? 0 : 2], c2 = CARD_BG[(idx % 5) + 1];
    const avatarBg = CARD_BG[(idx % 5) + 1];
    const detailHref = `/marketplace/${listing.id}`;

    return (
      <div className="lc-card reveal" style={{ ['--d' as string]: idx * 50 + 'ms', ...(isCertified ? { borderColor: 'var(--amber-400)' } : {}) }}>
        <Link href={detailHref} className="lc-link-shell" aria-label={locale === 'th' ? `ดูรายละเอียด ${listing.title}` : `View details for ${listing.title}`}>
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
              {locale === 'th' ? '✅ ตรวจสอบและพร้อมส่งโดยคนกลาง' : '✅ Verified and ready to ship by middleman'}
            </div>
          )}
          <div className="lc-tags">
            {listing.category && <span className="badge badge-gray">{catLabel(listing.category)}</span>}
            {listing.condition && <span className="badge badge-gray">{listing.condition}</span>}
          </div>
          <Link href={detailHref} className="lc-link-shell">
            <div className="lc-price">฿{(listing.price || 0).toLocaleString()}</div>
            <h3 className="lc-title">{listing.title}</h3>
          </Link>
          <div className="lc-seller">
            <span className="avatar" style={{ width: 24, height: 24, fontSize: 11, background: avatarBg }}>{(listing.seller_name || (locale === 'th' ? 'ผู้ขาย' : 'Seller')).slice(0, 1)}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.seller_name || (locale === 'th' ? 'ผู้ขาย' : 'Seller')}</span>
            {listing.location && <span style={{ fontSize: 12, color: 'var(--faint)' }}>📍 {listing.location}</span>}
          </div>
          <div className="lc-actions">
            <Link href={detailHref} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
              {locale === 'th' ? 'ดูรายละเอียด' : 'View details'}
            </Link>
            {isMyDeal && (
              <Link href={`/deal/${listing.id}`} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
                {listing.seller_id === myId ? (locale === 'th' ? 'เปิดดีลของคุณ' : 'Open your deal') : (locale === 'th' ? 'เข้าห้อง Deal' : 'Open deal room')}
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
            <div className="kicker" style={{ marginBottom: 10 }}>{locale === 'th' ? 'ตลาดคนกลาง' : 'Escrow Marketplace'}</div>
            <h1 className="mkt-headline reveal">{locale === 'th' ? <>ซื้อขายได้ทุกหมวด <span className="gradient-text">มั่นใจทุกมูลค่า</span></> : <>Trade across every category <span className="gradient-text">with confidence at any value</span></>}</h1>
            <p className="mkt-sub reveal" style={{ ['--d' as string]: '60ms' }}>{locale === 'th' ? 'ทุกรายการปลอดภัยด้วยระบบ Escrow — พักเงินจนกว่าจะได้ของตรงปก' : 'Every listing is protected by escrow. Funds stay on hold until the item matches the deal.'}</p>
            <div className="reveal" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16, ['--d' as string]: '80ms' }}>
              <Link href="/dashboard/seller" className="btn btn-primary">
                <Icon name="store" size={16} /> {locale === 'th' ? 'ลงขายสินค้า' : 'List an item'}
              </Link>
              <Link href="/wanted" className="btn btn-ghost">
                📢 {locale === 'th' ? 'ประกาศหาสินค้า' : 'Post wanted request'} <Icon name="arrowRight" size={15} />
              </Link>
            </div>
          </div>
          <div className="mkt-search reveal" style={{ ['--d' as string]: '100ms' }}>
            <Icon name="search" size={18} style={{ color: 'var(--faint)', flexShrink: 0 }} />
            <input type="text" placeholder={locale === 'th' ? 'ค้นหา iPhone, รถมือสอง, ไอดีเกม…' : 'Search iPhone, used cars, game accounts…'} value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn btn-primary btn-sm">{locale === 'th' ? 'ค้นหา' : 'Search'}</button>
          </div>
          <div className="mkt-cats reveal" style={{ ['--d' as string]: '140ms' }}>
            {CATS.map(c => (
              <button key={c} className={`chip ${cat === c ? 'is-active' : ''}`} onClick={() => setCat(c)}>
                <Icon name={CAT_ICON[c] || 'box'} />{catLabel(c)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 36, paddingBottom: 8 }}>
        <div className="container">
          <div className="cat-head reveal">
            <h2 className="section-title" style={{ fontSize: 'clamp(20px,2.4vw,26px)' }}>{locale === 'th' ? 'เลือกซื้อตามหมวดหมู่' : 'Browse by category'}</h2>
            <p className="section-lead" style={{ marginTop: 6, fontSize: 14 }}>{locale === 'th' ? 'แตะหมวดที่สนใจเพื่อกรองรายการด้านล่างทันที' : 'Tap a category to filter the listings below instantly.'}</p>
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
                  <span className="cat-t">{catLabel(c)}</span>
                  <span className="cat-n">{catCounts[c] || 0} {locale === 'th' ? 'รายการ' : 'items'}</span>
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
            <h4>{locale === 'th' ? 'จังหวัด' : 'Province'}</h4>
            <select value={province} onChange={e => setProvince(e.target.value)} style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', background: 'var(--surface-2)' }}>
              <option value="">📍 {locale === 'th' ? 'ทุกจังหวัด' : 'All provinces'}</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="mkt-filter-card" style={{ marginTop: 14 }}>
            <h4>{locale === 'th' ? 'การรับรอง' : 'Verification'}</h4>
            <label className="filter-row" onClick={() => setCertified(c => !c)} style={{ cursor: 'pointer' }}>
              <span>{locale === 'th' ? '⭐ Certified เท่านั้น' : '⭐ Certified only'}</span>
              <input type="checkbox" checked={certified} readOnly />
            </label>
          </div>
        </aside>

        <div>
          <div className="mkt-topbar">
            <span className="mkt-count">{locale === 'th' ? <>แสดง <b style={{ color: 'var(--ink)' }}>{filtered.length}</b> รายการ {cat !== 'ทั้งหมด' && `ใน "${catLabel(cat)}"`}</> : <>Showing <b style={{ color: 'var(--ink)' }}>{filtered.length}</b> items {cat !== 'ทั้งหมด' && `in "${catLabel(cat)}"`}</>}</span>
            <div className="mkt-sort">
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>{locale === 'th' ? 'เรียงโดย' : 'Sort by'}</span>
              <select value={sort} onChange={e => setSort(e.target.value)}>
                {sortOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
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
              <p>{locale === 'th' ? 'ไม่พบสินค้าที่ตรงกับที่ค้นหา' : 'No items matched your search'}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 14 }}>
                <button className="btn btn-soft" onClick={() => { setCat('ทั้งหมด'); setSearch(''); setProvince(''); setCertified(false); }}>{locale === 'th' ? 'ล้างตัวกรอง' : 'Clear filters'}</button>
                <Link href="/wanted" className="btn btn-primary">📢 {locale === 'th' ? 'ลงประกาศหาสินค้านี้' : 'Post a wanted request'}</Link>
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
