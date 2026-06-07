'use client';

import { useEffect, useState, useCallback } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Deal {
  $id: string;
  sellerId: string;
  sellerName: string;
  middlemanId: string;
  middlemanName: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  location: string;
  sellingMode: string;
  imageFileIds: string;
  status: string;
  sellerConfirmed: boolean;
  middlemanConfirmed: boolean;
  rejectReason: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  posted:                 'รอคนกลาง',
  buyer_joined:           'มีผู้ซื้อ',
  terms_pending:          'รอยอมรับเงื่อนไข',
  payment_pending:        'รอโอนเงิน',
  payment_uploaded:       'ตรวจสลิป',
  packing:                'แพ็คของ',
  shipped_to_middleman:   'รอคนกลางรับ',
  middleman_received:     'คนกลางรับแล้ว',
  middleman_checking:     'คนกลางตรวจสินค้า',
  shipped_to_buyer:       'จัดส่งให้ผู้ซื้อ',
  delivered:              'รอยืนยันรับ',
  completed:              'เสร็จสิ้น',
  cancelled:              'ยกเลิก',
  disputed:               'มีปัญหา',
};

const STATUS_COLOR: Record<string, string> = {
  posted:               'bg-blue-500/20 text-blue-300 border-blue-500/40',
  buyer_joined:         'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  terms_pending:        'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  payment_pending:      'bg-orange-500/20 text-orange-300 border-orange-500/40',
  payment_uploaded:     'bg-orange-500/20 text-orange-300 border-orange-500/40',
  packing:              'bg-purple-500/20 text-purple-300 border-purple-500/40',
  shipped_to_middleman: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  middleman_received:   'bg-teal-500/20 text-teal-300 border-teal-500/40',
  middleman_checking:   'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  shipped_to_buyer:     'bg-blue-500/20 text-blue-300 border-blue-500/40',
  delivered:            'bg-green-500/20 text-green-300 border-green-500/40',
  completed:            'bg-green-700/30 text-green-300 border-green-600/40',
  cancelled:            'bg-gray-500/20 text-gray-300 border-gray-500/40',
  disputed:             'bg-red-500/20 text-red-300 border-red-500/40',
};

