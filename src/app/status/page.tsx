'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ResponsiveShell } from '@/components/mobile';
import { StatusApp } from '@/components/system/SystemNoticeApp';

export default function Status() {
  const [status, setStatus] = useState<'pending' | 'approved'>('pending');
  const router = useRouter();

  const desktop = (
    <div className="min-h-screen py-12 px-4 sm:px-6 flex flex-col items-center justify-center">
      <div className="fixed top-4 right-4 bg-white/80 p-3 rounded-xl border shadow-sm flex items-center gap-3 z-50">
        <span className="text-xs font-semibold text-gray-500 uppercase">Dev Mode:</span>
        <button type="button" onClick={() => setStatus('pending')} className={`text-xs px-3 py-1.5 rounded-md ${status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100'}`}>Pending</button>
        <button type="button" onClick={() => setStatus('approved')} className={`text-xs px-3 py-1.5 rounded-md ${status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>Approved</button>
      </div>
      <div className="w-full max-w-md glass-panel rounded-3xl p-8 shadow-2xl text-center">
        <h1 className="text-2xl font-bold">{status === 'pending' ? 'กำลังตรวจสอบข้อมูล' : 'อนุมัติเรียบร้อย!'}</h1>
        <p className="text-gray-600 mt-4">{status === 'pending' ? 'กรุณารอประมาณ 24-48 ชั่วโมง' : 'คุณได้รับการอนุมัติแล้ว'}</p>
        <button type="button" className="mt-8 text-sm text-gray-500" onClick={() => router.push('/')}>ออกจากระบบ</button>
      </div>
    </div>
  );

  return (
    <ResponsiveShell
      mobile={
        <StatusApp
          status={status}
          onToggleDev={setStatus}
          onLogout={() => router.push('/')}
        />
      }
      desktop={desktop}
    />
  );
}
