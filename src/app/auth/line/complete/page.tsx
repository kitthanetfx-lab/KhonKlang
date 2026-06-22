'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function LineCompleteInner() {
  const router = useRouter();
  const [status, setStatus] = useState('กำลังเข้าสู่ระบบด้วย LINE...');

  useEffect(() => {
    async function finish() {
      const cookieMap = Object.fromEntries(
        document.cookie.split(';').map(c => {
          const [k, ...v] = c.trim().split('=');
          return [k.trim(), v.join('=')];
        }),
      );
      const raw = cookieMap['line_session_pending'];

      if (!raw) {
        // ไม่มี pending cookie — ลองใช้ session ที่มีอยู่แล้วใน localStorage
        try {
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error('no_session');
          await routeAfterLogin();
        } catch {
          router.replace('/login?error=line_failed&msg=no_session');
        }
        return;
      }

      document.cookie = 'line_session_pending=; max-age=0; path=/';

      try {
        const { access_token, refresh_token } = JSON.parse(raw);
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;
        setStatus('กำลังโหลดข้อมูล...');
        await routeAfterLogin();
      } catch (err: unknown) {
        console.error('LINE complete error:', err);
        const message = err instanceof Error ? err.message : 'session_invalid';
        router.replace(`/login?error=line_failed&msg=${encodeURIComponent(message)}`);
      }
    }

    async function routeAfterLogin() {
      setStatus('เข้าสู่ระบบสำเร็จ...');
      // บังคับเข้าหน้าโปรไฟล์ทันทีหลังล็อกอินเสมอ ไม่ว่าจะมีข้อมูลโปรไฟล์แล้วหรือไม่
      router.replace('/profile');
    }

    finish();
  }, [router]);

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
