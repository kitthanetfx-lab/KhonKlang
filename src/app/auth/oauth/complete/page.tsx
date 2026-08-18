'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isGlanghubApp } from '@/lib/nativeAuth';
import { appLoginUrl } from '@/lib/appDeepLinkNav';

/**
 * หน้ารับ callback จาก Google/Facebook OAuth (เว็บเบราว์เซอร์เท่านั้น)
 * แอpp ใช้ Native Google Sign-In แล้วไป returnTo โดยตรง — ไม่ผ่านหน้านี้
 */
function OAuthCompleteInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('กำลังเข้าสู่ระบบ...');
  const returnTo = searchParams.get('returnTo') || '/';

  useEffect(() => {
    const safeReturn = returnTo.startsWith('/') ? returnTo : '/';

    // แอpp ที่เปิด URL นี้จาก App Link = login จากเบราว์เซอร์ — ไม่รับ
    if (isGlanghubApp()) {
      window.location.replace(appLoginUrl(safeReturn));
      return;
    }

    let done = false;

    function goHome() {
      if (done) return;
      done = true;
      setStatus('เข้าสู่ระบบสำเร็จ...');
      window.location.replace(safeReturn);
    }

    function fail(err: unknown) {
      if (done) return;
      done = true;
      console.error('OAuth complete error:', err);
      const message = err instanceof Error ? err.message : 'session_invalid';
      window.location.replace(`/login?error=oauth_failed&msg=${encodeURIComponent(message)}&returnTo=${encodeURIComponent(returnTo)}`);
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
