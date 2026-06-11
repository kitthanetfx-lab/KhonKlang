'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { account } from '@/lib/appwrite';
import { Nav, Footer, useReveal } from '@/components/Site';
import { Icon } from '@/components/Icon';

const CATS = ['มือถือ & ไอที', 'แบรนด์เนม', 'รถ & ยานพาหนะ', 'ไอดีเกม & ดิจิทัล', 'พระเครื่อง', 'อาร์ตทอย & ของสะสม', 'เหมาสวน & เกษตร', 'ค้าส่ง & OEM โรงงาน', 'เครื่องจักร & อสังหาฯ', 'อื่นๆ'];
const PROVINCES = ['กระบี่','กรุงเทพมหานคร','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี'];

const MODE_INFO: Record<string, { label: string; cls: string; desc: string }> = {
  middleman: { label: '🛡️ ผ่านคนกลาง', cls: 'badge-green', desc: 'พักเงินกับระบบ ปลอดภัยทั้งสองฝ่าย' },
  direct:    { label: '⚡ ซื้อปกติ', cls: 'badge-gray', desc: 'ติดต่อซื้อขายกันโดยตรง' },
  both:      { label: '🤝 ได้ทั้งสองแบบ', cls: 'badge-blue', desc: 'แล้วแต่ตกลงกับผู้ขาย' },
};

