'use client';
import Image from 'next/image';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authHeaders } from '@/lib/supabase';
import { AddressPicker, EMPTY_ADDRESS, ThaiAddress, addressLabel } from '@/components/AddressPicker';
import { HeaderAccountActions } from '@/components/HeaderAccountActions';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { DealFlowBrand } from '@/components/DealFlowBrand';
import { RATE_PER_KM } from '@/lib/provinceGeo';
import { useServiceControls } from '@/lib/useServiceControls';

const PLATFORM = 50;
const CATS = ['สินค้าทั่วไป', 'อิเล็กทรอนิกส์', 'เสื้อผ้า', 'ยานพาหนะ', 'อสังหาริมทรัพย์', 'บริการ', 'อื่นๆ'];
const MODES = [
  { title: 'รับประกันเดินทาง EzDrive', href: '/service/meetup?step=2', image: '/Drive/Ezdrive.webp', kind: 'guarantee' as const },
  { title: 'Safedrive นัดรับเซฟโซน', href: '/deal/create?safezone=1', image: '/Drive/Safedrive.webp', kind: 'safezone' as const },
];

function MeetupInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const controls = useServiceControls();
  const preset = sp.get('step') === '2';
  const [feeWho] = useState('split');
  const [step, setStep] = useState<1 | 2>(preset ? 2 : 1);

  const [myRole, setMyRole] = useState<'buyer' | 'seller'>(sp.get('role') === 'seller' ? 'seller' : 'buyer');
  const [title, setTitle] = useState(sp.get('title') || '');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(sp.get('price') || '');
  const [category, setCategory] = useState('');
  const [myAddr, setMyAddr] = useState<ThaiAddress>(EMPTY_ADDRESS);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (step === 2) {
      const r = document.documentElement;
      r.style.setProperty('--accent', '#2f6bf0');
      r.style.setProperty('--accent-strong', '#1f54d6');
      r.style.setProperty('--accent-soft', '#eef4ff');
    }
  }, [step]);

  const total = PLATFORM;
  const buyerFee = feeWho === 'split' ? total / 2 : feeWho === 'buyer' ? total : 0;
  const sellerFee = feeWho === 'split' ? total / 2 : feeWho === 'seller' ? total : 0;
  const guaranteeEnabled = controls.isEnabled('meetupGuarantee');
  const safeZoneEnabled = controls.isEnabled('meetupSafeZone');

  if (!controls.loading && !guaranteeEnabled && !safeZoneEnabled) {
    return <ServiceDisabledNotice title="นัดรับผ่านกลาง" message={controls.message('meetupGuarantee')} />;
  }

  async function createGuaranteeDeal() {
    if (!title.trim()) { setError('กรุณากรอกชื่อสินค้า/สิ่งที่นัดรับ'); return; }
    if (!myAddr.province || !myAddr.amphoe || !myAddr.tambon) { setError('กรุณาเลือกที่อยู่ของคุณให้ครบถึงระดับตำบล'); return; }
    setCreating(true); setError('');
    try {
      const headers = await authHeaders();
      const meetupData = JSON.stringify({
        v: 2,
        [myRole === 'buyer' ? 'buyerLoc' : 'sellerLoc']: myAddr,
        ratePerKm: RATE_PER_KM,
        fee: total, feeWho, buyerFee, sellerFee,
      });
      const autoDesc = `ฝั่ง${myRole === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}: ${addressLabel(myAddr)} — จุดนัดพบและยอดประกันตกลงกันในห้องดีล`;
      const finalDesc = description.trim() ? `${description.trim()}\n${autoDesc}` : autoDesc;
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `นัดรับ+ประกันเดินทาง: ${title.trim()}`,
          description: finalDesc,
          price: Number(price) || 0,
          category: category || 'นัดรับผ่านกลาง',
          creatorRole: myRole,
          source: 'private',
          dealType: 'meetup',
          meetupData,
          wantedId: sp.get('wantedId') || '',
          inviteUserId: sp.get('inviteUserId') || '',
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'สร้างดีลไม่สำเร็จ'); return; }
      router.push(`/deal/${d.deal.id}`);
    } catch {
      router.push(`/login?returnTo=${encodeURIComponent('/service/meetup')}`);
    } finally { setCreating(false); }
  }

  return (
    <div className="sub-page service-sub-page service-trade-page service-meetup-page">
      <header className="sub-header">
        <Link href="/" className="sub-back" aria-label="ย้อนกลับ">
          <span className="sub-back-arrow">←</span>
          <span className="sub-back-text">ย้อนกลับ</span>
        </Link>
        <span className="sub-htitle">นัดรับผ่านกลาง</span>
        <HeaderAccountActions />
      </header>

      {step === 1 && (
        <div className="svc-inner">
          <div className="svc-hero">
            <div className="svc-hero-icon">🚗</div>
            <h1 className="svc-hero-title">เลือกรูปแบบบริการ</h1>
          </div>
          <div className="svc-modes">
            {MODES.map(m => {
              const enabled = m.kind === 'guarantee' ? guaranteeEnabled : safeZoneEnabled;
              const note = m.kind === 'guarantee' ? controls.message('meetupGuarantee') : controls.message('meetupSafeZone');
              return enabled ? (
                <Link key={m.title} href={m.href} className="svc-mode">
                  <div className="svc-mode-media">
                    <Image src={m.image} alt={m.title} fill className="svc-mode-image" sizes="(max-width: 519px) 100vw, 50vw" />
                  </div>
                  <div className="svc-mode-title">{m.title}</div>
                  <div className="svc-mode-cta">เริ่มต้น <span>→</span></div>
                </Link>
              ) : (
                <div key={m.title} className="svc-mode" style={{ opacity: 0.7, cursor: 'not-allowed' }}>
                  <div className="svc-mode-media">
                    <Image src={m.image} alt={m.title} fill className="svc-mode-image" sizes="(max-width: 519px) 100vw, 50vw" />
                  </div>
                  <div className="svc-mode-title">{m.title}</div>
                  <div className="svc-mode-cta" style={{ color: '#b7791f' }}>ปิดชั่วคราว</div>
                  <div style={{ marginTop: 10, fontSize: 13, color: '#9a6700', lineHeight: 1.6 }}>{note}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px 80px' }}>
          <div className="deal-form create-deal-form">
            <DealFlowBrand docked />

            <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => setStep(1)}>← ย้อนกลับ</button>

            {/* Role */}
            <div className="deal-field">
              <label>ฉันเป็น...</label>
              <div className="svc-pick-grid">
                {([['buyer', '/Buyer.webp', 'Buyer'], ['seller', '/Seller.webp', 'Seller']] as const).map(([k, img, alt]) => (
                  <button key={k} type="button" className={`svc-pick-card svc-pick-card-role${myRole === k ? ' sel' : ''}`} onClick={() => setMyRole(k)}>
                    <span className="svc-pick-role-media">
                      <Image src={img} alt={alt} fill className="svc-pick-role-image" sizes="(max-width: 559px) 100vw, 240px" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="deal-field">
              <label>สินค้า / สิ่งที่นัดรับ *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={150} placeholder="เช่น iPhone 15 Pro มือสอง" />
            </div>

            {/* Description */}
            <div className="deal-field">
              <label>รายละเอียด</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="สภาพ อุปกรณ์ที่แถม เงื่อนไขต่างๆ..." />
            </div>

            {/* Price + Category */}
            <div className="field-row">
              <div className="deal-field">
                <label>ราคาสินค้า (บาท)</label>
                <input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
              </div>
              <div className="deal-field">
                <label>หมวดหมู่</label>
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">เลือก...</option>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Address */}
            <div className="deal-field">
              <label>📍 ที่อยู่ของฉัน ({myRole === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}) — เลือกถึงระดับตำบล *</label>
              <AddressPicker value={myAddr} onChange={setMyAddr} />
              {myAddr.tambon && <p style={{ fontSize: 12.5, color: 'var(--green-600)', marginTop: 8 }}>✅ {addressLabel(myAddr)}</p>}
            </div>

            {/* Fee preview */}
            <div style={{ background: 'var(--accent-soft)', border: '1px solid #d7e3ff', borderRadius: 'var(--r-md)', padding: '12px 14px', marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>💸 ค่าบริการโดยประมาณ (นัดรับ EzDrive)</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', padding: '2px 0' }}>
                <span>ค่าแพลตฟอร์ม</span><span>฿{PLATFORM.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', borderTop: '1px solid #d7e3ff', marginTop: 6, paddingTop: 6 }}>
                <span>รวมค่าบริการ</span><span>฿{PLATFORM.toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>* ค่าแพลตฟอร์มตกลงใครจ่ายในห้องดีล · ยอดประกันเดินทางตกลงกันในห้องดีล</div>
            </div>

            {error && <p style={{ color: '#b22441', fontSize: 14, marginTop: 4 }}>⚠️ {error}</p>}

            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              style={{ marginTop: 18 }}
              disabled={creating || !title.trim() || !myAddr.tambon || !guaranteeEnabled}
              onClick={createGuaranteeDeal}
            >
              {creating ? 'กำลังสร้างดีล...' : 'สร้างดีลนัดรับ & รับลิงก์แชร์'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--muted)', marginTop: 12 }}>หลังสร้าง คัดลอกลิงก์จากหน้าดีลและส่งให้อีกฝ่าย</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MeetupPage() {
  return (
    <Suspense fallback={<div className="mkt-detail-loading" />}>
      <MeetupInner />
    </Suspense>
  );
}
