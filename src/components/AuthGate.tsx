'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/**
 * บังคับให้ต้องล็อกอินก่อนเข้าใช้งานเว็บไซต์ทุกหน้า (ยกเว้นหน้าที่อยู่ใน allowlist
 * ด้านล่าง เช่น หน้าล็อกอินเอง และหน้า bridge ของ OAuth ที่ยังไม่มี session ระหว่างขั้นตอน)
 *
 * หมายเหตุสถาปัตยกรรม: โปรเจกต์นี้ใช้ @supabase/supabase-js (ไม่ใช่ @supabase/ssr)
 * และเก็บ session ไว้ใน localStorage ของ browser เท่านั้น ไม่มี cookie ที่ middleware.ts
 * (ฝั่ง server) จะอ่านได้ ฉะนั้นการบังคับล็อกอินต้องทำฝั่ง client แบบนี้
 * ซึ่งสอดคล้องกับ pattern เดิมที่หน้าอื่น ๆ ในแอปใช้ตรวจ session อยู่แล้ว
 */

const PUBLIC_PATHS = [
  '/login',
  '/auth/oauth/complete',
  '/auth/line/complete',
  '/privacy',
  '/terms',
];

function isPublicPath(path: string) {
  return PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let active = true;

    async function check() {
      if (isPublicPath(pathname)) {
        if (active) { setAuthed(true); setChecked(true); }
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        setAuthed(true);
        setChecked(true);
      } else {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
      }
    }

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session && !isPublicPath(pathname)) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
      }
    });

    return () => { active = false; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!checked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 14 }}>
        กำลังตรวจสอบสิทธิ์เข้าใช้งาน...
      </div>
    );
  }

  if (!authed) return null;

  return <>{children}</>;
}
