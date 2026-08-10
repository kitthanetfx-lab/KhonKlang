'use client';

import { useState } from 'react';
import { authHeaders } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ServiceDisabledNotice } from '@/components/ServiceDisabledNotice';
import { useServiceControls } from '@/lib/useServiceControls';
import { MobileShell, DesktopShell } from '@/components/mobile/shells';
import { OnsiteCreateApp } from '@/components/mobile/OnsiteCreateApp';

const PROVINCES = [
  'กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร',
  'ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ',
  'ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก',
  'นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์',
  'นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี',
  'ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา',
  'พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์',
  'แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร',
  'ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง',
  'ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ',
  'สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย',
  'สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู',
  'อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี',
];

export default function CreateOnsiteJob() {
  const router = useRouter();
  const controls = useServiceControls();
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice,        setItemPrice]        = useState('');
  const [sellerLocation,   setSellerLocation]   = useState('');
  const [sellerProvince,   setSellerProvince]   = useState('');
  const [sellerContact,    setSellerContact]    = useState('');
  const [maxBudget,        setMaxBudget]        = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  if (!controls.loading && !controls.isEnabled('onsite')) {
    return <ServiceDisabledNotice title="สร้างคำขอลงพื้นที่" message={controls.message('onsite')} backHref="/service/onsite" backLabel="กลับไปหน้าบริการ" />;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!itemDescription || !sellerLocation || !sellerProvince) {
      setError('กรุณากรอกข้อมูลสินค้า ที่อยู่ และจังหวัดให้ครบ');
      return;
    }
    setLoading(true); setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/onsite-jobs', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemDescription, itemPrice, sellerLocation, sellerProvince, sellerContact, maxBudget }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return; }
      router.push(`/onsite/${data.job.id}`);
    } catch { setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); }
    finally { setLoading(false); }
  }

  const formProps = {
    provinces: PROVINCES,
    itemDescription, setItemDescription,
    itemPrice, setItemPrice,
    sellerLocation, setSellerLocation,
    sellerProvince, setSellerProvince,
    sellerContact, setSellerContact,
    maxBudget, setMaxBudget,
    loading, error,
    onSubmit: handleSubmit,
    onBack: () => router.back(),
  };

  return (
    <>
      <MobileShell>
        <OnsiteCreateApp {...formProps} />
      </MobileShell>
      <DesktopShell>
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3">
        <Link href="/service/onsite" className="text-gray-400 hover:text-white">←</Link>
        <h1 className="text-xl font-bold">สร้างคำขอลงพื้นที่</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">{error}</div>
        )}

        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">รายละเอียดสินค้าที่ต้องการตรวจ *</label>
          <textarea value={itemDescription} onChange={e => setItemDescription(e.target.value)}
            rows={3} placeholder="เช่น Honda Civic 2018 สีขาว เลขไมล์ 80,000 กม. ต้องการตรวจสภาพเครื่องยนต์และตัวถัง"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition resize-none"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">ราคาสินค้าที่ตกลงกับผู้ขาย (บาท)</label>
          <input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)}
            placeholder="เช่น 350000"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">จังหวัดที่ตั้งสินค้า *</label>
          <select value={sellerProvince} onChange={e => setSellerProvince(e.target.value)}
            className="w-full bg-[#1a2035] border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition"
          >
            <option value="">เลือกจังหวัด...</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">ที่อยู่/สถานที่นัดพบผู้ขาย *</label>
          <textarea value={sellerLocation} onChange={e => setSellerLocation(e.target.value)}
            rows={2} placeholder="เช่น ตลาดนัดรถยนต์มือสอง ถ.พหลโยธิน กม.30 ปทุมธานี (หรือชื่อร้าน/แผนที่ Google)"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition resize-none"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">เบอร์ติดต่อผู้ขาย (ให้คนกลางนัดเวลา)</label>
          <input type="text" value={sellerContact} onChange={e => setSellerContact(e.target.value)}
            placeholder="เช่น 081-234-5678"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">งบค่าบริการสูงสุดที่ยอมรับได้ (บาท)</label>
          <input type="number" value={maxBudget} onChange={e => setMaxBudget(e.target.value)}
            placeholder="เช่น 1000 (ค่าเดินทาง + ค่าตรวจ)"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition"
          />
          {maxBudget && <p className="text-xs text-gray-500 mt-1">คนกลางจะเห็นงบนี้และเสนอราคาภายในขอบเขตที่เหมาะสม</p>}
        </div>

        <button onClick={() => handleSubmit()} disabled={loading || !controls.isEnabled('onsite')}
          className="w-full py-4 rounded-2xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-lg transition"
        >
          {loading ? 'กำลังสร้างคำขอ...' : '📋 ส่งคำขอหาคนกลาง'}
        </button>
      </div>
    </div>
      </DesktopShell>
    </>
  );
}
