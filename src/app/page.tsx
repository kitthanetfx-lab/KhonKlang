'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/useUser';
import {
  ShieldCheck,
  Users,
  Search,
  Menu,
  X,
  ChevronDown,
  ArrowRight,
  Star,
  Lock,
  Truck,
  Store,
  HandshakeIcon,
} from 'lucide-react';

const services = [
  {
    icon: <HandshakeIcon className="w-7 h-7 text-blue-500" />,
    title: 'ซื้อขายผ่านกลาง',
    desc: 'ให้คนกลางดูแลการโอนเงินและส่งสินค้า ปลอดภัยทั้งผู้ซื้อและผู้ขาย',
    href: '/service/trade',
  },
  {
    icon: <Truck className="w-7 h-7 text-green-500" />,
    title: 'นัดรับผ่านกลาง',
    desc: 'คนกลางช่วยนัดหมายสถานที่รับสินค้าที่ปลอดภัย ไม่ต้องเจอกันแบบเสี่ยง',
    href: '/service/meetup',
  },
  {
    icon: <Store className="w-7 h-7 text-purple-500" />,
    title: 'ฝากขายผ่านกลาง',
    desc: 'ฝากสินค้าให้คนกลางดูแลและขายให้ ไม่ต้องกังวลเรื่องการโกง',
    href: '/service/consign',
  },
];

