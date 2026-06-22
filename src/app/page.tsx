'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/Icon';
import { Nav, Footer, CountUp, useReveal, useTilt } from '@/components/Site';
import { EscrowStage } from '@/components/EscrowStage';
import { ServiceSlider } from '@/components/ServiceSlider';
import { useServiceControls } from '@/lib/useServiceControls';

interface SiteStats {
  completedDeals: number; protectedValue: number; middlemen: number; satisfaction: number; reviewCount: number;
  categories?: Record<string, number>; listingTotal?: number; meetupDeals?: number;
  scamRecords?: number; middlemanRating?: number; middlemanReviews?: number;
  sellers?: number; totalMembers?: number; promoVideoUrl?: string;
}

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
    // เรียงจากภาพรวมระบบไปสู่ผลลัพธ์จริง: สมาชิก → ผู้ขาย → คนกลาง → ดีลสำเร็จ → มูลค่าคุ้มครอง → ความพึงพอใจ
    { v: s?.totalMembers ?? 0, suf: '', pre: '', label: 'สมาชิกทั้งหมด' },
    { v: s?.sellers ?? 0, suf: '', pre: '', label: 'ผู้ขายในระบบ' },
    { v: s?.middlemen ?? 0, suf: '', pre: '', label: 'คนกลางผ่านการรับรอง' },
    { v: s?.completedDeals ?? 0, suf: '', pre: '', label: 'ดีลสำเร็จปลอดภัย' },
    { v: inMillions ? Math.round(value / 100_000) / 10 : value, suf: inMillions ? 'ล้าน' : '', pre: '฿', label: 'มูลค่าที่คุ้มครอง' },
    s && s.reviewCount > 0
      ? { v: s.satisfaction, suf: '%', pre: '', label: 'ความพึงพอใจผู้ใช้' }
      : { v: -1, suf: '', pre: '', label: 'ความพึงพอใจผู้ใช้' }, // -1 = ยังไม่มีรีวิว แสดง "—"
  ];
}

// ลิงก์วิดีโอตั้งได้จากหน้าแอดมิน admin/service-controls (เก็บใน fee_config.promo_video_url)
// ส่วนรูปภาพยังไม่มี UI ตั้งค่า ถ้าต้องใช้ให้แก้ค่าคงที่นี้ตรง ๆ ได้
const PROMO_IMAGE = '';

function SectionHead({ kicker, title, lead, center }: { kicker?: string; title: string; lead?: string; center?: boolean }) {
  return (
    <div className={`reveal ${center ? 'center' : ''}`} style={{ maxWidth: center ? '62ch' : 'none', margin: center ? '0 auto 44px' : '0 0 40px' }}>
      {kicker && <div className="kicker" style={{ marginBottom: 12 }}>{kicker}</div>}
      <h2 className="section-title">{title}</h2>
      {lead && <p className="section-lead" style={{ marginTop: 14, marginInline: center ? 'auto' : 0 }}>{lead}</p>}
    </div>
  );
}

function Hero({ stats, controls }: { stats: SiteStats | null; controls: ReturnType<typeof useServiceControls> }) {
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
            {controls.isEnabled('tradeOnline') || controls.isEnabled('tradeSimple') ? (
              <Link className="btn btn-primary btn-lg" href="/service/trade">เริ่มสร้างดีล <Icon name="arrowRight" size={18} /></Link>
            ) : (
              <button className="btn btn-primary btn-lg" type="button" disabled title={controls.message('tradeOnline')}>
                บริการซื้อขายปิดชั่วคราว
              </button>
            )}
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
          <div className="hero-promo-mini reveal" style={{ ['--d' as string]: '200ms' }}>
            {stats?.promoVideoUrl ? (
              <div className="promo-video-wrap">
                <iframe src={stats.promoVideoUrl} title="วีดีโอแนะนำการใช้งาน" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
              </div>
            ) : PROMO_IMAGE ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={PROMO_IMAGE} alt="แนะนำการใช้งาน" className="promo-image" />
            ) : (
              <div className="promo-placeholder">
                <Icon name="film" size={20} />
                <p>เร็ว ๆ นี้ — วีดีโอ/ภาพแนะนำการใช้งาน</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function HomePage() {
  useReveal();
  const stats = useSiteStats();
  const statItems = buildStatItems(stats);
  const controls = useServiceControls();
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0');
    r.style.setProperty('--accent-strong', '#1f54d6');
    r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);

  return (
    <>
      <Nav active="home" />
      <Hero stats={stats} controls={controls} />

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

      <section className="section" style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <SectionHead kicker="บริการผ่านคนกลาง" title="ทุกปัญหาการซื้อขาย เรามีทางแก้ให้" lead="เลื่อนดูบริการที่ออกแบบมาแก้ปัญหาที่คนซื้อ–ขายเจอบ่อยที่สุด พร้อมข้อดีที่คุณจะได้รับ" center />
          <div className="reveal"><ServiceSlider stats={stats} /></div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="join-grid">
            <div className="join-card reveal">
              <span className="icon-tile"><Icon name="users" /></span>
              <h3>เปิดร้านในฐานะผู้ขาย</h3>
              <p>เพิ่มความน่าเชื่อถือด้วยตราการันตี ปิดการขายได้ง่ายขึ้น และเบิกเงินไว</p>
              {controls.isEnabled('sellerRegistration') ? (
                <Link className="btn btn-dark" href="/register/seller">สมัครเป็นผู้ขาย <Icon name="arrowRight" size={16} /></Link>
              ) : (
                <button className="btn btn-dark" type="button" disabled title={controls.message('sellerRegistration')}>สมัครเป็นผู้ขายปิดชั่วคราว</button>
              )}
            </div>
            <div className="join-card green reveal" style={{ ['--d' as string]: '90ms' }}>
              <span className="icon-tile green"><Icon name="handCoins" /></span>
              <h3>สร้างรายได้เป็นคนกลาง</h3>
              <p>ใช้ความน่าเชื่อถือของคุณรับงานคนกลาง รับค่าธรรมเนียมจากทุกดีลที่สำเร็จ</p>
              {controls.isEnabled('middlemanRegistration') ? (
                <Link className="btn btn-dark" href="/register/middleman">สมัครเป็นคนกลาง <Icon name="arrowRight" size={16} /></Link>
              ) : (
                <button className="btn btn-dark" type="button" disabled title={controls.message('middlemanRegistration')}>สมัครเป็นคนกลางปิดชั่วคราว</button>
              )}
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
