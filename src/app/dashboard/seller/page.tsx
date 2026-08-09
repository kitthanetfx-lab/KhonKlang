'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useCallback } from 'react';
import { supabase, authHeaders, fileViewUrl, DEAL_BUCKET } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { isCertifiedMode } from '@/lib/listingMode';
import { computeMarketplaceGp, computeAuctionGp, FEE_DEFAULTS, type FeeConfig } from '@/lib/fees';
import { AUCTION_DURATION_OPTIONS } from '@/lib/auction';
import { ShippingCarrierPicker } from '@/components/ShippingCarrierPicker';
import { getLogisticsProviderLabel } from '@/lib/logistics';

interface Deal {
  id: string; seller_id: string; seller_name: string; middleman_id: string; middleman_name: string;
  title: string; description: string; price: number; list_gross_price?: number | null;
  category: string; condition: string;
  location: string; selling_mode: string; images: string[]; status: string;
  reject_reason: string; created_at: string; deal_type?: string; source?: string;
  shipping_cost?: number; shipping_providers?: string[];
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

interface ShopStats {
  listingCount: number;
  soldCount: number;
  boughtCount: number;
  successfulDeals: number;
  reviewScore: number;
  reviewCount: number;
}

function imgUrl(fileId: string) { return fileViewUrl(DEAL_BUCKET, fileId); }

function stars(score: number) {
  const full = Math.round(score);
  return '★'.repeat(Math.min(5, full)) + '☆'.repeat(Math.max(0, 5 - full));
}

interface UploadedImage { fileId: string; url: string; name: string; }

export default function SellerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tab, setTab] = useState<'selling' | 'packing' | 'shipping' | 'done' | 'history'>('selling');
  const [postModal, setPostModal] = useState<null | 'pick' | 'listing' | 'auction'>(null);
  const [myId, setMyId] = useState('');

  const [shopName, setShopName] = useState('');
  const [shopTagline, setShopTagline] = useState('');
  const [shopLocation, setShopLocation] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPublic, setShopPublic] = useState(false);
  const [shopAvatarFileId, setShopAvatarFileId] = useState('');
  const [shopBannerFileId, setShopBannerFileId] = useState('');
  const [shopAvatarUrl, setShopAvatarUrl] = useState('');
  const [shopBannerUrl, setShopBannerUrl] = useState('');
  const [shopStats, setShopStats] = useState<ShopStats | null>(null);
  const [shopEditOpen, setShopEditOpen] = useState(false);
  const [shopImageUploading, setShopImageUploading] = useState('');
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
  const [feeConfig, setFeeConfig] = useState<FeeConfig>(FEE_DEFAULTS);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [postDone, setPostDone] = useState(false);
  const [bidIncrement, setBidIncrement] = useState('10');
  const [durationHours, setDurationHours] = useState(72);
  const [shippingCost, setShippingCost] = useState('0');
  const [shippingProviders, setShippingProviders] = useState<string[]>([]);
  const [carrierPickerOpen, setCarrierPickerOpen] = useState(false);
  const [editDealId, setEditDealId] = useState('');

  function resetListingForm() {
    setTitle(''); setDescription(''); setPrice(''); setCategory(''); setCondition(''); setLocation('');
    setImages([]); setPostError(''); setBidIncrement('10'); setDurationHours(72);
    setShippingCost('0'); setShippingProviders([]); setEditDealId('');
  }

  function closePostModal() {
    setPostModal(null);
    resetListingForm();
    setPostDone(false);
  }

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
          setShopTagline(s.shopTagline || '');
          setShopLocation(s.shopLocation || '');
          setShopAddress(s.shopAddress || '');
          setShopPublic(Boolean(s.shopPublic));
          setShopAvatarFileId(s.shopAvatarFileId || '');
          setShopBannerFileId(s.shopBannerFileId || '');
          if (s.shopAvatarFileId) setShopAvatarUrl(fileViewUrl(DEAL_BUCKET, s.shopAvatarFileId));
          if (s.shopBannerFileId) setShopBannerUrl(fileViewUrl(DEAL_BUCKET, s.shopBannerFileId));
          if (shopData.stats) setShopStats(shopData.stats);
        }
        await fetchDeals(headers);
        fetch('/api/fees').then(r => r.json()).then(d => { if (d.fees) setFeeConfig(d.fees); }).catch(() => {});
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

  async function uploadShopImage(kind: 'avatar' | 'banner', file: File) {
    setShopImageUploading(kind);
    setShopError('');
    try {
      const headers = await authHeaders();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload-deal', { method: 'POST', headers, body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'อัปโหลดไม่สำเร็จ');
      if (kind === 'avatar') {
        setShopAvatarFileId(d.fileId);
        setShopAvatarUrl(d.url || fileViewUrl(DEAL_BUCKET, d.fileId));
      } else {
        setShopBannerFileId(d.fileId);
        setShopBannerUrl(d.url || fileViewUrl(DEAL_BUCKET, d.fileId));
      }
    } catch (err: unknown) {
      setShopError(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setShopImageUploading('');
    }
  }

  async function saveShop() {
    setShopSaving(true);
    setShopSaved(false);
    setShopError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/seller/shop', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName, shopTagline, shopLocation, shopAddress, shopPublic,
          shopAvatarFileId, shopBannerFileId,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'บันทึกไม่สำเร็จ');
      if (d.stats) setShopStats(d.stats);
      setShopSaved(true);
      setShopEditOpen(false);
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
    if (shippingProviders.length === 0) { setPostError('กรุณาเลือกขนส่งอย่างน้อย 1 รายการ'); return; }
    if (editDealId) { await handleUpdateListing(); return; }
    setPosting(true); setPostError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, price: Number(price), listGrossPrice: Number(price),
          category, condition, location, sellingMode: 'escrow,chat',
          shippingCost: Number(shippingCost) || 0, shippingProviders,
          imageFileIds: images.map(i => i.fileId), creatorRole: 'seller', source: 'listing',
        }),
      });
      if (!res.ok) { const d = await res.json(); setPostError(d.error || 'เกิดข้อผิดพลาด'); return; }
      setPostDone(true);
      resetListingForm();
      await fetchDeals(headers);
      setTimeout(() => { setPostDone(false); closePostModal(); setTab('selling'); }, 1800);
    } catch (err: unknown) {
      setPostError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally { setPosting(false); }
  }

  async function handlePostAuction() {
    if (!title || !price) { setPostError('กรุณากรอกชื่อสินค้าและราคาเริ่มต้น'); return; }
    if (!condition) { setPostError('กรุณาเลือกสภาพสินค้า'); return; }
    if (shippingProviders.length === 0) { setPostError('กรุณาเลือกขนส่งอย่างน้อย 1 รายการ'); return; }
    if (editDealId) { await handleUpdateListing(); return; }
    const inc = Math.max(1, Math.round(Number(bidIncrement) || 10));
    setPosting(true); setPostError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, price: Number(price), listGrossPrice: Number(price),
          category, condition, location, creatorRole: 'seller', source: 'listing',
          shippingCost: Number(shippingCost) || 0, shippingProviders,
          dealType: 'auction', imageFileIds: images.map(i => i.fileId),
          auctionData: { bidIncrement: inc, durationHours },
        }),
      });
      if (!res.ok) { const d = await res.json(); setPostError(d.error || 'เกิดข้อผิดพลาด'); return; }
      setPostDone(true);
      resetListingForm();
      await fetchDeals(headers);
      setTimeout(() => { setPostDone(false); closePostModal(); setTab('selling'); }, 1800);
    } catch (err: unknown) {
      setPostError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally { setPosting(false); }
  }

  function openEditListing(deal: Deal) {
    setEditDealId(deal.id);
    setTitle(deal.title);
    setDescription(deal.description || '');
    setPrice(String(deal.list_gross_price ?? deal.price ?? ''));
    setCategory(deal.category || '');
    setCondition(deal.condition || '');
    setLocation(deal.location || '');
    setShippingCost(String(deal.shipping_cost ?? 0));
    setShippingProviders(Array.isArray(deal.shipping_providers) ? deal.shipping_providers : []);
    setImages((deal.images || []).map(fileId => ({ fileId, url: imgUrl(fileId), name: '' })));
    setPostError('');
    setPostDone(false);
    setPostModal(deal.deal_type === 'auction' ? 'auction' : 'listing');
  }

  async function handleUpdateListing() {
    if (!editDealId) return;
    setPosting(true); setPostError('');
    try {
      const headers = await authHeaders();
      const inc = Math.max(1, Math.round(Number(bidIncrement) || 10));
      const res = await fetch(`/api/deals/${editDealId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_listing',
          title, description, price: Number(price), category, condition, location,
          shippingCost: Number(shippingCost) || 0, shippingProviders,
          imageFileIds: images.map(i => i.fileId),
          ...(postModal === 'auction' ? { auctionData: { bidIncrement: inc, durationHours } } : {}),
        }),
      });
      if (!res.ok) { const d = await res.json(); setPostError(d.error || 'บันทึกไม่สำเร็จ'); return; }
      setPostDone(true);
      resetListingForm();
      await fetchDeals(headers);
      setTimeout(() => { setPostDone(false); closePostModal(); setTab('selling'); }, 1800);
    } catch (err: unknown) {
      setPostError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally { setPosting(false); }
  }

  const SELLING_STATUSES = ['posted', 'payment_pending', 'payment_uploaded', 'buyer_joined', 'terms_pending'];
  const PACKING_STATUSES = ['packing'];
  const SHIPPING_STATUSES = ['shipped_to_buyer', 'delivered'];
  const DONE_STATUSES = ['completed'];
  const HISTORY_STATUSES = ['cancelled', 'disputed', 'shipped_to_middleman', 'middleman_received', 'middleman_checking'];

  const myListings = deals.filter(d => d.seller_id === myId);
  const sellingDeals = myListings.filter(d => SELLING_STATUSES.includes(d.status));
  const packingDeals = myListings.filter(d => d.source === 'listing' && PACKING_STATUSES.includes(d.status));
  const shippingDeals = myListings.filter(d => d.source === 'listing' && SHIPPING_STATUSES.includes(d.status));
  const doneDeals = myListings.filter(d => d.source === 'listing' && DONE_STATUSES.includes(d.status));
  const historyDeals = myListings.filter(d => HISTORY_STATUSES.includes(d.status) || (d.source !== 'listing' && DONE_STATUSES.includes(d.status)));
  const totalRev = myListings.filter(d => d.status === 'completed').reduce((s, d) => s + (d.price || 0), 0);
  const listingGpPreview = price && Number(price) > 0 && postModal === 'listing' ? computeMarketplaceGp(feeConfig, Number(price)) : null;
  const auctionGpPreview = price && Number(price) > 0 && postModal === 'auction' ? computeAuctionGp(feeConfig, Number(price)) : null;

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
                {deal.deal_type === 'auction' && <span style={{ color: '#7c3aed', fontWeight: 700 }}>🔨 ประมูล</span>}
                {isCertifiedMode(deal.selling_mode) && <span style={{ color: 'var(--amber-500)', fontWeight: 700 }}>⭐ Certified</span>}
              </div>
            </div>
          </div>
          <span className={`sb ${STATUS_CLS[deal.status] || 'sb-gray'}`}>{STATUS_LABEL[deal.status] || deal.status}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
          {deal.status === 'posted' && deal.source === 'listing' && (
            <button type="button" className="btn btn-soft btn-sm" onClick={() => openEditListing(deal)}>✏️ แก้ไข</button>
          )}
          <Link href={deal.status === 'posted' ? `/marketplace/${deal.id}` : `/deal/${deal.id}`} className="btn btn-ghost btn-sm">
            {deal.status === 'posted' ? '📋 ดูประกาศ →' : '💬 เข้าห้องดีล →'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-root">
      <header className="dash-header">
        <button onClick={() => router.back()} className="dash-back"><Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} /></button>
        <div className="dash-head-info"><div className="dash-head-title">🏪 ร้านของฉัน</div></div>
        <div className="dash-head-actions"><button className="btn btn-primary btn-sm" onClick={() => { setPostError(''); setPostDone(false); setPostModal('pick'); }}>+ ลงขาย</button></div>
      </header>

      <section className="dash-body" style={{ paddingBottom: 0 }}>
        {shopError && <div className="shop-alert shop-alert--err">⚠️ {shopError}</div>}
        {shopSaved && <div className="shop-alert shop-alert--ok">✅ บันทึกป้ายร้านแล้ว</div>}

        <div className="shop-sign-card">
          <div
            className="shop-sign-banner"
            style={shopBannerUrl ? { backgroundImage: `url(${shopBannerUrl})` } : undefined}
          >
            {!shopBannerUrl && <div className="shop-sign-banner-fallback" />}
            {shopEditOpen && (
              <label className="shop-sign-upload shop-sign-upload--banner">
                {shopImageUploading === 'banner' ? '⏳' : '📷 เปลี่ยนแบนเนอร์'}
                <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void uploadShopImage('banner', f); e.target.value = ''; }} />
              </label>
            )}
          </div>
          <div className="shop-sign-body">
            <div className="shop-sign-avatar-wrap">
              {shopAvatarUrl ? (
                <img src={shopAvatarUrl} alt="" className="shop-sign-avatar" />
              ) : (
                <div className="shop-sign-avatar shop-sign-avatar--empty">🏪</div>
              )}
              {shopEditOpen && (
                <label className="shop-sign-upload shop-sign-upload--avatar">
                  {shopImageUploading === 'avatar' ? '⏳' : '📷'}
                  <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void uploadShopImage('avatar', f); e.target.value = ''; }} />
                </label>
              )}
            </div>
            <div className="shop-sign-info">
              <h2 className="shop-sign-name">{shopName || 'ตั้งชื่อร้านของคุณ'}</h2>
              {shopTagline && <p className="shop-sign-tagline">{shopTagline}</p>}
              {shopLocation && <p className="shop-sign-loc">📍 {shopLocation}</p>}
            </div>
            <div className="shop-sign-actions">
              {shopPublic && shopName && myId && (
                <Link href={`/shop/${myId}`} className="btn btn-ghost btn-sm" target="_blank">ดูหน้าร้าน ↗</Link>
              )}
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setShopEditOpen(v => !v)}>
                {shopEditOpen ? 'ปิดการแก้ไข' : '✏️ แก้ป้ายร้าน'}
              </button>
            </div>
          </div>
          {shopStats && (
            <div className="shop-sign-stats">
              <div className="shop-sign-stat"><span className="shop-sign-stat-val">{shopStats.listingCount}</span><span className="shop-sign-stat-lbl">สินค้าในร้าน</span></div>
              <div className="shop-sign-stat"><span className="shop-sign-stat-val">{shopStats.soldCount}</span><span className="shop-sign-stat-lbl">ขายแล้ว</span></div>
              <div className="shop-sign-stat"><span className="shop-sign-stat-val">{shopStats.boughtCount}</span><span className="shop-sign-stat-lbl">ซื้อสำเร็จ</span></div>
              <div className="shop-sign-stat"><span className="shop-sign-stat-val">{shopStats.successfulDeals}</span><span className="shop-sign-stat-lbl">ดีลสำเร็จ</span></div>
              <div className="shop-sign-stat shop-sign-stat--rating">
                <span className="shop-sign-stat-val">{shopStats.reviewScore > 0 ? shopStats.reviewScore.toFixed(1) : '—'}</span>
                <span className="shop-sign-stat-lbl">{shopStats.reviewCount > 0 ? `${stars(shopStats.reviewScore)} (${shopStats.reviewCount})` : 'ยังไม่มีรีวิว'}</span>
              </div>
            </div>
          )}
        </div>

        {shopEditOpen && (
          <div className="form-section shop-edit-panel">
            <h3 style={{ marginBottom: 12 }}>ตั้งค่าป้ายร้าน</h3>
            <div className="form-field">
              <label>แบนเนอร์ร้าน</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {shopBannerUrl && (
                  <img src={shopBannerUrl} alt="" style={{ width: 120, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
                )}
                <label className="btn btn-soft btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                  {shopImageUploading === 'banner' ? 'กำลังอัปโหลด...' : shopBannerUrl ? 'เปลี่ยนแบนเนอร์' : 'อัปโหลดแบนเนอร์'}
                  <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void uploadShopImage('banner', f); e.target.value = ''; }} />
                </label>
              </div>
            </div>
            <div className="form-field">
              <label>ชื่อร้าน</label>
              <input type="text" value={shopName} onChange={e => setShopName(e.target.value)} placeholder="เช่น Kitt IT Shop" maxLength={120} />
            </div>
            <div className="form-field">
              <label>คำโปรยร้าน</label>
              <input type="text" value={shopTagline} onChange={e => setShopTagline(e.target.value)} placeholder="เช่น ของมือสองคุณภาพ ส่งไวทั่วไทย" maxLength={200} />
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
            <label className="filter-row shop-public-toggle" onClick={() => setShopPublic(v => !v)}>
              <span>เปิดหน้าร้าน public ให้ผู้ซื้อเข้าชมได้</span>
              <input type="checkbox" checked={shopPublic} readOnly />
            </label>
            <button type="button" className="btn btn-primary btn-sm" onClick={saveShop} disabled={shopSaving}>
              {shopSaving ? 'กำลังบันทึก...' : 'บันทึกป้ายร้าน'}
            </button>
          </div>
        )}
      </section>

      <nav className="dash-tabs-wrap">
        {([
          { k: 'selling', l: `กำลังขาย (${sellingDeals.length})` },
          { k: 'packing', l: `ขอแพคกิ้ง (${packingDeals.length})` },
          { k: 'shipping', l: `เตรียมจัดส่ง (${shippingDeals.length})` },
          { k: 'done', l: `สำเร็จ (${doneDeals.length})` },
          { k: 'history', l: `ประวัติ (${historyDeals.length})` },
        ] as const).map(({ k, l }) => (
          <button key={k} className={`dash-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>

      <main className="dash-body">
        <div className="dash-stats">
          <div className="dash-stat"><div className="dash-stat-val">{packingDeals.length}</div><div className="dash-stat-lbl">รอแพค</div></div>
          <div className="dash-stat"><div className="dash-stat-val">{shippingDeals.length}</div><div className="dash-stat-lbl">กำลังส่ง</div></div>
          <div className="dash-stat"><div className="dash-stat-val">{doneDeals.length}</div><div className="dash-stat-lbl">สำเร็จ</div></div>
          <div className="dash-stat"><div className="dash-stat-val" style={{ fontSize: 17 }}>฿{totalRev.toLocaleString()}</div><div className="dash-stat-lbl">รายได้รวม</div></div>
        </div>

        {tab === 'selling' && (sellingDeals.length === 0 ? (
          <div className="dash-empty">
            <div className="dash-empty-icon">📦</div>
            <p>ยังไม่มีประกาศที่กำลังดำเนินการ</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setPostModal('pick')}>+ ลงประกาศใหม่</button>
          </div>
        ) : sellingDeals.map(d => <DealCard key={d.id} deal={d} />))}

        {tab === 'packing' && (packingDeals.length === 0 ? <div className="dash-empty"><p>ไม่มีสินค้ารอแพค</p></div> : packingDeals.map(d => <DealCard key={d.id} deal={d} />))}

        {tab === 'shipping' && (shippingDeals.length === 0 ? <div className="dash-empty"><p>ไม่มีสินค้ารอจัดส่ง</p></div> : shippingDeals.map(d => <DealCard key={d.id} deal={d} />))}

        {tab === 'done' && (doneDeals.length === 0 ? <div className="dash-empty"><p>ยังไม่มีออเดอร์สำเร็จ</p></div> : doneDeals.map(d => <DealCard key={d.id} deal={d} />))}

        {tab === 'history' && (historyDeals.length === 0 ? <div className="dash-empty"><p>ยังไม่มีประวัติการขาย</p></div> : historyDeals.map(d => <DealCard key={d.id} deal={d} />))}
      </main>

      {postModal && (
        <div className="seller-modal-backdrop" onClick={closePostModal}>
          <div className="seller-modal" onClick={e => e.stopPropagation()}>
            <button type="button" className="seller-modal-close" onClick={closePostModal} aria-label="ปิด">×</button>

            {postModal === 'pick' && (
              <>
                <h3 className="seller-modal-title">เลือกประเภทการลงขาย</h3>
                <p className="seller-modal-sub">เลือกรูปแบบที่ต้องการลงในตลาด</p>
                <div className="seller-modal-pick-grid">
                  <button type="button" className="seller-modal-pick" onClick={() => { setPostError(''); setPostModal('listing'); }}>
                    <span className="seller-modal-pick-ic">🛒</span>
                    <strong>ลงขายสินค้า</strong>
                    <span>ราคาตายตัว แสดงในตลาดทันที</span>
                  </button>
                  <button type="button" className="seller-modal-pick seller-modal-pick--auction" onClick={() => { setPostError(''); setPostModal('auction'); }}>
                    <span className="seller-modal-pick-ic">🔨</span>
                    <strong>ลงสินค้าประมูล</strong>
                    <span>เปิดรับ bid มีเวลานับถอยหลัง</span>
                  </button>
                </div>
              </>
            )}

            {(postModal === 'listing' || postModal === 'auction') && (
              <div className="seller-modal-form">
                <button type="button" className="seller-modal-back-link" onClick={() => { setEditDealId(''); setPostModal('pick'); }}>← เลือกประเภทอื่น</button>
                <h3 className="seller-modal-title">
                  {editDealId ? 'แก้ไขประกาศ' : postModal === 'auction' ? 'ลงสินค้าประมูล' : 'ลงขายสินค้า'}
                </h3>
                {postDone && <div className="shop-alert shop-alert--ok">{editDealId ? '✅ บันทึกการแก้ไขแล้ว!' : '✅ ลงประกาศสำเร็จ!'}</div>}
                {postError && <div className="shop-alert shop-alert--err">⚠️ {postError}</div>}

                <div className="form-field">
                  <label>รูปภาพสินค้า</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {images.map(img => (
                      <div key={img.fileId} style={{ position: 'relative' }}>
                        <img src={img.url} alt={img.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--r-md)' }} />
                        <button type="button" onClick={() => removeImage(img.fileId)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--rose-500)', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                    <label className="img-upload-box" style={{ width: 72, height: 72, padding: 0, margin: 0 }}>
                      <span style={{ fontSize: 20 }}>{uploading ? '⏳' : '📷'}</span>
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
                    <label>{postModal === 'auction' ? 'ราคาเริ่มประมูล (บาท) *' : 'ราคาที่คุณต้องการได้ (บาท) *'}</label>
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

                {postModal === 'auction' && (
                  <div className="form-row-2">
                    <div className="form-field" style={{ margin: 0 }}>
                      <label>บิทครั้งละ (บาท) *</label>
                      <input type="number" value={bidIncrement} onChange={e => setBidIncrement(e.target.value)} min="1" placeholder="10" />
                    </div>
                    <div className="form-field" style={{ margin: 0 }}>
                      <label>ระยะเวลาประมูล</label>
                      <select value={durationHours} onChange={e => setDurationHours(Number(e.target.value))}>
                        {AUCTION_DURATION_OPTIONS.map(o => (
                          <option key={o.hours} value={o.hours}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {listingGpPreview && (
                  <div className="gp-preview-box">
                    <div className="gp-preview-row gp-preview-row--muted">
                      <span>ราคาที่คุณตั้ง</span>
                      <span>฿{listingGpPreview.sellerPrice.toLocaleString()}</span>
                    </div>
                    <div className="gp-preview-row gp-preview-row--muted">
                      <span>บวก GP {listingGpPreview.gpPercent}%</span>
                      <span>+฿{listingGpPreview.gpAmount.toLocaleString()}</span>
                    </div>
                    <div className="gp-preview-row">
                      <span>ราคาที่ผู้บริโภคเห็นในตลาด</span>
                      <strong>฿{listingGpPreview.displayPrice.toLocaleString()}</strong>
                    </div>
                    <div className="gp-preview-row gp-preview-row--accent">
                      <span>คอมมิชชั่นคืนคุณ ({listingGpPreview.commissionPercent}% ของ GP)</span>
                      <strong>+฿{listingGpPreview.sellerCommission.toLocaleString()}</strong>
                    </div>
                    <div className="gp-preview-row gp-preview-row--total">
                      <span>รายได้คุณเมื่อขายได้</span>
                      <strong>฿{listingGpPreview.sellerReceive.toLocaleString()}</strong>
                    </div>
                  </div>
                )}

                {auctionGpPreview && (
                  <div className="gp-preview-box">
                    <div className="gp-preview-row gp-preview-row--muted">
                      <span>ราคาเปิดประมูล (ผู้ซื้อ bid จากราคานี้)</span>
                      <span>฿{Number(price).toLocaleString()}</span>
                    </div>
                    <p className="gp-preview-row gp-preview-row--muted" style={{ fontSize: 12, margin: '0 0 6px' }}>
                      ตัวอย่างถ้าปิดที่ ฿{auctionGpPreview.finalPrice.toLocaleString()}
                    </p>
                    <div className="gp-preview-row">
                      <span>ผู้ชนะจ่าย</span>
                      <strong>฿{auctionGpPreview.finalPrice.toLocaleString()}</strong>
                    </div>
                    <div className="gp-preview-row gp-preview-row--muted">
                      <span>หัก GP {auctionGpPreview.gpPercent}%</span>
                      <span>−฿{auctionGpPreview.gpAmount.toLocaleString()}</span>
                    </div>
                    <div className="gp-preview-row gp-preview-row--accent">
                      <span>คืนคุณ ({auctionGpPreview.commissionPercent}% ของ GP)</span>
                      <strong>+฿{auctionGpPreview.sellerCommission.toLocaleString()}</strong>
                    </div>
                    <div className="gp-preview-row gp-preview-row--total">
                      <span>คุณได้รับสุทธิ</span>
                      <strong>฿{auctionGpPreview.sellerReceive.toLocaleString()}</strong>
                    </div>
                  </div>
                )}

                <div className="form-row-2">
                  <div className="form-field" style={{ margin: 0 }}>
                    <label>ค่าขนส่ง (บาท)</label>
                    <input type="number" value={shippingCost} onChange={e => setShippingCost(e.target.value)} placeholder="0" min="0" />
                  </div>
                  <div className="form-field" style={{ margin: 0 }}>
                    <label>ขนส่งที่รองรับ *</label>
                    <button type="button" className="btn btn-soft btn-block seller-shipping-pick" onClick={() => setCarrierPickerOpen(true)}>
                      {shippingProviders.length > 0
                        ? `เลือกแล้ว ${shippingProviders.length} รายการ`
                        : 'เลือกขนส่ง...'}
                    </button>
                  </div>
                </div>
                {shippingProviders.length > 0 && (
                  <div className="seller-shipping-chips">
                    {shippingProviders.map(id => (
                      <span key={id} className="seller-shipping-chip">{getLogisticsProviderLabel(id)}</span>
                    ))}
                  </div>
                )}

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
                  <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="รายละเอียดสินค้า..." />
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={postModal === 'auction' ? handlePostAuction : handlePost}
                  disabled={posting || postDone || uploading}
                >
                  {posting
                    ? (editDealId ? 'กำลังบันทึก...' : 'กำลังลงประกาศ...')
                    : editDealId
                      ? 'บันทึกการแก้ไข'
                      : postModal === 'auction'
                        ? 'เปิดประมูล'
                        : 'ลงประกาศ'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ShippingCarrierPicker
        open={carrierPickerOpen}
        selected={shippingProviders}
        onClose={() => setCarrierPickerOpen(false)}
        onConfirm={next => { setShippingProviders(next); setCarrierPickerOpen(false); }}
      />
    </div>
  );
}
