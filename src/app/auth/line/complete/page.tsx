'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { account, hydratePersistedSession, persistSession } from '@/lib/appwrite';
import { Suspense } from 'react';

function LineCompleteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';
  const [status, setStatus] = useState('กำลังเข้าสู่ระบบด้วย LINE...');

  useEffect(() => {
    async function finish() {
      // อ่าน session secret จาก cookie (httpOnly=false)
      const cookieMap = Object.fromEntries(
        document.cookie.split(';').map(c => {
          const [k, ...v] = c.trim().split('=');
          return [k.trim(), v.join('=')];
        })
      );
      const secret = cookieMap['line_session_pending'];

      if (!secret) {
        hydratePersistedSession();
        // ไม่มี pending cookie — ลอง account.get() โดยตรง
        try {
          const u = await account.get();
          setStatus('เข้าสู่ระบบสำเร็จ...');
          const prefs = u.prefs as Record<string, string>;
          const dest = prefs?.firstName
            ? (returnTo.startsWith('/') ? returnTo : '/')
            : '/register';
          router.replace(dest);
        } catch {
          router.replace('/login?error=line_failed&msg=no_session');
        }
        return;
      }

      // ลบ pending cookie
      document.cookie = 'line_session_pending=; max-age=0; path=/';

      // บอก Appwrite SDK ให้ใช้ session นี้ (สำคัญมาก — SDK ไม่ auto-read server cookies)
      persistSession(secret);
      setStatus('กำลังโหลดข้อมูล...');

      try {
        const u = await account.get();
        setStatus('เข้าสู่ระบบสำเร็จ...');
        const prefs = u.prefs as Record<string, string>;
        const dest = prefs?.firstName
          ? (returnTo.startsWith('/') ? returnTo : '/')
          : '/register';
        router.replace(dest);
      } catch (err: unknown) {
        console.error('LINE complete error:', err);
        const message = err instanceof Error ? err.message : 'session_invalid';
        router.replace(`/login?error=line_failed&msg=${encodeURIComponent(message)}`);
      }
    }

    finish();
  }, [router, returnTo]);

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
