'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/Icon';
import { Nav, Footer, CountUp, useReveal, useTilt } from '@/components/Site';
import { EscrowStage } from '@/components/EscrowStage';
import { ServiceSlider } from '@/components/ServiceSlider';

interface SiteStats { completedDeals: number; protectedValue: number; middlemen: number; satisfaction: number; reviewCount: number; }

/** สถิติจริงจากระบบ — ดึงจาก /api/stats (นับจากดีลที่เสร็จสมบูรณ์, คนกลางที่อนุมัติ, รีวิวจริง) */
function useSiteStats() {
  const [stats, setStats] = useState<SiteStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => { if (!cancelled && typeof d.completedDeals === 'number') setStats(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return stats;
}

function buildStatItems(s: SiteStats | null) {
  const value = s?.protectedValue ?? 0;
  const inMillions = value >= 1_000_000;
  return [
    { v: s?.completedDeals ?? 0, suf: '', pre: '', label: 'ดีลสำเร็จปลอดภัย' },
    { v: s?.middlemen ?? 0, suf: '', pre: '', label: 'คนกลางผ่านการรับรอง' },
    { v: inMillions ? Math.round(value / 100_000) / 10 : value, suf: inMillions ? 'ล้าน' : '', pre: '฿', label: 'มูลค่าที่คุ้มครอง' },
    s && s.reviewCount > 0
      ? { v: s.satisfaction, suf: '%', pre: '', label: 'ความพึงพอใจผู้ใช้' }
      : { v: -1, suf: '', pre: '', label: 'ความพึงพอใจผู้ใช้' }, // -1 = ยังไม่มีรีวิว แสดง "—"
  ];
}

const TRUST = [
  { icon: 'lock', tint: '', t: 'พักเงินไว้กับระบบ', d: 'เงินจะไม่ถึงมือผู้ขาย จนกว่าคุณจะกดยืนยันว่าได้รับของตรงปก' },
  { icon: 'badgeCheck', tint: 'green', t: 'คนกลางผ่านการรับรอง', d: 'ยืนยันตัวตน KYC ทุกราย มีคะแนนรีวิวและประวัติการทำงานจริง' },
  { icon: 'search', tint: 'amber', t: 'เช็คคนโกงก่อนโอน', d: 'ค้นชื่อ–บัญชี–เบอร์โทร จากฐานข้อมูลแบล็กลิสต์ได้ทันที' },
  { icon: 'zap', tint: 'violet', t: 'ปล่อยเงินอัตโนมัติ', d: 'เมื่อตรวจรับครบเงื่อนไข ระบบโอนเงินให้ผู้ขายให้ทันที' },
];

const CATEGORIES = [
  { icon: 'smartphone', t: 'มือถือ & ไอที', n: '2,480' },
  { icon: 'gem', t: 'แบรนด์เนม', n: '1,120' },
  { icon: 'car', t: 'รถ & ยานพาหนะ', n: '640' },
  { icon: 'gamepad', t: 'ไอดีเกม & ดิจิทัล', n: '3,210' },
  { icon: 'sparkles', t: 'พระเครื่อง', n: '980' },
  { icon: 'box', t: 'อาร์ตทอย & ของสะสม', n: '1,540' },
  { icon: 'sprout', t: 'เหมาสวน & เกษตร', n: '410' },
  { icon: 'factory', t: 'ค้าส่ง & OEM โรงงาน', n: '290' },
  { icon: 'building', t: 'เครื่องจักร & อสังหาฯ', n: '150' },
];

function SectionHead({ kicker, title, lead, center }: { kicker?: string; title: string; lead?: string; center?: boolean }) {
  return (
    <div className={`reveal ${center ? 'center' : ''}`} style={{ maxWidth: center ? '62ch' : 'none', margin: center ? '0 auto 44px' : '0 0 40px' }}>
      {kicker && <div className="kicker" style={{ marginBottom: 12 }}>{kicker}</div>}
      <h2 className="section-title">{title}</h2>
      {lead && <p className="section-lead" style={{ marginTop: 14, marginInline: center ? 'auto' : 0 }}>{lead}</p>}
    </div>
  );
}

function Hero({ stats }: { stats: SiteStats | null }) {
  const { ref: stageTiltRef, onMouseLeave, onMouseMove } = useTilt(7);
  const hasReviews = !!stats && stats.reviewCount > 0;
  const avgStars = hasReviews ? Math.round((stats!.satisfaction / 20) * 10) / 10 : 0;
  return (
    <header className="hero">
      <div className="hero-bg" aria-hidden="true">
        <span className="blob blob-a" /><span className="blob blob-b" /><span className="hero-grid" />
      </div>
      <div className="container hero-inner">
        <div className="hero-copy">
          <div className="hero-brand reveal">
            <Image
              src="/logo.png"
              alt="โลโก้คนกลาง"
              width={420}
              height={420}
              priority
              className="hero-brand-image"
            />
          </div>
          <div className="eyebrow reveal"><Icon name="shieldCheck" size={15} /> ซื้อขายปลอดภัยผ่านคนกลางรับรอง</div>
          <h1 className="hero-title reveal" style={{ ['--d' as string]: '60ms' }}>
            จ่ายเงินอย่างมั่นใจ<br /><span className="gradient-text">ได้ของชัวร์ ไม่โดนโกง</span>
          </h1>
          <p className="hero-lead reveal" style={{ ['--d' as string]: '120ms' }}>
            คนกลางพักเงินของคุณไว้กับระบบจนกว่าจะได้รับสินค้าจริง — ครอบคลุมตั้งแต่มือถือ แบรนด์เนม รถมือสอง ไอดีเกม ของสะสม ไปจนถึงเหมาสวนและสั่งผลิตโรงงาน
          </p>
          <div className="hero-cta reveal" style={{ ['--d' as string]: '180ms' }}>
            <Link className="btn btn-primary btn-lg" href="/service/trade">เริ่มสร้างดีล <Icon name="arrowRight" size={18} /></Link>
            <Link className="btn btn-ghost btn-lg" href="/marketplace"><Icon name="store" size={18} /> ดูตลาด</Link>
          </div>
          <div className="hero-trust reveal" style={{ ['--d' as string]: '240ms' }}>
            <div className="hero-avatars">
              {[0, 1, 2, 3].map(i => <span key={i} className="avatar" style={{ width: 34, height: 34, fontSize: 12, marginLeft: i ? -10 : 0, border: '2px solid #fff', background: ['#2f6bf0', '#10a566', '#6841d9', '#e89211'][i] }}>{['ก', 'ข', 'ค', 'ง'][i]}</span>)}
            </div>
            <div>
              <div style={{ display: 'flex', gap: 2, color: 'var(--amber-500)' }}>{[0, 1, 2, 3, 4].map(i => <Icon key={i} name="star" size={15} style={{ fill: 'currentColor' }} />)}</div>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {stats && stats.completedDeals > 0
                  ? <><b style={{ color: 'var(--ink)' }}>{stats.completedDeals.toLocaleString()}</b> ดีลสำเร็จ{hasReviews ? ` • รีวิว ${avgStars}/5` : ''}</>
                  : <>พักเงินกับระบบ • ปลอดภัยทุกดีล</>}
              </span>
            </div>
          </div>
        </div>
        <div className="hero-stage reveal" style={{ ['--d' as string]: '140ms' }} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} ref={stageTiltRef}>
          <EscrowStage speed={1} />
        </div>
      </div>
    </header>
  );
}

export default function HomePage() {
  useReveal();
  const stats = useSiteStats();
  const statItems = buildStatItems(stats);
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0');
    r.style.setProperty('--accent-strong', '#1f54d6');
    r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);

  return (
    <>
      <Nav active="home" />
      <Hero stats={stats} />

      <section className="stats-band">
        <div className="container stats-grid">
          {statItems.map(s => (
            <div key={s.label} className="stat reveal">
              <div className="stat-v">{s.v < 0 ? '—' : <CountUp to={s.v} prefix={s.pre || ''} suffix={s.suf} />}</div>
              <div className="stat-l">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead kicker="ทำไมต้องคนกลาง" title="ความปลอดภัยที่จับต้องได้ ทุกขั้นตอน" lead="ระบบ Escrow ที่ออกแบบมาเพื่อตัดความเสี่ยงโดนโกงออกไปตั้งแต่ต้นจนจบดีล" center />
          <div className="trust-grid">
            {TRUST.map((f, i) => (
              <div key={f.t} className="trust-card reveal" style={{ ['--d' as string]: i * 70 + 'ms' }}>
                <span className={`icon-tile ${f.tint}`}><Icon name={f.icon} /></span>
                <h3 className="trust-t">{f.t}</h3>
                <p className="trust-d">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <SectionHead kicker="บริการผ่านคนกลาง" title="ทุกปัญหาการซื้อขาย เรามีทางแก้ให้" lead="เลื่อนดูบริการที่ออกแบบมาแก้ปัญหาที่คนซื้อ–ขายเจอบ่อยที่สุด พร้อมข้อดีที่คุณจะได้รับ" center />
          <div className="reveal"><ServiceSlider /></div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cat-head reveal">
            <div>
              <div className="kicker" style={{ marginBottom: 12 }}>ตลาดคนกลาง</div>
              <h2 className="section-title">ซื้อขายได้ทุกหมวด มั่นใจทุกมูลค่า</h2>
            </div>
            <Link className="btn btn-soft" href="/marketplace">ดูตลาดทั้งหมด <Icon name="arrowRight" size={16} /></Link>
          </div>
          <div className="cat-grid">
            {CATEGORIES.map((c, i) => (
              <Link key={c.t} href="/marketplace" className="cat-card reveal" style={{ ['--d' as string]: i * 40 + 'ms' }}>
                <span className="icon-tile"><Icon name={c.icon} /></span>
                <div>
                  <div className="cat-t">{c.t}</div>
                  <div className="cat-n">{c.n} ประกาศ</div>
                </div>
                <Icon name="chevronRight" size={18} className="cat-arrow" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="join-grid">
            <div className="join-card reveal">
              <span className="icon-tile"><Icon name="users" /></span>
              <h3>เปิดร้านในฐานะผู้ขาย</h3>
              <p>เพิ่มความน่าเชื่อถือด้วยตราการันตี ปิดการขายได้ง่ายขึ้น และเบิกเงินไว</p>
              <Link className="btn btn-dark" href="/register/seller">สมัครเป็นผู้ขาย <Icon name="arrowRight" size={16} /></Link>
            </div>
            <div className="join-card green reveal" style={{ ['--d' as string]: '90ms' }}>
              <span className="icon-tile green"><Icon name="handCoins" /></span>
              <h3>สร้างรายได้เป็นคนกลาง</h3>
              <p>ใช้ความน่าเชื่อถือของคุณรับงานคนกลาง รับค่าธรรมเนียมจากทุกดีลที่สำเร็จ</p>
              <Link className="btn btn-dark" href="/register/middleman">สมัครเป็นคนกลาง <Icon name="arrowRight" size={16} /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="scam-band">
        <div className="container scam-inner reveal">
          <div className="scam-ic"><Icon name="search" size={30} /></div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 style={{ fontSize: 'clamp(22px,3vw,30px)', color: '#fff' }}>สงสัยว่าจะโดนโกง? เช็คก่อนโอน</h2>
            <p style={{ color: 'rgba(255,255,255,.78)', marginTop: 8, maxWidth: '52ch' }}>ค้นหาชื่อ เลขบัญชี หรือเบอร์โทรศัพท์จากฐานข้อมูลคนโกง เพื่อความปลอดภัยก่อนทำธุรกรรมทุกครั้ง</p>
          </div>
          <Link className="btn btn-lg" href="/check-scam" style={{ background: '#fff', color: 'var(--ink)' }}>ตรวจสอบเลย <Icon name="arrowRight" size={18} /></Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
