'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authHeaders } from '@/lib/supabase';
import { AddressPicker, EMPTY_ADDRESS, ThaiAddress, addressLabel } from '@/components/AddressPicker';
import { HeaderAccountActions } from '@/components/HeaderAccountActions';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { RATE_PER_KM } from '@/lib/provinceGeo';
import { useServiceControls } from '@/lib/useServiceControls';

const PLATFORM = 50, MM_FEE = 300;

function MeetupInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const controls = useServiceControls();
  // เปิดจากปุ่ม "นัดรับ" ในหน้าสินค้า/ประกาศหา → ข้ามมาขั้นกรอกที่อยู่เลย พร้อม prefill
  const preset = sp.get('step') === '2';
  const [mode, setMode] = useState<string | null>(preset ? 'guarantee' : null);
  const [feeWho, setFeeWho] = useState('split');
  const [step, setStep] = useState<1 | 2>(preset ? 2 : 1);

  const [myRole, setMyRole] = useState<'buyer' | 'seller'>(sp.get('role') === 'seller' ? 'seller' : 'buyer');
  const [title, setTitle] = useState(sp.get('title') || '');
  const [price, setPrice] = useState(sp.get('price') || '');
  const [myAddr, setMyAddr] = useState<ThaiAddress>(EMPTY_ADDRESS);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const total = mode === 'safezone' ? PLATFORM + MM_FEE : PLATFORM;
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
    <div className="sub-page">
      <header className="sub-header">
        <Link href="/" className="sub-back">←</Link>
        <span className="sub-htitle">นัดรับผ่านกลาง</span>
        <HeaderAccountActions />
      </header>
      <div className="svc-inner">

        {step === 1 && (
          <>
            <h2 style={{ marginBottom: 6 }}>เลือกรูปแบบนัดรับ</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 24, lineHeight: 1.6 }}>คนกลางช่วยจัดการจุดนัดพบให้ปลอดภัย ไม่ต้องเจอกันสองต่อสองโดยไม่มีพยาน</p>

            {[
              { k: 'guarantee', icon: '🚗', title: 'รับประกันเดินทาง', sub: 'ทั้งสองฝ่ายวางเงินประกันเท่ากัน มาตามนัดได้คืนเต็มจำนวน ผิดนัดเงินประกันชดเชยให้ฝ่ายที่มา — ไม่ต้องใช้คนกลาง', fee: PLATFORM },
              { k: 'safezone', icon: '🏪', title: 'Safe Zone (จุดนัดพบปลอดภัย)', sub: 'คนกลางเป็นผู้ดูแลสถานที่นัดพบ เช่น ร้านมือถือ อู่รถ หน้าร้านค้า', fee: PLATFORM + MM_FEE },
            ].map(o => {
              const enabled = o.k === 'guarantee' ? guaranteeEnabled : safeZoneEnabled;
              const note = o.k === 'guarantee' ? controls.message('meetupGuarantee') : controls.message('meetupSafeZone');
              return (
              <div
                key={o.k}
                className={`svc-card${mode === o.k ? ' sel' : ''}`}
                onClick={() => { if (enabled) setMode(o.k); }}
                style={!enabled ? { opacity: 0.68, cursor: 'not-allowed' } : undefined}
              >
                <div className="svc-card-head">
                  <div className="svc-card-icon">{o.icon}</div>
                  <div><div className="svc-card-title">{o.title}</div><div className="svc-card-sub">{o.sub}</div></div>
                </div>
                {!enabled && <div style={{ marginTop: 10, fontSize: 13, color: '#9a6700', lineHeight: 1.6 }}>{note}</div>}
                {mode === o.k && (
                  <div className="svc-fee-box">
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>ค่าใช้จ่าย</div>
                    <div className="svc-fee-row"><span className="svc-fee-lbl">ค่าธรรมเนียมแพลตฟอร์ม</span><span className="svc-fee-val">฿{PLATFORM}</span></div>
                    {o.k === 'safezone' && <div className="svc-fee-row"><span className="svc-fee-lbl">ค่าบริการคนกลาง</span><span className="svc-fee-val">฿{MM_FEE}</span></div>}
                    {o.k === 'guarantee' && <div className="svc-fee-row"><span className="svc-fee-lbl">เงินประกันเดินทาง (ได้คืนเมื่อมาตามนัด)</span><span className="svc-fee-val">ตกลงกันในห้องดีล</span></div>}
                    <div className="svc-fee-total"><span className="svc-fee-lbl">รวม</span><span className="svc-fee-val">฿{o.fee}{o.k === 'guarantee' ? ' + ประกัน' : ''}</span></div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 7 }}>ใครออกค่าธรรมเนียม?</div>
                      <div className="svc-who-chips">
                        {[{ k: 'split', l: 'หารกัน' }, { k: 'buyer', l: 'ผู้ซื้อออก' }, { k: 'seller', l: 'ผู้ขายออก' }].map(w => (
                          <button key={w.k} className={`svc-chip${feeWho === w.k ? ' sel' : ''}`} onClick={e => { e.stopPropagation(); setFeeWho(w.k); }}>{w.l}</button>
                        ))}
                      </div>
                      {feeWho === 'split' && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>ผู้ซื้อออก ฿{buyerShareText(buyerFee)} · ผู้ขายออก ฿{buyerShareText(sellerFee)}</p>}
                    </div>
                  </div>
                )}
              </div>
              );
            })}

            {mode === 'guarantee' && guaranteeEnabled && (
              <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} onClick={() => setStep(2)}>
                ถัดไป: ระบุที่อยู่ของฉัน →
              </button>
            )}
            {mode === 'safezone' && safeZoneEnabled && (
              <Link href="/deal/create?safezone=1" className="btn btn-primary btn-block" style={{ marginTop: 8, display: 'flex', textDecoration: 'none', justifyContent: 'center' }}>สร้างดีลนัดรับ →</Link>
            )}
          </>
        )}

        {step === 2 && (
          <>
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

function buyerShareText(n: number) { return n.toLocaleString(); }

export default function MeetupPage() {
  return (
    <Suspense fallback={<div className="mkt-detail-loading" />}>
      <MeetupInner />
    </Suspense>
  );
}
