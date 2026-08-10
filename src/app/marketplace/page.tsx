'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Nav, Footer, useReveal } from '@/components/Site';
import { isCertifiedMode } from '@/lib/listingMode';
import { useServiceControls } from '@/lib/useServiceControls';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { AuctionCountdown } from '@/components/AuctionCountdown';
import type { AuctionPublic, MyAuctionStatus } from '@/lib/auction';
import { MY_AUCTION_STATUS_LABEL } from '@/lib/auction';

type Zone = 'listing' | 'auction';

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
  myAuctionStatus?: MyAuctionStatus;
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
const AUCTION_CARD_BG = ['#4c1d95','#7c3aed','#6d28d9','#5b21b6','#9333ea','#8b5cf6'];

export default function Marketplace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const zone: Zone = searchParams.get('zone') === 'auction' ? 'auction' : 'listing';
  const auctionView = searchParams.get('view') === 'mine' ? 'mine' : 'all';

  const [listings, setListings] = useState<Listing[]>([]);
  const [myAuctions, setMyAuctions] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [myAuctionsLoading, setMyAuctionsLoading] = useState(false);
  const [myId, setMyId] = useState('');

  const [search, setSearch] = useState('');
  const [cat, setCat] = useState(() => {
    const c = searchParams.get('cat');
    return c && CATS.includes(c) ? c : 'ทั้งหมด';
  });
  const [province, setProvince] = useState('');
  const [certified, setCertified] = useState(false);
  const [listingSort, setListingSort] = useState('ล่าสุด');
  const [auctionSort, setAuctionSort] = useState('ปิดเร็วสุด');

  useReveal();
  const controls = useServiceControls();

  const setZone = useCallback((next: Zone) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'auction') params.set('zone', 'auction');
    else params.delete('zone');
    const qs = params.toString();
    router.replace(qs ? `/marketplace?${qs}` : '/marketplace', { scroll: false });
  }, [router, searchParams]);

  const setAuctionView = useCallback((view: 'all' | 'mine') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('zone', 'auction');
    if (view === 'mine') params.set('view', 'mine');
    else params.delete('view');
    router.replace(`/marketplace?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    const r = document.documentElement;
    if (zone === 'auction') {
      r.style.setProperty('--accent', '#7c3aed');
      r.style.setProperty('--accent-strong', '#6d28d9');
      r.style.setProperty('--accent-soft', '#f5f3ff');
    } else {
      r.style.setProperty('--accent', '#2f6bf0');
      r.style.setProperty('--accent-strong', '#1f54d6');
      r.style.setProperty('--accent-soft', '#eef4ff');
    }
  }, [zone]);

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

  useEffect(() => {
    if (!myId) {
      setMyAuctions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setMyAuctionsLoading(true);
      try {
        const headers = await authHeaders();
        const res = await fetch('/api/auctions/mine', { headers });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setMyAuctions(data.deals || []);
        }
      } finally {
        if (!cancelled) setMyAuctionsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [myId]);

  const marketListings = listings
    .filter(d => d.status === 'posted')
    .filter(d => d.deal_type !== 'auction')
    .filter(d => d.source === 'listing' || (!d.source && !!d.selling_mode && d.selling_mode !== 'normal'));

  // ประมูลที่ปิด/มีผู้ชนะแล้ว — เอาออกจากตลาด (ไปขึ้นบอร์ดผู้ขาย + หน้าร้าน)
  const auctions = listings
    .filter(d => d.status === 'posted' && d.deal_type === 'auction' && d.auction)
    .filter(d => !d.buyer_id && !d.auction?.endedAt);

  let filteredListings = marketListings
    .filter(d => cat === 'ทั้งหมด' || d.category === cat)
    .filter(d => !province || d.location === province)
    .filter(d => !certified || isCertifiedMode(d.selling_mode))
    .filter(d => !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase())
    );
  if (listingSort === 'ราคา: น้อย→มาก') filteredListings = [...filteredListings].sort((a, b) => a.price - b.price);
  else if (listingSort === 'ราคา: มาก→น้อย') filteredListings = [...filteredListings].sort((a, b) => b.price - a.price);

  const myAuctionStatusMap = useMemo(() => {
    const m = new Map<string, MyAuctionStatus>();
    for (const d of myAuctions) {
      if (d.myAuctionStatus) m.set(d.id, d.myAuctionStatus);
    }
    return m;
  }, [myAuctions]);

  let filteredAuctions = (auctionView === 'mine' ? myAuctions : auctions)
    .filter(d => cat === 'ทั้งหมด' || d.category === cat)
    .filter(d => !province || d.location === province)
    .filter(d => !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase())
    );
  if (auctionSort === 'ราคา: น้อย→มาก') {
    filteredAuctions = [...filteredAuctions].sort((a, b) => (a.auction?.leadingPrice || 0) - (b.auction?.leadingPrice || 0));
  } else if (auctionSort === 'ราคา: มาก→น้อย') {
    filteredAuctions = [...filteredAuctions].sort((a, b) => (b.auction?.leadingPrice || 0) - (a.auction?.leadingPrice || 0));
  } else {
    filteredAuctions = [...filteredAuctions].sort((a, b) => {
      const ea = a.auction?.endsAt ? new Date(a.auction.endsAt).getTime() : Infinity;
      const eb = b.auction?.endsAt ? new Date(b.auction.endsAt).getTime() : Infinity;
      return ea - eb;
    });
  }

  const filtered = zone === 'auction' ? filteredAuctions : filteredListings;
  const isAuction = zone === 'auction';
  const showAuctionLoading = isAuction && auctionView === 'mine' ? myAuctionsLoading : loading;

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
    const isCertified = isCertifiedMode(listing.selling_mode);
    const firstImg = getFirstImage(listing);
    const isMyDeal = listing.seller_id === myId || listing.buyer_id === myId;
    const c1 = CARD_BG[idx % 3 === 0 ? 0 : 2], c2 = CARD_BG[(idx % 5) + 1];

    return (
      <Link
        href={`/marketplace/${listing.id}`}
        className={`lc-card reveal${isCertified ? ' lc-card--certified' : ''}`}
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
          <span className="lc-badge">
            {isCertified ? '⭐ Certified' : 'Escrow'}
          </span>
        </div>
        <div className="lc-body">
          <div className="lc-price">฿{(listing.price || 0).toLocaleString()}</div>
          <h3 className="lc-title">{listing.title}</h3>
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

  function AuctionCard({ listing, idx }: { listing: Listing; idx: number }) {
    const a = listing.auction!;
    const firstImg = listing.images?.[0] ? imgUrl(listing.images[0]) : '';
    const c1 = AUCTION_CARD_BG[idx % AUCTION_CARD_BG.length];
    const c2 = AUCTION_CARD_BG[(idx + 2) % AUCTION_CARD_BG.length];
    const hasBids = a.bidCount > 0;

    const myStatus = listing.myAuctionStatus ?? myAuctionStatusMap.get(listing.id);

    return (
      <Link
        href={`/marketplace/${listing.id}`}
        className="lc-card lc-card--auction reveal"
        style={{ ['--d' as string]: `${Math.min(idx * 30, 300)}ms` }}
      >
        <div className="lc-img" style={firstImg ? undefined : { background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}>
          {firstImg ? <img src={firstImg} alt={listing.title} loading="lazy" /> : <span style={{ fontSize: 40 }}>🔨</span>}
          <span className="lc-badge lc-badge--auction">ประมูล</span>
          {myStatus && (
            <span className={`lc-badge lc-badge--my-auction lc-badge--my-auction-${myStatus}`}>
              {MY_AUCTION_STATUS_LABEL[myStatus]}
            </span>
          )}
        </div>
        <div className="lc-body lc-body--auction">
          <h3 className="lc-title lc-title--auction">{listing.title}</h3>
          <div className="lc-auction-hero-stats">
            <div className="lc-ahs lc-ahs--price">
              <span className="lc-ahs-label">{hasBids ? 'ราคาปัจจุบัน' : 'ราคาเริ่ม'}</span>
              <span className="lc-ahs-value">฿{a.leadingPrice.toLocaleString()}</span>
            </div>
            {a.phase === 'live' ? (
              <div className="lc-ahs lc-ahs--time">
                <span className="lc-ahs-label">เหลือเวลา</span>
                <AuctionCountdown endsAt={a.endsAt} endedAt={a.endedAt} variant="card" liveClassName="is-live" />
              </div>
            ) : (
              <div className="lc-ahs lc-ahs--time lc-ahs--ended">
                <span className="lc-ahs-label">สถานะ</span>
                <span className="lc-ahs-value">ปิดแล้ว</span>
              </div>
            )}
            <div className="lc-ahs lc-ahs--leader">
              <span className="lc-ahs-label">ผู้นำ</span>
              <span className="lc-ahs-value lc-ahs-value--leader">
                {a.currentBidderName ? `🏆 ${a.currentBidderName}` : 'ยังไม่มี bid'}
              </span>
            </div>
          </div>
          <div className="lc-auction-foot">
            <span className="lc-auction-foot-bidders">👥 {a.uniqueBidderCount} คน bid</span>
            <span className="lc-auction-foot-sep">·</span>
            <span className="lc-auction-bid-step">+฿{a.bidIncrement.toLocaleString()}/bid</span>
            {(listing.location || listing.condition) && (
              <span className="lc-auction-foot-extra">
                {listing.location && (
                  <>
                    <span className="lc-auction-foot-sep">·</span>
                    <span>📍 {listing.location}</span>
                  </>
                )}
                {listing.condition && (
                  <>
                    <span className="lc-auction-foot-sep">·</span>
                    <span>{listing.condition}</span>
                  </>
                )}
              </span>
            )}
          </div>
          {(listing.seller_id === myId || listing.buyer_id === myId) && (
            <span className="lc-mine">{listing.seller_id === myId ? 'ของคุณ' : 'เข้าร่วมแล้ว'}</span>
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

      <section className={`mkt-hero${isAuction ? ' mkt-hero--auction' : ''}`}>
        <div className="container mkt-container mkt-hero-inner">
          <div className="mkt-hero-top">
            <div className="mkt-hero-copy">
              <div className="mkt-mode-tabs reveal" role="tablist" aria-label="โซนตลาด">
                <button
                  type="button"
                  role="tab"
                  aria-selected={!isAuction}
                  className={`mkt-mode-tab mkt-mode-tab--listing${!isAuction ? ' active' : ''}`}
                  onClick={() => setZone('listing')}
                >
                  <Icon name="store" size={16} />
                  <span>ตลาดซื้อขาย</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isAuction}
                  className={`mkt-mode-tab mkt-mode-tab--auction${isAuction ? ' active' : ''}`}
                  onClick={() => setZone('auction')}
                >
                  <span className="mkt-mode-tab-ic" aria-hidden>🔨</span>
                  <span>ตลาดประมูล</span>
                </button>
              </div>
              <h1 className="mkt-headline reveal">
                {isAuction ? (
                  <>ประมูลสินค้า <span className="gradient-text">แบบ real-time</span></>
                ) : (
                  <>ซื้อขายได้ทุกหมวด <span className="gradient-text">มั่นใจทุกมูลค่า</span></>
                )}
              </h1>
              <p className="mkt-sub reveal" style={{ ['--d' as string]: '60ms' }}>
                {isAuction
                  ? 'นับถอยหลัง · ดูผู้นำ · bid ได้ทันที — ปิดประมูลแล้วเข้าดีล escrow อัตโนมัติ'
                  : 'ทุกรายการปลอดภัยด้วย Escrow — พักเงินจนได้ของตรงปก'}
              </p>
            </div>
            <div className="mkt-hero-actions reveal" style={{ ['--d' as string]: '80ms' }}>
              <Link href="/wanted" className="btn btn-ghost btn-sm">
                📢 หาสินค้า
              </Link>
            </div>
          </div>

          <div className="mkt-yahoo-panel reveal" style={{ ['--d' as string]: '100ms' }}>
            <div className="mkt-yahoo-search-row">
              <div className="mkt-yahoo-brand" aria-hidden>
                {isAuction ? (
                  <>
                    <span className="mkt-yahoo-brand-ic">🔨</span>
                    <span className="mkt-yahoo-brand-txt">ตลาดประมูล</span>
                  </>
                ) : (
                  <>
                    <Icon name="store" size={22} />
                    <span className="mkt-yahoo-brand-txt">ตลาดซื้อขาย</span>
                  </>
                )}
              </div>
              <form
                className="mkt-yahoo-search"
                onSubmit={e => { e.preventDefault(); }}
                role="search"
              >
                <label className="mkt-yahoo-cat-select">
                  <span className="mkt-yahoo-cat-btn">หมวดหมู่</span>
                  <select
                    value={cat}
                    onChange={e => setCat(e.target.value)}
                    aria-label="เลือกหมวดหมู่"
                  >
                    {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <input
                  type="search"
                  className="mkt-yahoo-input"
                  placeholder={isAuction ? 'ค้นหาสินค้าประมูล…' : 'ค้นหา iPhone, รถมือสอง, ไอดีเกม…'}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="ค้นหาสินค้า"
                />
                <button type="submit" className="mkt-yahoo-submit">ค้นหา</button>
              </form>
            </div>
            <div className="mkt-yahoo-cats" role="tablist" aria-label="หมวดหมู่">
              <span className="mkt-yahoo-cats-title">หมวดหมู่</span>
              <div className="mkt-yahoo-cat-grid">
                {CATS.map(c => (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={cat === c}
                    className={`mkt-yahoo-cat-chip${cat === c ? ' is-active' : ''}`}
                    onClick={() => setCat(c)}
                  >
                    <Icon name={CAT_ICON[c] || 'box'} size={14} />
                    <span>{c}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div id="mkt-results" className="container mkt-container mkt-feed">
        {isAuction && (
          <div className="mkt-auction-view-tabs reveal" role="tablist" aria-label="มุมมองประมูล">
            <button
              type="button"
              role="tab"
              aria-selected={auctionView === 'all'}
              className={`mkt-auction-view-tab${auctionView === 'all' ? ' is-active' : ''}`}
              onClick={() => setAuctionView('all')}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={auctionView === 'mine'}
              className={`mkt-auction-view-tab${auctionView === 'mine' ? ' is-active' : ''}`}
              onClick={() => {
                if (!myId) {
                  router.push(`/login?returnTo=${encodeURIComponent('/marketplace?zone=auction&view=mine')}`);
                  return;
                }
                setAuctionView('mine');
              }}
            >
              ประมูลของฉัน
            </button>
          </div>
        )}
        <div className="mkt-toolbar">
          <span className="mkt-count">
            {showAuctionLoading ? 'กำลังโหลด…' : isAuction ? (
              auctionView === 'mine'
                ? <>📋 ประมูลของฉัน <b>{filtered.length}</b> รายการ</>
                : <>🔨 ประมูล <b>{filtered.length}</b> รายการ</>
            ) : (
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
            {!isAuction && (
              <button
                type="button"
                className={`mkt-filter-chip${certified ? ' is-active' : ''}`}
                onClick={() => setCertified(c => !c)}
                aria-pressed={certified}
              >
                ⭐ Certified
              </button>
            )}
            <label className="mkt-filter-pill">
              <span className="mkt-filter-label">เรียง</span>
              <select
                value={isAuction ? auctionSort : listingSort}
                onChange={e => isAuction ? setAuctionSort(e.target.value) : setListingSort(e.target.value)}
                aria-label="เรียงลำดับ"
              >
                {(isAuction
                  ? ['ปิดเร็วสุด', 'ราคา: น้อย→มาก', 'ราคา: มาก→น้อย', 'ล่าสุด']
                  : ['ล่าสุด', 'ราคา: น้อย→มาก', 'ราคา: มาก→น้อย']
                ).map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
        </div>

        {showAuctionLoading ? (
          <div className="mkt-loading">
            <div className="mkt-spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mkt-empty">
            <div className="mkt-empty-ic">
              {isAuction ? '🔨' : <Icon name="search" size={32} />}
            </div>
            <p>
              {isAuction && auctionView === 'mine'
                ? 'ยังไม่มีรายการที่คุณเคย bid'
                : isAuction ? 'ยังไม่มีรายการประมูล' : 'ไม่พบสินค้าที่ตรงกับที่ค้นหา'}
            </p>
            <div className="mkt-empty-actions">
              {!isAuction && (
                <button type="button" className="btn btn-soft btn-sm" onClick={clearFilters}>ล้างตัวกรอง</button>
              )}
              {isAuction ? (
                <button type="button" className="btn btn-soft btn-sm" onClick={() => setZone('listing')}>
                  <Icon name="store" size={15} /> ดูตลาดซื้อขาย
                </button>
              ) : (
                <Link href="/wanted" className="btn btn-primary btn-sm">📢 ลงประกาศหาสินค้านี้</Link>
              )}
            </div>
          </div>
        ) : (
          <div className={`mkt-grid${isAuction ? ' mkt-grid--auction' : ''}`}>
            {isAuction
              ? filteredAuctions.map((item, i) => <AuctionCard key={item.id} listing={item} idx={i} />)
              : filteredListings.map((item, i) => <ListingCard key={item.id} listing={item} idx={i} />)
            }
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}
