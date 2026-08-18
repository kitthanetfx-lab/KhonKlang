'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isGlanghubApp } from '@/lib/nativeAuth';
import { APP_HANDOFF_FAIL_MSG } from '@/lib/appAuthHandoff';

/**
 * หน้ารับ callback จาก Google/Facebook OAuth.
 * supabase-js (detectSessionInUrl: true ใน src/lib/supabase.ts) จะอ่าน
 * access_token/refresh_token จาก URL hash ที่ Supabase ส่งกลับมาให้อัตโนมัติ
 * แล้วเก็บ session ไว้ใน localStorage เอง — ไม่ต้องแลก token เองแบบ Appwrite เดิม
 */
function OAuthCompleteInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('กำลังเข้าสู่ระบบ...');
  const returnTo = searchParams.get('returnTo') || '/';

  useEffect(() => {
    let done = false;
    const safeReturn = returnTo.startsWith('/') ? returnTo : '/';

    function goHome() {
      if (done) return;
      done = true;
      setStatus('เข้าสู่ระบบสำเร็จ...');
      // full navigation — WebView/Capacitor ยืนยัน session + AuthGate ใหม่ได้แน่นอน
      window.location.replace(safeReturn);
    }

    function fail(err: unknown) {
      if (done) return;
      done = true;
      console.error('OAuth complete error:', err);
      const message = err instanceof Error ? err.message : 'session_invalid';
      const errorCode = isGlanghubApp() ? 'app_handoff' : 'oauth_failed';
      const msgParam = isGlanghubApp()
        ? encodeURIComponent(APP_HANDOFF_FAIL_MSG)
        : encodeURIComponent(message);
      window.location.replace(`/login?error=${errorCode}&msg=${msgParam}&returnTo=${encodeURIComponent(returnTo)}`);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        goHome();
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) return;
      goHome();
    }).catch(fail);

    const timer = setTimeout(() => {
      if (done) return;
      fail(new Error('session_timeout'));
    }, 15000);

    return () => {
      done = true;
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [returnTo]);

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
