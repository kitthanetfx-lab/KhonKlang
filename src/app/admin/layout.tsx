'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { account, clearPersistedSession } from '@/lib/appwrite';
import {
  LayoutDashboard, Store, Shield, Users, Settings,
  LogOut, Menu, ChevronRight, Bell, ShieldAlert, Handshake, EyeOff, MapPin,
} from 'lucide-react';

const NAV = [
  { href: '/admin',             icon: LayoutDashboard, label: 'ภาพรวม' },
  { href: '/admin/sellers',     icon: Store,           label: 'ผู้ขาย' },
  { href: '/admin/middlemen',   icon: Shield,          label: 'คนกลาง' },
  { href: '/admin/scam-reports',icon: ShieldAlert,     label: 'รายงานคนโกง' },
  { href: '/admin/deals',       icon: Handshake,       label: 'ดีล & ข้อพิพาท' },
  { href: '/admin/onsite-jobs', icon: MapPin,          label: 'งานนัดออนไซต์' },
  { href: '/admin/moderate',    icon: EyeOff,          label: 'ตรวจสอบเนื้อหา' },
  { href: '/admin/users',       icon: Users,           label: 'ผู้ใช้ทั้งหมด' },
  { href: '/admin/settings',    icon: Settings,        label: 'ตั้งค่า' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [adminName, setAdminName] = useState('');
  const [checking, setChecking]   = useState(() => pathname !== '/admin/setup');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (pathname === '/admin/setup') return;
    account.get()
      .then(u => {
        const prefs = (u.prefs as Record<string, string>) || {};
        if (prefs.role !== 'admin') { router.replace('/admin/setup'); return; }
        setAdminName(u.name || 'Admin');
        setChecking(false);
      })
      .catch(() => router.replace('/login'));
  }, [router, pathname]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-400 animate-pulse text-sm">กำลังตรวจสอบสิทธิ์...</p>
      </div>
    );
  }

  const activeHref = NAV.slice(1).find(n => pathname.startsWith(n.href))?.href ?? '/admin';
  const activeLabel = NAV.find(n => n.href === activeHref)?.label ?? 'ภาพรวม';

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-56 flex flex-col
        bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="h-14 flex items-center px-5 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <span className="font-bold text-base tracking-tight">🛡️ คนกลาง Admin</span>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(n => {
            const isActive = n.href === '/admin' ? pathname === '/admin' : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
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
              <p className="text-sm font-medium truncate">{adminName}</p>
              <p className="text-xs text-gray-400">Admin</p>
            </div>
            <button
              onClick={async () => {
                try {
                  await account.deleteSession('current');
                } catch {
                  // Continue clearing local auth state even if the remote session is gone.
                } finally {
                  clearPersistedSession();
                  router.push('/login');
                }
              }}
              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
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

          <nav className="flex items-center gap-1.5 text-sm min-w-0">
            <Link href="/admin" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors shrink-0">
              Admin
            </Link>
            {pathname !== '/admin' && (
              <>
                <ChevronRight size={14} className="text-gray-300 shrink-0" />
                <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{activeLabel}</span>
              </>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/" target="_blank"
              className="text-xs text-gray-400 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
              ดูหน้าเว็บ ↗
            </Link>
            <button className="relative p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="การแจ้งเตือน">
              <Bell size={18} className="text-gray-400" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
