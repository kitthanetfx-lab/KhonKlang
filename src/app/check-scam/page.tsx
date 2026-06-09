'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

const SITES = [
  { name: 'Blacklist Seller', tag: 'ผู้ขายออนไลน์', desc: 'ฐานข้อมูลผู้ขายที่ถูกแบล็คลิสต์จากผู้ซื้อทั่วประเทศ ตรวจสอบชื่อ เบอร์ บัญชีก่อนโอน', bg: 'linear-gradient(135deg,#1a0a0a 0%,#4a0a14 100%)', tagColor: '#ff8080', url: 'https://www.blacklistseller.com/' },
  { name: 'ฉลาดโอน', tag: 'เลขบัญชี / เบอร์โทร', desc: 'ตรวจสอบเลขบัญชีธนาคารและเบอร์โทรศัพท์ว่าเคยถูกร้องเรียนว่าโกงหรือไม่ก่อนโอนเงิน', bg: 'linear-gradient(135deg,#0a1e14 0%,#0a4022 100%)', tagColor: '#80ffb8', url: 'https://www.chaladohn.com/' },
  { name: 'เช็คก่อน (CheckGon)', tag: 'ภาครัฐ', desc: 'ระบบตรวจสอบการโกงออนไลน์โดยภาครัฐ เชื่อถือได้ 100% รองรับทั้งผู้ซื้อและผู้ขาย', bg: 'linear-gradient(135deg,#060e22 0%,#0a2050 100%)', tagColor: '#80b8ff', url: 'https://checkgon.go.th/' },
];

export default function CheckScamPage() {
  const [q, setQ] = useState('');
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0'); r.style.setProperty('--accent-strong', '#1f54d6'); r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);
  function open(site: typeof SITES[0]) {
    const url = q.trim() ? site.url + '?q=' + encodeURIComponent(q.trim()) : site.url;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  function openAll() { SITES.forEach(s => open(s)); }

  return (
    <div className="sub-page">
      <header className="sub-header">
        <Link href="/" className="sub-back">←</Link>
        <span className="sub-htitle">เช็คคนโกง</span>
      </header>
      <div className="cs-inner">
        <div className="cs-hero">
          <div className="cs-hero-icon">🛡️</div>
          <h1 className="cs-title">เช็คคนโกงก่อนโอน</h1>
          <div className="cs-slogan">
            <span>⏱ เสียเวลาสักนิด</span><span style={{ opacity: .4 }}>•</span>
            <span>🛡 ปลอดภัยมั่นใจ</span><span style={{ opacity: .4 }}>•</span>
            <span>📉 ความเสี่ยงน้อยลง</span>
          </div>
        </div>
        <div className="cs-search-row">
          <div className="cs-search-wrap">
            <svg className="cs-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="ชื่อ-สกุล, เลขบัญชี หรือเบอร์โทรศัพท์..." onKeyDown={e => { if (e.key === 'Enter') openAll(); }} />
          </div>
          <button className="cs-btn-all" onClick={openAll}>เช็คทุกเว็บ</button>
        </div>
        <div className="cs-sites">
          {SITES.map(s => (
            <div key={s.name} className="cs-site-card">
              <div className="cs-site-banner" style={{ background: s.bg }}>
                <div className="cs-site-banner-overlay" />
                <div className="cs-site-banner-content">
                  <span className="cs-site-name">{s.name}</span>
                  <span className="cs-site-tag" style={{ background: `${s.tagColor}30`, borderColor: `${s.tagColor}60`, color: s.tagColor }}>{s.tag}</span>
                </div>
              </div>
              <div className="cs-site-body"><p className="cs-site-desc">{s.desc}</p></div>
              <div className="cs-site-footer">
                <span className="cs-site-hint">{q.trim() ? <>จะเปิดค้นหา <strong>&quot;{q}&quot;</strong></> : 'กรอกข้อมูลด้านบนเพื่อค้นหาตรงจุด'}</span>
                <button className="cs-site-btn" onClick={() => open(s)}>เปิดเว็บไซต์
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="cs-footer-note">ระบบเปิดเว็บไซต์ภายนอกในแท็บใหม่<br />หากพบประวัติน่าสงสัย <strong style={{ color: 'var(--amber-500)' }}>ไม่ควรโอนเงิน</strong> และแนะนำให้ใช้บริการคนกลางของเรา</p>
      </div>
    </div>
  );
}
