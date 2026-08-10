'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { authHeaders } from '@/lib/supabase';
import { Search, Users, RefreshCw, MoreVertical } from 'lucide-react';
import { AdminUsersApp } from '@/components/admin/mobile/AdminUsersApp';

interface AppUser {
  id: string;
  display_name: string;
  first_name?: string;
  email: string;
  active: boolean; // true = active, false = blocked
  created_at: string;
  role?: string;
  phone?: string;
  seller_status?: string;
  middleman_status?: string;
}

const ROLE_CFG: Record<string, { label: string; cls: string }> = {
  admin:    { label: 'Admin',    cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  seller:   { label: 'ผู้ขาย',   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  middleman:{ label: 'คนกลาง',  cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  user:     { label: 'ผู้ใช้ทั่วไป', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

// ผู้ใช้คนเดียวอาจเป็นได้หลายอย่างพร้อมกัน (เช่น admin ที่สมัครเป็นผู้ขาย+คนกลางด้วยเพื่อทดสอบ)
// เดิมหน้านี้ดูแค่ profiles.role (ค่าเดียว) ทำให้นับ/แสดงไม่ตรงกับหน้า admin/sellers, admin/middlemen
// ที่ดูจาก seller_status/middleman_status — เปลี่ยนมาคำนวณ badge ทั้งหมดจากสถานะอนุมัติจริงแทน
function userBadgeKeys(u: AppUser): string[] {
  const keys: string[] = [];
  if ((u.role || 'user') === 'admin') keys.push('admin');
  if (u.seller_status === 'approved') keys.push('seller');
  if (u.middleman_status === 'approved') keys.push('middleman');
  if (keys.length === 0) keys.push('user');
  return keys;
}

function RoleBadges({ user }: { user: AppUser }) {
  return (
    <div className="flex flex-wrap gap-1">
      {userBadgeKeys(user).map(k => {
        const c = ROLE_CFG[k] ?? ROLE_CFG.user;
        return <span key={k} className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${c.cls}`}>{c.label}</span>;
      })}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

// Action menu component
function ActionMenu({ user, onRefresh }: { user: AppUser; onRefresh: () => void }) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  const call = async (body: object) => {
    setLoading(true); setOpen(false); setErr('');
    const headers = await authHeaders();
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || `Error ${res.status}`);
    }
    setLoading(false);
    onRefresh();
  };

  const setRole = (role: string) =>
    call({ userId: user.id, action: 'set_role', role });

  const toggleBlock = () =>
    call({ userId: user.id, action: user.active ? 'block' : 'unblock' });

  const deleteAccount = () => {
    const name = user.display_name || user.first_name || user.email || 'บัญชีนี้';
    const ok = window.confirm(
      `ลบบัญชี "${name}" ถาวร?\n\n` +
      `• ข้อมูลส่วนตัว (ชื่อ เบอร์ ที่อยู่ บัญชีธนาคาร), ประกาศหาสินค้า, ข้อความส่วนตัว, ` +
      `ใบสมัครผู้ขาย/คนกลาง, การแจ้งเตือน และประวัติแชทซัพพอร์ต จะถูกลบทั้งหมด\n` +
      `• ดีล, งานนัดออนไซต์, ประวัติการเงิน และรีวิวที่เคยได้รับ จะยังอยู่ครบ (แสดงชื่อ ณ ขณะนั้น)\n` +
      `• อีเมล/LINE/Google นี้จะสมัครสมาชิกใหม่ได้อีกในฐานะบัญชีใหม่\n\n` +
      `การลบนี้ย้อนกลับไม่ได้ ยืนยันหรือไม่?`
    );
    if (!ok) return;
    call({ userId: user.id, action: 'delete_account' });
  };

  const currentRole = user.role || 'user';

  return (
    <div className="relative">
      {err && (
        <p className="absolute right-8 top-0 text-xs text-red-500 whitespace-nowrap bg-white dark:bg-gray-900 px-2 py-1 rounded shadow z-30">
          {err}
        </p>
      )}
      <button onClick={() => setOpen(o => !o)} disabled={loading}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
        {loading ? (
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : <MoreVertical size={16} />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-400 font-medium">เปลี่ยน Role เป็น</p>
            </div>
            {(['user', 'seller', 'middleman', 'admin'] as const).map(r => (
              <button key={r} onClick={() => setRole(r)}
                disabled={currentRole === r}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                  ${currentRole === r
                    ? 'text-gray-300 dark:text-gray-600 cursor-default'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                {ROLE_CFG[r]?.label ?? r}
                {currentRole === r && ' (ปัจจุบัน)'}
              </button>
            ))}
            <div className="border-t border-gray-100 dark:border-gray-700">
              <button onClick={toggleBlock}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                  ${user.active
                    ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
                {user.active ? '🚫 ระงับบัญชี' : '✅ ยกเลิกการระงับ'}
              </button>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700">
              <button onClick={deleteAccount}
                disabled={currentRole === 'admin'}
                title={currentRole === 'admin' ? 'เปลี่ยน role ออกจาก Admin ก่อนถึงจะลบได้' : undefined}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                  ${currentRole === 'admin'
                    ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    : 'text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium'}`}>
                🗑️ ลบบัญชีนี้
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UsersContent() {
  const [users, setUsers]     = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [total, setTotal]     = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res  = await fetch('/api/admin/users', { headers });
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = users.filter(u => {
    const name  = (u.display_name || u.first_name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const q     = search.toLowerCase();
    if (search && !name.includes(q) && !email.includes(q)) return false;
    if (roleFilter && !userBadgeKeys(u).includes(roleFilter)) return false;
    return true;
  });

  const roleCounts = Object.fromEntries(
    Object.keys(ROLE_CFG).map(k => [k, users.filter(u => userBadgeKeys(u).includes(k)).length]),
  );

  const desktopView = (
    <div className="space-y-5 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Users size={20} /> ผู้ใช้ทั้งหมด</h1>
          <p className="text-sm text-gray-500 mt-0.5">รวม {total.toLocaleString()} บัญชี</p>
        </div>
        <button onClick={() => load()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
          <RefreshCw size={15} /> รีเฟรช
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="pl-9 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 w-64"
            placeholder="ค้นหาชื่อหรืออีเมล..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900"
          value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">ทุก Role</option>
          <option value="admin">Admin</option>
          <option value="seller">ผู้ขาย</option>
          <option value="middleman">คนกลาง</option>
          <option value="user">ผู้ใช้ทั่วไป</option>
        </select>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(ROLE_CFG).map(([key, cfg]) => {
          const count = users.filter(u => userBadgeKeys(u).includes(key)).length;
          return (
            <button key={key} onClick={() => setRoleFilter(roleFilter === key ? '' : key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition-all
                ${roleFilter === key ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-blue-300'}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.cls.includes('purple') ? 'bg-purple-500' : cfg.cls.includes('blue') ? 'bg-blue-500' : cfg.cls.includes('green') ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span>{cfg.label}</span>
              <span className="font-bold text-gray-700 dark:text-gray-300">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">ชื่อ</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">อีเมล</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">สถานะ</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">สมัครเมื่อ</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">ไม่มีข้อมูล</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold shrink-0">
                        {(u.display_name || u.email || '?')[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.display_name || u.first_name || '—'}</p>
                        {u.phone && <p className="text-xs text-gray-400 mt-0.5">{u.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-600 dark:text-gray-400 text-xs">
                    {u.email?.includes('@line.khonklang.app') ? (
                      <span className="text-gray-400 italic">LINE ({u.id.slice(0, 12)}...)</span>
                    ) : u.email || '—'}
                  </td>
                  <td className="px-4 py-3.5"><RoleBadges user={u} /></td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                      ${u.active
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {u.active ? '● ใช้งานได้' : '● ระงับ'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500 text-xs whitespace-nowrap">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3.5 text-right">
                    <ActionMenu user={u} onRefresh={() => load()} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
          แสดง {filtered.length} จาก {users.length} รายการ (ทั้งหมดในระบบ {total})
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="admin-mobile-only">
        <AdminUsersApp
          users={users}
          filtered={filtered}
          total={total}
          loading={loading}
          search={search}
          onSearch={setSearch}
          roleFilter={roleFilter}
          onRoleFilter={setRoleFilter}
          roleCounts={roleCounts}
          onRefresh={() => void load()}
          renderActions={u => <ActionMenu user={u} onRefresh={() => void load()} />}
          badgeFor={u => userBadgeKeys(u).map(k => ROLE_CFG[k] ?? ROLE_CFG.user)}
        />
      </div>
      <div className="admin-desktop-only">{desktopView}</div>
    </>
  );
}

export default function UsersPage() {
  return <Suspense><UsersContent /></Suspense>;
}
