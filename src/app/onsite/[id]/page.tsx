'use client';

import { useEffect, useState, use, useCallback } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface OnsiteJob {
  $id: string;
  buyerId: string; buyerName: string;
  itemDescription: string; itemPrice: string;
  sellerLocation: string; sellerProvince: string; sellerContact: string;
  maxBudget: string; status: string;
  middlemanId: string; middlemanName: string;
  middlemanTier: string; middlemanDeposit: string;
  travelFee: string; serviceFee: string;
  estimatedArrival: string; conditions: string;
  quotedAt: string; acceptedAt: string; startedAt: string;
  completedAt: string; reportNotes: string; createdAt: string;
}

const STATUS_STEPS = [
  { key: 'open',        label: 'รอใบเสนอราคา',     icon: '📋' },
  { key: 'quoted',      label: 'มีใบเสนอราคา',       icon: '📩' },
  { key: 'accepted',    label: 'อนุมัติแล้ว',        icon: '✅' },
  { key: 'in_progress', label: 'คนกลางลงพื้นที่',   icon: '🚗' },
  { key: 'completed',   label: 'เสร็จสมบูรณ์',      icon: '🎉' },
];

const STATUS_COLOR: Record<string, string> = {
  open:        'bg-blue-500/20 text-blue-300 border-blue-500/40',
  quoted:      'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  accepted:    'bg-green-500/20 text-green-300 border-green-500/40',
  in_progress: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  completed:   'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  cancelled:   'bg-gray-500/20 text-gray-400 border-gray-500/40',
};

const TIER_DEPOSIT: Record<string, number> = {
  Bronze: 1000, Silver: 5000, Gold: 20000, Platinum: 50000,
};

