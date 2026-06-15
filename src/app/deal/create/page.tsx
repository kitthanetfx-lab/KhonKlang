'use client';
import { useState, useEffect, Suspense } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

const CATS = ['สินค้าทั่วไป', 'อิเล็กทรอนิกส์', 'เสื้อผ้า', 'ยานพาหนะ', 'อสังหาริมทรัพย์', 'บริการ', 'อื่นๆ'];

function CreateDealForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // prefill จากหน้าอื่น เช่น /wanted ("เสนอขายผ่านคนกลาง")
  const isSimple = searchParams.get('type') === 'simple';
  const [role, setRole] = useState<'seller' | 'buyer'>(searchParams.get('role') === 'buyer' ? 'buyer' : 'seller');
  const [title, setTitle] = useState(searchParams.get('title') || '');
  const [description, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0'); r.style.setProperty('--accent-strong', '#1f54d6'); r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);

  async function handleCreate() {
    if (!title || !price) { setError('กรุณากรอกชื่อและราคา'); return; }
    setLoading(true); setError('');
    try {
      const jwt = (await account.createJWT()).jwt;
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, price: Number(price), category, creatorRole: role, source: 'private', wantedId: searchParams.get('wantedId') || '', dealType: isSimple ? 'simple' : '' }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'เกิดข้อผิดพลาด'); return; }
      router.push(`/deal/${d.deal.$id}`);
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
        <div className="deal-form">
          <h2 className="deal-form-title">รายละเอียดดีล</h2>
          <p className="deal-form-sub">{isSimple ? 'ซื้อขายผ่านกลางแบบง่าย — พักเงินกับศูนย์กลาง ผู้ขายส่งตรงถึงผู้ซื้อ ไม่ต้องใช้คนกลางบุคคล' : 'สร้างดีล Escrow แล้วส่งลิงก์ให้อีกฝ่ายเข้าร่วม'}</p>

          {isSimple && (
            <div style={{ background: '#fff3e0', border: '1px solid #ffe0b2', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 13, color: '#8a5a00', lineHeight: 1.6, marginBottom: 16 }}>
              ⚡ โหมดง่าย: เงินพักไว้กับศูนย์กลาง · ผู้ขายส่งตรงพร้อมถ่ายวิดีโอ Serial/เลขชิป · ผู้ซื้อถ่ายวิดีโอก่อนแกะกล่อง แล้วศูนย์กลางจึงโอนเงินให้ผู้ขาย
            </div>
          )}

          {/* Role */}
          <div className="deal-field">
            <label>คุณเป็น...</label>
            <div className="svc-pick-grid">
              {(isSimple
                ? [['seller', 'ผู้ขาย 🛒', 'สร้างดีล → ส่งลิงก์ให้ผู้ซื้อ → ผู้ซื้อโอนเงินเข้าศูนย์กลาง'], ['buyer', 'ผู้ซื้อ 🛍️', 'สร้างดีล → ส่งลิงก์ให้ผู้ขาย → โอนเงินเข้าศูนย์กลาง']] as const
                : [['seller', 'ผู้ขาย 🛒', 'สร้างดีล → ส่งลิงก์ให้ผู้ซื้อ → ผู้ซื้อเลือกคนกลาง'], ['buyer', 'ผู้ซื้อ 🛍️', 'สร้างดีล → ส่งลิงก์ให้ผู้ขาย → เลือกคนกลางเอง']] as const
              ).map(([k, l, d]) => (
                <button key={k} type="button" className={`svc-pick-card${role === k ? ' sel' : ''}`} onClick={() => setRole(k)} style={{ flexDirection: 'column', gap: 6 }}>
                  <span className="spc-t">{l}</span>
                  <span className="spc-d">{d}</span>
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

          {error && <p style={{ color: '#b22441', fontSize: 14, marginTop: 4 }}>⚠️ {error}</p>}

          <button onClick={handleCreate} disabled={loading} className="btn btn-primary btn-block btn-lg" style={{ marginTop: 18 }}>
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
