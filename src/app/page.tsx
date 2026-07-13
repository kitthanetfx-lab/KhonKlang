'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/Icon';
import { Nav, Footer, CountUp, useReveal, useTilt } from '@/components/Site';
import { EscrowStage } from '@/components/EscrowStage';
import { ServiceSlider } from '@/components/ServiceSlider';
import { useAppPreferences } from '@/components/AppPreferences';
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
  // default labels in Thai; locale mapping happens in page
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

function Hero({ stats, controls, locale }: { stats: SiteStats | null; controls: ReturnType<typeof useServiceControls>; locale: 'th' | 'en' }) {
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
            {/* โลโก้สลับตามธีม — CSS ใน globals.css ซ่อน/แสดงตาม html[data-theme='dark'] */}
            <Image
              src="/logo.png"
              alt="โลโก้กลางฮับ"
              width={520}
              height={520}
              priority
              className="hero-brand-image hero-logo-light"
            />
            <Image
              src="/logo-dark.png"
              alt="โลโก้กลางฮับ (dark)"
              width={520}
              height={520}
              className="hero-brand-image hero-logo-dark"
            />
          </div>
          <div className="hero-promo-mini reveal" style={{ ['--d' as string]: '140ms' }}>
            {stats?.promoVideoUrl ? (
              <div className="promo-video-wrap">
                <iframe src={stats.promoVideoUrl} title={locale === 'th' ? 'วีดีโอแนะนำการใช้งาน' : 'How it works video'} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
              </div>
            ) : PROMO_IMAGE ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={PROMO_IMAGE} alt={locale === 'th' ? 'แนะนำการใช้งาน' : 'How it works'} className="promo-image" />
            ) : (
              <div className="promo-placeholder">
                <Icon name="film" size={20} />
                <p>{locale === 'th' ? 'เร็ว ๆ นี้ — วีดีโอ/ภาพแนะนำการใช้งาน' : 'Coming soon — product walkthrough video/image'}</p>
              </div>
            )}
          </div>
        </div>
        <div className="hero-stage reveal" style={{ ['--d' as string]: '140ms' }} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} ref={stageTiltRef}>
          <EscrowStage speed={1} />
          <div className="eyebrow reveal"><Icon name="shieldCheck" size={19} /> {locale === 'th' ? 'ซื้อขายปลอดภัยผ่านคนกลางรับรอง' : 'Safer trading with trusted escrow support'}</div>
          <h1 className="hero-title reveal" style={{ ['--d' as string]: '60ms' }}>
            {locale === 'th' ? <>จ่ายเงินอย่างมั่นใจ<br /><span className="gradient-text">ได้ของชัวร์ ไม่โดนโกง</span></> : <>Pay with confidence<br /><span className="gradient-text">Get the real item, avoid scams</span></>}
          </h1>
          <div className="reveal" style={{ ['--d' as string]: '120ms', marginTop: 24 }}>
            <Link className="btn btn-lg" href="/deal-all" style={{ background: 'var(--accent)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {locale === 'th' ? 'เริ่ม Deal' : 'Start a Deal'} <Icon name="arrowRight" size={18} />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function HomePage() {
  useReveal();
  const { locale } = useAppPreferences();
  const stats = useSiteStats();
  const statItems = buildStatItems(stats).map(item => ({
    ...item,
    label: locale === 'th'
      ? item.label
      : ({
          'สมาชิกทั้งหมด': 'Total Members',
          'ผู้ขายในระบบ': 'Registered Sellers',
          'คนกลางผ่านการรับรอง': 'Verified Middlemen',
          'ดีลสำเร็จปลอดภัย': 'Completed Protected Deals',
          'มูลค่าที่คุ้มครอง': 'Protected Value',
          'ความพึงพอใจผู้ใช้': 'User Satisfaction',
        }[item.label] || item.label),
  }));
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
      <Hero stats={stats} controls={controls} locale={locale} />

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
          <SectionHead kicker={locale === 'th' ? 'บริการผ่านคนกลาง' : 'Escrow Services'} title={locale === 'th' ? 'ทุกปัญหาการซื้อขาย เรามีทางแก้ให้' : 'We design services for real trading problems'} lead={locale === 'th' ? 'เลื่อนดูบริการที่ออกแบบมาแก้ปัญหาที่คนซื้อ–ขายเจอบ่อยที่สุด พร้อมข้อดีที่คุณจะได้รับ' : 'Browse services built to solve the most common buyer-seller risks, with clear benefits for both sides.'} center />
          <div className="reveal"><ServiceSlider stats={stats} /></div>
        </div>
      </section>

      <section className="scam-band">
        <div className="container scam-inner reveal">
          <div className="scam-ic"><Icon name="search" size={30} /></div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 style={{ fontSize: 'clamp(22px,3vw,30px)', color: '#fff' }}>{locale === 'th' ? 'สงสัยว่าจะโดนโกง? เช็คก่อนโอน' : 'Think it might be a scam? Check before you pay'}</h2>
            <p style={{ color: 'rgba(255,255,255,.78)', marginTop: 8, maxWidth: '52ch' }}>{locale === 'th' ? 'ค้นหาชื่อ เลขบัญชี หรือเบอร์โทรศัพท์จากฐานข้อมูลคนโกง เพื่อความปลอดภัยก่อนทำธุรกรรมทุกครั้ง' : 'Search names, bank accounts, or phone numbers against scam reports before every transaction.'}</p>
          </div>
          <Link className="btn btn-lg" href="/check-scam" style={{ background: '#fff', color: '#10224d' }}>{locale === 'th' ? 'ตรวจสอบเลย' : 'Check Now'} <Icon name="arrowRight" size={18} /></Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
