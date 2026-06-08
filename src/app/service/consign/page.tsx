'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Step { icon: string; title: string; desc: string; }
interface Service {
  id: string;
  emoji: string;
  badge: string;
  name: string;
  tagline: string;
  teaser: string;
  accent: string;        // tailwind bg color (card glow)
  accentBorder: string;  // border color
  badgeColor: string;
  stepColor: string;
  steps: Step[];
  ctaLabel: string;
  ctaHref: string;
  highlight: string;     // key stat/hook
}

const SERVICES: Service[] = [
  {
    id: 'boost',
    emoji: '📣',
    badge: 'Boost & Sell',
    name: 'ฝากขาย-ช่วยดัน',
    tagline: 'ให้คนกลางมือโปรช่วยไลฟ์สดและป้ายยาให้สิ!',
    teaser: 'ไม่มีเวลาขาย? บริการนี้คนกลางจะไม่แค่รับฝากของ แต่ช่วยทำคอนเทนต์ ไลฟ์สด และโปรโมทสินค้าผ่านช่องทางของพวกเขาให้ด้วย ปิดการขายไว ได้เงินเร็วขึ้น!',
    accent: 'from-blue-900/30 to-indigo-900/20',
    accentBorder: 'border-blue-500/40',
    badgeColor: 'bg-blue-600/30 text-blue-300 border-blue-500/40',
    stepColor: 'bg-blue-600',
    highlight: '🎯 ขายไวขึ้น 3× ด้วยไลฟ์สด',
    steps: [
      { icon: '📦', title: 'ส่งมอบสินค้า', desc: 'ผู้ขายลงประกาศ "ฝากขาย-ช่วยดัน" ระบุสินค้า และนัดส่งของให้คนกลาง' },
      { icon: '🤝', title: 'ตกลงค่าคอมมิชชัน', desc: 'คนกลางรับของ ตรวจสภาพ แล้วเสนอเรต "ค่าคอม" (เช่น 10% ของยอดขาย) ผู้ขายกดยอมรับ ดีลเริ่มทันที' },
      { icon: '📱', title: 'คนกลางทำการตลาด', desc: 'ไลฟ์สด TikTok/Facebook ถ่ายรูปลงแคปชัน และดันโพสต์ในตลาด Khonklang' },
      { icon: '💸', title: 'ปิดการขาย รับเงิน', desc: 'ผู้ซื้อจ่ายเงินเข้า Escrow คนกลางแพ็กส่ง เมื่อผู้ซื้อได้ของ — ระบบโอนเงินให้ผู้ขาย (หักค่าคอมให้คนกลางอัตโนมัติ)' },
    ],
    ctaLabel: '📣 เริ่มฝากขาย-ช่วยดัน',
    ctaHref: '/dashboard/seller?mode=boost',
  },
  {
    id: 'cash',
    emoji: '⚡',
    badge: 'Fast Cash',
    name: 'ฝากขาย-เงินด่วน',
    tagline: 'ฝากของปุ๊บ รับเงินก้อนไปหมุนก่อนได้เลย!',
    teaser: 'ร้อนเงิน ไม่อยากรอของขายออก? คนกลางจะประเมินราคาและ "สำรองจ่ายเงินล่วงหน้า" ให้สูงสุด 50% ทันทีที่รับของ แล้วจัดการขายต่อให้แบบไร้กังวล!',
    accent: 'from-emerald-900/30 to-teal-900/20',
    accentBorder: 'border-emerald-500/40',
    badgeColor: 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40',
    stepColor: 'bg-emerald-600',
    highlight: '💰 รับเงินก้อนแรกใน 24 ชม.',
    steps: [
      { icon: '📋', title: 'ขอประเมินราคา', desc: 'ผู้ขายลงประกาศ "ฝากขาย-เงินด่วน" คนกลางที่สนใจส่งข้อเสนอ "วงเงินล่วงหน้า + ค่าบริการ"' },
      { icon: '💵', title: 'รับเงินก้อนแรก', desc: 'ผู้ขายส่งของให้คนกลาง ตรวจสภาพเสร็จ → ระบบหักเงินประกันของคนกลางโอนเข้าบัญชีผู้ขายทันที (เช่น สินค้า 10,000 บาท รับก่อน 5,000 บาท)' },
      { icon: '🏪', title: 'คนกลางจัดการขาย', desc: 'สินค้าอยู่ที่คนกลาง รับผิดชอบทั้งหมด ประกาศขายในแอปและช่องทางของตัวเอง' },
      { icon: '🔄', title: 'หักลบกลบหนี้', desc: 'เมื่อขายได้ ระบบคืนเงิน 5,000 บาทแรกให้คนกลาง (+ ค่าบริการที่ตกลง) ส่วนที่เหลือโอนให้ผู้ขาย' },
    ],
    ctaLabel: '⚡ เริ่มฝากขาย-เงินด่วน',
    ctaHref: '/dashboard/seller?mode=cash',
  },
  {
    id: 'spa',
    emoji: '✨',
    badge: 'Spa & Upgrade',
    name: 'ฝากขาย-อัปเกรด',
    tagline: 'ของโทรมโดนกดราคา? ให้คนกลางทำสปา ดันราคาสูงปรี๊ด!',
    teaser: 'เปลี่ยนสินค้ามือสองสภาพเยิน (แบรนด์เนม สนีกเกอร์ ไอที) ให้กลายเป็นของเกรดนางฟ้า ด้วยคนกลางเฉพาะทางที่รับจบทั้งทำความสะอาด ซ่อมแซม และวางขายให้!',
    accent: 'from-purple-900/30 to-pink-900/20',
    accentBorder: 'border-purple-500/40',
    badgeColor: 'bg-purple-600/30 text-purple-300 border-purple-500/40',
    stepColor: 'bg-purple-600',
    highlight: '📈 ดันมูลค่าสินค้าได้ 30-80%',
    steps: [
      { icon: '🔍', title: 'จับคู่คนกลางเฉพาะทาง', desc: 'ผู้ขายเลือกบริการ "ฝากขาย-อัปเกรด" ระบบจับคู่คนกลางที่มีสกิลช่าง/สปาตรงกับสินค้าของคุณ' },
      { icon: '💡', title: 'รับแผนงาน & ยืนยัน', desc: 'คนกลางประเมินของแล้วส่งแผน: "ค่าสปา 500 บาท จะดันราคาจาก 3,000 → 5,000 ได้" ผู้ขายยืนยัน — ยังไม่ต้องจ่ายเงินสด ระบบแปะบิลไว้ก่อน' },
      { icon: '🪄', title: 'แปลงโฉมสินค้า', desc: 'คนกลางทำสปา อัปโหลดรูป Before/After สวยงาม แล้วตั้งประกาศขายในราคาพรีเมียม' },
      { icon: '🏆', title: 'ปิดการขาย หักลบ', desc: 'เมื่อขายได้ ระบบจ่ายค่าสปา + ค่าคอมให้คนกลางก่อน ส่วนที่เหลือทั้งหมดโอนให้ผู้ขาย — ได้กำไรมากกว่าขายตามสภาพเดิมแน่นอน' },
    ],
    ctaLabel: '✨ เริ่มฝากขาย-อัปเกรด',
    ctaHref: '/dashboard/seller?mode=spa',
  },
];