export default function OnsiteJobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [job,      setJob]      = useState<OnsiteJob | null>(null);
  const [myId,     setMyId]     = useState('');
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState(false);
  const [error,    setError]    = useState('');

  // Quote form state (middleman)
  const [travelFee,        setTravelFee]        = useState('');
  const [serviceFee,       setServiceFee]       = useState('');
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [conditions,       setConditions]       = useState('');
  const [reportNotes,      setReportNotes]      = useState('');

  const load = useCallback(async () => {
    try {
      const user = await account.get();
      setMyId(user.$id);
      const jwt = (await account.createJWT()).jwt;
      const res = await fetch(`/api/onsite-jobs/${id}`, {
        headers: { 'x-session-jwt': jwt },
      });
      const data = await res.json();
      if (res.ok) setJob(data.job);
      else setError(data.error || 'โหลดไม่ได้');
    } catch { router.replace('/login'); }
    finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function doAction(action: string, extra: Record<string, string> = {}) {
    setActing(true); setError('');
    try {
      const jwt = (await account.createJWT()).jwt;
      const res = await fetch(`/api/onsite-jobs/${id}`, {
        method: 'PATCH',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (res.ok) setJob(data.job);
      else setError(data.error || 'เกิดข้อผิดพลาด');
    } finally { setActing(false); }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!job) return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex items-center justify-center">
      <p className="text-gray-400">{error || 'ไม่พบข้อมูล'}</p>
    </div>
  );

  const isBuyer      = myId === job.buyerId;
  const isMiddleman  = myId === job.middlemanId;
  const totalFee     = Number(job.travelFee || 0) + Number(job.serviceFee || 0);
  const totalPay     = Number(job.itemPrice || 0) + totalFee;
  const depositAmt   = Number(job.middlemanDeposit || TIER_DEPOSIT[job.middlemanTier] || 1000);
  const stepIdx      = STATUS_STEPS.findIndex(s => s.key === job.status);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* Header */}
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white">←</button>
        <h1 className="text-xl font-bold truncate">{job.itemDescription.slice(0, 40)}{job.itemDescription.length > 40 ? '...' : ''}</h1>
        <span className={`ml-auto text-xs px-2 py-1 rounded-full border whitespace-nowrap flex-shrink-0 ${STATUS_COLOR[job.status] || 'bg-gray-500/20 text-gray-300 border-gray-500/40'}`}>
          {STATUS_STEPS.find(s => s.key === job.status)?.label || job.status}
        </span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Progress bar */}
        {!['cancelled'].includes(job.status) && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              {STATUS_STEPS.map((s, i) => (
                <div key={s.key} className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base transition-all ${
                    i < stepIdx ? 'bg-green-500 text-white' :
                    i === stepIdx ? 'bg-orange-500 text-white ring-4 ring-orange-500/30' :
                    'bg-white/10 text-gray-500'
                  }`}>
                    {i < stepIdx ? '✓' : s.icon}
                  </div>
                  <span className={`text-[10px] mt-1 text-center leading-tight ${i === stepIdx ? 'text-orange-300' : 'text-gray-600'}`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">{error}</div>
        )}

        {/* Job details */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-200">รายละเอียดงาน</h2>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-gray-500 w-28 flex-shrink-0">สินค้า</span>
              <span className="text-white">{job.itemDescription}</span>
            </div>
            {job.itemPrice && Number(job.itemPrice) > 0 && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-28 flex-shrink-0">ราคาสินค้า</span>
                <span className="text-green-400 font-semibold">{Number(job.itemPrice).toLocaleString()} บาท</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-gray-500 w-28 flex-shrink-0">สถานที่</span>
              <span className="text-white">{job.sellerLocation}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-28 flex-shrink-0">จังหวัด</span>
              <span className="text-white">📍 {job.sellerProvince}</span>
            </div>
            {isBuyer && job.sellerContact && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-28 flex-shrink-0">เบอร์ผู้ขาย</span>
                <a href={`tel:${job.sellerContact}`} className="text-blue-400">📞 {job.sellerContact}</a>
              </div>
            )}
            {job.maxBudget && Number(job.maxBudget) > 0 && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-28 flex-shrink-0">งบบริการ</span>
                <span className="text-gray-300">สูงสุด {Number(job.maxBudget).toLocaleString()} บาท</span>
              </div>
            )}
          </div>
        </div>

        {/* ===== MIDDLEMAN: QUOTE FORM (status=open) ===== */}
        {!isBuyer && !isMiddleman && job.status === 'open' && (
          <div className="bg-white/5 border border-orange-500/30 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-orange-300">📝 ส่งใบเสนอราคา</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">ค่าเดินทาง (บาท) *</label>
                <input type="number" value={travelFee} onChange={e => setTravelFee(e.target.value)}
                  placeholder="เช่น 300"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">ค่าบริการตรวจ (บาท) *</label>
                <input type="number" value={serviceFee} onChange={e => setServiceFee(e.target.value)}
                  placeholder="เช่น 500"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition text-sm"
                />
              </div>
            </div>
            {travelFee && serviceFee && (
              <div className="bg-orange-500/10 rounded-xl px-4 py-2.5 text-sm text-orange-200">
                รวมค่าบริการ: <strong>{(Number(travelFee) + Number(serviceFee)).toLocaleString()} บาท</strong>
              </div>
            )}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">วัน-เวลาที่จะไปถึง *</label>
              <input type="datetime-local" value={estimatedArrival} onChange={e => setEstimatedArrival(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500 transition text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">เงื่อนไขเพิ่มเติม</label>
              <textarea value={conditions} onChange={e => setConditions(e.target.value)}
                rows={2} placeholder="เช่น สามารถถ่ายวิดีโอเต็มคัน ตรวจได้ 30 นาที..."
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition text-sm resize-none"
              />
            </div>
            <button
              onClick={() => doAction('submit_quote', { travelFee, serviceFee, estimatedArrival, conditions })}
              disabled={acting || !travelFee || !serviceFee || !estimatedArrival}
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-semibold transition"
            >
              {acting ? 'กำลังส่ง...' : '📩 ส่งใบเสนอราคา'}
            </button>
          </div>
        )}

        {/* ===== BUYER: APPROVAL VIEW (status=quoted) ===== */}
        {isBuyer && job.status === 'quoted' && (
          <div className="space-y-4">
            {/* Safety deposit alert */}
            <div className="bg-yellow-500/10 border-2 border-yellow-500/40 rounded-2xl p-5 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-2xl flex-shrink-0">🛡️</span>
                <div>
                  <p className="font-semibold text-yellow-300">ปลอดภัย 100% — ระบบเงินประกัน</p>
                  <p className="text-sm text-gray-300 mt-1 leading-relaxed">
                    คนกลาง <strong className="text-white">{job.middlemanName}</strong> มีเงินประกันกับระบบ
                    {' '}<strong className="text-yellow-300 text-base">{depositAmt.toLocaleString()} บาท</strong>
                  </p>
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                    หากพบการทุจริตหรือฮั้วกับผู้ขาย แพลตฟอร์มจะ
                    <strong className="text-red-300"> ยึดเงินประกันชดเชยคุณทันที</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Quote summary */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <h2 className="font-semibold text-gray-200">ใบเสนอราคา</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">คนกลาง</span>
                  <span className="text-white font-medium">{job.middlemanName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">ค่าเดินทาง</span>
                  <span className="text-white">{Number(job.travelFee).toLocaleString()} บาท</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">ค่าบริการตรวจ</span>
                  <span className="text-white">{Number(job.serviceFee).toLocaleString()} บาท</span>
                </div>
                {Number(job.itemPrice) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">ราคาสินค้า</span>
                    <span className="text-white">{Number(job.itemPrice).toLocaleString()} บาท</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 flex justify-between font-semibold">
                  <span className="text-gray-300">รวมทั้งหมด</span>
                  <span className="text-green-400 text-base">{totalPay.toLocaleString()} บาท</span>
                </div>
              </div>
              {job.estimatedArrival && (
                <div className="text-sm text-gray-400">
                  🕐 คาดว่าจะถึง: {new Date(job.estimatedArrival).toLocaleString('th-TH')}
                </div>
              )}
              {job.conditions && (
                <div className="text-sm text-gray-400 bg-white/5 rounded-lg p-3">
                  📝 {job.conditions}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => doAction('reject_quote')} disabled={acting}
                className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-medium transition"
              >
                ❌ ปฏิเสธ
              </button>
              <button onClick={() => doAction('accept_quote')} disabled={acting}
                className="flex-2 flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold transition"
              >
                {acting ? 'กำลังยืนยัน...' : '✅ ยอมรับและว่าจ้าง'}
              </button>
            </div>
          </div>
        )}

        {/* ===== MIDDLEMAN: START WORK (status=accepted) ===== */}
        {isMiddleman && job.status === 'accepted' && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 space-y-3">
            <p className="font-semibold text-green-300">✅ ผู้ว่าจ้างอนุมัติแล้ว!</p>
            <p className="text-sm text-gray-300">
              ติดต่อผู้ขายที่เบอร์ <strong className="text-white">{job.sellerContact || '—'}</strong> และเดินทางไปยัง{' '}
              <strong className="text-white">{job.sellerLocation}</strong>
            </p>
            <button onClick={() => doAction('start_work')} disabled={acting}
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold transition"
            >
              {acting ? '...' : '🚗 เริ่มออกเดินทาง'}
            </button>
          </div>
        )}

        {/* ===== MIDDLEMAN: COMPLETE (status=in_progress) ===== */}
        {isMiddleman && job.status === 'in_progress' && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5 space-y-4">
            <p className="font-semibold text-orange-300">🚗 กำลังดำเนินการ</p>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">บันทึกสรุปผลการตรวจ</label>
              <textarea value={reportNotes} onChange={e => setReportNotes(e.target.value)}
                rows={3} placeholder="เช่น ตรวจแล้วสภาพดี เครื่องปกติ ตัวถังไม่มีรอยชน..."
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition resize-none text-sm"
              />
            </div>
            <button onClick={() => doAction('complete', { reportNotes })} disabled={acting || !reportNotes}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold transition"
            >
              {acting ? '...' : '🎉 รายงานเสร็จสิ้น'}
            </button>
          </div>
        )}

        {/* ===== COMPLETED ===== */}
        {job.status === 'completed' && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 space-y-2">
            <p className="font-semibold text-emerald-300 text-lg">🎉 งานเสร็จสมบูรณ์</p>
            {job.reportNotes && (
              <div className="bg-white/5 rounded-xl p-4 text-sm text-gray-300">
                <p className="text-xs text-gray-500 mb-1">สรุปผลจากคนกลาง:</p>
                {job.reportNotes}
              </div>
            )}
            <p className="text-xs text-gray-500">
              เสร็จเมื่อ {job.completedAt ? new Date(job.completedAt).toLocaleString('th-TH') : '—'}
            </p>
          </div>
        )}

        {/* ===== CANCEL button (buyer, early stages) ===== */}
        {isBuyer && ['open', 'quoted'].includes(job.status) && (
          <button onClick={() => { if (confirm('ยืนยันยกเลิกคำขอนี้?')) doAction('cancel'); }}
            disabled={acting}
            className="w-full py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 text-sm transition"
          >
            ยกเลิกคำขอ
          </button>
        )}

        {/* Cancelled state */}
        {job.status === 'cancelled' && (
          <div className="bg-gray-700/30 border border-gray-600/30 rounded-2xl p-5 text-center">
            <p className="text-gray-400">❌ คำขอนี้ถูกยกเลิกแล้ว</p>
            <Link href="/onsite/create" className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300 transition">
              สร้างคำขอใหม่ →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
