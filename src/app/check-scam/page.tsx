'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, ExternalLink, ArrowLeft, ShieldCheck, AlertTriangle } from 'lucide-react';

const SITES = [
  {
    id: 'blacklist',
    name: 'Blacklist Seller',
    slogan: 'ฐานข้อมูลผู้ขายที่ถูกแบล็คลิสต์จากผู้ซื้อทั่วประเทศไทย',
    url: 'https://www.blacklistseller.com/',
    searchUrl: (q: string) => `https://www.blacklistseller.com/search?s=${encodeURIComponent(q)}`,
    gradient: 'from-red-900 via-red-800 to-rose-900',
    border: 'border-red-500/40',
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
    icon: '🚫',
    tag: 'ผู้ขายออนไลน์',
  },
  {
    id: 'chaladohn',
    name: 'ฉลาดโอน',
    slogan: 'ตรวจสอบเลขบัญชีและเบอร์โทรก่อนโอนเงิน ลดความเสี่ยงการโดนโกง',
    url: 'https://www.chaladohn.com/',
    searchUrl: (q: string) => `https://www.chaladohn.com/?q=${encodeURIComponent(q)}`,
    gradient: 'from-blue-900 via-blue-800 to-indigo-900',
    border: 'border-blue-500/40',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: '💳',
    tag: 'เลขบัญชี / เบอร์โทร',
  },
  {
    id: 'checkgon',
    name: 'Check ก่อน',
    slogan: 'ระบบตรวจสอบการโกงออนไลน์โดยภาครัฐ เชื่อถือได้ 100%',
    url: 'https://checkgon.go.th/',
    searchUrl: (q: string) => `https://checkgon.go.th/?search=${encodeURIComponent(q)}`,
    gradient: 'from-emerald-900 via-green-800 to-teal-900',
    border: 'border-emerald-500/40',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: '🏛️',
    tag: 'ภาครัฐ',
  },
];

export default function CheckScam() {
  const [query, setQuery] = useState('');

  const open = (site: typeof SITES[0]) => {
    const url = query.trim() ? site.searchUrl(query.trim()) : site.url;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openAll = () => {
    SITES.forEach((site) => open(site));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white px-4 py-12">
      <div className="max-w-3xl mx-auto">

        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> กลับหน้าหลัก
        </Link>

        {/* Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-yellow-500/20 border border-yellow-500/30 rounded-2xl mb-4">
            <ShieldCheck className="w-7 h-7 text-yellow-400" />
          </div>
          <h1 className="text-3xl font-bold mb-3">เช็คคนโกง</h1>

          {/* Slogan */}
          <div className="inline-block bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-2xl px-6 py-3 mb-6">
            <p className="text-yellow-300 font-semibold text-base sm:text-lg">
              ⏱ เสียเวลาสักนิด &nbsp;•&nbsp; 🛡 ปลอดภัยมั่นใจ &nbsp;•&nbsp; 📉 ความเสี่ยงน้อยลง
            </p>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex gap-2 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ชื่อ-สกุล, เลขบัญชี หรือเบอร์โทรศัพท์..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all placeholder-gray-500"
            />
          </div>
          <button
            onClick={openAll}
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold px-5 py-3 rounded-xl text-sm transition-all whitespace-nowrap"
          >
            เช็คทุกเว็บ
          </button>
        </div>

        {/* Site cards */}
        <div className="space-y-4">
          {SITES.map((site) => (
            <div
              key={site.id}
              className={`bg-gradient-to-r ${site.gradient} border ${site.border} rounded-2xl overflow-hidden`}
            >
              {/* Banner */}
              <div className="px-6 pt-5 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{site.icon}</span>
                      <h2 className="text-xl font-bold">{site.name}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${site.badge} font-medium`}>
                        {site.tag}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{site.slogan}</p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10 mx-6" />

              {/* Action */}
              <div className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                  {query.trim()
                    ? <span>จะเปิดค้นหา <strong className="text-white">"{query}"</strong></span>
                    : <span>กรอกข้อมูลด้านบนเพื่อค้นหาตรงจุด</span>
                  }
                </div>
                <button
                  onClick={() => open(site)}
                  className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
                >
                  เปิดเว็บไซต์ <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-500 mt-8">
          ระบบเปิดเว็บไซต์ภายนอกในแท็บใหม่ • หากพบประวัติน่าสงสัย <span className="text-yellow-400">ไม่ควรโอนเงิน</span>
        </p>
      </div>
    </div>
  );
}
