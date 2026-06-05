'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { client, account } from '@/lib/appwrite';

export default function LineComplete() {
  const router = useRouter();

  useEffect(() => {
    // อ่าน session secret จาก cookie ที่ callback ตั้งไว้
    const cookies = Object.fromEntries(
      document.cookie.split(';').map((c) => {
        const [k, ...v] = c.trim().split('=');
        return [k, v.join('=')];
      })
    );

    const secret = cookies['line_session_pending'];

    if (!secret) {
      router.replace('/login?error=line_failed&msg=no_session');
      return;
    }

    // บอก Appwrite SDK ให้ใช้ session นี้โดยตรง
    client.setSession(secret);

    // ลบ pending cookie
    document.cookie = 'line_session_pending=; max-age=0; path=/';

    // ตรวจสอบ user แล้ว redirect ตามสถานะ
    account.get()
      .then((u) => {
        const prefs = u.prefs as Record<string, string>;
        if (prefs?.firstName) {
          router.replace('/'); // ลงทะเบียนแล้ว → หน้าหลัก
        } else {
          router.replace('/register'); // ยังไม่ได้ลงทะเบียน → กรอกฟอร์ม
        }
      })
      .catch(() => {
        router.replace('/login?error=line_failed&msg=session_invalid');
      });
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-600 dark:text-gray-300">กำลังเข้าสู่ระบบด้วย LINE...</p>
    </div>
  );
}
