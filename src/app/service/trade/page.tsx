'use client';
import Link from 'next/link';

export default function ServiceTrade() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-white">←</Link>
        <h1 className="text-xl font-bold">บริการผ่านคนกลาง</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <div className="text-center space-y-2">
          <div className="text-5xl">🤝</div>
          <h2 className="text-2xl font-bold">เลือกรูปแบบบริการ</h2>
          <p className="text-gray-400">Khonklang มีบริการคนกลาง 2 รูปแบบ เลือกตามลักษณะสินค้าของคุณ</p>
        </div>

        {/* Two mode cards */}
        <div className="grid sm:grid-cols-2 gap-5">
          {/* Mode 1 - Online Trade */}
          <Link href="/service/trade/online"
            className="group bg-white/5 hover:bg-blue-900/20 border border-white/10 hover:border-blue-500/50 rounded-2xl p-6 transition-all hover:-translate-y-1 space-y-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 flex items-center justify-center text-3xl">
              🛒
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">ซื้อขายผ่านกลาง</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                ซื้อขายออนไลน์ คนกลางรับเงิน ตรวจสินค้า และส่งให้ผู้ซื้อ เหมาะกับสินค้าที่จัดส่งได้
              </p>
            </div>
            <div className="space-y-1.5 text-xs text-gray-500">
              <div className="flex items-center gap-2">✅ ปลอดภัยทั้งผู้ซื้อและผู้ขาย</div>
              <div className="flex items-center gap-2">✅ คนกลางตรวจสินค้าก่อนส่ง</div>
              <div className="flex items-center gap-2">✅ ชำระเงินผ่านระบบ Escrow</div>
            </div>
            <div className="flex items-center gap-1 text-blue-400 text-sm font-medium group-hover:gap-2 transition-all">
              เริ่มต้น <span>→</span>
            </div>
          </Link>

          {/* Mode 2 - On-site Inspection */}
          <Link href="/service/onsite"
            className="group bg-white/5 hover:bg-orange-900/20 border border-white/10 hover:border-orange-500/50 rounded-2xl p-6 transition-all hover:-translate-y-1 space-y-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-orange-600/20 flex items-center justify-center text-3xl">
              🔍
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">จ้างคนกลางลงพื้นที่</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                คนกลางเดินทางไปตรวจสินค้าถึงที่ เหมาะกับรถมือสอง อสังหาฯ หรือสินค้าชิ้นใหญ่
              </p>
            </div>
            <div className="space-y-1.5 text-xs text-gray-500">
              <div className="flex items-center gap-2">🚗 คนกลางไปถึงสถานที่จริง</div>
              <div className="flex items-center gap-2">📸 ถ่ายรูป/วิดีโอสภาพจริง</div>
              <div className="flex items-center gap-2">🛡️ มีเงินประกันคุ้มครองทุจริต</div>
            </div>
            <div className="flex items-center gap-1 text-orange-400 text-sm font-medium group-hover:gap-2 transition-all">
              เริ่มต้น <span>→</span>
            </div>
          </Link>
        </div>

        {/* Original steps — collapsed into accordion-style info */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-sm text-gray-300">ขั้นตอนการซื้อขายผ่านกลาง (ออนไลน์)</h3>
          <div className="space-y-2">
            {[
              'ผู้ขายหรือผู้ซื้อสร้างดีลและส่งลิงค์ให้อีกฝ่าย',
              'ผู้ซื้อเลือกคนกลางจากรายชื่อที่ผ่านการรับรอง',
              'ทุกฝ่ายเข้าห้องแชทและเจรจาตกลงราคา',
              'ผู้ซื้อโอนเงินผ่าน QR Code ไปยังคนกลาง',
              'ผู้ขายแพ็คของและส่งสินค้าให้คนกลาง',
              'คนกลางตรวจสินค้าและวิดีโอ — ผู้ซื้อยืนยัน',
              'คนกลางส่งสินค้าให้ผู้ซื้อ — ดีลเสร็จสมบูรณ์',
            ].map((step, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600/60 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <p className="text-gray-400 text-sm pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/deal/create"
            className="flex-1 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-center transition"
          >สร้างดีลออนไลน์</Link>
          <Link href="/marketplace"
            className="flex-1 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-center transition"
          >ดูสินค้าในตลาด</Link>
        </div>
      </div>
    </div>
  );
}
