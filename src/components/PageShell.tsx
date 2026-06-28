'use client';
import React, { useEffect } from 'react';
import { useAppPreferences } from '@/components/AppPreferences';
import { Nav, Footer } from '@/components/Site';

type LocalizedText = string | { th: string; en: string };

function textOf(value: LocalizedText, locale: 'th' | 'en') {
  if (typeof value === 'string') return value;
  return value[locale];
}

/** เปลือกหน้าเนื้อหา (help/legal) — Nav + hero หัวเรื่อง + Footer ตาม design system */
export function PageShell({ kicker, title, lead, children }:
  { kicker: LocalizedText; title: LocalizedText; lead?: LocalizedText; children: React.ReactNode }) {
  const { locale } = useAppPreferences();
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0');
    r.style.setProperty('--accent-strong', '#1f54d6');
    r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);
  return (
    <>
      <Nav />
      <header className="page-hero">
        <div className="container">
          <div className="kicker" style={{ marginBottom: 12 }}>{textOf(kicker, locale)}</div>
          <h1 className="section-title">{textOf(title, locale)}</h1>
          {lead && <p className="section-lead" style={{ marginTop: 12 }}>{textOf(lead, locale)}</p>}
        </div>
      </header>
      <main className="page-body">
        <div className="container">{children}</div>
      </main>
      <Footer />
    </>
  );
}

export default PageShell;
