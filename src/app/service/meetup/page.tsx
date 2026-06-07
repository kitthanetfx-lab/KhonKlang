'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type ServiceOption = 'travel' | 'safezone' | null;
type FeeWho = 'split' | 'buyer' | 'seller';

const PLATFORM_FEE = 50;
const MM_RATE_PER_KM = 2; // บาท/กม. (placeholder)

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg className={`w-4 h-4 ${filled ? 'text-yellow-400' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

export default function ServiceMeetup() {
  const router = useRouter();
  const [selected, setSelected] = useState<ServiceOption>(null);

  // Option 1: Travel Guarantee
  const [tDeposit, setTDeposit]   = useState(500);
  const [tFeeWho, setTFeeWho]     = useState<FeeWho>('split');

  // Option 2: Safe Zone
  const [sDeposit, setSDeposit]   = useState(500);
  const [sFeeWho, setsFeeWho]     = useState<FeeWho>('split');
  const [mmFee, setMmFee]         = useState(300); // placeholder

  // Midpoint idea demo state
  const [showIdeas, setShowIdeas] = useState(false);

  const tBuyerFee  = tFeeWho === 'split' ? PLATFORM_FEE / 2 : tFeeWho === 'buyer'  ? PLATFORM_FEE : 0;
  const tSellerFee = tFeeWho === 'split' ? PLATFORM_FEE / 2 : tFeeWho === 'seller' ? PLATFORM_FEE : 0;

  const totalService = PLATFORM_FEE + mmFee;
  const sBuyerFee  = sFeeWho === 'split' ? totalService / 2 : sFeeWho === 'buyer'  ? totalService : 0;
  const sSellerFee = sFeeWho === 'split' ? totalService / 2 : sFeeWho === 'seller' ? totalService : 0;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">

      {/* ── Header ── */}
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3 sticky top-0 z-20">
        <Link href="/" className="text-gray-400 hover:text-white transition">←</Link>
        <h1 className="text-lg font-bold">นัดรับผ่านกลาง</h1>
        <button onClick={() => setShowIdeas(v => !v)}
          className="ml-auto px-3 py-1.5 rounded-lg bg-purple-600/40 hover:bg-purple-600/60 border border-purple-500/30 text-purple-300 text-xs font-medium transition"
        >💡 ไอเดียล้ำ</button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-16 space-y-10">

        {/* ══ SECTION 1: Hero ══ */}
        <section className="pt-10 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-3xl shadow-lg shadow-blue-500/30 mx-auto">
            📍
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight">
              นัดรับผ่านกลาง<br/>
              <span className="text-blue-400">ยกระดับความปลอดภัย</span>ให้ทุกการนัดหมาย
            </h2>
            <p className="text-gray-400 text-sm">เพราะการซื้อขายที่ดี ต้องมีระบบที่ไว้ใจได้</p>
          </div>

          {/* Pain Points */}
          <div className="grid gap-3 text-left">
            {[
              { icon: '🚨', title: 'นัดแล้วเท!', desc: 'เสียเวลา เสียค่าเดินทางฟรี โดยไม่มีการชดเชยใดๆ' },
              { icon: '📦', title: 'สินค้าไม่ตรงปก', desc: 'ไม่เหมือนในรูป ไม่มีใครช่วยตรวจสอบก่อนจ่ายเงิน' },
              { icon: '⚠️', title: 'สถานที่เปลี่ยว ไม่ปลอดภัย', desc: 'เสี่ยงถูกมิจฉาชีพ ไม่มีพยานหรือหลักฐาน' },
            ].map(p => (
              <div key={p.icon} className="flex gap-3 items-start bg-red-900/15 border border-red-500/20 rounded-xl px-4 py-3">
                <span className="text-xl flex-shrink-0 mt-0.5">{p.icon}</span>
                <div>
                  <p className="font-semibold text-red-300 text-sm">{p.title}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Solution Banner */}
          <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 rounded-2xl px-5 py-4 text-center">
            <p className="text-blue-200 font-semibold text-sm leading-relaxed">
              ✅ เราจึงสร้างระบบนัดรับที่ปลอดภัยที่สุด<br/>
              <span className="text-white font-bold">เพื่อปกป้องทั้งผู้ซื้อและผู้ขายในทุกการซื้อขาย</span>
            </p>
          </div>
        </section>

        {/* ══ SECTION 2: Service Type Selection ══ */}
        <section className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-bold">เลือกประเภทบริการนัดรับ</h3>
            <p className="text-gray-500 text-xs mt-1">คลิกเลือกรูปแบบที่เหมาะกับคุณ</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">

            {/* ── Card 1: Travel Guarantee ── */}
            <div
              onClick={() => setSelected(s => s === 'travel' ? null : 'travel')}
              className={`relative cursor-pointer rounded-2xl border-2 p-5 transition-all duration-200 ${
                selected === 'travel'
                  ? 'border-blue-500 bg-blue-900/20 shadow-lg shadow-blue-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/8'
              }`}
            >
              {selected === 'travel' && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">✓</span>
              )}
              <div className="space-y-3">
                <div className="text-3xl">🤝</div>
                <div>
                  <p className="font-bold text-base">ประกันการเดินทาง</p>
                  <p className="text-xs text-gray-400 mt-0.5">ไม่ต้องใช้คนกลาง — ล็อคเงินมัดจำค่าเดินทาง</p>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25">ค่าธรรมเนียมต่ำ</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">ไม่ต้องใช้คนกลาง</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-yellow-400">
                  {[1,2,3,4].map(i => <StarIcon key={i} filled={i<=3}/>)}
                  <span className="text-gray-500 ml-1">ความปลอดภัย 3/5</span>
                </div>
              </div>
            </div>

            {/* ── Card 2: Safe Zone ── */}
            <div
              onClick={() => setSelected(s => s === 'safezone' ? null : 'safezone')}
              className={`relative cursor-pointer rounded-2xl border-2 p-5 transition-all duration-200 ${
                selected === 'safezone'
                  ? 'border-purple-500 bg-purple-900/20 shadow-lg shadow-purple-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/8'
              }`}
            >
              {selected === 'safezone' && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold">✓</span>
              )}
              <div className="space-y-3">
                <div className="text-3xl">🛡️</div>
                <div>
                  <p className="font-bold text-base">Safe Zone + คนกลาง</p>
                  <p className="text-xs text-gray-400 mt-0.5">นัดรับ ณ สถานที่ปลอดภัย พร้อมคนกลางตรวจสินค้า</p>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25">ปลอดภัยสูงสุด</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">ตรวจสินค้าเชิงลึก</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-yellow-400">
                  {[1,2,3,4,5].map(i => <StarIcon key={i} filled={true}/>)}
                  <span className="text-gray-500 ml-1">ความปลอดภัย 5/5</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Option 1 Form ── */}
          {selected === 'travel' && (
            <div className="bg-[#111827] border border-blue-500/30 rounded-2xl p-5 space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤝</span>
                <h4 className="font-bold text-blue-300">ประกันการเดินทาง — รายละเอียด</h4>
              </div>

              {/* Condition box */}
              <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl px-4 py-3 text-xs text-blue-200 leading-relaxed">
                เมื่อนัดพบและยืนยันสำเร็จ ระบบจะ<strong>คืนเงินประกัน</strong>ให้ทั้ง 2 ฝ่าย
                แต่หากมีฝ่ายใด<strong>ผิดนัด/ไม่มาตามนัด</strong> ระบบจะยึดเงินประกันของฝ่ายนั้น
                ไปชดเชยให้อีกฝ่ายทันที
              </div>

              {/* Deposit input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">💰 เงินประกันการเดินทาง (ต่อฝ่าย)</label>
                <div className="flex gap-2 items-center">
                  <input type="number" min={100} step={100} value={tDeposit}
                    onChange={e => setTDeposit(Number(e.target.value))}
                    className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-gray-400 text-sm flex-shrink-0">บาท</span>
                </div>
                <div className="flex gap-2">
                  {[200,500,1000,2000].map(v => (
                    <button key={v} onClick={() => setTDeposit(v)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${tDeposit===v ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    >{v.toLocaleString()}</button>
                  ))}
                </div>
              </div>

              {/* Fee breakdown */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-300">💳 ค่าธรรมเนียมแพลตฟอร์ม</p>
                <div className="bg-white/5 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">ค่าธรรมเนียม</span><span className="text-white font-medium">{PLATFORM_FEE} บาท</span></div>
                </div>
              </div>

              {/* Who pays */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-300">👤 ใครจ่ายค่าธรรมเนียม?</p>
                <div className="grid grid-cols-3 gap-2">
                  {([['split','แบ่ง 50/50'],['buyer','ผู้ซื้อจ่าย'],['seller','ผู้ขายจ่าย']] as [FeeWho,string][]).map(([val,label]) => (
                    <button key={val} onClick={() => setTFeeWho(val)}
                      className={`py-2 rounded-xl text-xs font-medium transition ${tFeeWho===val ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    >{label}</button>
                  ))}
                </div>
              </div>

              {/* Summary receipt */}
              <div className="bg-gradient-to-br from-blue-900/30 to-[#111827] border border-blue-500/25 rounded-xl p-4 space-y-2 text-sm">
                <p className="text-xs text-blue-400 font-semibold uppercase tracking-wide mb-3">สรุปค่าใช้จ่าย</p>
                <div className="flex justify-between"><span className="text-gray-400">เงินประกัน (ผู้ซื้อ)</span><span className="text-white">{tDeposit.toLocaleString()} บาท <span className="text-xs text-green-400">(คืน)</span></span></div>
                <div className="flex justify-between"><span className="text-gray-400">เงินประกัน (ผู้ขาย)</span><span className="text-white">{tDeposit.toLocaleString()} บาท <span className="text-xs text-green-400">(คืน)</span></span></div>
                <div className="border-t border-white/10 pt-2 mt-1 space-y-1">
                  {tBuyerFee > 0 && <div className="flex justify-between"><span className="text-gray-400">ค่าธรรมเนียม (ผู้ซื้อ)</span><span className="text-orange-300">{tBuyerFee} บาท</span></div>}
                  {tSellerFee > 0 && <div className="flex justify-between"><span className="text-gray-400">ค่าธรรมเนียม (ผู้ขาย)</span><span className="text-orange-300">{tSellerFee} บาท</span></div>}
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
                  <span className="text-gray-300">รวมจ่ายจริง (ค่าธรรมเนียม)</span>
                  <span className="text-white">{PLATFORM_FEE} บาท</span>
                </div>
              </div>

              <button onClick={() => router.push('/deal/create')}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base transition shadow-lg shadow-blue-600/25"
              >🤝 สร้างดีลนัดรับแบบประกันการเดินทาง</button>
            </div>
          )}

          {/* ── Option 2 Form ── */}
          {selected === 'safezone' && (
            <div className="bg-[#111827] border border-purple-500/30 rounded-2xl p-5 space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛡️</span>
                <h4 className="font-bold text-purple-300">Safe Zone + คนกลาง — รายละเอียด</h4>
              </div>

              {/* Condition box */}
              <div className="bg-purple-900/20 border border-purple-500/20 rounded-xl px-4 py-3 text-xs text-purple-200 leading-relaxed">
                <strong>ปลอดภัยขั้นสุด!</strong> นัดพบ ณ Safe Zone ของคนกลาง พร้อมบริการตรวจเช็กสภาพสินค้าเชิงลึก
                <br/><span className="text-purple-300">หมายเหตุ: ทั้งผู้ซื้อและผู้ขายต้องวางเงินประกันการเดินทาง เพื่อยืนยันคิวกับคนกลาง</span>
              </div>

              {/* Travel Deposit */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">💰 เงินประกันการเดินทาง (ต่อฝ่าย)</label>
                <p className="text-xs text-gray-500">วางไว้เพื่อยืนยันการนัด คืนเมื่อการซื้อขายเสร็จสิ้น หรือยึดให้ฝั่งที่มาตามนัดหากมีคนเท</p>
                <div className="flex gap-2 items-center">
                  <input type="number" min={100} step={100} value={sDeposit}
                    onChange={e => setSDeposit(Number(e.target.value))}
                    className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-gray-400 text-sm flex-shrink-0">บาท</span>
                </div>
                <div className="flex gap-2">
                  {[200,500,1000,2000].map(v => (
                    <button key={v} onClick={() => setSDeposit(v)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${sDeposit===v ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    >{v.toLocaleString()}</button>
                  ))}
                </div>
              </div>

              {/* Middleman fee slider */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">🏢 ค่าบริการคนกลาง (Safe Zone + ตรวจสินค้า)</label>
                <p className="text-xs text-gray-500">รวมค่าใช้สถานที่ Safe Zone และค่าตรวจสอบสินค้าเชิงเทคนิค</p>
                <div className="flex gap-2 items-center">
                  <input type="range" min={200} max={2000} step={100} value={mmFee}
                    onChange={e => setMmFee(Number(e.target.value))}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-white font-semibold w-20 text-right text-sm">{mmFee.toLocaleString()} ฿</span>
                </div>
                <p className="text-xs text-yellow-400/70">⚠️ เรตค่าบริการ Safe Zone สูงกว่าการนัดรับปกติ เนื่องจากรวมค่าตรวจสินค้าและพื้นที่มาตรฐาน</p>
              </div>

              {/* Who pays service fee */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-300">👤 ใครจ่ายค่าบริการ?</p>
                <div className="grid grid-cols-3 gap-2">
                  {([['split','แบ่ง 50/50'],['buyer','ผู้ซื้อจ่าย'],['seller','ผู้ขายจ่าย']] as [FeeWho,string][]).map(([val,label]) => (
                    <button key={val} onClick={() => setsFeeWho(val)}
                      className={`py-2 rounded-xl text-xs font-medium transition ${sFeeWho===val ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    >{label}</button>
                  ))}
                </div>
              </div>

              {/* Transparent fee breakdown */}
              <div className="space-y-2">
                <p className="text-xs text-purple-400 font-semibold uppercase tracking-wide">🧾 ใบสรุปค่าใช้จ่าย (โปร่งใส)</p>

                {/* Deposit row */}
                <div className="bg-green-900/15 border border-green-500/20 rounded-xl p-4 space-y-1.5 text-sm">
                  <p className="text-xs text-green-400 font-semibold mb-2">ส่วนที่ 1 — เงินประกันการเดินทาง <span className="font-normal text-green-400/70">(คืนเมื่อเสร็จสิ้น)</span></p>
                  <div className="flex justify-between"><span className="text-gray-400">ผู้ซื้อวาง</span><span className="text-green-300">{sDeposit.toLocaleString()} บาท</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">ผู้ขายวาง</span><span className="text-green-300">{sDeposit.toLocaleString()} บาท</span></div>
                </div>

                {/* Service fee row */}
                <div className="bg-orange-900/15 border border-orange-500/20 rounded-xl p-4 space-y-1.5 text-sm">
                  <p className="text-xs text-orange-400 font-semibold mb-2">ส่วนที่ 2 — ค่าบริการ <span className="font-normal text-orange-400/70">(ไม่คืน)</span></p>
                  <div className="flex justify-between"><span className="text-gray-400">ค่าธรรมเนียมแพลตฟอร์ม</span><span className="text-white">{PLATFORM_FEE} บาท</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">ค่าบริการคนกลาง (Safe Zone)</span><span className="text-white">{mmFee.toLocaleString()} บาท</span></div>
                  <div className="border-t border-white/10 pt-2 flex justify-between font-semibold">
                    <span className="text-gray-300">รวมค่าบริการ</span><span className="text-orange-300">{totalService.toLocaleString()} บาท</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 space-y-1 text-xs">
                    {sBuyerFee > 0 && <div className="flex justify-between"><span className="text-gray-500">ผู้ซื้อจ่าย</span><span className="text-orange-300">{sBuyerFee} บาท</span></div>}
                    {sSellerFee > 0 && <div className="flex justify-between"><span className="text-gray-500">ผู้ขายจ่าย</span><span className="text-orange-300">{sSellerFee} บาท</span></div>}
                  </div>
                </div>

                {/* Grand total */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-bold flex justify-between">
                  <span className="text-gray-200">ยอดรวมที่ผู้ซื้อจ่าย (รวมมัดจำ)</span>
                  <span className="text-white">{(sDeposit + sBuyerFee).toLocaleString()} บาท</span>
                </div>
              </div>

              {/* Find middleman CTA */}
              <button onClick={() => router.push('/marketplace?type=safezone')}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-base transition shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
              >
                <span>📍</span>
                <span>ค้นหาคนกลาง Safe Zone ในพื้นที่ใกล้คุณ</span>
                <span>→</span>
              </button>
              <button onClick={() => router.push('/deal/create')}
                className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-gray-300 font-medium text-sm transition"
              >หรือสร้างดีล Safe Zone ด้วยตัวเอง</button>
            </div>
          )}

          {/* No selection CTA */}
          {!selected && (
            <div className="text-center py-4">
              <p className="text-gray-600 text-sm">👆 เลือกประเภทบริการด้านบนเพื่อดูรายละเอียด</p>
            </div>
          )}
        </section>

        {/* ══ SECTION 3: Ideas Panel ══ */}
        {showIdeas && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌟</span>
              <h3 className="font-bold text-purple-300">ไอเดียล้ำ — ฟีเจอร์อนาคต</h3>
            </div>
            <div className="space-y-3">

              {/* Idea 1 */}
              <div className="bg-gradient-to-br from-blue-900/20 to-[#111827] border border-blue-500/20 rounded-2xl p-5 space-y-2">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🗺️</span>
                  <div>
                    <p className="font-bold text-blue-300 text-sm">1. Mid-Point Matcher — หาจุดกึ่งกลางอัตโนมัติ</p>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      ทั้งสองคนปักหมุดตำแหน่งที่ตัวเองอยู่ → ระบบหา Safe Zone ของคนกลาง
                      ที่ตั้งอยู่<strong className="text-blue-300">ตรงกึ่งกลาง</strong>ระหว่าง 2 คน โดยคำนวณจากระยะทางที่เร็วที่สุดของทั้งสองฝั่ง
                    </p>
                    <div className="mt-2 flex gap-1 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">Google Maps API</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">Geolocation</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">แฟร์ทั้งสองฝ่าย</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Idea 2 */}
              <div className="bg-gradient-to-br from-green-900/20 to-[#111827] border border-green-500/20 rounded-2xl p-5 space-y-2">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📐</span>
                  <div>
                    <p className="font-bold text-green-300 text-sm">2. Dynamic Travel Deposit — คำนวณเงินประกันตามระยะทางจริง</p>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      ระบบดึง Google Maps API คำนวณระยะทางจริง (วิธีเดินทางที่เร็วที่สุด)
                      แล้วแปลงเป็น<strong className="text-green-300">เรตเงินประกันขั้นต่ำอัตโนมัติ</strong>
                    </p>
                    <div className="mt-3 bg-black/20 rounded-xl p-3 space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-gray-500">ในเมือง (&lt;20 กม.)</span><span className="text-green-400">ประกันขั้นต่ำ 200 บาท</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">ต่างอำเภอ (20–100 กม.)</span><span className="text-yellow-400">ประกันขั้นต่ำ 500 บาท</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">ข้ามจังหวัด (&gt;100 กม.)</span><span className="text-orange-400">ประกันขั้นต่ำ 1,000 บาท</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Idea 3 (bonus) */}
              <div className="bg-gradient-to-br from-yellow-900/20 to-[#111827] border border-yellow-500/20 rounded-2xl p-5 space-y-2">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⭐</span>
                  <div>
                    <p className="font-bold text-yellow-300 text-sm">3. Safe Zone Rating System — จัดอันดับสถานที่นัดพบ</p>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      ผู้ใช้ review คะแนนสถานที่ Safe Zone ของคนกลางแต่ละคน (ความปลอดภัย, ความสะดวก, ที่จอดรถ)
                      ระบบ rank Safe Zone ตามคะแนน ช่วยผู้ซื้อ-ขายตัดสินใจเลือกสถานที่ได้ดีขึ้น
                    </p>
                    <div className="mt-2 flex gap-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">UX Improvement</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">Community Trust</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ══ Quick links ══ */}
        <section className="grid sm:grid-cols-2 gap-3 pt-2">
          <Link href="/deal/create"
            className="py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-center transition"
          >สร้างดีลใหม่</Link>
          <Link href="/marketplace"
            className="py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-center transition"
          >ดูสินค้าในตลาด</Link>
        </section>
      </div>
    </div>
  );
}
