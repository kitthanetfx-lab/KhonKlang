'use client';
import Image from 'next/image';
import { useState, useEffect, Suspense } from 'react';
import { authHeaders } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { FeeConfig, FEE_DEFAULTS, computeDealFees } from '@/lib/fees';
import { useServiceControls } from '@/lib/useServiceControls';

const CATS = ['สินค้าทั่วไป', 'อิเล็กทรอนิกส์', 'เสื้อผ้า', 'ยานพาหนะ', 'อสังหาริมทรัพย์', 'บริการ', 'อื่นๆ'];
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
  // prefill จากหน้าอื่น เช่น /wanted ("เสนอขายผ่านคนกลาง")
  const isSimple = searchParams.get('type') === 'simple';
  const isSafeZone = searchParams.get('safezone') === '1';
  const controls = useServiceControls();
  const [role, setRole] = useState<'seller' | 'buyer'>(searchParams.get('role') === 'buyer' ? 'buyer' : 'seller');
  const [title, setTitle] = useState(searchParams.get('title') || '');
  const [description, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fees, setFees] = useState<FeeConfig>(FEE_DEFAULTS);

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
      <header className="sub-header">
        <Link href="/" className="sub-back"><Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} /></Link>
        <span className="sub-htitle">{isSimple ? 'สร้างดีลแบบง่าย' : 'สร้างดีลใหม่'}</span>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px 80px' }}>
        <div className="create-deal-brand-wrap">
          <div className="create-deal-brand">
            <Image src="/logo.png" alt="กลางฮับ" width={420} height={132} priority className="create-deal-brand-image" />
          </div>
        </div>
        <div className="deal-form">
          <h2 className="deal-form-title">รายละเอียดดีล</h2>
          <p className="deal-form-sub">{isSimple ? 'ซื้อขายผ่านกลางแบบง่าย — พักเงินกับศูนย์กลาง ผู้ขายส่งตรงถึงผู้ซื้อ ไม่ต้องใช้คนกลางบุคคล' : isSafeZone ? 'สร้างดีลนัดรับ Safe Zone แล้วชวนอีกฝ่ายเข้าร่วมต่อจากลิงก์นี้' : 'สร้างดีล Escrow แล้วส่งลิงก์ให้อีกฝ่ายเข้าร่วม'}</p>

          {isSimple && (
            <div style={{ background: '#fff3e0', border: '1px solid #ffe0b2', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 13, color: '#8a5a00', lineHeight: 1.6, marginBottom: 16 }}>
              ⚡ โหมดง่าย: เงินพักไว้กับศูนย์กลาง · ผู้ขายส่งตรงพร้อมถ่ายวิดีโอ Serial/เลขชิป · ผู้ซื้อถ่ายวิดีโอก่อนแกะกล่อง แล้วศูนย์กลางจึงโอนเงินให้ผู้ขาย
            </div>
          )}

          {/* Role */}
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
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>* {feeBreakdown.note} · อัตราตามที่ระบบกำหนด แสดงให้ทราบก่อนเริ่มดีล</div>
            </div>
          )}

          {error && <p style={{ color: '#b22441', fontSize: 14, marginTop: 4 }}>⚠️ {error}</p>}

          <button onClick={handleCreate} disabled={loading || !serviceEnabled} className="btn btn-primary btn-block btn-lg" style={{ marginTop: 18 }}>
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
