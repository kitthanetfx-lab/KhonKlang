'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { authHeaders } from '@/lib/supabase';

export default function AdminSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const handleSetup = async () => {
    setLoading(true); setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return; }
      setDone(true);
      setTimeout(() => router.push('/admin'), 1500);
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="max-w-sm w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl p-8 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold">ตั้งค่า Admin</h1>
          <p className="text-sm text-gray-500 mt-1">กดปุ่มด้านล่างเพื่อตั้งบัญชีปัจจุบันเป็น Admin</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Endpoint นี้ใช้ได้เฉพาะเมื่อยังไม่มี Admin ในระบบ หลังจากนั้นจะถูกบล็อกอัตโนมัติ
          </p>
        </div>

        {done ? (
          <div className="flex items-center justify-center gap-2 text-green-600 font-medium py-2">
            <CheckCircle2 className="w-5 h-5" /> ตั้งค่าสำเร็จ กำลังไปหน้า Admin...
          </div>
        ) : (
          <>
            {error && (
              <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                {error}
              </p>
            )}
            <button onClick={handleSetup} disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition-all">
              {loading ? 'กำลังตั้งค่า...' : 'ตั้งบัญชีนี้เป็น Admin'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
