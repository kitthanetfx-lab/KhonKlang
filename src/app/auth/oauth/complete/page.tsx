'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { account, persistSession } from '@/lib/appwrite';

/**
 * หน้ารับ callback จาก Google/Facebook OAuth (token flow)
 * — แลก userId+secret เป็น session ผ่าน XHR แล้วเก็บ secret ใน localStorage
 * วิธีนี้ไม่พึ่ง third-party cookie จึงใช้ได้บนมือถือ/แท็บเล็ต (Safari/Chrome บล็อก cookie ข้ามโดเมน)
 */
function OAuthCompleteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('กำลังเข้าสู่ระบบ...');

  useEffect(() => {
    async function finish() {
      const userId = searchParams.get('userId') || '';
      const secret = searchParams.get('secret') || '';
      const returnTo = searchParams.get('returnTo') || '/register';

      try {
        if (userId && secret) {
          // แลก token เป็น session — SDK จะเก็บ fallback cookie ใน localStorage ให้อัตโนมัติ
          const session = await account.createSession({ userId, secret });
          if (session.secret) persistSession(session.secret);
        }
        setStatus('กำลังโหลดข้อมูล...');
        const u = await account.get();
        setStatus('เข้าสู่ระบบสำเร็จ...');
        const prefs = u.prefs as Record<string, string>;
        // สมาชิกใหม่ (ยังไม่มีโปรไฟล์) → ไปหน้าลงทะเบียน / สมาชิกเดิม → ไปหน้าที่ตั้งใจ
        const dest = prefs?.firstName
          ? (returnTo.startsWith('/') ? returnTo : '/')
          : '/register';
        router.replace(dest);
      } catch (err: unknown) {
        console.error('OAuth complete error:', err);
        const message = err instanceof Error ? err.message : 'session_invalid';
        router.replace(`/login?error=oauth_failed&msg=${encodeURIComponent(message)}`);
      }
    }
    finish();
  }, [router, searchParams]);

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
