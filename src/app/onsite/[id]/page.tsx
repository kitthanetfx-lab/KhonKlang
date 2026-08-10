'use client';

import { useEffect, useState, use, useCallback, type ReactNode } from 'react';
import { supabase, authHeaders } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AsyncButton } from '@/components/AsyncButton';
import { MobileShell, DesktopShell } from '@/components/mobile/shells';
import { OnsiteDetailApp } from '@/components/mobile/OnsiteDetailApp';

interface OnsiteJob {
  id: string;
  buyer_id: string; buyer_name: string;
  item_description: string; item_price: string;
  seller_location: string; seller_province: string; seller_contact: string;
  max_budget: string; status: string;
  middleman_id: string; middleman_name: string;
  middleman_tier: string; middleman_deposit: string;
  travel_fee: string; service_fee: string;
  estimated_arrival: string; conditions: string;
  quoted_at: string; accepted_at: string; started_at: string;
  completed_at: string; report_notes: string; created_at: string;
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      setMyId(user.id);
      const headers = await authHeaders();
      const res = await fetch(`/api/onsite-jobs/${id}`, { headers });
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
      const headers = await authHeaders();
      const res = await fetch(`/api/onsite-jobs/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
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

  const isBuyer      = myId === job.buyer_id;
  const isMiddleman  = myId === job.middleman_id;
  const totalFee     = Number(job.travel_fee || 0) + Number(job.service_fee || 0);
  const totalPay     = Number(job.item_price || 0) + totalFee;
  const depositAmt   = Number(job.middleman_deposit || TIER_DEPOSIT[job.middleman_tier] || 1000);
  const stepIdx      = STATUS_STEPS.findIndex(s => s.key === job.status);
  const titleText    = `${job.item_description.slice(0, 40)}${job.item_description.length > 40 ? '...' : ''}`;
  const statusLabel  = STATUS_STEPS.find(s => s.key === job.status)?.label || job.status;

  const panelCls = (mobile: boolean, extra = '') =>
    mobile ? `onsite-app-panel${extra ? ` ${extra}` : ''}` : `bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3${extra ? ` ${extra}` : ''}`;
  const inputCls = (mobile: boolean) =>
    mobile ? undefined : 'w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition text-sm';

  function renderPanels(mobile: boolean, j: OnsiteJob): ReactNode {
    return (
      <>
        {error && (
          mobile
            ? <p className="app-field-error">{error}</p>
            : <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">{error}</div>
        )}

        <div className={panelCls(mobile)}>
          <h2 className={mobile ? undefined : 'font-semibold text-gray-200'}><strong>รายละเอียดงาน</strong></h2>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className={mobile ? 'text-[#64748b] w-28 flex-shrink-0' : 'text-gray-500 w-28 flex-shrink-0'}>สินค้า</span>
              <span className={mobile ? undefined : 'text-white'}>{j.item_description}</span>
            </div>
            {j.item_price && Number(j.item_price) > 0 && (
              <div className="flex gap-2">
                <span className={mobile ? 'text-[#64748b] w-28 flex-shrink-0' : 'text-gray-500 w-28 flex-shrink-0'}>ราคาสินค้า</span>
                <span className={mobile ? 'font-semibold text-green-600' : 'text-green-400 font-semibold'}>{Number(j.item_price).toLocaleString()} บาท</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className={mobile ? 'text-[#64748b] w-28 flex-shrink-0' : 'text-gray-500 w-28 flex-shrink-0'}>สถานที่</span>
              <span className={mobile ? undefined : 'text-white'}>{j.seller_location}</span>
            </div>
            <div className="flex gap-2">
              <span className={mobile ? 'text-[#64748b] w-28 flex-shrink-0' : 'text-gray-500 w-28 flex-shrink-0'}>จังหวัด</span>
              <span className={mobile ? undefined : 'text-white'}>📍 {j.seller_province}</span>
            </div>
            {isBuyer && j.seller_contact && (
              <div className="flex gap-2">
                <span className={mobile ? 'text-[#64748b] w-28 flex-shrink-0' : 'text-gray-500 w-28 flex-shrink-0'}>เบอร์ผู้ขาย</span>
                <a href={`tel:${j.seller_contact}`} className="text-blue-500">📞 {j.seller_contact}</a>
              </div>
            )}
            {j.max_budget && Number(j.max_budget) > 0 && (
              <div className="flex gap-2">
                <span className={mobile ? 'text-[#64748b] w-28 flex-shrink-0' : 'text-gray-500 w-28 flex-shrink-0'}>งบบริการ</span>
                <span className={mobile ? undefined : 'text-gray-300'}>สูงสุด {Number(j.max_budget).toLocaleString()} บาท</span>
              </div>
            )}
          </div>
        </div>

        {!isBuyer && !isMiddleman && j.status === 'open' && (
          <div className={panelCls(mobile, mobile ? '' : 'border-orange-500/30')}>
            <h2 className={mobile ? undefined : 'font-semibold text-orange-300'}>📝 ส่งใบเสนอราคา</h2>
            <div className={mobile ? 'onsite-app-form space-y-3' : 'space-y-4'}>
              <div className="grid grid-cols-2 gap-3">
                <label className={mobile ? 'app-field' : undefined}>
                  {mobile && <span>ค่าเดินทาง (บาท) <em>*</em></span>}
                  {!mobile && <span className="text-xs text-gray-400 mb-1 block">ค่าเดินทาง (บาท) *</span>}
                  <input type="number" value={travelFee} onChange={e => setTravelFee(e.target.value)} placeholder="เช่น 300" className={inputCls(mobile)} />
                </label>
                <label className={mobile ? 'app-field' : undefined}>
                  {mobile && <span>ค่าบริการตรวจ (บาท) <em>*</em></span>}
                  {!mobile && <span className="text-xs text-gray-400 mb-1 block">ค่าบริการตรวจ (บาท) *</span>}
                  <input type="number" value={serviceFee} onChange={e => setServiceFee(e.target.value)} placeholder="เช่น 500" className={inputCls(mobile)} />
                </label>
              </div>
              {travelFee && serviceFee && (
                <div className={mobile ? 'text-sm text-orange-700 bg-orange-50 rounded-xl px-4 py-2.5' : 'bg-orange-500/10 rounded-xl px-4 py-2.5 text-sm text-orange-200'}>
                  รวมค่าบริการ: <strong>{(Number(travelFee) + Number(serviceFee)).toLocaleString()} บาท</strong>
                </div>
              )}
              <label className={mobile ? 'app-field' : undefined}>
                {mobile && <span>วัน-เวลาที่จะไปถึง <em>*</em></span>}
                {!mobile && <span className="text-xs text-gray-400 mb-1 block">วัน-เวลาที่จะไปถึง *</span>}
                <input type="datetime-local" value={estimatedArrival} onChange={e => setEstimatedArrival(e.target.value)} className={inputCls(mobile)} />
              </label>
              <label className={mobile ? 'app-field' : undefined}>
                {mobile && <span>เงื่อนไขเพิ่มเติม</span>}
                {!mobile && <span className="text-xs text-gray-400 mb-1 block">เงื่อนไขเพิ่มเติม</span>}
                <textarea value={conditions} onChange={e => setConditions(e.target.value)} rows={2} placeholder="เช่น สามารถถ่ายวิดีโอเต็มคัน ตรวจได้ 30 นาที..." className={mobile ? undefined : `${inputCls(mobile)} resize-none`} />
              </label>
              <AsyncButton
                onClick={() => doAction('submit_quote', { travelFee, serviceFee, estimatedArrival, conditions })}
                disabled={!travelFee || !serviceFee || !estimatedArrival}
                loadingChildren="กำลังส่ง..."
                className={mobile ? 'btn btn-primary btn-block' : 'w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-semibold transition'}
              >
                📩 ส่งใบเสนอราคา
              </AsyncButton>
            </div>
          </div>
        )}

        {isBuyer && j.status === 'quoted' && (
          <div className={mobile ? 'space-y-3' : 'space-y-4'}>
            <div className={panelCls(mobile, mobile ? '' : 'border-2 border-yellow-500/40 bg-yellow-500/10')}>
              <div className="flex items-start gap-2">
                <span className="text-2xl flex-shrink-0">🛡️</span>
                <div>
                  <p className={mobile ? 'font-semibold' : 'font-semibold text-yellow-300'}>ปลอดภัย 100% — ระบบเงินประกัน</p>
                  <p className={`text-sm mt-1 leading-relaxed ${mobile ? '' : 'text-gray-300'}`}>
                    คนกลาง <strong>{j.middleman_name}</strong> มีเงินประกันกับระบบ{' '}
                    <strong className={mobile ? 'text-amber-700' : 'text-yellow-300 text-base'}>{depositAmt.toLocaleString()} บาท</strong>
                  </p>
                  <p className={`text-sm mt-1 leading-relaxed ${mobile ? 'text-[#64748b]' : 'text-gray-400'}`}>
                    หากพบการทุจริตหรือฮั้วกับผู้ขาย แพลตฟอร์มจะ
                    <strong className={mobile ? 'text-red-600' : 'text-red-300'}> ยึดเงินประกันชดเชยคุณทันที</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className={panelCls(mobile)}>
              <h2 className={mobile ? undefined : 'font-semibold text-gray-200'}>ใบเสนอราคา</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className={mobile ? 'text-[#64748b]' : 'text-gray-400'}>คนกลาง</span><span className={mobile ? 'font-medium' : 'text-white font-medium'}>{j.middleman_name}</span></div>
                <div className="flex justify-between"><span className={mobile ? 'text-[#64748b]' : 'text-gray-400'}>ค่าเดินทาง</span><span className={mobile ? undefined : 'text-white'}>{Number(j.travel_fee).toLocaleString()} บาท</span></div>
                <div className="flex justify-between"><span className={mobile ? 'text-[#64748b]' : 'text-gray-400'}>ค่าบริการตรวจ</span><span className={mobile ? undefined : 'text-white'}>{Number(j.service_fee).toLocaleString()} บาท</span></div>
                {Number(j.item_price) > 0 && (
                  <div className="flex justify-between"><span className={mobile ? 'text-[#64748b]' : 'text-gray-400'}>ราคาสินค้า</span><span className={mobile ? undefined : 'text-white'}>{Number(j.item_price).toLocaleString()} บาท</span></div>
                )}
                <div className={`border-t pt-2 flex justify-between font-semibold ${mobile ? 'border-[#e2e8f0]' : 'border-white/10'}`}>
                  <span className={mobile ? undefined : 'text-gray-300'}>รวมทั้งหมด</span>
                  <span className={mobile ? 'text-green-600' : 'text-green-400 text-base'}>{totalPay.toLocaleString()} บาท</span>
                </div>
              </div>
              {j.estimated_arrival && (
                <div className={`text-sm ${mobile ? 'text-[#64748b]' : 'text-gray-400'}`}>
                  🕐 คาดว่าจะถึง: {new Date(j.estimated_arrival).toLocaleString('th-TH')}
                </div>
              )}
              {j.conditions && (
                <div className={`text-sm rounded-lg p-3 ${mobile ? 'bg-[#f8fafc] text-[#64748b]' : 'text-gray-400 bg-white/5'}`}>📝 {j.conditions}</div>
              )}
            </div>

            <div className="flex gap-3">
              <AsyncButton onClick={() => doAction('reject_quote')} disabled={acting}
                className={mobile ? 'btn btn-ghost flex-1' : 'flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-medium transition'}
              >❌ ปฏิเสธ</AsyncButton>
              <AsyncButton onClick={() => doAction('accept_quote')} disabled={acting} loadingChildren="กำลังยืนยัน..."
                className={mobile ? 'btn btn-primary flex-1' : 'flex-2 flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold transition'}
              >✅ ยอมรับและว่าจ้าง</AsyncButton>
            </div>
          </div>
        )}

        {isMiddleman && j.status === 'accepted' && (
          <div className={panelCls(mobile, mobile ? '' : 'bg-green-500/10 border-green-500/30')}>
            <p className={mobile ? 'font-semibold' : 'font-semibold text-green-300'}>✅ ผู้ว่าจ้างอนุมัติแล้ว!</p>
            <p className={`text-sm ${mobile ? '' : 'text-gray-300'}`}>
              ติดต่อผู้ขายที่เบอร์ <strong>{j.seller_contact || '—'}</strong> และเดินทางไปยัง <strong>{j.seller_location}</strong>
            </p>
            <AsyncButton onClick={() => doAction('start_work')}
              className={mobile ? 'btn btn-primary btn-block' : 'w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold transition'}
            >🚗 เริ่มออกเดินทาง</AsyncButton>
          </div>
        )}

        {isMiddleman && j.status === 'in_progress' && (
          <div className={panelCls(mobile, mobile ? '' : 'bg-orange-500/10 border-orange-500/30 space-y-4')}>
            <p className={mobile ? 'font-semibold' : 'font-semibold text-orange-300'}>🚗 กำลังดำเนินการ</p>
            <label className={mobile ? 'app-field' : undefined}>
              {mobile && <span>บันทึกสรุปผลการตรวจ</span>}
              {!mobile && <span className="text-xs text-gray-400 mb-1.5 block">บันทึกสรุปผลการตรวจ</span>}
              <textarea value={reportNotes} onChange={e => setReportNotes(e.target.value)} rows={3}
                placeholder="เช่น ตรวจแล้วสภาพดี เครื่องปกติ ตัวถังไม่มีรอยชน..."
                className={mobile ? undefined : `${inputCls(mobile)} resize-none`}
              />
            </label>
            <AsyncButton onClick={() => doAction('complete', { reportNotes })} disabled={!reportNotes}
              className={mobile ? 'btn btn-primary btn-block' : 'w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold transition'}
            >🎉 รายงานเสร็จสิ้น</AsyncButton>
          </div>
        )}

        {j.status === 'completed' && (
          <div className={panelCls(mobile, mobile ? '' : 'bg-emerald-500/10 border-emerald-500/30 space-y-2')}>
            <p className={mobile ? 'font-semibold text-lg' : 'font-semibold text-emerald-300 text-lg'}>🎉 งานเสร็จสมบูรณ์</p>
            {j.report_notes && (
              <div className={`rounded-xl p-4 text-sm ${mobile ? 'bg-[#f8fafc]' : 'bg-white/5 text-gray-300'}`}>
                <p className={`text-xs mb-1 ${mobile ? 'text-[#64748b]' : 'text-gray-500'}`}>สรุปผลจากคนกลาง:</p>
                {j.report_notes}
              </div>
            )}
            <p className={`text-xs ${mobile ? 'text-[#64748b]' : 'text-gray-500'}`}>
              เสร็จเมื่อ {j.completed_at ? new Date(j.completed_at).toLocaleString('th-TH') : '—'}
            </p>
          </div>
        )}

        {isBuyer && ['open', 'quoted'].includes(j.status) && (
          <button onClick={() => { if (confirm('ยืนยันยกเลิกคำขอนี้?')) doAction('cancel'); }} disabled={acting}
            className={mobile ? 'btn btn-ghost btn-block' : 'w-full py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 text-sm transition'}
          >ยกเลิกคำขอ</button>
        )}

        {j.status === 'cancelled' && (
          <div className={panelCls(mobile, mobile ? 'text-center' : 'bg-gray-700/30 border-gray-600/30 text-center')}>
            <p className={mobile ? 'text-[#64748b]' : 'text-gray-400'}>❌ คำขอนี้ถูกยกเลิกแล้ว</p>
            <Link href="/onsite/create" className={mobile ? 'onsite-app-link-back' : 'mt-3 inline-block text-sm text-blue-400 hover:text-blue-300 transition'}>
              สร้างคำขอใหม่ →
            </Link>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <MobileShell>
        <OnsiteDetailApp
          title={titleText}
          subtitle={`📍 ${job.seller_province}`}
          statusLabel={statusLabel}
          statusClass=""
          steps={STATUS_STEPS}
          currentKey={job.status}
          onBack={() => router.back()}
        >
          {renderPanels(true, job)}
        </OnsiteDetailApp>
      </MobileShell>

      <DesktopShell>
        <div className="min-h-screen bg-[#0a0f1e] text-white">
          <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-white">←</button>
            <h1 className="text-xl font-bold truncate">{titleText}</h1>
            <span className={`ml-auto text-xs px-2 py-1 rounded-full border whitespace-nowrap flex-shrink-0 ${STATUS_COLOR[job.status] || 'bg-gray-500/20 text-gray-300 border-gray-500/40'}`}>
              {statusLabel}
            </span>
          </div>

          <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
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
            {renderPanels(false, job)}
          </div>
        </div>
      </DesktopShell>
    </>
  );
}
