'use client';
import Image from 'next/image';
import { useState, useEffect, Suspense, useMemo } from 'react';
import { authHeaders } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { SubPageHeader } from '@/components/mobile/SubPageHeader';
import { DealFlowBrand } from '@/components/DealFlowBrand';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { FeeConfig, FEE_DEFAULTS, computeDealFees } from '@/lib/fees';
import { useServiceControls } from '@/lib/useServiceControls';
import { useUser } from '@/lib/useUser';
import { DealCreateMediaField, type CreateDealMedia } from '@/components/deal/DealCreateMediaField';
import { clampWarrantyInput, formatWarranty } from '@/lib/warranty';

const CATS = ['สินค้าทั่วไป', 'อิเล็กทรอนิกส์', 'เสื้อผ้า', 'ยานพาหนะ', 'อสังหาริมทรัพย์', 'บริการ', 'อื่นๆ'];
const FEE_PAYER_OPTIONS = [
  { key: 'buyer' as const, label: 'ผู้ซื้อจ่าย' },
  { key: 'seller' as const, label: 'ผู้ขายจ่าย' },
  { key: 'split' as const, label: 'หารครึ่ง' },
];
const ROLE_OPTIONS = {
  simple: [
    { key: 'seller', image: '/Seller.webp', imageAlt: 'Seller', desc: 'สร้างดีลแล้วส่งลิงก์ให้ผู้ซื้อเข้าร่วม' },
    { key: 'buyer', image: '/Buyer.webp', imageAlt: 'Buyer', desc: 'สร้างดีลแล้วส่งลิงก์ให้ผู้ขายเข้าร่วม' },
  ],
  regular: [
    { key: 'seller', image: '/Seller.webp', imageAlt: 'Seller', desc: 'สร้างดีลแล้วส่งลิงก์ให้อีกฝ่ายเข้าร่วม' },
    { key: 'buyer', image: '/Buyer.webp', imageAlt: 'Buyer', desc: 'สร้างดีลแล้วส่งลิงก์ให้อีกฝ่ายเข้าร่วม' },
  ],
} as const;

function CreateDealForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSimple = searchParams.get('type') === 'simple';
  const isSafeZone = searchParams.get('safezone') === '1';
  const controls = useServiceControls();
  const { user, loading: authLoading } = useUser();
  const loginHref = useMemo(() => {
    const q = searchParams.toString();
    return `/login?returnTo=${encodeURIComponent(q ? `/deal/create?${q}` : '/deal/create?type=simple')}`;
  }, [searchParams]);
  const [role, setRole] = useState<'seller' | 'buyer'>(searchParams.get('role') === 'buyer' ? 'buyer' : 'seller');
  const [title, setTitle] = useState(searchParams.get('title') || '');
  const [description, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [feePayer, setFeePayer] = useState<'buyer' | 'seller' | 'split'>('buyer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fees, setFees] = useState<FeeConfig>(FEE_DEFAULTS);
  const [media, setMedia] = useState<CreateDealMedia[]>([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [warrantyYears, setWarrantyYears] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('');
  const [warrantyDays, setWarrantyDays] = useState('');

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0'); r.style.setProperty('--accent-strong', '#1f54d6'); r.style.setProperty('--accent-soft', '#eef4ff');
    fetch('/api/fees').then(r => r.json()).then(d => { if (d.fees) setFees(d.fees); }).catch(() => {});
  }, []);

  const feeBreakdown = computeDealFees(fees, Number(price) || 0, isSimple ? 'simple' : '');
  const roleOptions = isSimple ? ROLE_OPTIONS.simple : ROLE_OPTIONS.regular;
  const serviceEnabled = isSimple ? controls.isEnabled('tradeSimple') : isSafeZone ? controls.isEnabled('meetupSafeZone') : controls.isEnabled('tradeOnline');
  const serviceMessage = isSimple
    ? controls.message('tradeSimple')
    : isSafeZone
      ? controls.message('meetupSafeZone')
      : controls.message('tradeOnline');

  if (!controls.loading && !serviceEnabled) {
    return (
      <ServiceDisabledNotice
        title={isSimple ? 'สร้างดีลแบบง่าย' : isSafeZone ? 'สร้างดีลนัดรับ Safe Zone' : 'สร้างดีลซื้อขายผ่านกลาง'}
        message={serviceMessage}
        backHref={isSafeZone ? '/service/meetup' : '/service/trade'}
        backLabel="กลับไปหน้าบริการ"
      />
    );
  }

  async function handleCreate() {
    if (!title || !price) { setError('กรุณากรอกชื่อและราคา'); return; }
    setLoading(true); setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          price: Number(price),
          category,
          creatorRole: role,
          source: 'private',
          wantedId: searchParams.get('wantedId') || '',
          dealType: isSimple ? 'simple' : '',
          serviceIntent: isSafeZone ? 'safezone' : '',
          ...(isSimple ? {
            imageFileIds: media.map(m => m.fileId),
            warrantyYears: clampWarrantyInput('years', warrantyYears),
            warrantyMonths: clampWarrantyInput('months', warrantyMonths),
            warrantyDays: clampWarrantyInput('days', warrantyDays),
            feePayer,
          } : {}),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'เกิดข้อผิดพลาด'); return; }
      router.push(`/deal/${d.deal.id}`);
    } catch { setError('เกิดข้อผิดพลาด'); }
    finally { setLoading(false); }
  }

  return (
    <div className="sub-page">
      <SubPageHeader backHref="/" title={isSimple ? 'สร้างดีลแบบง่าย' : 'สร้างดีลใหม่'} titleIcon="package" />

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px 80px' }}>
        <div className="deal-form create-deal-form">
          <DealFlowBrand docked />

          <div className="deal-field">
            <label>คุณเป็น...</label>
            <div className="svc-pick-grid">
              {roleOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`svc-pick-card svc-pick-card-role${role === option.key ? ' sel' : ''}`}
                  onClick={() => setRole(option.key)}
                >
                  <span className="svc-pick-role-media">
                    <Image
                      src={option.image}
                      alt={option.imageAlt}
                      fill
                      className="svc-pick-role-image"
                      sizes="(max-width: 559px) 100vw, 240px"
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="deal-field">
            <label>ชื่อสินค้า / บริการ *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="เช่น iPhone 15 Pro Max 256GB สภาพ 9/10" />
          </div>

          <div className="deal-field">
            <label>รายละเอียด</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={3} placeholder="สภาพ อุปกรณ์ที่แถม เงื่อนไขต่างๆ..." />
          </div>

          {isSimple && (
            <>
              {!authLoading && !user && (
                <div style={{ background: '#fff8e6', border: '1px solid #f0d080', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 14, fontSize: 13.5, color: '#7a5a00' }}>
                  🔐 ต้อง <Link href={loginHref} style={{ fontWeight: 700, textDecoration: 'underline' }}>เข้าสู่ระบบ</Link> ก่อนจึงจะอัปโหลดรูป/วิดีโอและสร้างดีลได้
                </div>
              )}
              <DealCreateMediaField
                items={media}
                onChange={setMedia}
                uploading={mediaUploading}
                onUploading={setMediaUploading}
                onError={setError}
                userId={user?.$id}
              />

              <div className="deal-field">
                <label>เงื่อนไขการประกัน</label>
                <p className="simple-deal-warranty-hint">กำหนดระยะเวลาประกัน (เว้นว่างทั้งหมด = ไม่มีประกัน)</p>
                <div className="simple-deal-warranty-row">
                  <label className="simple-deal-warranty-cell">
                    <span>ปี</span>
                    <input type="number" min={0} max={99} value={warrantyYears} onChange={e => setWarrantyYears(e.target.value)} placeholder="0" inputMode="numeric" />
                  </label>
                  <label className="simple-deal-warranty-cell">
                    <span>เดือน</span>
                    <input type="number" min={0} max={11} value={warrantyMonths} onChange={e => setWarrantyMonths(e.target.value)} placeholder="0" inputMode="numeric" />
                  </label>
                  <label className="simple-deal-warranty-cell">
                    <span>วัน</span>
                    <input type="number" min={0} max={30} value={warrantyDays} onChange={e => setWarrantyDays(e.target.value)} placeholder="0" inputMode="numeric" />
                  </label>
                </div>
                {formatWarranty(
                  clampWarrantyInput('years', warrantyYears),
                  clampWarrantyInput('months', warrantyMonths),
                  clampWarrantyInput('days', warrantyDays),
                ) && (
                  <p className="simple-deal-warranty-preview">
                    🛡️ ประกัน {formatWarranty(
                      clampWarrantyInput('years', warrantyYears),
                      clampWarrantyInput('months', warrantyMonths),
                      clampWarrantyInput('days', warrantyDays),
                    )}
                  </p>
                )}
              </div>

              <div className="deal-field">
                <label>ผู้จ่ายค่าบริการ (ค่ากลาง) *</label>
                <p className="simple-deal-warranty-hint">กำหนดตอนสร้างดีล — อีกฝ่ายเห็นค่านี้ทันที ไม่ต้องเลือกซ้ำ</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {FEE_PAYER_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setFeePayer(opt.key)}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        borderRadius: 'var(--r-md)',
                        border: `2px solid ${feePayer === opt.key ? 'var(--accent)' : 'var(--line)'}`,
                        background: feePayer === opt.key ? 'var(--accent-soft)' : 'var(--surface)',
                        color: feePayer === opt.key ? 'var(--accent-strong)' : 'var(--ink-2)',
                        fontWeight: feePayer === opt.key ? 700 : 500,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="field-row">
            <div className="deal-field">
              <label>ราคา (บาท) *</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0" placeholder="0" />
            </div>
            <div className="deal-field">
              <label>หมวดหมู่</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">เลือก...</option>
                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {Number(price) > 0 && (
            <div style={{ background: 'var(--accent-soft)', border: '1px solid #d7e3ff', borderRadius: 'var(--r-md)', padding: '12px 14px', marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>💸 ค่าบริการโดยประมาณ ({isSimple ? 'ซื้อขายแบบง่าย' : 'ซื้อขายผ่านกลาง'})</div>
              {feeBreakdown.lines.map(l => (
                <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', padding: '2px 0' }}>
                  <span>{l.label}</span><span>฿{l.amount.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', borderTop: '1px solid #d7e3ff', marginTop: 6, paddingTop: 6 }}>
                <span>รวมค่าบริการ</span><span>฿{feeBreakdown.total.toLocaleString()}</span>
              </div>
              {isSimple && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                  ผู้จ่าย: {FEE_PAYER_OPTIONS.find(o => o.key === feePayer)?.label}
                </div>
              )}
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>* {feeBreakdown.note} · อัตราตามที่ระบบกำหนด แสดงให้ทราบก่อนเริ่มดีล</div>
            </div>
          )}

          {error && <p style={{ color: '#b22441', fontSize: 14, marginTop: 4 }}>⚠️ {error}</p>}

          <button onClick={handleCreate} disabled={loading || mediaUploading || !serviceEnabled || authLoading || !user} className="btn btn-primary btn-block btn-lg" style={{ marginTop: 18 }}>
            {loading ? 'กำลังสร้าง...' : 'สร้างดีล & รับลิงก์แชร์'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--muted)', marginTop: 12 }}>หลังสร้าง คัดลอกลิงก์จากหน้าดีลและส่งให้อีกฝ่าย</p>
        </div>
      </div>
    </div>
  );
}

export default function CreateDeal() {
  return (
    <Suspense fallback={<div className="mkt-detail-loading" />}>
      <CreateDealForm />
    </Suspense>
  );
}
