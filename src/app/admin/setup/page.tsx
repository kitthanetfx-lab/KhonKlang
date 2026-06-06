'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { account } from '@/lib/appwrite';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function AdminSetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [msg, setMsg]       = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    account.get()
      .then(u => setUserName(u.name || u.email || 'คุณ'))
      .catch(() => router.replace('/login'));
  }, [router]);

  const makeAdmin = async () => {
    setStatus('loading');
    try {
      const jwt = (await account.createJWT()).jwt;
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-jwt': jwt },
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || 'เกิดข้อผิดพลาด'); setStatus('error'); return; }
      setStatus('done');
      setTimeout(() => router.replace('/admin'), 1500);
    } catch (e) {
      setMsg(String(e)); setStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="max-w-sm w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 text-center space-y-5">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8 text-blue-600" />
        </div>

        <div>
          <h1 className="text-xl font-bold">ตั้งค่า Admin</h1>
          <p className="text-sm text-gray-500 mt-1">
            {userName && `สวัสดี ${userName} — `}กดปุ่มด้านล่างเพื่อให้สิทธิ์ Admin แก่บัญชีนี้
          </p>
        </div>

        {status === 'done' ? (
          <div className="text-green-600 font-medium">✅ ได้รับสิทธิ์ Admin แล้ว กำลังเข้าสู่ระบบ...</div>
        ) : (
          <button onClick={makeAdmin} disabled={status === 'loading'}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2">
            {status === 'loading' ? <><Loader2 className="w-4 h-4 animate-spin" /> กำลังตั้งค่า...</> : 'ให้สิทธิ์ Admin'}
          </button>
        )}

        {status === 'error' && (
          <p className="text-sm text-red-500">{msg}</p>
        )}

        <p className="text-xs text-gray-400">หน้านี้ใช้สำหรับตั้งค่าครั้งแรกเท่านั้น</p>
      </div>
    </div>
  );
}
