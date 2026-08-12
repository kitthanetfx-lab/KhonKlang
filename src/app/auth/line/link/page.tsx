'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAccessToken } from '@/lib/supabase';

function LineLinkInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('กำลังเตรียมผูก LINE...');
  const returnTo = searchParams.get('returnTo') || '/profile';

  useEffect(() => {
    async function startLink() {
      const token = await getAccessToken();
      const safeReturn = returnTo.startsWith('/') ? returnTo : '/profile';
      if (!token) {
        router.replace(`/login?returnTo=${encodeURIComponent(`/auth/line/link?returnTo=${encodeURIComponent(safeReturn)}`)}`);
        return;
      }

      try {
        setStatus('กำลังเปิด LINE...');
        const res = await fetch(
          `/api/auth/line/link?returnTo=${encodeURIComponent(safeReturn)}&format=json`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) {
          throw new Error(data.error || 'link_start_failed');
        }
        window.location.href = data.url;
      } catch {
        router.replace(`${safeReturn}?line_link_error=start_failed`);
      }
    }

    startLink();
  }, [returnTo, router]);

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center gap-4 text-white">
      <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-300 text-sm">{status}</p>
    </div>
  );
}

export default function LineLinkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LineLinkInner />
    </Suspense>
  );
}
