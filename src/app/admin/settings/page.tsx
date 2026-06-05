'use client';

import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Settings size={20} /> ตั้งค่า</h1>
        <p className="text-sm text-gray-500 mt-0.5">การตั้งค่าแพลตฟอร์มและระบบ</p>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center">
        <Settings size={40} className="text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">เร็วๆ นี้ — การตั้งค่าระบบ, ค่าธรรมเนียม, PromptPay และช่องทางชำระเงิน</p>
      </div>
    </div>
  );
}
