'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isGlanghubApp } from '@/lib/nativeAuth';
import { appLoginUrl } from '@/lib/appDeepLinkNav';

function LineCompleteInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('กำลังเข้าสู่ระบบด้วย LINE...');
  const returnTo = searchParams.get('returnTo') || '/';

  useEffect(() => {
    const safeReturn = returnTo.startsWith('/') ? returnTo : '/';

    async function finish() {
      const cookieMap = Object.fromEntries(
        document.cookie.split(';').map(c => {
          const [k, ...v] = c.trim().split('=');
          return [k.trim(), v.join('=')];
        }),
      );
      const raw = cookieMap['line_session_pending'];

      // แอpp + ไม่มี cookie = ถูก App Link ดึงมาจาก login ในเบราว์เซอร์ — ไม่รับ
      if (isGlanghubApp() && !raw) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          window.location.replace(appLoginUrl(safeReturn));
          return;
        }
      }

      if (!raw) {
        try {
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error('no_session');
          routeAfterLogin();
        } catch {
          window.location.replace(`/login?error=line_failed&msg=no_session&returnTo=${encodeURIComponent(returnTo)}`);
        }
        return;
      }

      document.cookie = 'line_session_pending=; max-age=0; path=/';

      try {
        const { access_token, refresh_token } = JSON.parse(decodeURIComponent(raw));
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;
        setStatus('กำลังโหลดข้อมูล...');
        routeAfterLogin();
      } catch (err: unknown) {
        console.error('LINE complete error:', err);
        const message = err instanceof Error ? err.message : 'session_invalid';
        window.location.replace(`/login?error=line_failed&msg=${encodeURIComponent(message)}&returnTo=${encodeURIComponent(returnTo)}`);
      }
    }

    function routeAfterLogin() {
      setStatus('เข้าสู่ระบบสำเร็จ...');
      window.location.replace(safeReturn);
    }

    finish();
  }, [returnTo]);

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center gap-4 text-white">
      <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-300 text-sm">{status}</p>
    </div>
  );
}

export default function LineComplete() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LineCompleteInner />
    </Suspense>
  );
}
