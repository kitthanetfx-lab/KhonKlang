'use client';

import { useState } from 'react';
import { Clock, CheckCircle2, Shield, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Status() {
  // For demonstration, we use a state to toggle between pending and approved.
  // In a real application, this would come from the Appwrite database.
  const [status, setStatus] = useState<'pending' | 'approved'>('pending');
  const router = useRouter();

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 flex flex-col items-center justify-center">
      
      {/* Dev Toggle (Remove in production) */}
      <div className="fixed top-4 right-4 bg-white/80 dark:bg-black/50 backdrop-blur-sm p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-3 z-50">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dev Mode:</span>
        <button 
          onClick={() => setStatus('pending')}
          className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Pending
        </button>
        <button 
          onClick={() => setStatus('approved')}
          className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Approved
        </button>
      </div>

      <div className="w-full max-w-md glass-panel rounded-3xl p-8 shadow-2xl relative overflow-hidden animate-fade-in text-center">
        
        {/* Dynamic Background Element */}
        <div className={`absolute top-0 left-0 w-full h-2 transition-colors duration-500 ${status === 'pending' ? 'bg-amber-400' : 'bg-green-500'}`}></div>

        {status === 'pending' ? (
          <div className="space-y-6">
            <div className="w-24 h-24 mx-auto bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-6">
              <Clock className="w-12 h-12 text-amber-500 animate-pulse" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">กำลังตรวจสอบข้อมูล</h1>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              แอดมินกำลังตรวจสอบหลักฐานการสมัครของคุณ<br/>
              กรุณารอประมาณ 24-48 ชั่วโมง
            </p>
            
            <div className="bg-white/50 dark:bg-gray-900/50 rounded-xl p-4 mt-6 inline-block">
              <p className="text-sm font-medium text-gray-500">หมายเลขอ้างอิงของคุณ</p>
              <p className="text-lg font-mono font-bold tracking-wider mt-1">REF-849201</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="absolute inset-0 bg-green-100 dark:bg-green-900/30 rounded-full animate-ping opacity-75"></div>
              <div className="relative w-full h-full bg-green-50 dark:bg-green-900/40 rounded-full flex items-center justify-center border-4 border-green-500 shadow-lg">
                <CheckCircle2 className="w-16 h-16 text-green-500" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">อนุมัติเรียบร้อย!</h1>
            <p className="text-gray-600 dark:text-gray-300">
              ยินดีด้วย คุณได้รับการอนุมัติเป็นผู้ขายยืนยันตัวตนแล้ว
            </p>

            <div className="bg-gradient-to-br from-blue-600 to-purple-700 p-6 rounded-2xl shadow-xl mt-8 text-white relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-10">
                <Shield className="w-32 h-32" />
              </div>
              <div className="relative z-10 text-left">
                <p className="text-blue-100 text-sm font-medium mb-1">รหัสผู้ขายประจำกลุ่ม</p>
                <p className="text-4xl font-black tracking-widest font-mono drop-shadow-md">KK-89245</p>
                <div className="mt-4 pt-4 border-t border-white/20 flex justify-between items-center">
                  <span className="text-xs text-blue-100 uppercase tracking-wider font-semibold">Verified Seller</span>
                  <Shield className="w-5 h-5 text-yellow-300" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-800">
          <button 
            onClick={() => router.push('/')}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm font-medium flex items-center justify-center gap-2 mx-auto transition-colors"
          >
            <LogOut className="w-4 h-4" />
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}
