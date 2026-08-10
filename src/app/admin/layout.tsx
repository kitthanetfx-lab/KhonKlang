'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase, authHeaders } from '@/lib/supabase';
import { useAppPreferences } from '@/components/AppPreferences';
import {
  LayoutDashboard, Store, Shield, Users, Settings, SlidersHorizontal,
  LogOut, Menu, ChevronRight, Bell, ShieldAlert, Handshake, EyeOff, Wallet, MessageCircle, Banknote,
} from 'lucide-react';

function getAdminNav(locale: 'th' | 'en') {
  return locale === 'th'
    ? [
        { href: '/admin', icon: LayoutDashboard, label: 'ภาพรวม' },
        { href: '/admin/support', icon: MessageCircle, label: 'แชทลูกค้า' },
        { href: '/admin/sellers', icon: Store, label: 'ผู้ขาย' },
        { href: '/admin/middlemen', icon: Shield, label: 'คนกลาง' },
        { href: '/admin/middleman-deposits', icon: Banknote, label: 'เงินค้ำประกันคนกลาง' },
        { href: '/admin/scam-reports', icon: ShieldAlert, label: 'รายงานคนโกง' },
        { href: '/admin/finance', icon: Wallet, label: 'การเงิน' },
        { href: '/admin/deals', icon: Handshake, label: 'ดีล & ข้อพิพาท' },
        { href: '/admin/moderate', icon: EyeOff, label: 'ตรวจสอบเนื้อหา' },
        { href: '/admin/users', icon: Users, label: 'ผู้ใช้ทั้งหมด' },
        { href: '/admin/service-controls', icon: SlidersHorizontal, label: 'ควบคุมบริการ' },
        { href: '/admin/settings', icon: Settings, label: 'ค่าธรรมเนียม' },
      ]
    : [
        { href: '/admin', icon: LayoutDashboard, label: 'Overview' },
        { href: '/admin/support', icon: MessageCircle, label: 'Customer Chat' },
        { href: '/admin/sellers', icon: Store, label: 'Sellers' },
        { href: '/admin/middlemen', icon: Shield, label: 'Middlemen' },
        { href: '/admin/middleman-deposits', icon: Banknote, label: 'Middleman Deposits' },
        { href: '/admin/scam-reports', icon: ShieldAlert, label: 'Scam Reports' },
        { href: '/admin/finance', icon: Wallet, label: 'Finance' },
        { href: '/admin/deals', icon: Handshake, label: 'Deals & Disputes' },
        { href: '/admin/moderate', icon: EyeOff, label: 'Moderation' },
        { href: '/admin/users', icon: Users, label: 'Users' },
        { href: '/admin/service-controls', icon: SlidersHorizontal, label: 'Service Controls' },
        { href: '/admin/settings', icon: Settings, label: 'Fees' },
      ];
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { locale } = useAppPreferences();
  const NAV = getAdminNav(locale);
  const router   = useRouter();
  const pathname = usePathname();
  const [adminName, setAdminName] = useState('');
  const [checking, setChecking]   = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ชั้นความปลอดภัยที่ 2 — ต้องกรอกรหัสผ่านหน้าแอดมินทุกครั้งที่เข้ามาใหม่ (ไม่เก็บสถานะไว้ที่ไหน
  // รีเฟรชหรือกลับเข้ามาใหม่ต้องกรอกอีก) นอกเหนือจากล็อกอิน + role admin ตามปกติ
  const [pwVerified, setPwVerified] = useState(false);
  const [pwInput, setPwInput]       = useState('');
  const [pwChecking, setPwChecking] = useState(false);
  const [pwError, setPwError]       = useState('');

  async function submitAdminPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwChecking(true); setPwError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwInput }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setPwError(d.error || 'รหัสผ่านไม่ถูกต้อง'); return; }
      setPwVerified(true);
    } catch {
      setPwError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setPwChecking(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/login'); return; }
        const { data: profile } = await supabase.from('profiles').select('role, display_name').eq('id', user.id).maybeSingle();
        if (profile?.role !== 'admin') { router.replace('/'); return; }
        setAdminName(profile.display_name || 'Admin');
        setChecking(false);
      } catch {
        router.replace('/login');
      }
    })();
  }, [router, pathname]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-500 animate-pulse text-base font-medium">{locale === 'th' ? 'กำลังตรวจสอบสิทธิ์...' : 'Checking access...'}</p>
      </div>
    );
  }

  if (!pwVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <form onSubmit={submitAdminPassword}
          className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="text-center space-y-1">
            <div className="text-3xl">🔒</div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              {locale === 'th' ? 'ยืนยันรหัสผ่านแอดมิน' : 'Admin password required'}
            </h1>
            <p className="text-sm text-gray-500">
              {locale === 'th' ? 'กรอกรหัสผ่านชั้นที่ 2 เพื่อเข้าหน้าแอดมิน' : 'Enter the second-factor password to continue'}
            </p>
          </div>
          <input
            type="password"
            autoFocus
            value={pwInput}
            onChange={e => setPwInput(e.target.value)}
            placeholder={locale === 'th' ? 'รหัสผ่านแอดมิน' : 'Admin password'}
            className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-950"
          />
          {pwError && <p className="text-sm text-red-500 text-center">{pwError}</p>}
          <button type="submit" disabled={pwChecking || !pwInput}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {pwChecking ? (locale === 'th' ? 'กำลังตรวจสอบ...' : 'Checking...') : (locale === 'th' ? 'เข้าสู่ระบบแอดมิน' : 'Continue')}
          </button>
        </form>
      </div>
    );
  }

  const activeHref = NAV.slice(1).find(n => pathname.startsWith(n.href))?.href ?? '/admin';
  const activeLabel = NAV.find(n => n.href === activeHref)?.label ?? (locale === 'th' ? 'ภาพรวม' : 'Overview');

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-60 flex flex-col
        bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="h-14 flex items-center px-5 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-white">🛡️ {locale === 'th' ? 'คนกลาง Admin' : 'Glanghub Admin'}</span>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(n => {
            const isActive = n.href === '/admin' ? pathname === '/admin' : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] font-semibold tracking-[-0.01em] transition-all
                  ${isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                  }`}>
                <n.icon className="w-4.5 h-4.5 shrink-0" size={18} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {adminName[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-gray-900 dark:text-white truncate">{adminName}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Admin</p>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut().catch(() => {
                  // Continue even if the remote session is already gone.
                });
                router.push('/login');
              }}
              className="p-1.5 text-gray-500 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        <header className="h-14 shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-3">
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>

          <nav className="flex items-center gap-1.5 text-[15px] min-w-0">
            <Link href="/admin" className="text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors shrink-0 font-medium">
              {locale === 'th' ? 'Admin' : 'Admin'}
            </Link>
            {pathname !== '/admin' && (
              <>
                <ChevronRight size={14} className="text-gray-300 shrink-0" />
                <span className="font-semibold text-gray-900 dark:text-white truncate">{activeLabel}</span>
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/" target="_blank"
              className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
              {locale === 'th' ? 'ดูหน้าเว็บ ↗' : 'Open Website ↗'}
            </Link>
            <button className="relative p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label={locale === 'th' ? 'การแจ้งเตือน' : 'Notifications'}>
              <Bell size={18} className="text-gray-500" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-5 md:p-6 xl:p-8 admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}
