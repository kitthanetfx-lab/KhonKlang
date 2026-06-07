'use client';
import Link from 'next/link';

const STEPS = [
  { icon: '📋', title: 'ผู้ซื้อสร้างคำขอ', desc: 'ระบุสินค้า ที่อยู่ผู้ขาย และงบที่ยอมรับได้' },
  { icon: '🤝', title: 'คนกลางเสนอราคา', desc: 'คนกลางในพื้นที่ส่งใบเสนอค่าเดินทาง + ค่าบริการ' },
  { icon: '✅', title: 'ผู้ซื้ออนุมัติ', desc: 'ผู้ซื้อเห็นเงินประกันคนกลางและยืนยันรับข้อเสนอ' },
  { icon: '🚗', title: 'คนกลางลงพื้นที่', desc: 'เดินทางไปถึงสถานที่ ตรวจสอบสินค้าจริง ถ่ายรูป/วิดีโอ' },
  { icon: '📦', title: 'รายงานผล + ส่งสินค้า', desc: 'คนกลางส่งรายงาน หากผ่านก็นำส่งหรือช่วยประสานงานส่งให้ผู้ซื้อ' },
];

export default function OnsiteService() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3">
        <Link href="/service/trade" className="text-gray-400 hover:text-white">←</Link>
        <h1 className="text-xl font-bold">จ้างคนกลางลงพื้นที่</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="text-6xl">🔍</div>
          <h2 className="text-2xl font-bold">On-site Inspection</h2>
          <p className="text-gray-400 leading-relaxed">
            ส่งคนกลางไปดูสินค้าถึงที่ ตรวจสอบสภาพจริง ถ่ายวิดีโอ<br />
            เหมาะกับรถมือสอง เครื่องจักร หรืออสังหาริมทรัพย์
          </p>
        </div>

        {/* Safety guarantee */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-yellow-300">
            🛡️ ระบบเงินประกันป้องกันทุจริต
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">
            คนกลางทุกคนต้องวางเงินประกันกับระบบ (Bronze 1,000 ฿ / Silver 5,000 ฿ / Gold 20,000 ฿ / Platinum 50,000 ฿)
            หากพบการทุจริตหรือฮั้วกับผู้ขาย <strong className="text-yellow-300">แพลตฟอร์มยึดเงินประกันชดเชยคุณทันที</strong>
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-300">ขั้นตอนการทำงาน</h3>
          {STEPS.map((s, i) => (
            <div key={i} className="flex gap-4 bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-2xl flex-shrink-0">{s.icon}</div>
              <div>
                <p className="font-medium text-white">{s.title}</p>
                <p className="text-sm text-gray-400 mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Use cases */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-gray-300">เหมาะกับสินค้าประเภทใด?</h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
            {['🚗 รถยนต์มือสอง','🏍️ มอเตอร์ไซค์','🏠 อสังหาริมทรัพย์','⚙️ เครื่องจักร','🖥️ คอมพิวเตอร์/สินค้าชิ้นใหญ่','💎 ของมีค่า'].map(u => (
              <div key={u} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">{u}</div>
            ))}
          </div>
        </div>

        <Link href="/onsite/create"
          className="block w-full py-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-center text-lg transition"
        >
          📋 สร้างคำขอลงพื้นที่
        </Link>
      </div>
    </div>
  );
}
