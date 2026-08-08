'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** รวมเข้าหน้า ดีล & ข้อพิพาท → หมวดออนไซต์ */
export default function AdminOnsiteJobsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/deals?category=onsite');
  }, [router]);
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="animate-spin text-gray-400" />
    </div>
  );
}
