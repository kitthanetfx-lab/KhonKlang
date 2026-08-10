'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSiteMaintenanceInfo, type ServiceControlMap } from '@/lib/serviceControls';
import { ResponsiveShell } from '@/components/mobile';
import { MaintenanceApp } from '@/components/system/SystemNoticeApp';

export default function MaintenancePage() {
  const [info, setInfo] = useState(() => getSiteMaintenanceInfo(null));

  useEffect(() => {
    fetch('/api/service-controls', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const services = d?.services as ServiceControlMap | undefined;
        setInfo(getSiteMaintenanceInfo(services));
        if (!getSiteMaintenanceInfo(services).active) {
          window.location.replace('/');
        }
      })
      .catch(() => {});
  }, []);

  const reopenLabel = info.reopenAt
    ? new Date(info.reopenAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  const desktop = (
    <div style={{ maxWidth: 720, margin: '56px auto', padding: '0 20px' }}>
      <div style={{
        background: 'linear-gradient(180deg, #fff, #f7f9fd)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-xl)',
        padding: '32px 28px',
        boxShadow: 'var(--sh-sm)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🛠️</div>
        <div className="badge badge-amber" style={{ marginBottom: 14 }}>ปิดปรับปรุงชั่วคราว</div>
        <h1 style={{ marginBottom: 12, fontFamily: 'var(--font-display)' }}>เว็บไซต์ปิดให้บริการชั่วคราว</h1>
        <p style={{ color: 'var(--ink-2)', lineHeight: 1.7, marginBottom: 16 }}>{info.message}</p>
        {reopenLabel && (
          <p style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: 16 }}>
            คาดว่าจะเปิดให้บริการอีกครั้ง: {reopenLabel}
          </p>
        )}
        <Link href="/" className="btn btn-primary">ลองใหม่อีกครั้ง</Link>
      </div>
    </div>
  );

  return (
    <ResponsiveShell
      mobile={<MaintenanceApp message={info.message} reopenLabel={reopenLabel || undefined} />}
      desktop={desktop}
    />
  );
}