export default function ServiceConsign() {
  const [selected, setSelected] = useState<string | null>(null);
  const active = SERVICES.find(s => s.id === selected) ?? null;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* Header */}
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-gray-400 hover:text-white transition">←</Link>
        <h1 className="text-xl font-bold">ฝากขายผ่านกลาง</h1>
        {active && (
          <button onClick={() => setSelected(null)}
            className="ml-auto text-xs text-gray-400 hover:text-white transition px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
          >← กลับ</button>
        )}
      </div>

      {/* ===== SERVICE DETAIL VIEW ===== */}
      {active ? (
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          {/* Hero */}
          <div className={`bg-gradient-to-br ${active.accent} border ${active.accentBorder} rounded-2xl p-6 space-y-3`}>
            <div className="flex items-start gap-4">
              <span className="text-5xl flex-shrink-0">{active.emoji}</span>
              <div>
                <span className={`text-xs px-2 py-1 rounded-full border font-medium ${active.badgeColor}`}>
                  {active.badge}
                </span>
                <h2 className="text-xl font-bold text-white mt-2">{active.name}</h2>
                <p className="text-sm text-gray-300 font-medium mt-1">{active.tagline}</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed border-t border-white/10 pt-3">
              {active.teaser}
            </p>
            <div className="inline-flex items-center gap-2 bg-black/30 rounded-xl px-4 py-2 text-sm font-semibold">
              {active.highlight}
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">ขั้นตอนการทำงาน</h3>
            {active.steps.map((step, i) => (
              <div key={i} className="flex gap-4 bg-white/5 border border-white/10 rounded-xl p-4 items-start">
                <div className={`w-8 h-8 rounded-full ${active.stepColor} flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                  {i + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{step.icon}</span>
                    <p className="font-semibold text-white text-sm">{step.title}</p>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Link href={active.ctaHref}
            className={`block w-full py-4 rounded-2xl bg-gradient-to-br ${active.accent} border ${active.accentBorder} text-white font-bold text-center text-base transition hover:brightness-110 active:scale-[0.98]`}
          >
            {active.ctaLabel}
          </Link>
        </div>

      ) : (
        /* ===== SERVICE SELECTOR ===== */
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
          {/* Hero */}
          <div className="text-center space-y-3">
            <div className="text-5xl">🏪</div>
            <h2 className="text-2xl font-bold">เลือกรูปแบบฝากขาย</h2>
            <p className="text-gray-400">คนกลาง Khonklang มีบริการฝากขาย 3 รูปแบบ เลือกตามความต้องการ</p>
          </div>

          {/* Cards */}
          <div className="space-y-4">
            {SERVICES.map(s => (
              <button key={s.id} onClick={() => setSelected(s.id)}
                className={`w-full text-left bg-gradient-to-br ${s.accent} border ${s.accentBorder} rounded-2xl p-5 hover:brightness-110 transition-all active:scale-[0.99] space-y-3`}
              >
                <div className="flex items-start gap-4">
                  <span className="text-4xl flex-shrink-0">{s.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${s.badgeColor}`}>
                        {s.badge}
                      </span>
                      <span className="text-xs text-gray-500">{s.highlight}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white">{s.name}</h3>
                    <p className="text-sm text-gray-300 mt-0.5">{s.tagline}</p>
                  </div>
                  <span className="text-gray-500 text-lg flex-shrink-0 mt-1">→</span>
                </div>
                {/* Mini steps */}
                <div className="flex gap-2 flex-wrap pl-14">
                  {s.steps.map((st, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-gray-400 bg-black/20 rounded-full px-2.5 py-1">
                      <span>{st.icon}</span>
                      <span>{st.title}</span>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Compare table */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-400">เปรียบเทียบบริการ</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-white/10">
                    <th className="pb-2 pr-4">บริการ</th>
                    <th className="pb-2 pr-4 text-center">รับเงินเร็ว</th>
                    <th className="pb-2 pr-4 text-center">คนกลางขายให้</th>
                    <th className="pb-2 text-center">เพิ่มมูลค่า</th>
                  </tr>
                </thead>
                <tbody className="space-y-1">
                  {[
                    ['📣 ช่วยดัน',   '—',  '✅', '—'],
                    ['⚡ เงินด่วน',   '✅', '✅', '—'],
                    ['✨ อัปเกรด',  '—',  '✅', '✅'],
                  ].map(([name, fast, sell, value]) => (
                    <tr key={name as string} className="border-b border-white/5 last:border-0">
                      <td className="py-2 pr-4 text-gray-300 font-medium">{name}</td>
                      <td className="py-2 pr-4 text-center">{fast}</td>
                      <td className="py-2 pr-4 text-center">{sell}</td>
                      <td className="py-2 text-center">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
