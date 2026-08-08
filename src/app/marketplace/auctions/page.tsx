'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import { supabase, authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Nav, Footer, useReveal } from '@/components/Site';
import { useServiceControls } from '@/lib/useServiceControls';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { AuctionCountdown } from '@/components/AuctionCountdown';
import type { AuctionPublic } from '@/lib/auction';

interface AuctionListing {
  id: string;
  seller_id: string;
  seller_name: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  location: string;
  images: string[];
  status: string;
  buyer_id: string;
  deal_type?: string;
  auction?: AuctionPublic;
}

function imgUrl(fileId: string) {
  return fileViewUrl(DEAL_BUCKET, fileId);
}

const CATS = ['ทั้งหมด','สินค้าทั่วไป','อิเล็กทรอนิกส์','เสื้อผ้า','ยานพาหนะ','อสังหาริมทรัพย์','บริการ','อื่นๆ'];
const PROVINCES = [
  'กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ',
  'ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์',
  'นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา',
  'พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน',
  'ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล',
  'สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์',
  'หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี',
];
const CARD_BG = ['#4c1d95','#7c3aed','#6d28d9','#5b21b6','#9333ea','#8b5cf6'];

export default function MarketplaceAuctionsPage() {
  const [listings, setListings] = useState<AuctionListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState('');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('ทั้งหมด');
  const [province, setProvince] = useState('');
  const [sort, setSort] = useState('ปิดเร็วสุด');

  useReveal();
  const controls = useServiceControls();

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#7c3aed');
    r.style.setProperty('--accent-strong', '#6d28d9');
    r.style.setProperty('--accent-soft', '#f5f3ff');
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

  const auctions = listings
    .filter(d => d.status === 'posted' && d.deal_type === 'auction' && d.auction);

  let filtered = auctions
    .filter(d => cat === 'ทั้งหมด' || d.category === cat)
    .filter(d => !province || d.location === province)
    .filter(d => !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase())
    );

  if (sort === 'ราคา: น้อย→มาก') filtered = [...filtered].sort((a, b) => (a.auction?.leadingPrice || 0) - (b.auction?.leadingPrice || 0));
  else if (sort === 'ราคา: มาก→น้อย') filtered = [...filtered].sort((a, b) => (b.auction?.leadingPrice || 0) - (a.auction?.leadingPrice || 0));
  else filtered = [...filtered].sort((a, b) => {
    const ea = a.auction?.endsAt ? new Date(a.auction.endsAt).getTime() : Infinity;
    const eb = b.auction?.endsAt ? new Date(b.auction.endsAt).getTime() : Infinity;
    return ea - eb;
  });

  function AuctionCard({ listing, idx }: { listing: AuctionListing; idx: number }) {
    const a = listing.auction!;
    const firstImg = listing.images?.[0] ? imgUrl(listing.images[0]) : '';
    const c1 = CARD_BG[idx % CARD_BG.length], c2 = CARD_BG[(idx + 2) % CARD_BG.length];

    return (
      <Link href={`/marketplace/${listing.id}`} className="lc-card lc-card--auction reveal" style={{ ['--d' as string]: `${Math.min(idx * 30, 300)}ms` }}>
        <div className="lc-img" style={firstImg ? undefined : { background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}>
          {firstImg ? <img src={firstImg} alt={listing.title} loading="lazy" /> : <span style={{ fontSize: 40 }}>🔨</span>}
          <span className="lc-badge lc-badge--auction">ประมูล</span>
          {a.phase === 'live' && (
            <span className="lc-auction-timer">
              <AuctionCountdown endsAt={a.endsAt} endedAt={a.endedAt} />
            </span>
          )}
        </div>
        <div className="lc-body">
          <div className="lc-price">
            {a.bidCount > 0 ? 'ปัจจุบัน ' : 'เริ่ม '}
            ฿{a.leadingPrice.toLocaleString()}
          </div>
          <h3 className="lc-title">{listing.title}</h3>
          <div className="lc-auction-meta">
            <span>👥 {a.uniqueBidderCount} คน</span>
            <span>{a.currentBidderName ? `🏆 ${a.currentBidderName}` : 'ยังไม่มี bid'}</span>
            <span>+฿{a.bidIncrement.toLocaleString()}/bid</span>
          </div>
          <div className="lc-meta">
            {listing.location && <span>📍 {listing.location}</span>}
            {listing.condition && <span>{listing.condition}</span>}
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
      <ServiceDisabledNotice title="โซนประมูล" message={controls.message('marketplace')} backHref="/" backLabel="กลับหน้าหลัก" />
    );
  }

  return (
    <>
      <Nav active="auction" />

      <section className="mkt-hero mkt-hero--auction">
        <div className="container mkt-hero-inner">
          <div className="mkt-hero-top">
            <div className="mkt-hero-copy">
              <div className="kicker">โซนประมูล</div>
              <h1 className="mkt-headline reveal">
                ประมูลสินค้า <span className="gradient-text">แบบ real-time</span>
              </h1>
              <p className="mkt-sub reveal" style={{ ['--d' as string]: '60ms' }}>
                นับถอยหลัง · ดูผู้นำ · bid ได้ทันที — ปิดประมูลแล้วเข้าดีล escrow อัตโนมัติ
              </p>
            </div>
            <div className="mkt-hero-actions reveal" style={{ ['--d' as string]: '80ms' }}>
              <Link href="/marketplace" className="btn btn-ghost btn-sm">
                <Icon name="store" size={15} /> กลับตลาดสินค้า
              </Link>
              <Link href="/dashboard/seller" className="btn btn-primary btn-sm">
                🔨 ลงประมูล
              </Link>
            </div>
          </div>

          <div className="mkt-search reveal" style={{ ['--d' as string]: '100ms' }}>
            <Icon name="search" size={18} style={{ color: 'var(--faint)', flexShrink: 0 }} />
            <input type="search" placeholder="ค้นหาสินค้าประมูล…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </section>

      <div className="container mkt-feed">
        <div className="mkt-toolbar">
          <span className="mkt-count">
            {loading ? 'กำลังโหลด…' : <>🔨 ประมูล <b>{filtered.length}</b> รายการ</>}
          </span>
          <div className="mkt-toolbar-filters">
            <label className="mkt-filter-pill">
              <span className="mkt-filter-label">หมวด</span>
              <select value={cat} onChange={e => setCat(e.target.value)}>
                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="mkt-filter-pill">
              <span className="mkt-filter-label">จังหวัด</span>
              <select value={province} onChange={e => setProvince(e.target.value)}>
                <option value="">ทุกจังหวัด</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="mkt-filter-pill">
              <span className="mkt-filter-label">เรียง</span>
              <select value={sort} onChange={e => setSort(e.target.value)}>
                {['ปิดเร็วสุด', 'ราคา: น้อย→มาก', 'ราคา: มาก→น้อย', 'ล่าสุด'].map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="mkt-loading"><div className="mkt-spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="mkt-empty">
            <div className="mkt-empty-ic">🔨</div>
            <p>ยังไม่มีรายการประมูล</p>
            <div className="mkt-empty-actions">
              <Link href="/dashboard/seller" className="btn btn-primary btn-sm">ลงประมูลสินค้า</Link>
              <Link href="/marketplace" className="btn btn-soft btn-sm">ดูตลาดสินค้า</Link>
            </div>
          </div>
        ) : (
          <div className="mkt-grid">{filtered.map((item, i) => <AuctionCard key={item.id} listing={item} idx={i} />)}</div>
        )}
      </div>

      <Footer />
    </>
  );
}
