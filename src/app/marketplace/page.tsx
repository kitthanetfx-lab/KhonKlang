'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import { supabase, authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Nav, Footer, useReveal } from '@/components/Site';
import { isCertifiedMode } from '@/lib/listingMode';
import { useServiceControls } from '@/lib/useServiceControls';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { AuctionCountdown } from '@/components/AuctionCountdown';
import type { AuctionPublic } from '@/lib/auction';

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
  deal_type?: string;
  images: string[];
  status: string;
  buyer_id: string;
  created_at: string;
  auction?: AuctionPublic;
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
  const [marketMode, setMarketMode] = useState<'all' | 'fixed' | 'auction'>('all');

  useReveal();
  const controls = useServiceControls();

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

  const marketListings = listings
    .filter(d => d.status === 'posted')
    .filter(d => d.source === 'listing' || (!d.source && !!d.selling_mode && d.selling_mode !== 'normal'));

  let filtered = marketListings
    .filter(d => marketMode === 'all' || (marketMode === 'auction' ? d.deal_type === 'auction' : d.deal_type !== 'auction'))
    .filter(d => cat === 'ทั้งหมด' || d.category === cat)
    .filter(d => !province || d.location === province)
    .filter(d => !certified || isCertifiedMode(d.selling_mode))
    .filter(d => !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase())
    );
  if (sort === 'ราคา: น้อย→มาก') filtered = [...filtered].sort((a, b) => a.price - b.price);
  else if (sort === 'ราคา: มาก→น้อย') filtered = [...filtered].sort((a, b) => b.price - a.price);
  else if (sort === 'ปิดประมูลเร็วสุด') {
    filtered = [...filtered].sort((a, b) => {
      const ea = a.auction?.endsAt ? new Date(a.auction.endsAt).getTime() : Infinity;
      const eb = b.auction?.endsAt ? new Date(b.auction.endsAt).getTime() : Infinity;
      return ea - eb;
    });
  }

  function clearFilters() {
    setCat('ทั้งหมด');
    setSearch('');
    setProvince('');
    setCertified(false);
  }

  function getFirstImage(listing: Listing): string {
    return listing.images && listing.images.length > 0 ? imgUrl(listing.images[0]) : '';
  }

  function ListingCard({ listing, idx }: { listing: Listing; idx: number }) {
    const isAuction = listing.deal_type === 'auction' && listing.auction;
    const isCertified = isCertifiedMode(listing.selling_mode);
    const firstImg    = getFirstImage(listing);
    const isMyDeal    = listing.seller_id === myId || listing.buyer_id === myId;
    const c1 = CARD_BG[idx % 3 === 0 ? 0 : 2], c2 = CARD_BG[(idx % 5) + 1];
    const detailHref = `/marketplace/${listing.id}`;
    const showPrice = isAuction ? listing.auction!.leadingPrice : (listing.price || 0);

    return (
      <Link
        href={detailHref}
        className={`lc-card reveal${isCertified ? ' lc-card--certified' : ''}${isAuction ? ' lc-card--auction' : ''}`}
        style={{ ['--d' as string]: `${Math.min(idx * 30, 300)}ms` }}
        aria-label={`ดูรายละเอียด ${listing.title}`}
      >
        <div
          className="lc-img"
          style={firstImg ? undefined : { background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}
        >
          {firstImg
            ? <img src={firstImg} alt={listing.title} loading="lazy" />
            : <Icon name="package" size={40} style={{ color: 'rgba(255,255,255,0.25)' }} />}
          <span className={`lc-badge${isAuction ? ' lc-badge--auction' : ''}`}>
            {isAuction ? '🔨 ประมูล' : isCertified ? '⭐ Certified' : 'Escrow'}
          </span>
          {isAuction && listing.auction!.phase === 'live' && (
            <span className="lc-auction-timer">
              <AuctionCountdown endsAt={listing.auction!.endsAt} endedAt={listing.auction!.endedAt} />
            </span>
          )}
        </div>
        <div className="lc-body">
          <div className="lc-price">
            {isAuction && listing.auction!.bidCount > 0 ? 'ปัจจุบัน ' : isAuction ? 'เริ่ม ' : ''}
            ฿{showPrice.toLocaleString()}
          </div>
          <h3 className="lc-title">{listing.title}</h3>
          {isAuction && (
            <div className="lc-auction-meta">
              <span>👥 {listing.auction!.uniqueBidderCount} คน</span>
              <span>{listing.auction!.currentBidderName ? `🏆 ${listing.auction!.currentBidderName}` : 'ยังไม่มี bid'}</span>
            </div>
          )}
          <div className="lc-meta">
            {listing.location && <span>📍 {listing.location}</span>}
            {listing.condition && <span>{listing.condition}</span>}
          </div>
          {isMyDeal && (
            <span className="lc-mine">
              {listing.seller_id === myId ? 'ดีลของคุณ' : 'เข้าร่วมแล้ว'}
            </span>
          )}
        </div>
      </Link>
    );
  }

  if (!controls.loading && !controls.isEnabled('marketplace')) {
    return (
      <ServiceDisabledNotice
        title="โซนตลาด"
        message={controls.message('marketplace')}
        backHref="/"
        backLabel="กลับหน้าหลัก"
      />
    );
  }

  return (
    <>
      <Nav active="market" />

      <section className="mkt-hero">
        <div className="container mkt-hero-inner">
          <div className="mkt-hero-top">
            <div className="mkt-hero-copy">
              <div className="kicker">ตลาดคนกลาง</div>
              <h1 className="mkt-headline reveal">
                ซื้อขายได้ทุกหมวด <span className="gradient-text">มั่นใจทุกมูลค่า</span>
              </h1>
              <p className="mkt-sub reveal" style={{ ['--d' as string]: '60ms' }}>
                ทุกรายการปลอดภัยด้วย Escrow — พักเงินจนได้ของตรงปก
              </p>
            </div>
            <div className="mkt-hero-actions reveal" style={{ ['--d' as string]: '80ms' }}>
              <Link href="/dashboard/seller" className="btn btn-primary btn-sm">
                <Icon name="store" size={15} /> ลงขาย
              </Link>
              <Link href="/wanted" className="btn btn-ghost btn-sm">
                📢 หาสินค้า
              </Link>
            </div>
          </div>

          <div className="mkt-search reveal" style={{ ['--d' as string]: '100ms' }}>
            <Icon name="search" size={18} style={{ color: 'var(--faint)', flexShrink: 0 }} />
            <input
              type="search"
              placeholder="ค้นหา iPhone, รถมือสอง, ไอดีเกม…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-sm mkt-search-btn">ค้นหา</button>
          </div>

          <div className="mkt-cats reveal" role="tablist" aria-label="หมวดหมู่" style={{ ['--d' as string]: '120ms' }}>
            {CATS.map(c => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={cat === c}
                className={`mkt-cat-tab ${cat === c ? 'is-active' : ''}`}
                onClick={() => setCat(c)}
              >
                <Icon name={CAT_ICON[c] || 'box'} size={15} />
                <span>{c}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div id="mkt-results" className="container mkt-feed">
        <div className="mkt-toolbar">
          <div className="mkt-mode-tabs">
            {([['all', 'ทั้งหมด'], ['fixed', 'สินค้า'], ['auction', '🔨 ประมูล']] as const).map(([k, l]) => (
              <button key={k} type="button" className={`mkt-mode-tab${marketMode === k ? ' active' : ''}`} onClick={() => setMarketMode(k)}>{l}</button>
            ))}
          </div>
          <span className="mkt-count">
            {loading ? 'กำลังโหลด…' : (
              <>แสดง <b>{filtered.length}</b> รายการ{cat !== 'ทั้งหมด' ? ` · ${cat}` : ''}</>
            )}
          </span>
          <div className="mkt-toolbar-filters">
            <label className="mkt-filter-pill">
              <span className="mkt-filter-label">จังหวัด</span>
              <select value={province} onChange={e => setProvince(e.target.value)} aria-label="กรองจังหวัด">
                <option value="">ทุกจังหวัด</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <button
              type="button"
              className={`mkt-filter-chip${certified ? ' is-active' : ''}`}
              onClick={() => setCertified(c => !c)}
              aria-pressed={certified}
            >
              ⭐ Certified
            </button>
            <label className="mkt-filter-pill">
              <span className="mkt-filter-label">เรียง</span>
              <select value={sort} onChange={e => setSort(e.target.value)} aria-label="เรียงลำดับ">
                {['ล่าสุด', 'ราคา: น้อย→มาก', 'ราคา: มาก→น้อย', ...(marketMode !== 'fixed' ? ['ปิดประมูลเร็วสุด'] as const : [])].map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="mkt-loading">
            <div className="mkt-spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mkt-empty">
            <div className="mkt-empty-ic"><Icon name="search" size={32} /></div>
            <p>ไม่พบสินค้าที่ตรงกับที่ค้นหา</p>
            <div className="mkt-empty-actions">
              <button type="button" className="btn btn-soft btn-sm" onClick={clearFilters}>ล้างตัวกรอง</button>
              <Link href="/wanted" className="btn btn-primary btn-sm">📢 ลงประกาศหาสินค้านี้</Link>
            </div>
          </div>
        ) : (
          <div className="mkt-grid">
            {filtered.map((item, i) => <ListingCard key={item.id} listing={item} idx={i} />)}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}
