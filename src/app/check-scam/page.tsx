'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, CheckCircle2, Loader2, ExternalLink, ArrowLeft, AlertTriangle } from 'lucide-react';

type CheckStatus = 'idle' | 'checking' | 'done';
type SiteStatus = 'waiting' | 'checking' | 'opened';

const SITES = [
  {
    id: 'chalodon',
    name: 'ฉลาดโอน',
    desc: 'ตรวจสอบประวัติการโกงจากฐานข้อมูลผู้เสียหาย',
    url: (q: string) => `https://www.chalodohn.com/search?q=${encodeURIComponent(q)}`,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
  },
  {
    id: 'blacklist',
    name: 'Blacklist Seller',
    desc: 'ฐานข้อมูลผู้ขายที่ถูกแบล็คลิสต์จากผู้ซื้อทั่วไทย',
    url: (q: string) => `https://www.blacklistseller.com/search?s=${encodeURIComponent(q)}`,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
  },
];

export default function CheckScam() {
  const [form, setForm] = useState({ name: '', account: '', phone: '' });
  const [status, setStatus] = useState<CheckStatus>('idle');
  const [siteStatuses, setSiteStatuses] = useState<Record<string, SiteStatus>>({});

  const query = [form.name, form.account, form.phone].filter(Boolean).join(' ');
  const hasInput = query.trim().length > 0;

  const handleCheck = async () => {
    if (!hasInput) return;
    setStatus('checking');
    setSiteStatuses({ chalodon: 'waiting', blacklist: 'waiting' });

    for (let i = 0; i < SITES.length; i++) {
      const site = SITES[i];

      // Mark as checking
      setSiteStatuses((prev) => ({ ...prev, [site.id]: 'checking' }));
      await delay(1200);

      // Open in new tab
      window.open(site.url(query), '_blank', 'noopener,noreferrer');
      setSiteStatuses((prev) => ({ ...prev, [site.id]: 'opened' }));
      await delay(600);
    }

    setStatus('done');
  };

  const reset = () => {
    setForm({ name: '', account: '', phone: '' });
    setStatus('idle');
    setSiteStatuses({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white px-4 py-12">
      <div className="max-w-xl mx-auto">

        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> กลับหน้าหลัก
        </Link>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-yellow-500/20 border border-yellow-500/30 rounded-2xl mb-4">
            <Search className="w-7 h-7 text-yellow-400" />
          </div>
          <h1 className="text-3xl font-bold mb-2">เช็คคนโกง</h1>
          <p className="text-gray-400 text-sm">ตรวจสอบชื่อ เลขบัญชี หรือเบอร์โทรก่อนโอนเงิน</p>
        </div>

        {status === 'idle' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">ชื่อ-นามสกุล</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น สมชาย ใจดี"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">เลขบัญชีธนาคาร</label>
              <input
                type="text"
                value={form.account}
                onChange={(e) => setForm({ ...form, account: e.target.value })}
                placeholder="เช่น 012-3-45678-9"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">เบอร์โทรศัพท์</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="เช่น 0812345678"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all placeholder-gray-500"
              />
            </div>

            <p className="text-xs text-gray-500">กรอกอย่างน้อย 1 อย่าง</p>

            <button
              onClick={handleCheck}
              disabled={!hasInput}
              className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold py-3 rounded-xl transition-all"
            >
              <Search className="w-4 h-4" /> ตรวจสอบเลย
            </button>
          </div>
        )}

        {(status === 'checking' || status === 'done') && (
          <div className="space-y-4">
            {/* Query summary */}
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300">
              <span className="text-gray-500">กำลังตรวจสอบ: </span>
              <span className="font-medium text-white">{query}</span>
            </div>

            {/* Site checks */}
            {SITES.map((site) => {
              const s = siteStatuses[site.id];
              return (
                <div key={site.id} className={`border rounded-2xl p-5 transition-all ${site.bg} ${s === 'opened' ? 'opacity-100' : 'opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className={`font-semibold ${site.color}`}>{site.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{site.desc}</p>
                    </div>
                    <div className="flex-shrink-0 mt-0.5">
                      {s === 'waiting' && <div className="w-5 h-5 rounded-full border-2 border-gray-600" />}
                      {s === 'checking' && <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />}
                      {s === 'opened' && (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                          <a href={site.url(query)} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-white flex items-center gap-0.5 transition-colors">
                            เปิดอีกครั้ง <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                  {s === 'checking' && (
                    <p className="text-xs text-yellow-400 mt-2 animate-pulse">กำลังเปิดเว็บไซต์...</p>
                  )}
                  {s === 'opened' && (
                    <p className="text-xs text-green-400 mt-2">เปิดแท็บใหม่แล้ว — กรุณาตรวจสอบผลลัพธ์ในแท็บนั้น</p>
                  )}
                </div>
              );
            })}

            {/* Done */}
            {status === 'done' && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm mb-1">ตรวจสอบผลลัพธ์ด้วยตนเอง</p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      ระบบได้เปิดเว็บไซต์ตรวจสอบทั้ง {SITES.length} แห่งในแท็บใหม่แล้ว
                      กรุณาดูผลลัพธ์ในแต่ละแท็บ หากพบประวัติน่าสงสัย <strong className="text-white">ไม่ควรโอนเงิน</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status === 'done' && (
              <button onClick={reset} className="w-full border border-white/20 hover:bg-white/10 text-white py-3 rounded-xl text-sm font-medium transition-all">
                ตรวจสอบรายการใหม่
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