interface WantedPost {
  $id: string; userId: string; userName: string; title: string; detail: string;
  budgetMin: number; budgetMax: number; category: string; province: string;
  buyMode: string; contact: string; status: string; createdAt: string;
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`;
  return `${Math.floor(s / 86400)} วันที่แล้ว`;
}

function budgetText(p: WantedPost) {
  if (p.budgetMin && p.budgetMax) return `฿${p.budgetMin.toLocaleString()} – ฿${p.budgetMax.toLocaleString()}`;
  if (p.budgetMax) return `ไม่เกิน ฿${p.budgetMax.toLocaleString()}`;
  if (p.budgetMin) return `ตั้งแต่ ฿${p.budgetMin.toLocaleString()}`;
  return 'ตามตกลง';
}

export default function WantedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<WantedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState('');
  const [showForm, setShowForm] = useState(false);

  // filters
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [province, setProvince] = useState('');
  const [mode, setMode] = useState('');

  // form
  const [fTitle, setFTitle] = useState('');
  const [fDetail, setFDetail] = useState('');
  const [fBudgetMin, setFBudgetMin] = useState('');
  const [fBudgetMax, setFBudgetMax] = useState('');
  const [fCat, setFCat] = useState('');
  const [fProvince, setFProvince] = useState('');
  const [fMode, setFMode] = useState<'middleman' | 'direct' | 'both'>('middleman');
  const [fContact, setFContact] = useState('');
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState('');
  const [contactOpen, setContactOpen] = useState<string>('');

  useReveal();
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0');
    r.style.setProperty('--accent-strong', '#1f54d6');
    r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/wanted');
      if (res.ok) { const d = await res.json(); setPosts(d.posts || []); }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
      account.get().then(u => setMyId(u.$id)).catch(() => {});
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submitPost() {
    if (!fTitle.trim()) { setFormError('กรุณากรอกชื่อสินค้าที่ต้องการหา'); return; }
    setPosting(true); setFormError('');
    try {
      const jwt = (await account.createJWT()).jwt;
      const res = await fetch('/api/wanted', {
        method: 'POST',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: fTitle, detail: fDetail,
          budgetMin: Number(fBudgetMin) || 0, budgetMax: Number(fBudgetMax) || 0,
          category: fCat, province: fProvince, buyMode: fMode, contact: fContact,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setFormError(d.error || 'เกิดข้อผิดพลาด'); return; }
      setFTitle(''); setFDetail(''); setFBudgetMin(''); setFBudgetMax(''); setFCat(''); setFProvince(''); setFContact(''); setFMode('middleman');
      setShowForm(false);
      await load();
      window.scrollTo({ top: 0 });
    } catch {
      setFormError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบก่อนลงประกาศ');
    } finally { setPosting(false); }
  }

  async function closePost(id: string) {
    try {
      const jwt = (await account.createJWT()).jwt;
      const res = await fetch('/api/wanted', {
        method: 'PATCH',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'close' }),
      });
      if (res.ok) setPosts(prev => prev.filter(p => p.$id !== id));
    } catch {}
  }

  function offerToSell(p: WantedPost) {
    if (!myId) { router.push(`/login?returnTo=${encodeURIComponent('/wanted')}`); return; }
    const params = new URLSearchParams({ title: `เสนอขาย: ${p.title}`, role: 'seller', ref: 'wanted', wantedId: p.$id });
    router.push(`/deal/create?${params}`);
  }

  const filtered = posts
    .filter(p => !cat || p.category === cat)
    .filter(p => !province || p.province === province)
    .filter(p => !mode || p.buyMode === mode || p.buyMode === 'both')
    .filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()) || (p.detail || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <Nav active="wanted" />
      <header className="page-hero">
        <div className="container" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18 }}>
          <div>
            <div className="kicker" style={{ marginBottom: 12 }}>ประกาศหาสินค้า</div>
            <h1 className="section-title">บอกเราว่าคุณกำลังหาอะไร</h1>
            <p className="section-lead" style={{ marginTop: 12 }}>ลงประกาศฟรี ผู้ขายทั้งระบบเห็นความต้องการของคุณ — เลือกได้ว่าจะซื้อผ่านคนกลางหรือซื้อปกติ</p>
          </div>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => { if (!myId) { router.push(`/login?returnTo=${encodeURIComponent('/wanted')}`); return; } setShowForm(v => !v); }}
          >
            {showForm ? 'ซ่อนฟอร์ม' : <><Icon name="plus" size={18} /> ลงประกาศหาสินค้า</>}
          </button>
        </div>
      </header>

      <main className="page-body">
        <div className="container" style={{ maxWidth: 980 }}>

          {showForm && (
            <div className="prose-card" style={{ marginBottom: 28 }}>
              <h2>ลงประกาศหาสินค้า</h2>
              <div className="wt-form">
                <div className="wt-field wt-span2">
                  <label>กำลังหาอะไร? *</label>
                  <input value={fTitle} onChange={e => setFTitle(e.target.value)} maxLength={200} placeholder="เช่น iPhone 15 Pro สี Natural Titanium 256GB สภาพ 90%+" />
                </div>
                <div className="wt-field wt-span2">
                  <label>รายละเอียดเพิ่มเติม</label>
                  <textarea value={fDetail} onChange={e => setFDetail(e.target.value)} rows={2} maxLength={1000} placeholder="สเปก เงื่อนไข อุปกรณ์ที่ต้องมี ฯลฯ" />
                </div>
                <div className="wt-field">
                  <label>งบต่ำสุด (บาท)</label>
                  <input type="number" min="0" value={fBudgetMin} onChange={e => setFBudgetMin(e.target.value)} placeholder="ไม่ระบุ" />
                </div>
                <div className="wt-field">
                  <label>งบสูงสุด (บาท)</label>
                  <input type="number" min="0" value={fBudgetMax} onChange={e => setFBudgetMax(e.target.value)} placeholder="ไม่ระบุ" />
                </div>
                <div className="wt-field">
                  <label>หมวดหมู่</label>
                  <select value={fCat} onChange={e => setFCat(e.target.value)}>
                    <option value="">เลือก...</option>
                    {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="wt-field">
                  <label>จังหวัด</label>
                  <select value={fProvince} onChange={e => setFProvince(e.target.value)}>
                    <option value="">ทุกจังหวัด</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="wt-field wt-span2">
                  <label>ต้องการซื้อแบบไหน? *</label>
                  <div className="wt-mode-grid">
                    {(Object.keys(MODE_INFO) as ('middleman' | 'direct' | 'both')[]).map(m => (
                      <button key={m} type="button" className={`wt-mode${fMode === m ? ' sel' : ''}`} onClick={() => setFMode(m)}>
                        <b>{MODE_INFO[m].label}</b>
                        <span>{MODE_INFO[m].desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="wt-field wt-span2">
                  <label>ช่องทางติดต่อ (ไม่บังคับ — แสดงให้ผู้ขายเห็น)</label>
                  <input value={fContact} onChange={e => setFContact(e.target.value)} maxLength={200} placeholder="เช่น LINE: mylineid (แนะนำให้คุยและปิดดีลผ่านระบบเพื่อความปลอดภัย)" />
                </div>
              </div>
              {formError && <p className="rv-error" style={{ marginTop: 12 }}>{formError}</p>}
              <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16 }} disabled={posting} onClick={submitPost}>
                {posting ? 'กำลังลงประกาศ...' : 'ลงประกาศ'}
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="wt-filters">
            <input className="wt-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหาประกาศ..." />
            <select value={cat} onChange={e => setCat(e.target.value)}><option value="">ทุกหมวด</option>{CATS.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <select value={province} onChange={e => setProvince(e.target.value)}><option value="">ทุกจังหวัด</option>{PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}</select>
            <select value={mode} onChange={e => setMode(e.target.value)}>
              <option value="">ทุกรูปแบบ</option>
              <option value="middleman">ผ่านคนกลาง</option>
              <option value="direct">ซื้อปกติ</option>
            </select>
          </div>

          {loading && <div className="mkt-detail-loading" />}
          {!loading && filtered.length === 0 && (
            <div className="prose-card center" style={{ padding: '48px 24px' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>📢</p>
              <p style={{ fontWeight: 600, color: 'var(--ink)' }}>ยังไม่มีประกาศที่ตรงเงื่อนไข</p>
              <p style={{ fontSize: 13.5, marginTop: 4 }}>เป็นคนแรกที่ลงประกาศหาสินค้า — ผู้ขายทั้งระบบจะเห็นความต้องการของคุณ</p>
            </div>
          )}

          <div className="wt-list">
            {filtered.map(p => {
              const m = MODE_INFO[p.buyMode] || MODE_INFO.middleman;
              const mine = p.userId === myId;
              return (
                <div key={p.$id} className="wt-card reveal">
                  <div className="wt-card-head">
                    <span className={`badge ${m.cls}`}>{m.label}</span>
                    {p.category && <span className="badge badge-gray">{p.category}</span>}
                    {p.province && <span className="badge badge-gray">📍 {p.province}</span>}
                    {mine && <span className="badge badge-amber">ประกาศของฉัน</span>}
                  </div>
                  <h3 className="wt-title">{p.title}</h3>
                  {p.detail && <p className="wt-detail">{p.detail}</p>}
                  <div className="wt-meta">
                    <span className="wt-budget">{budgetText(p)}</span>
                    <span>โดย {p.userName} · {timeAgo(p.createdAt)}</span>
                  </div>
                  <div className="wt-actions">
                    {!mine && (
                      <button className="btn btn-primary btn-sm" onClick={() => offerToSell(p)}>
                        เสนอขายผ่านคนกลาง <Icon name="arrowRight" size={15} />
                      </button>
                    )}
                    {!mine && (
                      <Link className="btn btn-soft btn-sm" href={`/service/meetup?step=2&role=seller&title=${encodeURIComponent(p.title)}&wantedId=${p.$id}&inviteUserId=${p.userId}`}>
                        🚗 นัดรับขาย
                      </Link>
                    )}
                    {!mine && (
                      <Link className="btn btn-ghost btn-sm" href={`/messages?to=${p.userId}&name=${encodeURIComponent(p.userName || 'สมาชิก')}`}>
                        <Icon name="message" size={15} /> ส่งข้อความ
                      </Link>
                    )}
                    {!mine && p.contact && (p.buyMode === 'direct' || p.buyMode === 'both') && (
                      contactOpen === p.$id
                        ? <span className="wt-contact">{p.contact}</span>
                        : <button className="btn btn-ghost btn-sm" onClick={() => setContactOpen(p.$id)}><Icon name="message" size={15} /> ดูช่องทางติดต่อ</button>
                    )}
                    {mine && (
                      <button className="btn btn-ghost btn-sm" onClick={() => closePost(p.$id)}>
                        <Icon name="check" size={15} /> ได้ของแล้ว — ปิดประกาศ
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="prose-card" style={{ marginTop: 28, background: 'var(--accent-soft)', borderColor: 'color-mix(in srgb, var(--accent) 25%, transparent)' }}>
            <p style={{ fontSize: 13.5 }}>
              💡 <b>เพื่อความปลอดภัย:</b> แนะนำให้ปิดการซื้อขาย<Link href="/service/trade">ผ่านคนกลาง</Link>เสมอ
              เงินของคุณจะถูกพักไว้กับระบบจนกว่าจะได้รับสินค้าจริง และ<Link href="/check-scam">เช็คคนโกง</Link>ก่อนโอนทุกครั้ง
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
