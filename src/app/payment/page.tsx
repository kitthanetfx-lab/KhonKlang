'use client';

import { useRouter } from 'next/navigation';
import { AlertOctagon, QrCode, Upload, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function Payment() {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate upload and status update
    router.push('/status');
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 flex items-center justify-center">
      <div className="max-w-xl w-full">
        
        {/* Warning Alert */}
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-6 rounded-r-xl shadow-md mb-8 animate-fade-in">
          <div className="flex gap-4">
            <AlertOctagon className="w-8 h-8 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div>
              <h3 className="text-red-800 dark:text-red-300 font-bold text-lg mb-2">คำเตือนสำคัญ</h3>
              <p className="text-red-700 dark:text-red-200 text-sm leading-relaxed">
                หากตรวจพบประวัติการฉ้อโกงหรือมีชื่อติดแบล็กลิสต์ในระบบใดๆ จะริบเงินค่าสมัครและไม่คืนเงินทุกกรณี 
                หากติดปัญหาสามารถยื่นหลักฐานชี้แจงกับแอดมินโดยตรง{' '}
                <Link href="#" className="font-semibold underline hover:text-red-800">
                  คลิกที่นี่เพื่อติดต่อแอดมิน
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <div className="glass-panel rounded-2xl p-6 sm:p-10 shadow-xl animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h1 className="text-2xl font-bold mb-6 text-center">ชำระค่าลงทะเบียน</h1>
          
          <div className="bg-white/50 dark:bg-gray-900/50 rounded-xl p-6 text-center border border-gray-200 dark:border-gray-700 mb-8">
            <div className="w-48 h-48 mx-auto bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-center mb-4">
              {/* This would be an actual QR code image in production */}
              <div className="text-center">
                <QrCode className="w-24 h-24 mx-auto text-gray-800 mb-2" />
                <span className="text-xs font-semibold text-gray-500">สแกนเพื่อชำระเงิน</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-gray-500">หรือโอนผ่านบัญชีธนาคาร</p>
              <p className="font-bold text-lg text-blue-600 dark:text-blue-400">ธนาคารกสิกรไทย (KBANK)</p>
              <p className="text-xl tracking-wider font-mono">123-4-56789-0</p>
              <p className="text-sm font-medium">ชื่อบัญชี: บจก. คนกลาง กรุ๊ป</p>
              <p className="font-bold text-lg mt-4">จำนวนเงิน: 500 บาท</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-8">
              <label className="block text-sm font-medium mb-3">แนบสลิปการโอนเงิน</label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                <Upload className="w-10 h-10 mx-auto text-blue-500 mb-3" />
                <p className="text-sm font-medium mb-1">คลิกเพื่ออัปโหลด หรือลากไฟล์มาวาง</p>
                <p className="text-xs text-gray-500 mb-4">รองรับ JPG, PNG ขนาดไม่เกิน 5MB</p>
                <input type="file" required accept="image/*" className="mx-auto text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" /> ยืนยันการชำระเงิน
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
