'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ServiceTrade() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-white">←</Link>
        <h1 className="text-xl font-bold">ซื้อขายผ่านกลาง</h1>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div className="text-center space-y-4">
          <div className="text-6xl">🤝</div>
          <h2 className="text-3xl font-bold">ซื้อขายผ่านกลาง</h2>
          <p className="text-gray-400 text-lg">ปลอดภัยทั้งผู้ซื้อและผู้ขาย ด้วยคนกลางที่ผ่านการรับรอง</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold">ขั้นตอนการทำงาน</h3>
          <div className="space-y-3">
            <div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">1</span><p className="text-gray-300 pt-0.5">ผู้ขายหรือผู้ซื้อสร้างดีลและส่งลิงค์ให้อีกฝ่าย</p></div>
            <div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">2</span><p className="text-gray-300 pt-0.5">ผู้ซื้อเลือกคนกลางที่ต้องการจากรายชื่อคนกลางที่ผ่านการรับรอง</p></div>
            <div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">3</span><p className="text-gray-300 pt-0.5">ทุกฝ่ายเข้าห้องแชทและเจรจาตกลงราคา</p></div>
            <div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">4</span><p className="text-gray-300 pt-0.5">ทุกฝ่ายกดยอมรับเงื่อนไข — ผู้ซื้อโอนเงินผ่าน QR Code ไปยังคนกลาง</p></div>
            <div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">5</span><p className="text-gray-300 pt-0.5">ผู้ขายแพ็คของและอัปโหลดวิดีโอแพ็คของ พร้อมส่งสินค้าให้คนกลาง</p></div>
            <div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">6</span><p className="text-gray-300 pt-0.5">คนกลางตรวจสอบสินค้าและอัปโหลดวิดีโอ — ผู้ซื้อยืนยันสินค้าไม่มีปัญหา</p></div>
            <div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">7</span><p className="text-gray-300 pt-0.5">คนกลางส่งสินค้าให้ผู้ซื้อ — ผู้ซื้อกดรับของ ดีลเสร็จสมบูรณ์</p></div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/deal/create"
            className="flex-1 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-center text-lg transition"
          >สร้างดีลใหม่</Link>
          <Link href="/marketplace"
            className="flex-1 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-center text-lg transition"
          >ดูสินค้าในตลาด</Link>
        </div>
      </div>
    </div>
  );
}
