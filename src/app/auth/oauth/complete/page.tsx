'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/**
 * หน้ารับ callback จาก Google/Facebook OAuth.
 * supabase-js (detectSessionInUrl: true ใน src/lib/supabase.ts) จะอ่าน
 * access_token/refresh_token จาก URL hash ที่ Supabase ส่งกลับมาให้อัตโนมัติ
 * แล้วเก็บ session ไว้ใน localStorage เอง — ไม่ต้องแลก token เองแบบ Appwrite เดิม
 */
function OAuthCompleteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('กำลังเข้าสู่ระบบ...');
  const returnTo = searchParams.get('returnTo') || '/register';

  useEffect(() => {
    async function finish() {
      try {
        // ให้เวลา supabase-js อ่าน token จาก URL hash ก่อน (เกิดทันทีตอนโหลดสคริปต์
        // แต่ getSession() รอ promise นั้นให้เสร็จก่อนคืนค่าอยู่แล้ว)
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) throw new Error(error?.message || 'no_session');

        setStatus('เข้าสู่ระบบสำเร็จ...');
        const safeReturn = returnTo.startsWith('/') ? returnTo : '/register';
        router.replace(safeReturn);
      } catch (err: unknown) {
        console.error('OAuth complete error:', err);
        const message = err instanceof Error ? err.message : 'session_invalid';
        router.replace(`/login?error=oauth_failed&msg=${encodeURIComponent(message)}&returnTo=${encodeURIComponent(returnTo)}`);
      }
    }
    finish();
  }, [returnTo, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#0a0f1e', color: '#fff' }}>
      <div style={{ width: 40, height: 40, border: '4px solid #2f6bf0', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#9aa4bd', fontSize: 14 }}>{status}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function OAuthComplete() {
  return (
    <Suspense fallback={null}>
      <OAuthCompleteInner />
    </Suspense>
  );
}
