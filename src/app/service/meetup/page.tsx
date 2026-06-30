'use client';
import Image from 'next/image';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authHeaders } from '@/lib/supabase';
import { AddressPicker, EMPTY_ADDRESS, ThaiAddress, addressLabel } from '@/components/AddressPicker';
import { HeaderAccountActions } from '@/components/HeaderAccountActions';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { RATE_PER_KM } from '@/lib/provinceGeo';
import { useServiceControls } from '@/lib/useServiceControls';
import { DealFlowBrand } from '@/components/DealFlowBrand';

const PLATFORM = 50, MM_FEE = 300;
const MODES = [
  { title: 'รับประกันเดินทาง EzDrive', href: '/service/meetup?step=2', image: '/Drive/Ezdrive.webp', kind: 'guarantee' as const },
  { title: 'Safedrive นัดรับเซฟโซน', href: '/deal/create?safezone=1', image: '/Drive/Safedrive.webp', kind: 'safezone' as const },
];

function MeetupInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const controls = useServiceControls();
  // เปิดจากปุ่ม "นัดรับ" ในหน้าสินค้า/ประกาศหา → ข้ามมาขั้นกรอกที่อยู่เลย พร้อม prefill
  const [feeWho] = useState('split');
  const [step, setStep] = useState<1 | 2>(sp.get('step') === '2' ? 2 : 1);

  useEffect(() => {
    setStep(sp.get('step') === '2' ? 2 : 1);
  }, [sp]);

  const [myRole, setMyRole] = useState<'buyer' | 'seller'>(sp.get('role') === 'seller' ? 'seller' : 'buyer');
  const [title, setTitle] = useState(sp.get('title') || '');
  const [price, setPrice] = useState(sp.get('price') || '');
  const [myAddr, setMyAddr] = useState<ThaiAddress>(EMPTY_ADDRESS);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

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
      // v2: เก็บเฉพาะที่อยู่ของฝ่ายผู้สร้าง — อีกฝ่ายมากรอกที่อยู่ตัวเองในห้องดีล
      // จุดนัดพบ + ยอดประกัน ไปตกลงกัน (เสนอ-ยอมรับ) ในห้องดีล
      const meetupData = JSON.stringify({
        v: 2,
        [myRole === 'buyer' ? 'buyerLoc' : 'sellerLoc']: myAddr,
        ratePerKm: RATE_PER_KM,
        fee: total, feeWho, buyerFee, sellerFee,
      });
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `นัดรับ+ประกันเดินทาง: ${title.trim()}`,
          description: `ฝั่ง${myRole === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}: ${addressLabel(myAddr)} — จุดนัดพบและยอดประกันตกลงกันในห้องดีล`,
          price: Number(price) || 0,
          category: 'นัดรับผ่านกลาง',
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
      <div className="svc-inner">

        {step === 1 && (
          <>
            <div className="svc-hero">
              <div className="svc-hero-icon">🚗</div>
              <h1 className="svc-hero-title">เลือกรูปแบบบริการ</h1>
            </div>
            <div className="svc-modes">
              {MODES.map(m => {
                const enabled = m.kind === 'guarantee' ? guaranteeEnabled : safeZoneEnabled;
                const note = m.kind === 'guarantee' ? controls.message('meetupGuarantee') : controls.message('meetupSafeZone');
                return enabled ? (
                  <div
                    key={m.title}
                    className="svc-mode"
                    style={{ cursor: 'pointer' }}
                    onClick={() => m.kind === 'guarantee' ? setStep(2) : router.push(m.href)}
                  >
                    <div className="svc-mode-media">
                      <Image src={m.image} alt={m.title} fill className="svc-mode-image" sizes="(max-width: 519px) 100vw, 50vw" />
                    </div>
                    <div className="svc-mode-title">{m.title}</div>
                    <div className="svc-mode-cta">เริ่มต้น <span>→</span></div>
                  </div>
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
          </>
        )}

        {step === 2 && (
          <>
            <DealFlowBrand docked />
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => setStep(1)}>← ย้อนกลับ</button>
            <h2 style={{ marginBottom: 6 }}>🚗 นัดรับ + รับประกันเดินทาง</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.65 }}>
              <b>ระบุที่อยู่ของคุณคนเดียวพอ</b> — อีกฝ่ายจะระบุที่อยู่ของเขาเองเมื่อเข้าร่วมดีล
              จากนั้นไปตกลงกันในห้องดีลว่าใครเดินทางไปหาใคร หรือนัดเจอจุดไหน พร้อมยอดประกันที่ทั้งคู่ต้องกดยอมรับ — บริการนี้<b>ไม่ต้องใช้คนกลาง</b>
            </p>

            <div className="mu-form">
              <div className="mu-field">
                <label>ฉันเป็น...</label>
                <div className="svc-who-chips">
                  {([['buyer', '🛍️ ผู้ซื้อ'], ['seller', '🛒 ผู้ขาย']] as const).map(([k, l]) => (
                    <button key={k} className={`svc-chip${myRole === k ? ' sel' : ''}`} onClick={() => setMyRole(k)}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="mu-grid">
                <div className="mu-field">
                  <label>สินค้า/สิ่งที่นัดรับ *</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} maxLength={150} placeholder="เช่น iPhone 15 Pro มือสอง" />
                </div>
                <div className="mu-field">
                  <label>ราคาสินค้า (บาท)</label>
                  <input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="ไม่บังคับ" />
                </div>
              </div>

              <div className="mu-field">
                <label>📍 ที่อยู่ของฉัน ({myRole === 'buyer' ? 'ผู้ซื้อ' : 'ผู้ขาย'}) — เลือกถึงระดับตำบลเพื่อระยะทางที่แม่นยำ *</label>
                <AddressPicker value={myAddr} onChange={setMyAddr} />
                {myAddr.tambon && <p style={{ fontSize: 12.5, color: 'var(--green-600)', marginTop: 8 }}>✅ {addressLabel(myAddr)}</p>}
              </div>

              <div className="mu-note" style={{ marginTop: 0 }}>
                ขั้นตอนถัดไปในห้องดีล: อีกฝ่ายระบุที่อยู่ → ตกลงจุดนัดพบ (ใครไปหาใคร/เจอครึ่งทาง/จุดอื่น)
                → เสนอยอดประกัน-อีกฝ่ายกดยอมรับ → ทั้งคู่วางเงิน → เจอกันสำเร็จรับเงินคืนเต็มจำนวน
              </div>

              {error && <p className="rv-error">{error}</p>}
              <button className="btn btn-primary btn-block btn-lg" disabled={creating || !title.trim() || !myAddr.tambon || !guaranteeEnabled} onClick={createGuaranteeDeal}>
                {creating ? 'กำลังสร้างดีล...' : 'สร้างดีลนัดรับ + รับลิงก์ชวนอีกฝ่าย →'}
              </button>
            </div>
          </>
        )}
      </div>
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