const stats = [
  { value: '10,000+', label: 'ธุรกรรมที่ปลอดภัย' },
  { value: '500+', label: 'คนกลางที่ผ่านการรับรอง' },
  { value: '99%', label: 'ความพึงพอใจ' },
];

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  seller:     { label: 'ผู้ขาย',     color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  middleman:  { label: 'คนกลาง',    color: 'bg-green-500/20 text-green-300 border-green-500/40' },
  user:       { label: 'ผู้ใช้งาน', color: 'bg-gray-500/20 text-gray-300 border-gray-500/40' },
};

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, loading, logout } = useUser();

  const role = user?.prefs?.role || 'user';
  const roleInfo = ROLE_LABEL[role] ?? ROLE_LABEL.user;
  const displayName = user?.prefs?.displayName || user?.name || 'ผู้ใช้งาน';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-wide">คนกลาง</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {/* สมัคร dropdown */}
              <div className="relative" onMouseEnter={() => setRegisterOpen(true)} onMouseLeave={() => setRegisterOpen(false)}>
                <button className="flex items-center gap-1 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium">
                  สมัคร <ChevronDown className="w-4 h-4" />
                </button>
                {registerOpen && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden">
                    <Link href="/register" className="flex items-center gap-2 px-4 py-3 hover:bg-white/10 transition-colors text-sm">
                      <Users className="w-4 h-4 text-blue-400" /> สมัครเป็นผู้ขายกลุ่มในเครือ
                    </Link>
                    <Link href="/register-middleman" className="flex items-center gap-2 px-4 py-3 hover:bg-white/10 transition-colors text-sm">
                      <HandshakeIcon className="w-4 h-4 text-green-400" /> สมัครเป็นคนกลาง
                    </Link>
                  </div>
                )}
              </div>

              {/* บริการ dropdown */}
              <div className="relative" onMouseEnter={() => setServiceOpen(true)} onMouseLeave={() => setServiceOpen(false)}>
                <button className="flex items-center gap-1 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium">
                  บริการผ่านคนกลาง <ChevronDown className="w-4 h-4" />
                </button>
                {serviceOpen && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden">
                    {services.map((s) => (
                      <Link key={s.title} href={s.href} className="flex items-center gap-2 px-4 py-3 hover:bg-white/10 transition-colors text-sm">
                        {s.icon} {s.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link href="/check-scam" className="flex items-center gap-1 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium">
                <Search className="w-4 h-4" /> เช็คคนโกง
              </Link>
            </div>

            {/* Login / Profile button */}
            <div className="hidden md:block">
              {loading ? (
                <div className="w-20 h-8 bg-white/10 rounded-xl animate-pulse" />
              ) : user ? (
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-xl transition-all"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                      {initials}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-medium leading-none">{displayName}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    </div>
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  </button>
                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-44 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden">
                      <Link href="/register?role=seller" className="block px-4 py-2.5 text-sm hover:bg-white/10 transition-colors" onClick={() => setProfileOpen(false)}>
                        สมัครเป็นผู้ขาย
                      </Link>
                      <Link href="/register?role=middleman" className="block px-4 py-2.5 text-sm hover:bg-white/10 transition-colors" onClick={() => setProfileOpen(false)}>
                        สมัครเป็นคนกลาง
                      </Link>
                      <hr className="border-white/10" />
                      <button onClick={logout} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/10 transition-colors">
                        ออกจากระบบ
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link href="/login" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-blue-500/30">
                  เข้าสู่ระบบ
                </Link>
              )}
            </div>

            {/* Mobile hamburger */}
            <button className="md:hidden p-2 rounded-lg hover:bg-white/10" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-slate-900 border-t border-white/10 px-4 py-4 space-y-1">
            <p className="text-xs text-gray-400 uppercase px-3 mb-2">สมัคร</p>
            <Link href="/register" className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/10 text-sm" onClick={() => setMobileOpen(false)}>
              <Users className="w-4 h-4 text-blue-400" /> สมัครเป็นผู้ขายกลุ่มในเครือ
            </Link>
            <Link href="/register-middleman" className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/10 text-sm" onClick={() => setMobileOpen(false)}>
              <HandshakeIcon className="w-4 h-4 text-green-400" /> สมัครเป็นคนกลาง
            </Link>
            <hr className="border-white/10 my-2" />
            <p className="text-xs text-gray-400 uppercase px-3 mb-2">บริการ</p>
            {services.map((s) => (
              <Link key={s.title} href={s.href} className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/10 text-sm" onClick={() => setMobileOpen(false)}>
                {s.icon} {s.title}
              </Link>
            ))}
            <hr className="border-white/10 my-2" />
            <Link href="/check-scam" className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/10 text-sm" onClick={() => setMobileOpen(false)}>
              <Search className="w-4 h-4 text-yellow-400" /> เช็คคนโกง
            </Link>
            <hr className="border-white/10 my-2" />
            <Link href="/login" className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all" onClick={() => setMobileOpen(false)}>
              เข้าสู่ระบบ
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
          <div className="absolute bottom-10 right-1/4 w-72 h-72 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-900/50 border border-blue-500/30 rounded-full px-4 py-1.5 text-sm text-blue-300 mb-6">
            <Star className="w-4 h-4" /> ซื้อขายปลอดภัย ไร้กังวล
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            ซื้อขายออนไลน์<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-green-400">
              ผ่านคนกลางที่เชื่อถือได้
            </span>
          </h1>
          <p className="text-lg text-gray-300 mb-10 max-w-xl mx-auto leading-relaxed">
            แพลตฟอร์มที่ช่วยให้การซื้อขายออนไลน์ปลอดภัย ด้วยระบบคนกลางที่ผ่านการรับรอง ป้องกันการโกงทุกรูปแบบ
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-7 py-3.5 rounded-xl font-semibold transition-all shadow-lg hover:shadow-blue-500/30 active:scale-[0.98]">
              เริ่มต้นใช้งาน <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/check-scam" className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-7 py-3.5 rounded-xl font-semibold transition-all active:scale-[0.98]">
              <Search className="w-4 h-4" /> เช็คคนโกง
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 border-y border-white/10 bg-white/5">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-3 gap-4 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-2xl sm:text-3xl font-bold text-blue-400">{s.value}</p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">บริการผ่านคนกลาง</h2>
            <p className="text-gray-400">เลือกบริการที่เหมาะกับการซื้อขายของคุณ</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {services.map((s) => (
              <Link key={s.title} href={s.href} className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/40 rounded-2xl p-6 transition-all hover:-translate-y-1">
                <div className="bg-slate-800 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {s.icon}
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Register CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-400 rounded-full opacity-20 blur-2xl" />
            <Users className="w-8 h-8 mb-4 text-blue-200" />
            <h3 className="text-xl font-bold mb-2">สมัครเป็นผู้ขาย</h3>
            <p className="text-blue-200 text-sm mb-5">เข้าร่วมเครือข่ายผู้ขายที่ได้รับการรับรอง เพิ่มความน่าเชื่อถือให้สินค้าของคุณ</p>
            <Link href="/register" className="inline-flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors">
              สมัครเลย <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="bg-gradient-to-br from-green-600 to-emerald-800 rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-400 rounded-full opacity-20 blur-2xl" />
            <HandshakeIcon className="w-8 h-8 mb-4 text-green-200" />
            <h3 className="text-xl font-bold mb-2">สมัครเป็นคนกลาง</h3>
            <p className="text-green-200 text-sm mb-5">สร้างรายได้จากการเป็นคนกลางที่ได้รับความไว้วางใจจากผู้ซื้อและผู้ขาย</p>
            <Link href="/register-middleman" className="inline-flex items-center gap-2 bg-white text-green-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-50 transition-colors">
              สมัครเลย <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Check Scam */}
      <section className="py-16 px-4 bg-yellow-500/10 border-y border-yellow-500/20">
        <div className="max-w-2xl mx-auto text-center">
          <Search className="w-10 h-10 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">เช็คคนโกง</h2>
          <p className="text-gray-300 mb-6">ตรวจสอบประวัติและความน่าเชื่อถือของผู้ขายก่อนทำธุรกรรม ด้วยระบบ blacklist ของเรา</p>
          <Link href="/check-scam" className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-3 rounded-xl font-semibold transition-all">
            ตรวจสอบเลย <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10 text-center text-sm text-gray-500">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-blue-400" />
          <span className="text-gray-300 font-medium">คนกลาง — ซื้อขายมั่นใจ ไร้กังวล</span>
        </div>
        <p>© 2568 Khonklang. All rights reserved.</p>
      </footer>
    </div>
  );
}
