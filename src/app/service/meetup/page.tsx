'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ServiceMeetup() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-white">←</Link>
        <h1 className="text-xl font-bold">นัดรับผ่านกลาง</h1>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div className="text-center space-y-4">
          <div className="text-6xl">📍</div>
          <h2 className="text-3xl font-bold">นัดรับผ่านกลาง</h2>
          <p className="text-gray-400 text-lg">คนกลางช่วยนัดหมายสถานที่รับสินค้าที่ปลอดภัย</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold">ขั้นตอนการทำงาน</h3>
          <div className="space-y-3">
            <div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">1</span><p className="text-gray-300 pt-0.5">ผู้ซื้อและผู้ขายตกลงราคา และเลือกคนกลาง</p></div>
            <div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">2</span><p className="text-gray-300 pt-0.5">คนกลางกำหนดสถานที่นัดรับสินค้าที่ปลอดภัย</p></div>
            <div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">3</span><p className="text-gray-300 pt-0.5">ผู้ซื้อโอนเงินให้คนกลางก่อนนัดพบ</p></div>
            <div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">4</span><p className="text-gray-300 pt-0.5">นัดพบ — คนกลางตรวจสินค้าและส่งมอบ พร้อมโอนเงินให้ผู้ขาย</p></div>
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
