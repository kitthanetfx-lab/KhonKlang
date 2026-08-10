'use client';

import React, { useEffect } from 'react';
import { Nav, Footer } from '@/components/Site';
import { ResponsiveShell, ContentPageApp } from '@/components/mobile';

/** เปลือกหน้าเนื้อหา (help/legal) — desktop: Nav+hero · mobile: App shell */
export function PageShell({ kicker, title, lead, children }:
  { kicker: string; title: string; lead?: string; children: React.ReactNode }) {
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--accent', '#2f6bf0');
    r.style.setProperty('--accent-strong', '#1f54d6');
    r.style.setProperty('--accent-soft', '#eef4ff');
  }, []);

  return (
    <>
      <Nav />
      <ResponsiveShell
        mobile={
          <ContentPageApp kicker={kicker} title={title} lead={lead} backHref="/">
            {children}
          </ContentPageApp>
        }
        desktop={
          <>
            <header className="page-hero">
              <div className="container">
                <div className="kicker" style={{ marginBottom: 12 }}>{kicker}</div>
                <h1 className="section-title">{title}</h1>
                {lead && <p className="section-lead" style={{ marginTop: 12 }}>{lead}</p>}
              </div>
            </header>
            <main className="page-body">
              <div className="container">{children}</div>
            </main>
            <Footer />
          </>
        }
      />
    </>
  );
}

export default PageShell;