const CATEGORIES = ['สินค้าทั่วไป', 'อิเล็กทรอนิกส์', 'เสื้อผ้า', 'ยานพาหนะ', 'อสังหาริมทรัพย์', 'บริการ', 'อื่นๆ'];
const CONDITIONS  = ['ของใหม่', 'มือสองสภาพดี', 'มือสองมีตำหนิ'];
const PROVINCES   = [
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

const ENDPOINT  = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT  || 'https://sgp.cloud.appwrite.io/v1';
const PROJECT   = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const BUCKET_ID = 'deal_files';

function imgUrl(fileId: string) {
  return `${ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileId}/view?project=${PROJECT}`;
}

interface UploadedImage { fileId: string; url: string; name: string; }

export default function SellerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals]     = useState<Deal[]>([]);
  const [tab, setTab]         = useState<'active' | 'post' | 'history'>('active');
  const [myId, setMyId]       = useState('');

  // Post form
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [price,       setPrice]       = useState('');
  const [category,    setCategory]    = useState('');
  const [condition,   setCondition]   = useState('');
  const [location,    setLocation]    = useState('');
  const [sellingMode, setSellingMode] = useState<'normal' | 'certified'>('normal');
  const [images,      setImages]      = useState<UploadedImage[]>([]);
  const [uploading,   setUploading]   = useState(false);
  const [posting,     setPosting]     = useState(false);
  const [postError,   setPostError]   = useState('');
  const [postDone,    setPostDone]    = useState(false);

  const fetchDeals = useCallback(async (jwt: string) => {
    const res = await fetch('/api/deals?role=seller', {
      headers: { 'x-session-jwt': jwt },
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setDeals(data.deals || []);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await account.get();
        const prefs = user.prefs as Record<string, string>;
        if (prefs.sellerStatus !== 'approved') { router.replace('/register/seller'); return; }
        setMyId(user.$id);
        const jwt = (await account.createJWT()).jwt;
        await fetchDeals(jwt);
      } catch { router.replace('/login'); }
      finally { setLoading(false); }
    })();
  }, [router, fetchDeals]);

  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const jwt = (await account.createJWT()).jwt;
      const uploaded: UploadedImage[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload-deal', {
          method: 'POST',
          headers: { 'x-session-jwt': jwt },
          body: fd,
        });
        if (res.ok) {
          const d = await res.json();
          uploaded.push({ fileId: d.fileId, url: d.url, name: file.name });
        }
      }
      setImages(prev => [...prev, ...uploaded]);
    } finally { setUploading(false); }
  }

  function removeImage(fileId: string) {
    setImages(prev => prev.filter(i => i.fileId !== fileId));
  }

  async function handlePost() {
    if (!title || !price) { setPostError('กรุณากรอกชื่อสินค้าและราคา'); return; }
    if (!condition)        { setPostError('กรุณาเลือกสภาพสินค้า'); return; }
    setPosting(true); setPostError('');
    try {
      const jwt = (await account.createJWT()).jwt;
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'x-session-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, price: Number(price), category,
          condition, location, sellingMode,
          imageFileIds: images.map(i => i.fileId),
          creatorRole: 'seller',
        }),
      });
      if (!res.ok) { const d = await res.json(); setPostError(d.error || 'เกิดข้อผิดพลาด'); return; }
      setPostDone(true);
      setTitle(''); setDescription(''); setPrice(''); setCategory('');
      setCondition(''); setLocation(''); setSellingMode('normal'); setImages([]);
      await fetchDeals(jwt);
      setTimeout(() => { setPostDone(false); setTab('active'); }, 1800);
    } finally { setPosting(false); }
  }

  const ACTIVE_STATUSES = ['posted','buyer_joined','terms_pending','payment_pending','payment_uploaded','packing','shipped_to_middleman','middleman_received','middleman_checking','shipped_to_buyer','delivered'];
  const DONE_STATUSES   = ['completed','cancelled','disputed'];
  const activeDeals  = deals.filter(d => d.sellerId === myId && ACTIVE_STATUSES.includes(d.status));
  const historyDeals = deals.filter(d => d.sellerId === myId && DONE_STATUSES.includes(d.status));

  if (loading) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  function DealCard({ deal }: { deal: Deal }) {
    let firstImg = '';
    try { const ids = JSON.parse(deal.imageFileIds || '[]'); if (ids.length) firstImg = imgUrl(ids[0]); } catch {}
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
        <div className="flex items-start gap-4">
          {firstImg && (
            <img src={firstImg} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-white/10" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-white text-base leading-tight truncate">{deal.title}</p>
              <span className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap flex-shrink-0 ${STATUS_COLOR[deal.status] || 'bg-gray-500/20 text-gray-300'}`}>
                {STATUS_LABEL[deal.status] || deal.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-400">
              <span>💰 {deal.price.toLocaleString()} บาท</span>
              {deal.condition  && <span>✨ {deal.condition}</span>}
              {deal.location   && <span>📍 {deal.location}</span>}
              {deal.sellingMode === 'certified' && (
                <span className="text-yellow-400 font-medium">⭐ Certified</span>
              )}
            </div>
          </div>
        </div>
        <Link href={`/deal/${deal.$id}`}
          className="block w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-center transition text-sm"
        >💬 เข้าห้อง Deal</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* Header */}
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition">←</button>
        <h1 className="text-xl font-bold">บอร์ดผู้ขาย</h1>
      </div>

      {/* Tabs */}
      <div className="px-4 max-w-2xl mx-auto pt-4">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {([
            { key: 'active',  label: `กำลังขาย (${activeDeals.length})` },
            { key: 'post',    label: '+ ลงประกาศ' },
            { key: 'history', label: `ประวัติ (${historyDeals.length})` },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-10 max-w-2xl mx-auto mt-4 space-y-3">
        {/* Active tab */}
        {tab === 'active' && (activeDeals.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-gray-500">ยังไม่มีประกาศที่กำลังดำเนินการ</p>
            <button onClick={() => setTab('post')} className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition">
              ลงประกาศใหม่
            </button>
          </div>
        ) : activeDeals.map(d => <DealCard key={d.$id} deal={d} />))}

        {/* Post form tab */}
        {tab === 'post' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-bold">ลงประกาศสินค้าใหม่</h2>

            {postDone && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-300 text-center">
                ✅ ลงประกาศสำเร็จ!
              </div>
            )}
            {postError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">
                {postError}
              </div>
            )}

            {/* Images */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">รูปภาพสินค้า</label>
              <div className="flex flex-wrap gap-3">
                {images.map(img => (
                  <div key={img.fileId} className="relative">
                    <img src={img.url} alt={img.name} className="w-20 h-20 object-cover rounded-xl bg-white/10" />
                    <button onClick={() => removeImage(img.fileId)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center hover:bg-red-500 transition"
                    >×</button>
                  </div>
                ))}
                <label className={`w-20 h-20 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  <span className="text-2xl">{uploading ? '⏳' : '📷'}</span>
                  <span className="text-xs text-gray-500 mt-1">{uploading ? 'กำลังอัป...' : 'เพิ่มรูป'}</span>
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={e => handleImageUpload(e.target.files)}
                  />
                </label>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">ชื่อสินค้า / บริการ *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="เช่น iPhone 15 Pro Max 256GB สีดำ"
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Price + Category */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm text-gray-400 mb-1.5 block">ราคา (บาท) *</label>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                  placeholder="0" min="0"
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
              <div className="flex-1">
                <label className="text-sm text-gray-400 mb-1.5 block">หมวดหมู่</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full bg-[#1a2035] border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="">เลือก...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Condition */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">สภาพสินค้า *</label>
              <div className="flex gap-2 flex-wrap">
                {CONDITIONS.map(c => (
                  <button key={c} type="button" onClick={() => setCondition(c)}
                    className={`px-4 py-2 rounded-xl text-sm border transition ${
                      condition === c
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-white/5 border-white/15 text-gray-300 hover:border-blue-500'
                    }`}
                  >{c}</button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">จังหวัดที่ตั้งสินค้า</label>
              <select value={location} onChange={e => setLocation(e.target.value)}
                className="w-full bg-[#1a2035] border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="">เลือกจังหวัด...</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Selling Mode */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">รูปแบบการขาย</label>
              <div className="space-y-2">
                <button type="button" onClick={() => setSellingMode('normal')}
                  className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition ${
                    sellingMode === 'normal'
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-white/5 border-white/15 text-gray-300 hover:border-white/30'
                  }`}
                >
                  <span className="text-xl mt-0.5">🏪</span>
                  <div>
                    <p className="font-medium text-sm">ลงขายปกติ</p>
                    <p className="text-xs text-gray-400 mt-0.5">ผู้ซื้อเลือกคนกลางเอง ค่าธรรมเนียมมาตรฐาน</p>
                  </div>
                </button>
                <button type="button" onClick={() => setSellingMode('certified')}
                  className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition ${
                    sellingMode === 'certified'
                      ? 'bg-yellow-600/20 border-yellow-500 text-white'
                      : 'bg-white/5 border-white/15 text-gray-300 hover:border-white/30'
                  }`}
                >
                  <span className="text-xl mt-0.5">⭐</span>
                  <div>
                    <p className="font-medium text-sm">ส่งฝากขายผ่านคนกลาง <span className="text-yellow-400">Khonklang Certified</span></p>
                    <p className="text-xs text-gray-400 mt-0.5">คนกลางตรวจสอบและดูแลสินค้าก่อนส่ง เพิ่มความน่าเชื่อถือ</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm text-gray-400 mb-1.5 block">รายละเอียดเพิ่มเติม</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={4} placeholder="รายละเอียดสินค้า สภาพ อุปกรณ์ที่มา เงื่อนไข..."
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition resize-none"
              />
            </div>

            <button onClick={handlePost} disabled={posting || postDone || uploading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition"
            >
              {posting ? 'กำลังลงประกาศ...' : 'ลงประกาศ'}
            </button>
          </div>
        )}

        {/* History tab */}
        {tab === 'history' && (historyDeals.length === 0 ? (
          <p className="text-center text-gray-500 py-16">ยังไม่มีประวัติการขาย</p>
        ) : historyDeals.map(d => <DealCard key={d.$id} deal={d} />))}
      </div>
    </div>
  );
}
