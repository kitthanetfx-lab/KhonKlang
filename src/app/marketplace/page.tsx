'use client';

import { useEffect, useState } from 'react';
import { account } from '@/lib/appwrite';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Listing {
  $id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  location: string;
  sellingMode: string;
  imageFileIds: string;
  status: string;
  buyerId: string;
  createdAt: string;
}

const ENDPOINT  = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT  || 'https://sgp.cloud.appwrite.io/v1';
const PROJECT   = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
const BUCKET_ID = 'deal_files';

function imgUrl(fileId: string) {
  return `${ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileId}/view?project=${PROJECT}`;
}

const CATS = ['ทั้งหมด','สินค้าทั่วไป','อิเล็กทรอนิกส์','เสื้อผ้า','ยานพาหนะ','อสังหาริมทรัพย์','บริการ','อื่นๆ'];
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

export default function Marketplace() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [myId,     setMyId]     = useState('');
  const [jwt,      setJwt]      = useState('');

  // Filters
  const [search,     setSearch]     = useState('');
  const [cat,        setCat]        = useState('ทั้งหมด');
  const [province,   setProvince]   = useState('');
  const [certified,  setCertified]  = useState(false);

  const [joining,  setJoining]  = useState<string | null>(null);
  const [contacting, setContacting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await account.get();
        setMyId(user.$id);
        const j = (await account.createJWT()).jwt;
        setJwt(j);
        const res = await fetch('/api/deals?role=buyer', { headers: { 'x-session-jwt': j } });
        if (res.ok) { const data = await res.json(); setListings(data.deals || []); }
      } catch {
        // Guest — try without auth
        const res = await fetch('/api/deals?role=buyer').catch(() => null);
        if (res?.ok) { const data = await res.json(); setListings(data.deals || []); }
      } finally { setLoading(false); }
    })();
  }, []);

  async function joinDeal(dealId: string) {
    if (!myId) { router.push('/login'); return; }
    setJoining(dealId);
    try {
      const j = jwt || (await account.createJWT()).jwt;
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'x-session-jwt': j, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join_as_buyer' }),
      });
      if (res.ok) router.push(`/deal/${dealId}`);
      else { const d = await res.json(); alert(d.error || 'เกิดข้อผิดพลาด'); }
    } finally { setJoining(null); }
  }

  async function callMiddleman(dealId: string) {
    if (!myId) { router.push('/login'); return; }
    // Join the deal first, then go to the deal room to select middleman
    setContacting(dealId);
    try {
      const j = jwt || (await account.createJWT()).jwt;
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'x-session-jwt': j, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join_as_buyer' }),
      });
      if (res.ok) router.push(`/deal/${dealId}`);
      else {
        // If already joined, just navigate
        router.push(`/deal/${dealId}`);
      }
    } finally { setContacting(null); }
  }

  const filtered = listings
    .filter(d => d.status === 'posted' && d.sellerId !== myId)
    .filter(d => cat === 'ทั้งหมด' || d.category === cat)
    .filter(d => !province || d.location === province)
    .filter(d => !certified || d.sellingMode === 'certified')
    .filter(d => !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase())
    );

  const certifiedList = filtered.filter(d => d.sellingMode === 'certified');
  const normalList    = filtered.filter(d => d.sellingMode !== 'certified');

  function getFirstImage(listing: Listing): string {
    try {
      const ids = JSON.parse(listing.imageFileIds || '[]');
      return ids.length > 0 ? imgUrl(ids[0]) : '';
    } catch { return ''; }
  }

  function ListingCard({ listing }: { listing: Listing }) {
    const isCertified = listing.sellingMode === 'certified';
    const firstImg    = getFirstImage(listing);
    const isMyDeal    = listing.buyerId === myId;

    return (
      <div className={`rounded-2xl border overflow-hidden transition ${
        isCertified
          ? 'bg-gradient-to-br from-yellow-900/20 to-green-900/15 border-yellow-500/50 shadow-yellow-900/20 shadow-lg'
          : 'bg-white/5 border-white/10'
      }`}>
        {/* Image */}
        <div className="relative">
          {firstImg ? (
            <img src={firstImg} alt={listing.title}
              className="w-full h-44 object-cover"
            />
          ) : (
            <div className="w-full h-44 bg-white/5 flex items-center justify-center">
              <span className="text-4xl opacity-30">📦</span>
            </div>
          )}
          {isCertified && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-yellow-500 text-black text-xs font-bold px-2.5 py-1 rounded-full shadow">
              ⭐ Certified
            </div>
          )}
          {listing.condition && (
            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
              {listing.condition}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {isCertified && (
            <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
              <span>✅</span>
              <span>ตรวจสอบและพร้อมส่งโดยคนกลาง Khonklang</span>
            </div>
          )}

          <div>
            <p className="font-semibold text-white text-base leading-tight line-clamp-2">{listing.title}</p>
            {listing.description && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">{listing.description}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className={`text-xl font-bold ${isCertified ? 'text-yellow-400' : 'text-green-400'}`}>
              {listing.price.toLocaleString()} ฿
            </p>
            <div className="flex flex-col items-end gap-0.5 text-xs text-gray-500">
              {listing.location && <span>📍 {listing.location}</span>}
              {listing.category && <span>📦 {listing.category}</span>}
            </div>
          </div>

          <p className="text-xs text-gray-500">👤 {listing.sellerName || 'ผู้ขาย'}</p>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            {isMyDeal ? (
              <Link href={`/deal/${listing.$id}`}
                className="block w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium text-center transition text-sm"
              >เข้าห้อง Deal ของคุณ</Link>
            ) : isCertified ? (
              <button onClick={() => joinDeal(listing.$id)} disabled={joining === listing.$id}
                className="w-full py-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white font-semibold transition text-sm"
              >
                {joining === listing.$id ? 'กำลังเข้าร่วม...' : '⭐ ซื้อสินค้า Certified'}
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => joinDeal(listing.$id)} disabled={joining === listing.$id}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium transition text-sm"
                >
                  {joining === listing.$id ? '...' : 'ขอซื้อ'}
                </button>
                <button onClick={() => callMiddleman(listing.$id)} disabled={contacting === listing.$id}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium transition text-sm"
                >
                  {contacting === listing.$id ? '...' : '🤝 เรียกคนกลาง'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* Header */}
      <div className="bg-[#111827] border-b border-white/10 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-gray-400 hover:text-white transition">←</Link>
        <h1 className="text-xl font-bold">ตลาด Khonklang</h1>
        <span className="ml-auto text-xs text-gray-500">{filtered.length} รายการ</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* Search */}
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 ค้นหาสินค้า..."
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
        />

        {/* Filter row */}
        <div className="flex gap-2 flex-wrap items-center">
          <select value={province} onChange={e => setProvince(e.target.value)}
            className="bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
          >
            <option value="">📍 ทุกจังหวัด</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <button onClick={() => setCertified(c => !c)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition ${
              certified
                ? 'bg-yellow-600/30 border-yellow-500 text-yellow-300'
                : 'bg-white/5 border-white/15 text-gray-400 hover:border-yellow-500 hover:text-yellow-300'
            }`}
          >
            ⭐ Certified เท่านั้น
            <span className={`w-4 h-4 rounded-full border transition ${
              certified ? 'bg-yellow-400 border-yellow-400' : 'border-gray-500'
            }`} />
          </button>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 flex-wrap">
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                cat === c ? 'bg-blue-600 border-blue-500 text-white' : 'border-white/15 text-gray-400 hover:text-white'
              }`}
            >{c}</button>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <p className="text-4xl">🛒</p>
            <p className="text-gray-400">ไม่พบสินค้าที่ตรงกัน</p>
            <p className="text-sm text-gray-600">ลองเปลี่ยนตัวกรองหรือค้นหาด้วยคำอื่น</p>
          </div>
        ) : (
          <>
            {/* Certified section */}
            {certifiedList.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 font-semibold text-sm">⭐ Khonklang Certified</span>
                  <span className="text-xs text-gray-500">({certifiedList.length} รายการ)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {certifiedList.map(d => <ListingCard key={d.$id} listing={d} />)}
                </div>
              </div>
            )}

            {/* Normal section */}
            {normalList.length > 0 && (
              <div className="space-y-3">
                {certifiedList.length > 0 && (
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-gray-300 font-semibold text-sm">🏪 สินค้าทั่วไป</span>
                    <span className="text-xs text-gray-500">({normalList.length} รายการ)</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {normalList.map(d => <ListingCard key={d.$id} listing={d} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
